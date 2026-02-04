from __future__ import annotations

import uuid
from datetime import timedelta
from unittest import mock

from django.test import Client, TestCase
from ninja.errors import HttpError

from bff.models import Tenant as BffTenant
from bff.session_store import SessionStore
from portal.enums import TeamStatus, Visibility
from portal.models import Community, CommunityMembership, PortalProfile, Post, Team, TeamMembership, Tenant
from core.errors import error_payload


def _host_headers(slug: str) -> dict[str, str]:
    return {
        "HTTP_X_REQUEST_ID": "test-req-1",
        "HTTP_HOST": f"{slug}.updspace.com",
    }


def _login_client(client: Client, *, tenant_id: uuid.UUID, tenant_slug: str, user_id: uuid.UUID):
    # Tenant must exist for TenantResolveMiddleware
    BffTenant.objects.get_or_create(id=tenant_id, slug=tenant_slug)
    session = SessionStore().create(
        tenant_id=str(tenant_id),
        user_id=str(user_id),
        master_flags={},
        ttl=timedelta(hours=1),
    )
    client.cookies["updspace_session"] = session.session_id


class PortalTenantIsolationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()

        self.tenant_a_id = uuid.uuid4()
        self.tenant_b_id = uuid.uuid4()

        self.tenant_a = Tenant.objects.create(id=self.tenant_a_id, slug="a", name="A")
        self.tenant_b = Tenant.objects.create(id=self.tenant_b_id, slug="b", name="B")

        _login_client(self.client, tenant_id=self.tenant_a_id, tenant_slug="a", user_id=self.user_id)

        self.community_b = Community.objects.create(
            tenant=self.tenant_b,
            name="B Community",
            description="",
            created_by=self.user_id,
        )

    def test_cannot_read_other_tenant_community(self):
        resp = self.client.get(
            f"/api/v1/communities/{self.community_b.id}",
            **_host_headers("a"),
        )
        self.assertEqual(resp.status_code, 404)


class PortalPrivateVisibilityTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.tenant = Tenant.objects.create(id=self.tenant_id, slug="aef", name="AEF")

        _login_client(self.client, tenant_id=self.tenant_id, tenant_slug="aef", user_id=self.user_id)

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
                **_host_headers("aef"),
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
                **_host_headers("aef"),
            )
            self.assertEqual(resp.status_code, 200)
            ids = {item["id"] for item in resp.json()}
        self.assertIn(str(self.private_post.id), ids)


class PortalMembershipApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.tenant = Tenant.objects.create(id=self.tenant_id, slug="aef", name="AEF")
        _login_client(self.client, tenant_id=self.tenant_id, tenant_slug="aef", user_id=self.user_id)

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
                **_host_headers("aef"),
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["member"])
        self.assertEqual(data["roleHint"], "member")
        mock_check.assert_called()

    def test_community_membership_missing(self):
        with mock.patch("portal.api.AccessService.check"):
            resp = self.client.get(
                f"/api/v1/communities/{self.community.id}/members/{self.user_id}",
                **_host_headers("aef"),
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
                **_host_headers("aef"),
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["member"])
        self.assertEqual(data["roleHint"], "player")

    def test_team_membership_missing(self):
        with mock.patch("portal.api.AccessService.check"):
            resp = self.client.get(
                f"/api/v1/teams/{self.team.id}/members/{self.user_id}",
                **_host_headers("aef"),
            )
        self.assertEqual(resp.status_code, 404)


class PortalProfilesApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.tenant = Tenant.objects.create(id=self.tenant_id, slug="aef", name="AEF")
        _login_client(self.client, tenant_id=self.tenant_id, tenant_slug="aef", user_id=self.user_id)

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
            resp = self.client.get("/api/v1/portal/profiles", **_host_headers("aef"))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 2)
        mock_check.assert_called()

    def test_profiles_list_filters_by_query(self):
        with mock.patch("portal.api.AccessService.check"):
            resp = self.client.get("/api/v1/portal/profiles?q=ali", **_host_headers("aef"))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["userId"], str(self.alice_id))

    def test_profiles_list_filters_by_username(self):
        PortalProfile.objects.filter(user_id=self.alice_id).update(username="m4tveevm")
        with mock.patch("portal.api.AccessService.check"):
            resp = self.client.get("/api/v1/portal/profiles?q=m4tveevm", **_host_headers("aef"))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["userId"], str(self.alice_id))
