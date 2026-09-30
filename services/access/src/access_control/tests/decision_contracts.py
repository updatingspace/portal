"""Stateful authorization contracts shared by SQLite and the real YDB checks."""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from access_control.models import (
    Permission,
    PolicyOverride,
    Role,
    RoleBinding,
    RolePermission,
)
from access_control.services import CheckDecision, MasterFlags


def exercise_decision_contracts(compute: Callable[..., CheckDecision]) -> int:
    tenant, other, user, other_user = uuid4(), uuid4(), uuid4(), uuid4()
    read_key = "portal.profile.read_self"
    key = f"portal.contract.'quoted-право-{uuid4().hex}"
    Permission.objects.create(key=key, service="portal")
    role = Role.objects.create(
        tenant_id=tenant, name="contract-editor", service="portal"
    )
    RolePermission.objects.create(role=role, permission_id=key)
    checks = 0

    def check(allowed: bool, reason: str, **kwargs) -> CheckDecision:
        nonlocal checks
        args = {
            "tenant_id": tenant,
            "user_id": user,
            "permission_key": key,
            "scope_type": "TEAM",
            "scope_id": "team-'quoted-α",
            "master_flags": MasterFlags(),
            "return_effective_permissions": True,
        }
        args.update(kwargs)
        decision = compute(**args)
        assert (decision.allowed, decision.reason_code) == (allowed, reason), (
            args,
            decision,
        )
        checks += 1
        return decision

    check(False, "RBAC_DENY")
    check(True, "RBAC_ALLOW", permission_key=read_key)
    check(False, "UNKNOWN_PERMISSION", permission_key="missing.permission")
    check(
        False,
        "UNKNOWN_PERMISSION",
        permission_key="missing.permission",
        master_flags=MasterFlags(system_admin=True),
    )
    check(
        False,
        "UNKNOWN_PERMISSION",
        permission_key="missing.permission",
        master_flags=MasterFlags(suspended=True),
    )
    check(
        False,
        "MASTER_SUSPENDED",
        master_flags=MasterFlags(suspended=True, system_admin=True),
    )
    check(False, "MASTER_SUSPENDED", master_flags=MasterFlags(banned=True))
    admin = check(
        True, "MASTER_SYSTEM_ADMIN", master_flags=MasterFlags(system_admin=True)
    )
    assert admin.permissions == [key] and admin.roles == []

    service = f"contract-{uuid4().hex[:8]}"
    isolated_key = f"{service}.read"
    Permission.objects.create(key=isolated_key, service=service)
    check(False, "NO_ROLE", permission_key=isolated_key)
    template = Role.objects.create(tenant_id=None, name="member", service=service)
    RolePermission.objects.create(role=template, permission_id=isolated_key)
    check(False, "NO_ROLE", permission_key=isolated_key)
    template.is_system_template = True
    template.save(update_fields=["is_system_template"])
    check(True, "RBAC_ALLOW", permission_key=isolated_key)
    local = Role.objects.create(tenant_id=tenant, name="member", service=service)
    check(False, "RBAC_DENY", permission_key=isolated_key)
    check(True, "RBAC_ALLOW", permission_key=isolated_key, tenant_id=other)
    local.delete()
    template.delete()
    check(False, "NO_ROLE", permission_key=isolated_key)

    def bind(scope_type, scope_id, **extra):
        params = {
            "tenant_id": tenant,
            "user_id": user,
            "role": role,
            "scope_type": scope_type,
            "scope_id": scope_id,
        }
        params.update(extra)
        return RoleBinding.objects.create(**params)

    for scope_type, scope_id in [
        ("GLOBAL", "ignored"),
        ("TENANT", str(tenant)),
        ("TEAM", "team-'quoted-α"),
    ]:
        binding = bind(scope_type, scope_id)
        check(True, "RBAC_ALLOW")
        check(False, "RBAC_DENY", tenant_id=other)
        check(False, "RBAC_DENY", user_id=other_user)
        if scope_type == "TEAM":
            check(False, "RBAC_DENY", scope_id="different-team")
            check(False, "RBAC_DENY", scope_type="COMMUNITY")
        binding.delete()
    # A malformed TENANT binding must not match by the generic exact-scope rule.
    binding = bind("TENANT", str(other))
    check(False, "RBAC_DENY", scope_type="TENANT", scope_id=str(other))
    binding.delete()
    for scope_type in ["COMMUNITY", "SERVICE"]:
        binding = bind(scope_type, "resource")
        check(True, "RBAC_ALLOW", scope_type=scope_type, scope_id="resource")
        check(False, "RBAC_DENY", scope_type=scope_type, scope_id="other")
        binding.delete()

    bind("TENANT", str(tenant))
    bind("TEAM", "team-'quoted-α")
    decision = check(True, "RBAC_ALLOW")
    assert [item.id for item in decision.roles].count(role.id) == 1
    assert key in decision.permissions
    hidden = check(True, "RBAC_ALLOW", return_effective_permissions=False)
    assert hidden.permissions == []

    # Catalog service, not a key prefix or a role grant alone, selects bindings.
    foreign = Role.objects.create(
        tenant_id=tenant, name="wrong-service", service="events"
    )
    RolePermission.objects.create(role=foreign, permission_id=key)
    bind("GLOBAL", "", role=foreign)
    RolePermission.objects.filter(role=role, permission_id=key).delete()
    check(False, "RBAC_DENY")
    RolePermission.objects.create(role=role, permission_id=key)
    check(True, "RBAC_ALLOW")

    restriction = Role.objects.create(tenant_id=tenant, name="member", service="portal")
    check(False, "RBAC_DENY", permission_key=read_key)
    check(True, "RBAC_ALLOW", tenant_id=other, permission_key=read_key)
    global_member = Role.objects.get(
        tenant_id=None, name="member", service="portal", is_system_template=True
    )
    explicit = bind("GLOBAL", "", role=global_member)
    # An explicit binding to the global template survives a local default override.
    check(True, "RBAC_ALLOW", permission_key=read_key)
    explicit.delete()
    restriction.delete()
    check(True, "RBAC_ALLOW", permission_key=read_key)

    permit = PolicyOverride.objects.create(
        tenant_id=tenant, user_id=user, action="allow", permission_id=None
    )
    deny = PolicyOverride.objects.create(
        tenant_id=tenant, user_id=user, action="deny", permission_id=key
    )
    check(False, "POLICY_DENY")
    check(False, "MASTER_SUSPENDED", master_flags=MasterFlags(suspended=True))
    check(True, "MASTER_SYSTEM_ADMIN", master_flags=MasterFlags(system_admin=True))
    deny.expires_at = timezone.now() - timedelta(seconds=2)
    deny.save(update_fields=["expires_at"])
    check(True, "POLICY_ALLOW")
    check(True, "POLICY_ALLOW", return_effective_permissions=False)
    permit.delete()
    check(True, "RBAC_ALLOW")
    deny.expires_at = timezone.now() + timedelta(hours=1)
    deny.save(update_fields=["expires_at"])
    check(False, "POLICY_DENY")
    check(False, "RBAC_DENY", user_id=other_user)
    check(False, "RBAC_DENY", tenant_id=other)
    # YDB stores these ORM datetimes at second precision; equality is expired.
    frozen_now = timezone.now().replace(microsecond=0)
    deny.expires_at = frozen_now
    deny.save(update_fields=["expires_at"])
    with patch("access_control.services.timezone.now", return_value=frozen_now):
        check(True, "RBAC_ALLOW")
        deny.expires_at = frozen_now + timedelta(seconds=1)
        deny.save(update_fields=["expires_at"])
        check(False, "POLICY_DENY")
    deny.delete()

    # Per-key allow never overrides a global deny; unrelated/foreign deny is ignored.
    permit = PolicyOverride.objects.create(
        tenant_id=tenant, user_id=user, action="allow", permission_id=key
    )
    deny = PolicyOverride.objects.create(
        tenant_id=tenant, user_id=user, action="deny", permission_id=None
    )
    check(False, "POLICY_DENY")
    deny.delete()
    PolicyOverride.objects.create(
        tenant_id=other, user_id=user, action="deny", permission_id=None
    )
    PolicyOverride.objects.create(
        tenant_id=tenant, user_id=other_user, action="deny", permission_id=None
    )
    PolicyOverride.objects.create(
        tenant_id=tenant, user_id=user, action="deny", permission_id="voting.poll.read"
    )
    check(True, "POLICY_ALLOW")
    permit.delete()
    check(True, "RBAC_ALLOW")
    # One query must use the current transaction and observe its writes/rollback.
    try:
        with transaction.atomic():
            PolicyOverride.objects.create(
                tenant_id=tenant, user_id=user, action="deny", permission_id=None
            )
            check(False, "POLICY_DENY")
            raise RuntimeError("rollback local contract")
    except RuntimeError:
        pass
    check(True, "RBAC_ALLOW")
    RoleBinding.objects.filter(tenant_id=tenant, user_id=user, role=role).delete()
    check(False, "RBAC_DENY")
    return checks
