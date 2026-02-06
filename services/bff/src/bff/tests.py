from __future__ import annotations

import json
import uuid
from datetime import timedelta
from unittest.mock import patch

import httpx
from django.test import Client, RequestFactory, SimpleTestCase, TestCase
from ninja.errors import HttpError

from bff.models import Tenant
from bff.security import require_internal_signature, sign_internal_request
from bff.session_store import SessionStore


class BffTenantIsolationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.tenant_a = Tenant.objects.create(slug="aef")
        self.tenant_b = Tenant.objects.create(slug="other")

        self.user_id = str(uuid.uuid4())
        self.session = SessionStore().create(
            tenant_id=str(self.tenant_a.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )

        self.cookie_name = "updspace_session"

    def test_other_tenant_host_denies_access(self):
        # Session minted for tenant_a, but host is tenant_b
        self.client.cookies[self.cookie_name] = self.session.session_id

        resp = self.client.get(
            "/api/v1/session/me",
            HTTP_HOST="other.updspace.com",
        )

        self.assertEqual(resp.status_code, 403)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "TENANT_MISMATCH")
        self.assertIn("request_id", payload["error"])

    def test_proxy_also_enforces_tenant_isolation(self):
        self.client.cookies[self.cookie_name] = self.session.session_id

        def _mocked_proxy(
            *,
            upstream_base_url,
            upstream_path,
            method,
            query_string,
            body,
            incoming_headers,
            context_headers,
            request_id,
            timeout=None,
        ):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "tenant": context_headers.get("X-Tenant-Slug"),
                },
            )

        with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
            resp = self.client.get(
                "/api/v1/portal/something",
                HTTP_HOST="other.updspace.com",
            )

        self.assertEqual(resp.status_code, 403)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "TENANT_MISMATCH")


class BffProxyRoutingTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())
        self.session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        self.cookie_name = "updspace_session"
        self.host = "aef.updspace.com"

    def _call_proxy(self, path: str, settings_overrides: dict[str, str]):
        self.client.cookies[self.cookie_name] = self.session.session_id
        captured: dict[str, str] = {}

        def _mocked_proxy(
            *,
            upstream_base_url,
            upstream_path,
            method,
            query_string,
            body,
            incoming_headers,
            context_headers,
            request_id,
            stream=False,
            timeout=None,
        ):
            captured["upstream_base_url"] = upstream_base_url
            captured["upstream_path"] = upstream_path
            return httpx.Response(200, json={"ok": True})

        with self.settings(**settings_overrides):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(path, HTTP_HOST=self.host)
        return resp, captured

    def test_access_proxy_adds_prefix_when_missing(self):
        resp, captured = self._call_proxy(
            "/api/v1/access/roles",
            {"BFF_UPSTREAM_ACCESS_URL": "http://access:8002/api/v1"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(captured["upstream_path"], "access/roles")

    def test_access_proxy_preserves_prefix_if_present(self):
        resp, captured = self._call_proxy(
            "/api/v1/access/roles",
            {"BFF_UPSTREAM_ACCESS_URL": "http://access:8002/api/v1/access"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(captured["upstream_path"], "roles")

    def test_portal_profiles_proxy_adds_prefix_when_missing(self):
        resp, captured = self._call_proxy(
            "/api/v1/portal/profiles",
            {"BFF_UPSTREAM_PORTAL_URL": "http://portal:8003/api/v1"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(captured["upstream_path"], "portal/profiles")


class BffSessionProfileSyncTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())
        self.session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        self.cookie_name = "updspace_session"
        self.host = "aef.updspace.com"

    def test_session_me_syncs_portal_names_from_id(self):
        self.client.cookies[self.cookie_name] = self.session.session_id
        calls: list[tuple[str, str]] = []

        def _mocked_proxy(
            *,
            upstream_base_url,
            upstream_path,
            method,
            query_string,
            body,
            incoming_headers,
            context_headers,
            request_id,
            stream=False,
            timeout=None,
        ):
            calls.append((method, upstream_path))
            if upstream_path == "portal/me" and method == "GET":
                return httpx.Response(
                    200,
                    json={"first_name": "", "last_name": "", "bio": None},
                )
            if upstream_path == "me" and method == "GET":
                return httpx.Response(
                    200,
                    json={
                        "user": {"first_name": "Max", "last_name": "Doe"},
                        "memberships": [],
                    },
                )
            if upstream_path == "portal/me" and method == "PATCH":
                return httpx.Response(
                    200,
                    json={"first_name": "Max", "last_name": "Doe", "bio": None},
                )
            return httpx.Response(200, json={"ok": True})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_PORTAL_URL="http://portal:8003/api/v1",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(
                    "/api/v1/session/me",
                    HTTP_HOST=self.host,
                )

        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(payload["portal_profile"]["first_name"], "Max")
        self.assertEqual(payload["portal_profile"]["last_name"], "Doe")
        self.assertIn(("PATCH", "portal/me"), calls)

    def test_session_me_includes_effective_capabilities_from_access(self):
        self.client.cookies[self.cookie_name] = self.session.session_id

        def _mocked_proxy(
            *,
            upstream_base_url,
            upstream_path,
            method,
            query_string,
            body,
            incoming_headers,
            context_headers,
            request_id,
            stream=False,
            timeout=None,
        ):
            if upstream_path == "portal/me" and method == "GET":
                return httpx.Response(200, json={"first_name": "", "last_name": "", "bio": None})

            if upstream_path == "me" and method == "GET":
                return httpx.Response(200, json={"user": {"first_name": "Max", "last_name": "Doe"}, "memberships": []})

            if upstream_path == "access/check" and method == "POST":
                payload = {}
                try:
                    payload = json.loads(body.decode("utf-8") if isinstance(body, (bytes, bytearray)) else "{}")
                except Exception:
                    payload = {}

                action = payload.get("action")
                if action == "portal.profile.read_self":
                    return httpx.Response(
                        200,
                        json={
                            "allowed": True,
                            "reason_code": "RBAC_ALLOW",
                            "effective_roles": [{"id": 1, "name": "member", "service": "portal"}],
                            "effective_permissions": ["portal.profile.read_self", "portal.posts.create_public"],
                        },
                    )
                if action == "activity.feed.read":
                    return httpx.Response(
                        200,
                        json={
                            "allowed": True,
                            "reason_code": "RBAC_ALLOW",
                            "effective_roles": [{"id": 2, "name": "member", "service": "activity"}],
                            "effective_permissions": ["activity.feed.read", "activity.news.create"],
                        },
                    )
                return httpx.Response(
                    200,
                    json={
                        "allowed": False,
                        "reason_code": "RBAC_DENY",
                        "effective_roles": [],
                        "effective_permissions": [],
                    },
                )

            return httpx.Response(200, json={"ok": True})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_PORTAL_URL="http://portal:8003/api/v1",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
            BFF_UPSTREAM_ACCESS_URL="http://access:8002/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(
                    "/api/v1/session/me",
                    HTTP_HOST=self.host,
                )

        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(
            payload.get("capabilities"),
            [
                "activity.feed.read",
                "activity.news.create",
                "portal.posts.create_public",
                "portal.profile.read_self",
            ],
        )
        self.assertEqual(payload.get("roles"), ["activity:member", "portal:member"])

class OidcAuthLoginTests(TestCase):
    """Tests for GET /auth/login OIDC redirect endpoint."""

    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.host = "aef.updspace.com"

    @patch.dict(
        "os.environ",
        {},
        clear=False,
    )
    def test_auth_login_redirects_to_idp(self):
        """GET /auth/login should redirect to ID.UpdSpace authorize URL."""
        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            ID_PUBLIC_BASE_URL="http://id.localhost",
            BFF_OIDC_CLIENT_ID="test-client-id",
            BFF_OIDC_CLIENT_SECRET="test-secret",
        ):
            resp = self.client.get(
                "/api/v1/auth/login?next=/app",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 302)
        location = resp["Location"]
        self.assertIn("http://id.localhost/authorize", location)
        self.assertIn("client_id=test-client-id", location)
        self.assertIn("response_type=code", location)
        self.assertIn("redirect_uri=", location)
        self.assertIn("state=", location)

    def test_auth_login_without_client_id_returns_error(self):
        """GET /auth/login without OIDC client_id configured returns 502."""
        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            ID_PUBLIC_BASE_URL="http://id.localhost",
            BFF_OIDC_CLIENT_ID="",
        ):
            resp = self.client.get(
                "/api/v1/auth/login",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 502)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "OIDC_NOT_CONFIGURED")

    def test_auth_login_without_id_url_returns_error(self):
        """GET /auth/login without ID_PUBLIC_BASE_URL configured returns 502."""
        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            ID_PUBLIC_BASE_URL="",
            BFF_UPSTREAM_ID_URL="",
            BFF_OIDC_CLIENT_ID="test-client",
        ):
            resp = self.client.get(
                "/api/v1/auth/login",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 502)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "OIDC_NOT_CONFIGURED")

    def test_auth_login_stores_state_in_cache(self):
        """GET /auth/login should store state→next mapping in cache."""
        from django.core.cache import cache

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            ID_PUBLIC_BASE_URL="http://id.localhost",
            BFF_OIDC_CLIENT_ID="test-client-id",
            BFF_OIDC_CLIENT_SECRET="test-secret",
        ):
            resp = self.client.get(
                "/api/v1/auth/login?next=/dashboard",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 302)
        location = resp["Location"]

        # Extract state from URL
        import re
        match = re.search(r"state=([^&]+)", location)
        self.assertIsNotNone(match)
        state = match.group(1)

        # Verify state is in cache
        cached = cache.get(f"oauth_state:{state}")
        self.assertIsNotNone(cached)
        self.assertEqual(cached["next"], "/dashboard")
        self.assertEqual(cached["tenant_id"], str(self.tenant.id))

    def test_auth_login_prevents_open_redirect(self):
        """GET /auth/login should not allow external URLs in next param."""
        from django.core.cache import cache

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            ID_PUBLIC_BASE_URL="http://id.localhost",
            BFF_OIDC_CLIENT_ID="test-client-id",
            BFF_OIDC_CLIENT_SECRET="test-secret",
        ):
            resp = self.client.get(
                "/api/v1/auth/login?next=https://evil.com/steal",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 302)
        location = resp["Location"]

        import re
        match = re.search(r"state=([^&]+)", location)
        state = match.group(1)

        cached = cache.get(f"oauth_state:{state}")
        # next should be sanitized to "/"
        self.assertEqual(cached["next"], "/")


