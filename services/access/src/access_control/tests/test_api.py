from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from typing import Any

from django.conf import settings
from django.db import IntegrityError
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from access_control.models import (
    Permission,
    PolicyOverride,
    Role,
    RolePermission,
    RoleBinding,
    ScopeType,
    TenantAdminAuditEvent,
)


def _make_signature(
    method: str, path: str, body: bytes, request_id: str
) -> dict[str, str]:
    secret = settings.BFF_INTERNAL_HMAC_SECRET
    ts = str(int(time.time()))

    msg = "\n".join(
        [
            method.upper(),
            path,
            hashlib.sha256(body or b"").hexdigest(),
            request_id,
            ts,
        ]
    ).encode("utf-8")
    signature = hmac.new(
        secret.encode("utf-8"), msg, digestmod=hashlib.sha256
    ).hexdigest()
    return {"timestamp": ts, "signature": signature}


def _build_headers(
    *,
    method: str,
    path: str,
    body: bytes,
    request_id: str,
    tenant_id: str,
    tenant_slug: str,
    user_id: str,
    master_flags: dict[str, Any],
) -> dict[str, str]:
    signed = _make_signature(
        method=method, path=path, body=body, request_id=request_id
    )
    return {
        "HTTP_X_REQUEST_ID": request_id,
        "HTTP_X_TENANT_ID": tenant_id,
        "HTTP_X_TENANT_SLUG": tenant_slug,
        "HTTP_X_USER_ID": user_id,
        "HTTP_X_MASTER_FLAGS": json.dumps(
            master_flags, separators=(",", ":"), ensure_ascii=False
        ),
        "HTTP_X_UPDSPACE_TIMESTAMP": signed["timestamp"],
        "HTTP_X_UPDSPACE_SIGNATURE": signed["signature"],
    }


@override_settings(BFF_INTERNAL_HMAC_SECRET="test-secret")
class PolicyOverrideApiTests(TestCase):
    def setUp(self):
        super().setUp()
        self.client = Client()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = "aef"
        self.user_id = str(uuid.uuid4())
        try:
            self.permission, _ = Permission.objects.get_or_create(
                key="voting.vote.cast",
                defaults={"description": "Cast vote", "service": "voting"},
            )
        except IntegrityError:
            # Handle case where permission might not exist
            permission_result = Permission.objects.filter(
                key="voting.vote.cast"
            ).first()
            if permission_result is None:
                # Create it if it doesn't exist
                permission_result = Permission.objects.create(
                    key="voting.vote.cast",
                    description="Cast vote",
                    service="voting"
                )
            self.permission = permission_result

    def _post(
        self,
        payload: dict[str, Any],
        *,
        master_flags: dict[str, Any],
    ):
        body = json.dumps(payload).encode("utf-8")
        request_id = str(uuid.uuid4())
        headers = _build_headers(
            method="POST",
            path="/api/v1/access/policy-overrides",
            body=body,
            request_id=request_id,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags=master_flags,
        )
        return self.client.post(
            "/api/v1/access/policy-overrides",
            data=body,
            content_type="application/json",
            HTTP_X_REQUEST_ID=headers["HTTP_X_REQUEST_ID"],
            HTTP_X_TENANT_ID=headers["HTTP_X_TENANT_ID"],
            HTTP_X_TENANT_SLUG=headers["HTTP_X_TENANT_SLUG"],
            HTTP_X_USER_ID=headers["HTTP_X_USER_ID"],
            HTTP_X_MASTER_FLAGS=headers["HTTP_X_MASTER_FLAGS"],
            HTTP_X_UPDSPACE_TIMESTAMP=headers["HTTP_X_UPDSPACE_TIMESTAMP"],
            HTTP_X_UPDSPACE_SIGNATURE=headers["HTTP_X_UPDSPACE_SIGNATURE"],
        )

    def test_system_admin_can_create_policy_override(self):
        expires_at = (timezone.now() + timezone.timedelta(hours=1)).isoformat()
        payload = {
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "action": "deny",
            "permission_key": self.permission.key,
            "reason": "temporary block",
            "expires_at": expires_at,
        }
        resp = self._post(payload, master_flags={"system_admin": True})
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["permission_key"], self.permission.key)
        self.assertEqual(data["reason"], "temporary block")
        self.assertEqual(PolicyOverride.objects.count(), 1)

    def test_non_admin_cannot_create_override(self):
        payload = {
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "action": "allow",
        }
        resp = self._post(payload, master_flags={})
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(PolicyOverride.objects.count(), 0)

    def test_list_filters_by_user(self):
        override = PolicyOverride.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            action="deny",
            permission_id=self.permission.key,
            reason="test",
        )
        PolicyOverride.objects.create(
            tenant_id=self.tenant_id,
            user_id=str(uuid.uuid4()),
            action="allow",
            permission_id=self.permission.key,
            reason="other",
        )
        request_id = str(uuid.uuid4())
        headers = _build_headers(
            method="GET",
            path="/api/v1/access/policy-overrides",
            body=b"",
            request_id=request_id,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": True},
        )
        resp = self.client.get(
            "/api/v1/access/policy-overrides",
            data={"user_id": self.user_id},
            HTTP_X_REQUEST_ID=headers["HTTP_X_REQUEST_ID"],
            HTTP_X_TENANT_ID=headers["HTTP_X_TENANT_ID"],
            HTTP_X_TENANT_SLUG=headers["HTTP_X_TENANT_SLUG"],
            HTTP_X_USER_ID=headers["HTTP_X_USER_ID"],
            HTTP_X_MASTER_FLAGS=headers["HTTP_X_MASTER_FLAGS"],
            HTTP_X_UPDSPACE_TIMESTAMP=headers["HTTP_X_UPDSPACE_TIMESTAMP"],
            HTTP_X_UPDSPACE_SIGNATURE=headers["HTTP_X_UPDSPACE_SIGNATURE"],
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], str(override.id))


