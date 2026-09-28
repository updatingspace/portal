"""Exercise Access bootstrap and authorization against a disposable local YDB."""

from __future__ import annotations

import json
import os
from datetime import timedelta
from io import StringIO
from unittest.mock import patch
from urllib.parse import urlparse
from uuid import uuid4

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
django.setup()

from django.conf import settings
from django.core.management import call_command
from django.db import connections
from django.test import Client
from django.utils import timezone

from access_control.bootstrap import SeedResult, seed_access_defaults
from access_control.models import (
    Permission,
    PolicyOverride,
    Role,
    RoleBinding,
    RolePermission,
)
from access_control.permissions_mvp import (
    DEFAULT_MEMBER_ROLE_PERMISSIONS,
    MVP_PERMISSIONS,
)
from access_control.services import MasterFlags, compute_effective_access
from access_control.tests.test_api import _build_headers


def main() -> None:
    if (
        settings.DB_DRIVER != "ydb"
        or urlparse(os.environ.get("YDB_ENDPOINT", "")).hostname
        not in {"localhost", "127.0.0.1"}
        or os.environ.get("YDB_DATABASE") != "/local"
    ):
        raise SystemExit(
            "Access runtime checks require a disposable local /local YDB database"
        )

    # Start without the data migrations that normally populate SQL databases.
    RoleBinding.objects.all().delete()
    PolicyOverride.objects.all().delete()
    RolePermission.objects.all().delete()
    Role.objects.all().delete()
    Permission.objects.all().delete()
    output = StringIO()
    call_command("seed_access_defaults", dry_run=True, stdout=output)
    assert Permission.objects.count() == 0 and Role.objects.count() == 0
    # Simulate interruption after permissions and a nullable global role were inserted.
    with patch.object(
        RolePermission.objects, "get_or_create", side_effect=RuntimeError("interrupted")
    ):
        try:
            seed_access_defaults()
        except RuntimeError:
            pass
        else:
            raise AssertionError("Failure injection did not run")
    assert Permission.objects.count() == 0 and Role.objects.count() == 0, (
        "Seed writes escaped rollback"
    )

    # The actual production bootstrap entrypoint must install baseline data too.
    call_command("migrate_ydb", stdout=output)
    assert Permission.objects.count() == len(MVP_PERMISSIONS)
    assert Role.objects.count() == len(DEFAULT_MEMBER_ROLE_PERMISSIONS)
    assert seed_access_defaults() == SeedResult()
    assert RoleBinding.objects.count() == 0

    user, tenant, other = uuid4(), uuid4(), uuid4()

    def decision(tenant_id, key="portal.profile.read_self", **flags):
        return compute_effective_access(
            tenant_id=tenant_id,
            user_id=user,
            permission_key=key,
            scope_type="TENANT",
            scope_id=str(tenant_id),
            master_flags=MasterFlags(**flags),
        )

    assert decision(tenant).allowed and decision(other).allowed
    assert not decision(tenant, "portal.roles.write").allowed
    assert not decision(tenant, suspended=True).allowed
    assert not decision(tenant, banned=True).allowed
    restricted = Role.objects.create(tenant_id=tenant, service="portal", name="member")
    assert not decision(tenant).allowed and decision(other).allowed
    assert seed_access_defaults() == SeedResult()
    assert RolePermission.objects.filter(role=restricted).count() == 0
    assert not decision(tenant).allowed and decision(other).allowed

    role = Role.objects.create(tenant_id=tenant, service="portal", name="editor")
    RolePermission.objects.create(role=role, permission_id="portal.roles.write")
    RoleBinding.objects.create(
        tenant_id=tenant,
        user_id=user,
        role=role,
        scope_type="TENANT",
        scope_id=str(tenant),
    )
    assert decision(tenant, "portal.roles.write").allowed
    assert not decision(other, "portal.roles.write").allowed
    override = PolicyOverride.objects.create(
        tenant_id=tenant,
        user_id=user,
        action="deny",
        permission_id="portal.roles.write",
        expires_at=timezone.now() + timedelta(hours=1),
        reason="local-only regression",
    )
    assert not decision(tenant, "portal.roles.write").allowed
    override.expires_at = timezone.now() - timedelta(hours=1)
    override.save(update_fields=["expires_at"])
    assert decision(tenant, "portal.roles.write").allowed
    assert not decision(tenant, "portal.roles.write", banned=True).allowed

    client = Client()
    path = "/api/v1/access/check"
    for payload_tenant, context_tenant, status, allowed in [
        (other, other, 200, True),
        (tenant, tenant, 200, False),
        (other, tenant, 400, None),
    ]:
        body = json.dumps(
            {
                "tenant_id": str(payload_tenant),
                "user_id": str(user),
                "action": "portal.profile.read_self",
                "scope": {"type": "TENANT", "id": str(payload_tenant)},
                "master_flags": {},
            }
        ).encode()
        headers = _build_headers(
            method="POST",
            path=path,
            body=body,
            request_id=str(uuid4()),
            tenant_id=str(context_tenant),
            tenant_slug="local-test",
            user_id=str(user),
            master_flags={},
        )
        response = client.post(
            path, body, content_type="application/json", secure=True, **headers
        )
        assert response.status_code == status, response.content[:300]
        if allowed is not None:
            assert response.json()["allowed"] is allowed
        else:
            assert response.json()["error"]["code"] == "TENANT_MISMATCH"

    path = "/api/v1/access/permissions"
    headers = _build_headers(
        method="GET",
        path=path,
        body=b"",
        request_id=str(uuid4()),
        tenant_id=str(other),
        tenant_slug="local-test",
        user_id=str(user),
        master_flags={},
    )
    response = client.get(path, secure=True, **headers)
    assert response.status_code == 200 and len(response.json()) == len(MVP_PERMISSIONS)
    connections.close_all()
    print(
        "YDB Access: dry-run, bootstrap, repeat, rollback, nullable roles, FK bindings, tenant isolation, expiry, master denials and signed API contracts passed"
    )


if __name__ == "__main__":
    main()
