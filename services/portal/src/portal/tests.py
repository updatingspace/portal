from __future__ import annotations

import importlib
import hashlib
import hmac
import json
import os
import sys
import time
import uuid
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.conf import settings
from django.core.management import call_command
from django.core.exceptions import ImproperlyConfigured
from django.test import Client, SimpleTestCase, TestCase
from django.utils import timezone
from ninja.errors import HttpError

from portal.enums import TeamStatus, Visibility
from portal.models import Community, CommunityMembership, PortalProfile, Post, Team, TeamMembership, Tenant
from core.errors import error_payload


def _host_headers(
    *,
    path: str,
    tenant_id: uuid.UUID,
    slug: str,
    user_id: uuid.UUID,
    method: str = "GET",
    body: bytes = b"",
    master_flags: dict[str, bool] | None = None,
) -> dict[str, str]:
    request_id = str(uuid.uuid4())
    ts = str(int(time.time()))
    path_only = path.split("?", 1)[0]
    body_hash = hashlib.sha256(body).hexdigest()
    msg = "\n".join([method.upper(), path_only, body_hash, request_id, ts]).encode("utf-8")
    signature = hmac.new(
        str(getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "")).encode("utf-8"),
        msg,
        digestmod=hashlib.sha256,
    ).hexdigest()
    return {
        "HTTP_X_REQUEST_ID": request_id,
        "HTTP_HOST": f"{slug}.updspace.com",
        "HTTP_X_TENANT_ID": str(tenant_id),
        "HTTP_X_TENANT_SLUG": slug,
        "HTTP_X_USER_ID": str(user_id),
        "HTTP_X_MASTER_FLAGS": json.dumps(master_flags or {}, separators=(",", ":")),
        "HTTP_X_UPDSPACE_TIMESTAMP": ts,
        "HTTP_X_UPDSPACE_SIGNATURE": signature,
    }


@mock.patch.dict("os.environ", {}, clear=False)
class PortalTenantIsolationTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.override = mock.patch.object(settings, "BFF_INTERNAL_HMAC_SECRET", "test-secret")
        cls.override.start()

    @classmethod
    def tearDownClass(cls):
        cls.override.stop()
        super().tearDownClass()

    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()

        self.tenant_a_id = uuid.uuid4()
        self.tenant_b_id = uuid.uuid4()

        self.tenant_a = Tenant.objects.create(id=self.tenant_a_id, slug="a", name="A")
        self.tenant_b = Tenant.objects.create(id=self.tenant_b_id, slug="b", name="B")

        self.community_b = Community.objects.create(
            tenant=self.tenant_b,
            name="B Community",
            description="",
            created_by=self.user_id,
        )

    def test_cannot_read_other_tenant_community(self):
        resp = self.client.get(
            f"/api/v1/communities/{self.community_b.id}",
            **_host_headers(
                path=f"/api/v1/communities/{self.community_b.id}",
                tenant_id=self.tenant_a_id,
                slug="a",
                user_id=self.user_id,
            ),
        )
        self.assertEqual(resp.status_code, 403)