class OidcAuthCallbackTests(TestCase):
    """Tests for GET /auth/callback OIDC token exchange endpoint."""

    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.host = "aef.updspace.com"

    def test_callback_without_code_returns_error(self):
        """GET /auth/callback without code param returns 400."""
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self.client.get(
                "/api/v1/auth/callback?state=abc123",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 400)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")

    def test_callback_without_state_returns_error(self):
        """GET /auth/callback without state param returns 400."""
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self.client.get(
                "/api/v1/auth/callback?code=abc123",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 400)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")

    def test_callback_with_invalid_state_returns_error(self):
        """GET /auth/callback with invalid/expired state returns 400."""
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self.client.get(
                "/api/v1/auth/callback?code=abc123&state=invalid-state",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 400)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "INVALID_STATE")

    def test_callback_with_state_tenant_mismatch_returns_error_and_preserves_state(self):
        """GET /auth/callback rejects state created for another tenant."""
        from django.core.cache import cache

        other_tenant = Tenant.objects.create(slug="other")
        state = "tenant-mismatch-state"
        cache.set(
            f"oauth_state:{state}",
            {"next": "/dashboard", "tenant_id": str(other_tenant.id)},
            timeout=600,
        )

        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self.client.get(
                f"/api/v1/auth/callback?code=abc123&state={state}",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 400)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "TENANT_MISMATCH")
        self.assertIsNotNone(cache.get(f"oauth_state:{state}"))

    def test_callback_with_oauth_error_returns_error(self):
        """GET /auth/callback with error param returns 400."""
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self.client.get(
                "/api/v1/auth/callback?error=access_denied",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 400)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "OAUTH_ERROR")

    @patch("httpx.post")
    @patch("httpx.get")
    def test_callback_success_creates_session_and_redirects(
        self, mock_get, mock_post
    ):
        """Successful callback creates session and redirects to next."""
        from django.core.cache import cache

        # Setup state in cache
        state = "valid-state-123"
        cache.set(
            f"oauth_state:{state}",
            {"next": "/dashboard", "tenant_id": str(self.tenant.id)},
            timeout=600,
        )

        # Mock token exchange response
        mock_post.return_value = httpx.Response(
            200,
            json={
                "access_token": "mock-access-token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
        )

        # Mock userinfo response
        mock_get.return_value = httpx.Response(
            200,
            json={
                "sub": "user-123-uuid",
                "email": "test@example.com",
                "master_flags": {"email_verified": True},
            },
        )

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id.internal:8001/api/v1",
            BFF_OIDC_CLIENT_ID="test-client",
            BFF_OIDC_CLIENT_SECRET="test-secret",
            BFF_SESSION_COOKIE_NAME="updspace_session",
            DEBUG=True,
        ):
            resp = self.client.get(
                f"/api/v1/auth/callback?code=auth-code-123&state={state}",
                HTTP_HOST=self.host,
            )

        # Should redirect to next path
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp["Location"], "/dashboard")

        # Should set session cookie
        self.assertIn("updspace_session", resp.cookies)
        session_id = resp.cookies["updspace_session"].value
        self.assertIsNotNone(session_id)

        # Verify session was created
        session_data = SessionStore().get(session_id)
        self.assertIsNotNone(session_data)
        self.assertEqual(session_data.user_id, "user-123-uuid")
        self.assertEqual(session_data.tenant_id, str(self.tenant.id))

        # Verify state was consumed (deleted from cache)
        self.assertIsNone(cache.get(f"oauth_state:{state}"))

    @patch("httpx.post")
    def test_callback_token_exchange_failure_returns_error(self, mock_post):
        """Failed token exchange returns 401."""
        from django.core.cache import cache

        state = "valid-state-456"
        cache.set(
            f"oauth_state:{state}",
            {"next": "/", "tenant_id": str(self.tenant.id)},
            timeout=600,
        )

        mock_post.return_value = httpx.Response(
            400,
            json={"error": "invalid_grant"},
        )

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id.internal:8001/api/v1",
            BFF_OIDC_CLIENT_ID="test-client",
            BFF_OIDC_CLIENT_SECRET="test-secret",
        ):
            resp = self.client.get(
                f"/api/v1/auth/callback?code=invalid-code&state={state}",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 401)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "TOKEN_EXCHANGE_FAILED")

    @patch("httpx.post")
    @patch("httpx.get")
    def test_callback_userinfo_failure_returns_error(self, mock_get, mock_post):
        """Failed userinfo fetch returns 401."""
        from django.core.cache import cache

        state = "valid-state-789"
        cache.set(
            f"oauth_state:{state}",
            {"next": "/", "tenant_id": str(self.tenant.id)},
            timeout=600,
        )

        mock_post.return_value = httpx.Response(
            200,
            json={"access_token": "mock-token"},
        )
        mock_get.return_value = httpx.Response(
            401,
            json={"error": "invalid_token"},
        )

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id.internal:8001/api/v1",
            BFF_OIDC_CLIENT_ID="test-client",
            BFF_OIDC_CLIENT_SECRET="test-secret",
        ):
            resp = self.client.get(
                f"/api/v1/auth/callback?code=valid-code&state={state}",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 401)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "USERINFO_FAILED")


