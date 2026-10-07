from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

import httpx
from django.test import Client, TestCase, override_settings

from bff.models import Tenant
from bff.session_store import SessionStore


@override_settings(BFF_ENFORCE_ACTIVE_MEMBERSHIP=True, BFF_TENANT_HOST_SUFFIX="updspace.com", BFF_UPSTREAM_PORTAL_URL="http://portal/api/v1")
class LeaveMembershipTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(slug="alpha")
        self.other = Tenant.objects.create(slug="beta")
        self.store = SessionStore()
        self.user_id = str(uuid4())
        self.sessions = [self.store.create(tenant_id=str(self.tenant.id), user_id=self.user_id, master_flags={}, ttl=timedelta(hours=1)) for _ in range(2)]
        for session in self.sessions:
            self.store.set_active_tenant(session.session_id, tenant_id=str(self.tenant.id), tenant_slug="alpha")
        self.client.cookies["updspace_session"] = self.sessions[0].session_id
        self.path = f"/api/v1/entry/memberships/{self.tenant.id}/leave"

    def test_leave_clears_all_active_sessions_only_after_confirmed_success(self):
        other_user = self.store.create(tenant_id=str(self.tenant.id), user_id=str(uuid4()), master_flags={}, ttl=timedelta(hours=1))
        other_community = self.store.create(tenant_id=str(self.other.id), user_id=self.user_id, master_flags={}, ttl=timedelta(hours=1))
        self.store.set_active_tenant(other_user.session_id, tenant_id=str(self.tenant.id), tenant_slug="alpha")
        self.store.set_active_tenant(other_community.session_id, tenant_id=str(self.other.id), tenant_slug="beta")
        with patch("bff.api.proxy_request", return_value=httpx.Response(200, json={"tenant_id": str(self.tenant.id), "status": "left"})) as proxy:
            response = self.client.post(self.path)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(proxy.call_args.kwargs["context_headers"]["X-User-Id"], self.user_id)
        for session in self.sessions:
            self.assertEqual(self.store.get(session.session_id).active_tenant_slug, "")
        self.assertEqual(self.store.get(other_user.session_id).active_tenant_slug, "alpha")
        self.assertEqual(self.store.get(other_community.session_id).active_tenant_slug, "beta")

    def test_owner_or_upstream_failure_keeps_context(self):
        for status, body in [(409, {"error": {"code": "OWNER_CANNOT_LEAVE"}}), (502, {}), (200, {"status": "wrong"})]:
            with patch("bff.api.proxy_request", return_value=httpx.Response(status, json=body)):
                response = self.client.post(self.path)
            self.assertGreaterEqual(response.status_code, 400)
            self.assertEqual(self.store.get(self.sessions[0].session_id).active_tenant_slug, "alpha")

    def test_requires_session_and_csrf(self):
        self.assertEqual(Client().post(self.path).status_code, 401)
        client = Client(enforce_csrf_checks=True)
        client.cookies["updspace_session"] = self.sessions[0].session_id
        self.assertEqual(client.post(self.path).status_code, 403)

    def test_removed_member_cannot_use_stale_session_or_host_fallback(self):
        for host in ["portal.updspace.com", "alpha.updspace.com"]:
            if host == "alpha.updspace.com":
                self.store.clear_active_tenant(self.sessions[0].session_id)
            with patch("bff.api._load_portal_memberships", return_value=[]), patch("bff.api.proxy_request") as proxy:
                response = self.client.get("/api/v1/events/events", HTTP_HOST=host)
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json()["error"]["code"], "TENANT_FORBIDDEN")
            proxy.assert_not_called()

    def test_membership_unavailable_fails_closed_and_other_tenant_is_not_membership(self):
        for memberships, status in [(None, 503), ([{"tenant_id": str(self.other.id), "tenant_slug": "beta"}], 403)]:
            with patch("bff.api._load_portal_memberships", return_value=memberships), patch("bff.api.proxy_request") as proxy:
                response = self.client.post("/api/v1/feed/posts")
            self.assertEqual(response.status_code, status)
            proxy.assert_not_called()

    @override_settings(BFF_ENFORCE_ACTIVE_MEMBERSHIP=False)
    def test_leave_is_unavailable_until_live_membership_gate_enabled(self):
        with patch("bff.api.proxy_request") as proxy:
            response = self.client.post(self.path)
        self.assertEqual(response.status_code, 503)
        proxy.assert_not_called()

    def test_session_snapshot_does_not_expose_departed_permissions_or_profile(self):
        with patch("bff.api._load_portal_memberships", return_value=[]), patch("bff.api.proxy_request") as proxy:
            response = self.client.get("/api/v1/session/me")
        self.assertEqual(response.status_code, 403)
        proxy.assert_not_called()

    @override_settings(BFF_UPSTREAM_EVENTS_URL="http://events/api/v1")
    def test_live_member_reaches_service(self):
        member = {"tenant_id":str(self.tenant.id), "tenant_slug":"alpha"}
        with patch("bff.api._load_portal_memberships", return_value=[member]), patch("bff.api.proxy_request", return_value=httpx.Response(200, json={"items":[]})) as proxy:
            response = self.client.get("/api/v1/events/events")
        self.assertEqual(response.status_code, 200, response.content)
        proxy.assert_called_once()