@mock.patch.dict("os.environ", {}, clear=False)
class PortalPrivateVisibilityTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.override = mock.patch.object(settings, "BFF_INTERNAL_HMAC_SECRET", "test-secret")
        cls.override.start()

    @classmethod
    def tearDownClass(cls):
        cls.override.stop()
        super().tearDownClass()

    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.tenant = Tenant.objects.create(id=self.tenant_id, slug="aef", name="AEF")

        self.community = Community.objects.create(
            tenant=self.tenant,
            name="C1",
            description="",
            created_by=self.user_id,
        )
        CommunityMembership.objects.create(
            tenant=self.tenant,
            community=self.community,
            user_id=self.user_id,
            role_hint="member",
        )

        Post.objects.create(
            tenant=self.tenant,
            community=self.community,
            title="Public",
            body="...",
            visibility=Visibility.COMMUNITY,
            created_by=self.user_id,
        )
        self.private_post = Post.objects.create(
            tenant=self.tenant,
            community=self.community,
            title="Private",
            body="secret",
            visibility=Visibility.PRIVATE,
            created_by=self.user_id,
        )

    def test_private_not_returned_without_permission(self):
        def check_side_effect(ctx, permission: str, **kwargs):
            if permission == "portal.posts.read_private":
                raise HttpError(403, error_payload("FORBIDDEN", "deny"))
            return None

        with mock.patch("portal.api.AccessService.check", side_effect=check_side_effect):
            resp = self.client.get(
                f"/api/v1/posts?scope=community&community_id={self.community.id}",
                **_host_headers(
                    path=f"/api/v1/posts?scope=community&community_id={self.community.id}",
                    tenant_id=self.tenant_id,
                    slug="aef",
                    user_id=self.user_id,
                ),
            )
            self.assertEqual(resp.status_code, 200)
            ids = {item["id"] for item in resp.json()}
            self.assertNotIn(str(self.private_post.id), ids)

    def test_private_returned_with_permission(self):
        def check_side_effect(ctx, permission: str, **kwargs):
            # allow all
            return None

        with mock.patch("portal.api.AccessService.check", side_effect=check_side_effect):
            resp = self.client.get(
                f"/api/v1/posts?scope=community&community_id={self.community.id}",
                **_host_headers(
                    path=f"/api/v1/posts?scope=community&community_id={self.community.id}",
                    tenant_id=self.tenant_id,
                    slug="aef",
                    user_id=self.user_id,
                ),
            )
            self.assertEqual(resp.status_code, 200)
            ids = {item["id"] for item in resp.json()}
        self.assertIn(str(self.private_post.id), ids)


@mock.patch.dict("os.environ", {}, clear=False)
class PortalMembershipApiTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.override = mock.patch.object(settings, "BFF_INTERNAL_HMAC_SECRET", "test-secret")
        cls.override.start()

    @classmethod
    def tearDownClass(cls):
        cls.override.stop()
        super().tearDownClass()

    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.tenant = Tenant.objects.create(id=self.tenant_id, slug="aef", name="AEF")

        self.community = Community.objects.create(
            tenant=self.tenant,
            name="Community",
            description="",
            created_by=self.user_id,
        )
        self.team = Team.objects.create(
            tenant=self.tenant,
            community=self.community,
            name="Team A",
            status=TeamStatus.ACTIVE,
            created_by=self.user_id,
        )

    def test_community_membership_check(self):
        CommunityMembership.objects.create(
            tenant=self.tenant,
            community=self.community,
            user_id=self.user_id,
            role_hint="member",
        )

        with mock.patch("portal.api.AccessService.check") as mock_check:
            resp = self.client.get(
                f"/api/v1/communities/{self.community.id}/members/{self.user_id}",
                **_host_headers(
                    path=f"/api/v1/communities/{self.community.id}/members/{self.user_id}",
                    tenant_id=self.tenant_id,
                    slug="aef",
                    user_id=self.user_id,
                ),
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["member"])
        self.assertEqual(data["role_hint"], "member")
        mock_check.assert_called()

    def test_community_membership_missing(self):
        with mock.patch("portal.api.AccessService.check"):
            resp = self.client.get(
                f"/api/v1/communities/{self.community.id}/members/{self.user_id}",
                **_host_headers(
                    path=f"/api/v1/communities/{self.community.id}/members/{self.user_id}",
                    tenant_id=self.tenant_id,
                    slug="aef",
                    user_id=self.user_id,
                ),
            )
        self.assertEqual(resp.status_code, 404)

    def test_team_membership_check(self):
        TeamMembership.objects.create(
            tenant=self.tenant,
            team=self.team,
            user_id=self.user_id,
            role_hint="player",
        )

        with mock.patch("portal.api.AccessService.check"):
            resp = self.client.get(
                f"/api/v1/teams/{self.team.id}/members/{self.user_id}",
                **_host_headers(
                    path=f"/api/v1/teams/{self.team.id}/members/{self.user_id}",
                    tenant_id=self.tenant_id,
                    slug="aef",
                    user_id=self.user_id,
                ),
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["member"])
        self.assertEqual(data["role_hint"], "player")

    def test_team_membership_missing(self):
        with mock.patch("portal.api.AccessService.check"):
            resp = self.client.get(
                f"/api/v1/teams/{self.team.id}/members/{self.user_id}",
                **_host_headers(
                    path=f"/api/v1/teams/{self.team.id}/members/{self.user_id}",
                    tenant_id=self.tenant_id,
                    slug="aef",
                    user_id=self.user_id,
                ),
            )
        self.assertEqual(resp.status_code, 404)


