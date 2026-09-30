import json
import uuid

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from access_control.models import Permission, RoleBinding, ScopeType
from access_control.services import compute_effective_access
from access_control.tests.test_api import _build_headers


class TenantOwnerTests(TestCase):
    def call(self, *, admin=True, tenant_id=None, header_tenant_id=None, owner=None):
        tenant_id = tenant_id or uuid.uuid4()
        owner = owner or uuid.uuid4()
        path = "/api/v1/access/internal/tenant-owner"
        body = json.dumps(
            {"tenant_id": str(tenant_id), "owner_user_id": str(owner)}
        ).encode()
        headers = _build_headers(
            method="POST",
            path=path,
            body=body,
            request_id=str(uuid.uuid4()),
            tenant_id=str(header_tenant_id or tenant_id),
            tenant_slug="new-team",
            user_id=str(uuid.uuid4()),
            master_flags={"system_admin": admin},
        )
        return self.client.post(
            path, data=body, content_type="application/json", **headers
        )

    def test_only_system_admin_can_provision_matching_tenant(self):
        self.assertEqual(self.call(admin=False).status_code, 403)
        self.assertEqual(self.call(header_tenant_id=uuid.uuid4()).status_code, 400)
        self.assertFalse(RoleBinding.objects.exists())

    def test_retry_is_idempotent_and_grants_only_target_tenant(self):
        # YDB schema creation does not run permission data migrations.
        Permission.objects.all().delete()
        tenant, owner = uuid.uuid4(), uuid.uuid4()
        with CaptureQueriesContext(connection) as queries:
            self.assertEqual(self.call(tenant_id=tenant, owner=owner).status_code, 200)
        self.assertLess(len(queries), 100, "Provision grants in batches, not per permission")
        count = RoleBinding.objects.count()
        self.assertGreater(count, 0)
        with CaptureQueriesContext(connection) as queries:
            self.assertEqual(self.call(tenant_id=tenant, owner=owner).status_code, 200)
        self.assertLess(len(queries), 30, "Retries must not query each permission")
        self.assertEqual(RoleBinding.objects.count(), count)
        for scope_tenant, user_id, allowed in [
            (tenant, owner, True),
            (uuid.uuid4(), owner, False),
            (tenant, uuid.uuid4(), False),
        ]:
            decision = compute_effective_access(
                tenant_id=scope_tenant,
                user_id=user_id,
                permission_key="portal.roles.write",
                scope_type=ScopeType.TENANT,
                scope_id=str(scope_tenant),
            )
            self.assertEqual(decision.allowed, allowed)
        self.assertFalse(
            compute_effective_access(
                tenant_id=tenant,
                user_id=owner,
                permission_key="portal.tenant_applications.review",
                scope_type=ScopeType.TENANT,
                scope_id=str(tenant),
            ).allowed
        )