@override_settings(BFF_INTERNAL_HMAC_SECRET="test-secret")
class TenantAdminAuditApiTests(TestCase):
    def setUp(self):
        super().setUp()
        self.client = Client()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = "aef"
        self.admin_id = str(uuid.uuid4())
        self.user_a = str(uuid.uuid4())
        self.user_b = str(uuid.uuid4())

        self.permission, _ = Permission.objects.get_or_create(
            key="portal.roles.read",
            defaults={"description": "Read roles", "service": "portal"},
        )

        role = Role.objects.create(
            tenant_id=self.tenant_id,
            service="portal",
            name="moderator",
            is_system_template=False,
        )
        RolePermission.objects.create(role=role, permission=self.permission)
        RoleBinding.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_a,
            scope_type=ScopeType.TENANT,
            scope_id=self.tenant_id,
            role=role,
        )
        RoleBinding.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_b,
            scope_type=ScopeType.TENANT,
            scope_id=self.tenant_id,
            role=role,
        )

    def _get(self, path: str, params: dict[str, Any], master_flags: dict[str, Any]):
        body = b""
        request_id = str(uuid.uuid4())
        headers = _build_headers(
            method="GET",
            path=path,
            body=body,
            request_id=request_id,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.admin_id,
            master_flags=master_flags,
        )
        return self.client.get(
            path,
            data=params,
            HTTP_X_REQUEST_ID=headers["HTTP_X_REQUEST_ID"],
            HTTP_X_TENANT_ID=headers["HTTP_X_TENANT_ID"],
            HTTP_X_TENANT_SLUG=headers["HTTP_X_TENANT_SLUG"],
            HTTP_X_USER_ID=headers["HTTP_X_USER_ID"],
            HTTP_X_MASTER_FLAGS=headers["HTTP_X_MASTER_FLAGS"],
            HTTP_X_UPDSPACE_TIMESTAMP=headers["HTTP_X_UPDSPACE_TIMESTAMP"],
            HTTP_X_UPDSPACE_SIGNATURE=headers["HTTP_X_UPDSPACE_SIGNATURE"],
        )

    def test_role_bindings_search_filters_by_user_id(self):
        resp = self._get(
            "/api/v1/access/admin/role-bindings/search",
            {"user_id": self.user_a},
            master_flags={"system_admin": True},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["user_id"], self.user_a)

    def test_delete_removes_override(self):
        override = PolicyOverride.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.admin_id,
            action="deny",
            permission_id=self.permission.key,
            reason="temp",
        )
        request_id = str(uuid.uuid4())
        headers = _build_headers(
            method="DELETE",
            path=f"/api/v1/access/policy-overrides/{override.id}",
            body=b"",
            request_id=request_id,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.admin_id,
            master_flags={"system_admin": True},
        )
        resp = self.client.delete(
            f"/api/v1/access/policy-overrides/{override.id}",
            HTTP_X_REQUEST_ID=headers["HTTP_X_REQUEST_ID"],
            HTTP_X_TENANT_ID=headers["HTTP_X_TENANT_ID"],
            HTTP_X_TENANT_SLUG=headers["HTTP_X_TENANT_SLUG"],
            HTTP_X_USER_ID=headers["HTTP_X_USER_ID"],
            HTTP_X_MASTER_FLAGS=headers["HTTP_X_MASTER_FLAGS"],
            HTTP_X_UPDSPACE_TIMESTAMP=headers["HTTP_X_UPDSPACE_TIMESTAMP"],
            HTTP_X_UPDSPACE_SIGNATURE=headers["HTTP_X_UPDSPACE_SIGNATURE"],
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(PolicyOverride.objects.filter(
            id=override.id
        ).exists())


@override_settings(BFF_INTERNAL_HMAC_SECRET="test-secret")
class TenantAdminApiTests(TestCase):
    def setUp(self):
        super().setUp()
        self.client = Client()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = "aef"
        self.user_id = str(uuid.uuid4())
        TenantAdminAuditEvent.objects.filter(tenant_id=self.tenant_id).delete()

        self.role = Role.objects.create(
            tenant_id=self.tenant_id,
            service="portal",
            name="tenant-admin",
            is_system_template=False,
        )

        permission_keys = [
            "portal.roles.read",
            "portal.roles.write",
            "portal.role_bindings.write",
        ]
        for key in permission_keys:
            perm, _ = Permission.objects.get_or_create(
                key=key,
                defaults={"description": key, "service": "portal"},
            )
            RolePermission.objects.get_or_create(role=self.role, permission=perm)

        RoleBinding.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            scope_type=ScopeType.TENANT,
            scope_id=self.tenant_id,
            role=self.role,
        )

    def _headers(self, method: str, path: str, body: bytes) -> dict[str, str]:
        request_id = str(uuid.uuid4())
        return _build_headers(
            method=method,
            path=path,
            body=body,
            request_id=request_id,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
        )

    def _get(self, path: str, params: dict[str, str] | None = None):
        headers = self._headers("GET", path, b"")
        return self.client.get(
            path,
            data=params or {},
            HTTP_X_REQUEST_ID=headers["HTTP_X_REQUEST_ID"],
            HTTP_X_TENANT_ID=headers["HTTP_X_TENANT_ID"],
            HTTP_X_TENANT_SLUG=headers["HTTP_X_TENANT_SLUG"],
            HTTP_X_USER_ID=headers["HTTP_X_USER_ID"],
            HTTP_X_MASTER_FLAGS=headers["HTTP_X_MASTER_FLAGS"],
            HTTP_X_UPDSPACE_TIMESTAMP=headers["HTTP_X_UPDSPACE_TIMESTAMP"],
            HTTP_X_UPDSPACE_SIGNATURE=headers["HTTP_X_UPDSPACE_SIGNATURE"],
        )

    def _post(self, path: str, payload: dict[str, str | list[str]]):
        body = json.dumps(payload).encode("utf-8")
        headers = self._headers("POST", path, body)
        return self.client.post(
            path,
            data=body,
            content_type="application/json",
            HTTP_X_REQUEST_ID=headers["HTTP_X_REQUEST_ID"],
            HTTP_X_TENANT_ID=headers["HTTP_X_TENANT_ID"],
            HTTP_X_TENANT_SLUG=headers["HTTP_X_TENANT_SLUG"],
            HTTP_X_USER_ID=headers["HTTP_X_USER_ID"],
            HTTP_X_MASTER_FLAGS=headers["HTTP_X_MASTER_FLAGS"],
            HTTP_X_UPDSPACE_TIMESTAMP=headers["HTTP_X_UPDSPACE_TIMESTAMP"],
            HTTP_X_UPDSPACE_SIGNATURE=headers["HTTP_X_UPDSPACE_SIGNATURE"],
        )

    def test_list_roles_includes_admin_role(self):
        resp = self._get("/api/v1/access/admin/roles")
        self.assertEqual(resp.status_code, 200)
        names = [entry["name"] for entry in resp.json()]
        self.assertIn(self.role.name, names)

    def test_create_role_records_event(self):
        self.assertEqual(
            TenantAdminAuditEvent.objects.filter(tenant_id=self.tenant_id).count(),
            0,
        )
        payload = {
            "service": "portal",
            "name": "tenant-editor",
            "permission_keys": ["portal.roles.read"],
        }
        resp = self._post("/api/v1/access/admin/roles", payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["name"], payload["name"])

        events = TenantAdminAuditEvent.objects.filter(tenant_id=self.tenant_id)
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.first().action, "role_created")

    def test_binding_search_and_event_stream(self):
        search = self._get("/api/v1/access/admin/role-bindings/search", {"q": "tenant"})
        self.assertEqual(search.status_code, 200)
        results = search.json()
        self.assertTrue(any(entry["role_name"] == self.role.name for entry in results))

        new_user = str(uuid.uuid4())
        payload = {
            "tenant_id": self.tenant_id,
            "user_id": new_user,
            "scope_type": "TENANT",
            "scope_id": self.tenant_id,
            "role_id": self.role.id,
        }
        resp = self._post("/api/v1/access/admin/role-bindings", payload)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["role_name"], self.role.name)

        event = TenantAdminAuditEvent.objects.filter(
            tenant_id=self.tenant_id,
            action="binding_created",
        ).first()
        self.assertIsNotNone(event)

        events_resp = self._get("/api/v1/access/admin/events", {"limit": "5"})
        self.assertEqual(events_resp.status_code, 200)
        events = events_resp.json()
        self.assertGreaterEqual(len(events), 1)
        self.assertEqual(events[0]["action"], event.action)
