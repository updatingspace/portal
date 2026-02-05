from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from unittest import mock

from django.conf import settings
from django.test import Client, TestCase
from ninja.errors import HttpError

from portal.enums import TeamStatus, Visibility
from portal.models import Community, CommunityMembership, PortalProfile, Post, Team, TeamMembership, Tenant
from core.errors import error_payload


def _host_headers(*, path: str, tenant_id: uuid.UUID, slug: str, user_id: uuid.UUID) -> dict[str, str]:
    request_id = str(uuid.uuid4())
    ts = str(int(time.time()))
    path_only = path.split("?", 1)[0]
    body = b""
    body_hash = hashlib.sha256(body).hexdigest()
    msg = "\n".join(["GET", path_only, body_hash, request_id, ts]).encode("utf-8")
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
        "HTTP_X_MASTER_FLAGS": json.dumps({}, separators=(",", ":")),
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