@mock.patch.dict("os.environ", {}, clear=False)
class PortalProfilesApiTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.override = mock.patch.object(settings, "BFF_INTERNAL_HMAC_SECRET", "test-secret")
        cls.override.start()

    @classmethod
    def tearDownClass(cls):
        cls.override.stop()
        super().tearDownClass()

    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.tenant = Tenant.objects.create(id=self.tenant_id, slug="aef", name="AEF")

        self.alice_id = uuid.uuid4()
        self.bob_id = uuid.uuid4()
        PortalProfile.objects.create(
            tenant=self.tenant,
            user_id=self.alice_id,
            first_name="Alice",
            last_name="Wonder",
            bio=None,
        )
        PortalProfile.objects.create(
            tenant=self.tenant,
            user_id=self.bob_id,
            first_name="Bob",
            last_name="Builder",
            bio=None,
        )

    def test_profiles_list_returns_all(self):
        with mock.patch("portal.api.AccessService.check") as mock_check:
            resp = self.client.get(
                "/api/v1/portal/profiles",
                **_host_headers(
                    path="/api/v1/portal/profiles",
                    tenant_id=self.tenant_id,
                    slug="aef",
                    user_id=self.user_id,
                ),
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 2)
        mock_check.assert_called()

    def test_profiles_list_filters_by_query(self):
        with mock.patch("portal.api.AccessService.check"):
            resp = self.client.get(
                "/api/v1/portal/profiles?q=ali",
                **_host_headers(
                    path="/api/v1/portal/profiles?q=ali",
                    tenant_id=self.tenant_id,
                    slug="aef",
                    user_id=self.user_id,
                ),
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["user_id"], str(self.alice_id))

    def test_profiles_list_filters_by_username(self):
        PortalProfile.objects.filter(user_id=self.alice_id).update(username="m4tveevm")
        with mock.patch("portal.api.AccessService.check"):
            resp = self.client.get(
                "/api/v1/portal/profiles?q=m4tveevm",
                **_host_headers(
                    path="/api/v1/portal/profiles?q=m4tveevm",
                    tenant_id=self.tenant_id,
                    slug="aef",
                    user_id=self.user_id,
                ),
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["user_id"], str(self.alice_id))


