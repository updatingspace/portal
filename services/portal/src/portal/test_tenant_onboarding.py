from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase

from portal.models import (
    Tenant,
    TenantApplication,
    TenantMembership,
    TenantProvisioningOutbox,
    TenantSlugClaim,
)
from portal.tenant_applications import complete_provisioning


class TenantOnboardingTests(TestCase):
    def setUp(self):
        self.user_id = uuid.uuid4()
        self.other_id = uuid.uuid4()
        self.admin_id = uuid.uuid4()

    def call(
        self, method, path, payload=None, *, user_id=None, flags=None, signed=True
    ):
        body = json.dumps(payload).encode() if payload is not None else b""
        request_id, timestamp = str(uuid.uuid4()), str(int(time.time()))
        message = "\n".join(
            [method, path, hashlib.sha256(body).hexdigest(), request_id, timestamp]
        ).encode()
        headers = {
            "HTTP_X_REQUEST_ID": request_id,
            "HTTP_X_USER_ID": str(user_id or self.user_id),
            "HTTP_X_MASTER_FLAGS": json.dumps(flags or {}),
        }
        if signed:
            headers.update(
                {
                    "HTTP_X_UPDSPACE_TIMESTAMP": timestamp,
                    "HTTP_X_UPDSPACE_SIGNATURE": hmac.new(
                        settings.BFF_INTERNAL_HMAC_SECRET.encode(),
                        message,
                        hashlib.sha256,
                    ).hexdigest(),
                }
            )
        return self.client.generic(
            method, path, data=body, content_type="application/json", **headers
        )

    def submit(self, slug="new-team", **extra):
        return self.call(
            "POST",
            "/api/v1/portal/entry/tenant-applications",
            {"slug": slug, "name": "New Team", **extra},
        )

    def test_submission_is_tenantless_and_ignores_caller_identity_and_email(self):
        response = self.submit(
            email="victim@example.com",
            applicant_user_id=str(self.other_id),
            requested_by_user_id=str(self.other_id),
            tenant_id=str(uuid.uuid4()),
        )
        self.assertEqual(response.status_code, 201, response.content)
        application = TenantApplication.objects.get()
        self.assertEqual(application.applicant_user_id, self.user_id)
        self.assertFalse(Tenant.objects.exists())
        self.assertFalse(TenantMembership.objects.exists())
        self.assertEqual(
            response.json(),
            {"id": str(application.id), "slug": "new-team", "status": "pending"},
        )
        self.assertEqual(
            self.call(
                "GET", "/api/v1/portal/entry/tenant-applications", user_id=self.other_id
            ).json(),
            [],
        )
        self.assertEqual(
            len(self.call("GET", "/api/v1/portal/entry/tenant-applications").json()), 1
        )

    def test_signature_and_account_flags_are_enforced(self):
        for kwargs, expected in [
            ({"signed": False}, 401),
            ({"flags": {"banned": True}}, 403),
            ({"flags": {"suspended": True}}, 403),
        ]:
            response = self.call(
                "POST",
                "/api/v1/portal/entry/tenant-applications",
                {"slug": "new-team"},
                **kwargs,
            )
            self.assertEqual(response.status_code, expected)
        self.assertFalse(TenantApplication.objects.exists())

    def test_duplicates_reserved_names_and_existing_tenants(self):
        self.assertEqual(self.submit().status_code, 201)
        self.assertEqual(self.submit().status_code, 409)
        Tenant.objects.create(slug="existing", name="Existing")
        self.assertEqual(self.submit("existing").status_code, 409)
        for slug in ["portal", "id", "bad/slug", "a" * 33]:
            self.assertEqual(self.submit(slug).status_code, 400)
        self.assertEqual(TenantApplication.objects.count(), 1)

    def test_user_application_limit(self):
        for index in range(20):
            self.assertEqual(self.submit(f"team-{index}").status_code, 201)
        response = self.submit("one-too-many")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "APPLICATION_LIMIT_REACHED")

    def test_approval_and_retry_preserve_owner_and_wait_for_access(self):
        self.assertEqual(self.submit().status_code, 201)
        application = TenantApplication.objects.get()
        path = (
            f"/api/v1/portal/entry/admin/tenant-applications/{application.id}/approve"
        )
        # An ordinary member (even of another tenant) cannot approve.
        self.assertEqual(
            self.call("POST", path, user_id=self.other_id).status_code, 403
        )
        with patch("portal.entry_api.process_tenant_event", return_value=False):
            response = self.call(
                "POST", path, user_id=self.admin_id, flags={"system_admin": True}
            )
        self.assertEqual(response.status_code, 202, response.content)
        self.assertEqual(TenantMembership.objects.get().user_id, self.user_id)
        self.assertEqual(
            self.call("GET", "/api/v1/portal/entry/memberships").json(), []
        )
        event = TenantProvisioningOutbox.objects.get()
        self.assertEqual(event.payload["owner_user_id"], str(self.user_id))
        with patch(
            "portal.entry_api.process_tenant_event", side_effect=complete_provisioning
        ):
            response = self.call(
                "POST", path, user_id=self.admin_id, flags={"system_admin": True}
            )
        self.assertEqual(response.status_code, 200)
        memberships = self.call("GET", "/api/v1/portal/entry/memberships").json()
        self.assertEqual(memberships[0]["base_role"], "owner")
        self.assertEqual(memberships[0]["display_name"], "New Team")
        self.assertEqual(
            self.call(
                "GET", "/api/v1/portal/entry/memberships", user_id=self.other_id
            ).json(),
            [],
        )
        self.assertEqual(
            self.call("GET", "/api/v1/portal/entry/tenant-applications").json(), []
        )
        self.assertEqual(
            self.call(
                "POST", path, user_id=self.admin_id, flags={"system_admin": True}
            ).status_code,
            200,
        )
        self.assertEqual(TenantMembership.objects.count(), 1)
        self.assertEqual(TenantProvisioningOutbox.objects.count(), 1)

    def test_rejection_releases_slug_and_cannot_be_approved(self):
        self.submit()
        application = TenantApplication.objects.get()
        base = f"/api/v1/portal/entry/admin/tenant-applications/{application.id}"
        response = self.call(
            "POST",
            f"{base}/reject",
            user_id=self.admin_id,
            flags={"system_admin": True},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(TenantSlugClaim.objects.exists())
        self.assertEqual(
            self.call(
                "POST",
                f"{base}/approve",
                user_id=self.admin_id,
                flags={"system_admin": True},
            ).status_code,
            409,
        )
        self.assertEqual(self.submit().status_code, 201)

    def test_provisioning_uses_persisted_event_and_retries_network_failure(self):
        from io import BytesIO

        from portal.provisioning import process_tenant_event

        self.submit()
        application = TenantApplication.objects.get()
        path = (
            f"/api/v1/portal/entry/admin/tenant-applications/{application.id}/approve"
        )
        with patch("portal.entry_api.process_tenant_event", return_value=False):
            self.call("POST", path, user_id=self.admin_id, flags={"system_admin": True})
        event = TenantProvisioningOutbox.objects.get()
        with (
            patch.dict("os.environ", {"ACCESS_BASE_URL": "http://access:8002/api/v1"}),
            patch(
                "portal.provisioning.urllib.request.urlopen",
                side_effect=OSError("offline"),
            ),
        ):
            self.assertFalse(process_tenant_event(event))
        self.assertEqual(TenantMembership.objects.get().status, "provisioning")
        with (
            patch.dict("os.environ", {"ACCESS_BASE_URL": "https://access.example/api/v1"}),
            patch(
                "portal.provisioning.urllib.request.urlopen",
                return_value=BytesIO(b'{"ok":true}'),
            ) as send,
        ):
            self.assertTrue(process_tenant_event(event))
        request = send.call_args.args[0]
        self.assertEqual(
            request.full_url, "https://access.example/api/v1/access/internal/tenant-owner"
        )
        self.assertEqual(request.get_header("X-forwarded-proto"), "https")
        self.assertEqual(json.loads(request.data)["owner_user_id"], str(self.user_id))
        self.assertEqual(TenantMembership.objects.get().status, "active")

    def test_account_enrollment_is_scoped_admin_only_and_idempotent(self):
        from django.test import RequestFactory
        from ninja.errors import HttpError

        from portal.context import PortalContext
        from portal.entry_api import TenantMemberIn, enroll_member

        tenant = Tenant.objects.create(slug="existing", name="Existing")
        request = RequestFactory().post("/")
        ctx = PortalContext(
            "request",
            tenant.id,
            tenant.slug,
            self.admin_id,
            frozenset({"system_admin"}),
        )
        with patch("portal.entry_api.require_portal_context", return_value=ctx):
            first = enroll_member(request, TenantMemberIn(user_id=self.user_id))
            self.assertEqual(
                first, enroll_member(request, TenantMemberIn(user_id=self.user_id))
            )
        self.assertEqual(TenantMembership.objects.get().base_role, "member")
        for flags in [frozenset(), frozenset({"system_admin", "banned"})]:
            ctx = PortalContext("request", tenant.id, tenant.slug, self.admin_id, flags)
            with (
                patch("portal.entry_api.require_portal_context", return_value=ctx),
                self.assertRaises(HttpError),
            ):
                enroll_member(request, TenantMemberIn(user_id=self.other_id))
        self.assertEqual(TenantMembership.objects.count(), 1)

    def test_erasure_removes_membership_and_pending_grant(self):
        from portal.dsar import erase_user_data, export_user_data
        from portal.provisioning import process_tenant_event
        from portal.tenant_applications import review_application

        self.submit()
        application = TenantApplication.objects.get()
        review_application(
            application_id=application.id,
            reviewer_id=self.admin_id,
            approve=True,
            request_id="erase-test",
        )
        event = TenantProvisioningOutbox.objects.get()
        exported = export_user_data(
            tenant_id=application.tenant_id, user_id=self.user_id
        )
        self.assertEqual(len(exported["tenant_memberships"]), 1)
        erase_user_data(tenant_id=uuid.uuid4(), user_id=self.user_id)
        self.assertFalse(TenantMembership.objects.exists())
        self.assertFalse(TenantProvisioningOutbox.objects.exists())
        self.assertFalse(process_tenant_event(event))
        application.refresh_from_db()
        self.assertEqual(application.status, "erased")

    def test_legacy_import_is_idempotent_and_preserves_other_tenants(self):
        import tempfile

        from django.core.management import call_command

        tenant = Tenant.objects.create(slug="existing", name="Existing")
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as source:
            json.dump(
                [
                    {
                        "tenant_id": str(tenant.id),
                        "tenant_slug": tenant.slug,
                        "user_id": str(self.user_id),
                        "status": "active",
                        "base_role": "owner",
                    }
                ],
                source,
            )
            source.flush()
            call_command("import_tenant_memberships", input=source.name, dry_run=True)
            self.assertFalse(TenantMembership.objects.exists())
            call_command("import_tenant_memberships", input=source.name)
            call_command("import_tenant_memberships", input=source.name)
        self.assertEqual(TenantMembership.objects.count(), 1)
        self.assertEqual(TenantMembership.objects.get().user_id, self.user_id)