class OidcAuthIntegrationTests(TestCase):
    """Integration tests for full OIDC auth flow."""

    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.host = "aef.updspace.com"

    @patch("httpx.post")
    @patch("httpx.get")
    def test_full_auth_flow(self, mock_get, mock_post):
        """Test complete login → callback → session flow."""
        from django.core.cache import cache

        # Step 1: Initiate login
        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            ID_PUBLIC_BASE_URL="http://id.localhost",
            BFF_OIDC_CLIENT_ID="portal-client",
            BFF_OIDC_CLIENT_SECRET="portal-secret",
            BFF_UPSTREAM_ID_URL="http://id.internal:8001/api/v1",
            BFF_SESSION_COOKIE_NAME="updspace_session",
            DEBUG=True,
        ):
            login_resp = self.client.get(
                "/api/v1/auth/login?next=/voting",
                HTTP_HOST=self.host,
            )

        self.assertEqual(login_resp.status_code, 302)
        authorize_url = login_resp["Location"]

        # Extract state for callback
        import re
        match = re.search(r"state=([^&]+)", authorize_url)
        state = match.group(1)

        # Verify state was stored
        cached = cache.get(f"oauth_state:{state}")
        self.assertEqual(cached["next"], "/voting")

        # Step 2: Simulate IdP callback (mock token + userinfo)
        mock_post.return_value = httpx.Response(
            200,
            json={
                "access_token": "real-access-token",
                "token_type": "Bearer",
                "id_token": "mock-id-token",
            },
        )
        mock_get.return_value = httpx.Response(
            200,
            json={
                "sub": "user-uuid-12345",
                "email": "voter@aef.com",
                "name": "Test Voter",
                "master_flags": {"system_admin": False},
            },
        )

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            ID_PUBLIC_BASE_URL="http://id.localhost",
            BFF_OIDC_CLIENT_ID="portal-client",
            BFF_OIDC_CLIENT_SECRET="portal-secret",
            BFF_UPSTREAM_ID_URL="http://id.internal:8001/api/v1",
            BFF_SESSION_COOKIE_NAME="updspace_session",
            DEBUG=True,
        ):
            callback_resp = self.client.get(
                f"/api/v1/auth/callback?code=auth-code-xyz&state={state}",
                HTTP_HOST=self.host,
            )

        # Should redirect to original next path
        self.assertEqual(callback_resp.status_code, 302)
        self.assertEqual(callback_resp["Location"], "/voting")

        # Should have session cookie
        session_id = callback_resp.cookies["updspace_session"].value

        # Step 3: Verify session works for /session/me
        self.client.cookies["updspace_session"] = session_id

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
        ):
            me_resp = self.client.get(
                "/api/v1/session/me",
                HTTP_HOST=self.host,
            )

        self.assertEqual(me_resp.status_code, 200)
        me_data = me_resp.json()
        self.assertEqual(me_data["user"]["id"], "user-uuid-12345")
        self.assertEqual(me_data["tenant"]["slug"], "aef")

    def test_unauthenticated_user_should_use_login_redirect(self):
        """Verify that unauthenticated /session/me returns 401."""
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self.client.get(
                "/api/v1/session/me",
                HTTP_HOST=self.host,
            )

        self.assertEqual(resp.status_code, 401)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "UNAUTHENTICATED")


class InternalSignatureVerifierTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.path = "/api/v1/session/logout"
        self.method = "POST"
        self.body = b'{"action":"logout"}'
        self.request_id = "req-123"

    def _make_request(
        self,
        *,
        request_id: str | None = None,
        timestamp: str | None = None,
        signature: str | None = None,
        body: bytes | None = None,
        method: str | None = None,
        path: str | None = None,
    ):
        headers: dict[str, str] = {}
        if request_id is not None:
            headers["HTTP_X_REQUEST_ID"] = request_id
        if timestamp is not None:
            headers["HTTP_X_UPDSPACE_TIMESTAMP"] = timestamp
        if signature is not None:
            headers["HTTP_X_UPDSPACE_SIGNATURE"] = signature
        return self.factory.generic(
            method or self.method,
            path or self.path,
            data=body if body is not None else self.body,
            content_type="application/json",
            **headers,
        )

    def _assert_http_error(
        self,
        request,
        *,
        status_code: int,
        code: str,
        message: str,
    ):
        with self.assertRaises(HttpError) as ctx:
            require_internal_signature(request)
        self.assertEqual(ctx.exception.status_code, status_code)
        payload = ctx.exception.message
        self.assertIsInstance(payload, dict)
        self.assertEqual(payload.get("code"), code)
        self.assertEqual(payload.get("message"), message)

    def test_missing_request_id(self):
        request = self._make_request(
            request_id=None,
            timestamp="1700000000",
            signature="sig",
        )
        with self.settings(BFF_INTERNAL_HMAC_SECRET="secret"):
            self._assert_http_error(
                request,
                status_code=400,
                code="MISSING_REQUEST_ID",
                message="X-Request-Id is required",
            )

    def test_missing_signature(self):
        request = self._make_request(
            request_id=self.request_id,
            timestamp="1700000000",
            signature=None,
        )
        with self.settings(BFF_INTERNAL_HMAC_SECRET="secret"):
            self._assert_http_error(
                request,
                status_code=401,
                code="UNAUTHORIZED",
                message="Missing internal signature",
            )

    def test_invalid_timestamp(self):
        request = self._make_request(
            request_id=self.request_id,
            timestamp="not-a-number",
            signature="sig",
        )
        with self.settings(BFF_INTERNAL_HMAC_SECRET="secret"):
            self._assert_http_error(
                request,
                status_code=401,
                code="UNAUTHORIZED",
                message="Invalid internal timestamp",
            )

    @patch("bff.security.time.time", return_value=1700000000)
    def test_expired_timestamp(self, _mock_time):
        request = self._make_request(
            request_id=self.request_id,
            timestamp="1699990000",
            signature="sig",
        )
        with self.settings(BFF_INTERNAL_HMAC_SECRET="secret"):
            self._assert_http_error(
                request,
                status_code=401,
                code="UNAUTHORIZED",
                message="Internal signature expired",
            )

    @patch("bff.security.time.time", return_value=1700000000)
    def test_missing_secret(self, _mock_time):
        request = self._make_request(
            request_id=self.request_id,
            timestamp="1700000000",
            signature="sig",
        )
        with self.settings(BFF_INTERNAL_HMAC_SECRET=""):
            self._assert_http_error(
                request,
                status_code=500,
                code="SERVER_ERROR",
                message="Internal HMAC secret is not configured",
            )

    @patch("bff.security.time.time", return_value=1700000000)
    def test_invalid_signature(self, _mock_time):
        request = self._make_request(
            request_id=self.request_id,
            timestamp="1700000000",
            signature="bad-signature",
        )
        with self.settings(BFF_INTERNAL_HMAC_SECRET="secret"):
            self._assert_http_error(
                request,
                status_code=401,
                code="UNAUTHORIZED",
                message="Invalid internal signature",
            )

    @patch("bff.security.time.time", return_value=1700000000)
    def test_valid_signature(self, _mock_time):
        with self.settings(BFF_INTERNAL_HMAC_SECRET="secret"):
            signed = sign_internal_request(
                method=self.method,
                path=self.path,
                body=self.body,
                request_id=self.request_id,
            )
            request = self._make_request(
                request_id=self.request_id,
                timestamp=signed.timestamp,
                signature=signed.signature,
                body=self.body,
            )
            require_internal_signature(request)


class InternalSignatureMiddlewareTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.host = "aef.updspace.com"
        self.path = "/api/v1/session/logout"
        self.request_id = "req-456"

    def test_unsigned_request_requires_csrf(self):
        resp = self.client.post(
            self.path,
            data=b"",
            content_type="application/json",
            HTTP_HOST=self.host,
        )

        self.assertEqual(resp.status_code, 403)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "CSRF_FAILED")

    @patch("bff.security.time.time", return_value=1700000000)
    def test_invalid_internal_signature_returns_unauthorized(self, _mock_time):
        with self.settings(BFF_INTERNAL_HMAC_SECRET="secret"):
            resp = self.client.post(
                self.path,
                data=b"",
                content_type="application/json",
                HTTP_HOST=self.host,
                HTTP_X_REQUEST_ID=self.request_id,
                HTTP_X_UPDSPACE_TIMESTAMP="1700000000",
                HTTP_X_UPDSPACE_SIGNATURE="bad-signature",
            )

        self.assertEqual(resp.status_code, 401)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "UNAUTHORIZED")
        self.assertEqual(payload["error"]["message"], "Invalid internal signature")

    @patch("bff.security.time.time", return_value=1700000000)
    def test_valid_internal_signature_skips_csrf(self, _mock_time):
        with self.settings(BFF_INTERNAL_HMAC_SECRET="secret"):
            signed = sign_internal_request(
                method="POST",
                path=self.path,
                body=b"",
                request_id=self.request_id,
            )
            resp = self.client.post(
                self.path,
                data=b"",
                content_type="application/json",
                HTTP_HOST=self.host,
                HTTP_X_REQUEST_ID=self.request_id,
                HTTP_X_UPDSPACE_TIMESTAMP=signed.timestamp,
                HTTP_X_UPDSPACE_SIGNATURE=signed.signature,
            )

        self.assertEqual(resp.status_code, 401)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "UNAUTHENTICATED")