@mock.patch.dict("os.environ", {}, clear=False)
class PortalDsarApiTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.override = mock.patch.object(settings, "BFF_INTERNAL_HMAC_SECRET", "test-secret")
        cls.override.start()

    @classmethod
    def tearDownClass(cls):
        cls.override.stop()
        super().tearDownClass()

    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.tenant = Tenant.objects.create(id=self.tenant_id, slug="aef", name="AEF")
        self.profile = PortalProfile.objects.create(
            tenant=self.tenant,
            user_id=self.user_id,
            username="owner",
            display_name="Owner",
            first_name="Portal",
            last_name="Owner",
            bio="bio",
        )
        self.community = Community.objects.create(
            tenant=self.tenant,
            name="Raiders",
            description="Guild",
            created_by=self.user_id,
        )
        self.team = Team.objects.create(
            tenant=self.tenant,
            community=self.community,
            name="Alpha",
            status=TeamStatus.ACTIVE,
            created_by=self.user_id,
        )
        CommunityMembership.objects.create(
            tenant=self.tenant,
            community=self.community,
            user_id=self.user_id,
            role_hint="member",
        )
        TeamMembership.objects.create(
            tenant=self.tenant,
            team=self.team,
            user_id=self.user_id,
            role_hint="captain",
        )
        self.post = Post.objects.create(
            tenant=self.tenant,
            community=self.community,
            title="Looking for squad",
            body="Contact me later",
            visibility=Visibility.COMMUNITY,
            created_by=self.user_id,
        )

    def test_dsar_export_returns_portal_bundle(self):
        from portal.audit import PortalAuditEvent

        path = f"/api/v1/portal/internal/dsar/users/{self.user_id}/export"
        resp = self.client.get(
            path,
            **_host_headers(
                path=path,
                tenant_id=self.tenant_id,
                slug="aef",
                user_id=self.user_id,
            ),
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["service"], "portal")
        self.assertEqual(data["portal_profile"]["user_id"], str(self.user_id))
        self.assertEqual(len(data["community_memberships"]), 1)
        self.assertEqual(len(data["team_memberships"]), 1)
        self.assertEqual(len(data["posts"]), 1)
        audits = list(PortalAuditEvent.objects.filter(action="dsar.exported"))
        self.assertEqual(len(audits), 1)
        self.assertEqual(audits[0].target_id, "self")
        self.assertEqual(audits[0].metadata["subject_scope"], "self")

    def test_dsar_erase_redacts_authored_content_and_deletes_profile(self):
        from portal.audit import PortalAuditEvent

        path = f"/api/v1/portal/internal/dsar/users/{self.user_id}/erase"
        resp = self.client.post(
            path,
            data=b"",
            content_type="application/json",
            **_host_headers(
                path=path,
                tenant_id=self.tenant_id,
                slug="aef",
                user_id=self.user_id,
                method="POST",
            ),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(
            PortalProfile.objects.filter(tenant=self.tenant, user_id=self.user_id).exists()
        )
        self.assertFalse(
            CommunityMembership.objects.filter(tenant=self.tenant, user_id=self.user_id).exists()
        )
        self.assertFalse(
            TeamMembership.objects.filter(tenant=self.tenant, user_id=self.user_id).exists()
        )

        self.community.refresh_from_db()
        self.team.refresh_from_db()
        self.post.refresh_from_db()

        anonymous_user_id = uuid.UUID(int=0)
        self.assertEqual(self.community.created_by, anonymous_user_id)
        self.assertEqual(self.team.created_by, anonymous_user_id)
        self.assertEqual(self.post.created_by, anonymous_user_id)
        self.assertEqual(self.post.title, "[deleted]")
        self.assertEqual(self.post.body, "[deleted by user request]")
        audits = list(PortalAuditEvent.objects.filter(action="dsar.erased"))
        self.assertEqual(len(audits), 1)
        self.assertEqual(audits[0].target_id, "self")

    def test_system_admin_can_export_other_user_via_json_master_flags(self):
        from portal.models import PortalAuditEvent

        admin_user_id = uuid.uuid4()
        path = f"/api/v1/portal/internal/dsar/users/{self.user_id}/export"
        resp = self.client.get(
            path,
            **_host_headers(
                path=path,
                tenant_id=self.tenant_id,
                slug="aef",
                user_id=admin_user_id,
                master_flags={"system_admin": True},
            ),
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["portal_profile"]["user_id"], str(self.user_id))
        audits = list(PortalAuditEvent.objects.filter(action="dsar.exported"))
        self.assertEqual(len(audits), 1)
        self.assertEqual(audits[0].target_id, str(self.user_id))
        self.assertEqual(audits[0].metadata["subject_scope"], "delegated")
        self.assertEqual(audits[0].actor_user_id, admin_user_id)

    def test_purge_retention_deletes_only_old_portal_audit_rows(self):
        from portal.audit import PortalAuditEvent

        old_event = PortalAuditEvent.objects.create(
            tenant_id=self.tenant_id,
            actor_user_id=self.user_id,
            action="profile.updated",
            target_type="portal_profile",
            target_id="self",
            metadata={},
            request_id="rid-old",
            created_at=timezone.now() - timedelta(days=400),
        )
        fresh_event = PortalAuditEvent.objects.create(
            tenant_id=self.tenant_id,
            actor_user_id=self.user_id,
            action="profile.updated",
            target_type="portal_profile",
            target_id="self",
            metadata={},
            request_id="rid-fresh",
        )

        call_command("purge_retention", "--audit-days=365", stdout=StringIO())

        self.assertFalse(PortalAuditEvent.objects.filter(id=old_event.id).exists())
        self.assertTrue(PortalAuditEvent.objects.filter(id=fresh_event.id).exists())


class PortalSettingsSecurityTests(SimpleTestCase):
    @staticmethod
    def _import_settings(env: dict[str, str]):
        original_module = sys.modules.get("app.settings")
        try:
            sys.modules.pop("app.settings", None)
            with mock.patch.dict(os.environ, env, clear=True):
                return importlib.import_module("app.settings")
        finally:
            sys.modules.pop("app.settings", None)
            if original_module is not None:
                sys.modules["app.settings"] = original_module

    def test_requires_secret_key_in_strict_mode(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            self._import_settings(
                {
                    "DJANGO_DEBUG": "False",
                    "ALLOWED_HOSTS": ".updspace.com,localhost,portal",
                    "DATABASE_URL": "postgres://user:pass@db:5432/portal_db",
                }
            )

        self.assertIn("DJANGO_SECRET_KEY", str(ctx.exception))

    def test_rejects_wildcard_allowed_hosts_in_strict_mode(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            self._import_settings(
                {
                    "DJANGO_DEBUG": "False",
                    "DJANGO_SECRET_KEY": "test-secret",
                    "ALLOWED_HOSTS": "*",
                    "DATABASE_URL": "postgres://user:pass@db:5432/portal_db",
                }
            )

        self.assertIn("ALLOWED_HOSTS", str(ctx.exception))

    def test_explicit_debug_escape_hatches_enable_local_defaults(self):
        settings_module = self._import_settings(
            {
                "DJANGO_DEBUG": "True",
                "DJANGO_ALLOW_INSECURE_DEFAULTS": "1",
                "DJANGO_ALLOW_SQLITE": "1",
            }
        )

        self.assertEqual(settings_module.SECRET_KEY, "portal-secret")
        self.assertEqual(settings_module.ALLOWED_HOSTS, ["*"])
        self.assertEqual(
            settings_module.DATABASES["default"]["ENGINE"],
            "django.db.backends.sqlite3",
        )
        self.assertEqual(settings_module.X_FRAME_OPTIONS, "DENY")


@mock.patch.dict("os.environ", {}, clear=False)
class PortalProfileAuditTests(TestCase):
    """Verify that PATCH /portal/me writes a PortalAuditEvent."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.override = mock.patch.object(settings, "BFF_INTERNAL_HMAC_SECRET", "test-secret")
        cls.override.start()

    @classmethod
    def tearDownClass(cls):
        cls.override.stop()
        super().tearDownClass()

    def setUp(self):
        from portal.audit import PortalAuditEvent  # noqa: F811

        self.AuditEvent = PortalAuditEvent
        self.client = Client()
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.tenant = Tenant.objects.create(id=self.tenant_id, slug="aef", name="AEF")

    def test_patch_profile_creates_audit_event(self):
        body = json.dumps({"first_name": "Max", "bio": "Hello"}).encode("utf-8")
        resp = self.client.patch(
            "/api/v1/portal/me",
            data=body,
            content_type="application/json",
            **_host_headers(
                path="/api/v1/portal/me",
                tenant_id=self.tenant_id,
                slug="aef",
                user_id=self.user_id,
                method="PATCH",
                body=body,
            ),
        )
        self.assertEqual(resp.status_code, 200)

        audits = list(
            self.AuditEvent.objects.filter(
                tenant_id=self.tenant_id,
                actor_user_id=self.user_id,
                action="profile.updated",
            )
        )
        self.assertEqual(len(audits), 1)
        event = audits[0]
        self.assertEqual(event.target_type, "portal_profile")
        self.assertIn("first_name", event.metadata["changed_fields"])
        self.assertIn("bio", event.metadata["changed_fields"])
        # Verify no raw PII values leak into metadata
        self.assertNotIn("Max", json.dumps(event.metadata))
        self.assertNotIn("Hello", json.dumps(event.metadata))

    def test_patch_profile_no_audit_when_no_changes(self):
        # First request creates the profile
        body_initial = json.dumps({"first_name": "A"}).encode("utf-8")
        self.client.patch(
            "/api/v1/portal/me",
            data=body_initial,
            content_type="application/json",
            **_host_headers(
                path="/api/v1/portal/me",
                tenant_id=self.tenant_id,
                slug="aef",
                user_id=self.user_id,
                method="PATCH",
                body=body_initial,
            ),
        )
        # Clear audit events from first call
        self.AuditEvent.objects.filter(tenant_id=self.tenant_id).delete()

        # PATCH with empty payload (no real field changes)
        body_empty = json.dumps({}).encode("utf-8")
        resp = self.client.patch(
            "/api/v1/portal/me",
            data=body_empty,
            content_type="application/json",
            **_host_headers(
                path="/api/v1/portal/me",
                tenant_id=self.tenant_id,
                slug="aef",
                user_id=self.user_id,
                method="PATCH",
                body=body_empty,
            ),
        )
        self.assertEqual(resp.status_code, 200)
        # updated_at is always set but shouldn't count as "changed_fields"
        audits = list(
            self.AuditEvent.objects.filter(
                tenant_id=self.tenant_id,
                action="profile.updated",
            )
        )
        self.assertEqual(len(audits), 0)
