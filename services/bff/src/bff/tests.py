from __future__ import annotations

import importlib
import hashlib
import hmac
import json
import os
import sys
import uuid
from datetime import timedelta
from io import StringIO
from unittest.mock import patch

import httpx
from django.conf import settings
from django.core.management import call_command
from django.core.exceptions import ImproperlyConfigured
from django.test import Client, RequestFactory, SimpleTestCase, TestCase
from django.utils import timezone
from ninja.errors import HttpError

from bff.models import BffSession, Tenant
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


class BffAccountDeletionTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())
        self.other_user_id = str(uuid.uuid4())
        self.primary_session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        self.secondary_session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        self.other_session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.other_user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        self.cookie_name = "updspace_session"
        self.host = "aef.updspace.com"

    def test_delete_account_runs_dsar_cleanup_before_identity_delete(self):
        self.client.cookies[self.cookie_name] = self.primary_session.session_id
        self.client.cookies["updspace_csrf"] = "csrf-token"
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
            if upstream_path in {
                f"portal/internal/dsar/users/{self.user_id}/erase",
                f"feed/internal/dsar/users/{self.user_id}/erase",
                f"access/internal/dsar/users/{self.user_id}/erase",
                f"internal/dsar/users/{self.user_id}/erase",
                f"gamification/internal/dsar/users/{self.user_id}/erase",
            }:
                return httpx.Response(200, json={"ok": True})
            if upstream_path == "auth/me" and method == "DELETE":
                return httpx.Response(204, content=b"")
            return httpx.Response(200, json={"ok": True})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_PORTAL_URL="http://portal:8003/api/v1",
            BFF_UPSTREAM_FEED_URL="http://activity:8006/api/v1",
            BFF_UPSTREAM_ACCESS_URL="http://access:8002/api/v1",
            BFF_UPSTREAM_EVENTS_URL="http://events:8005/api/v1",
            BFF_UPSTREAM_GAMIFICATION_URL="http://gamification:8007/api/v1",
            BFF_UPSTREAM_VOTING_URL="http://voting:8004/api/v1",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.delete(
                    "/api/v1/account/me",
                    HTTP_HOST=self.host,
                    HTTP_X_CSRF_TOKEN="csrf-token",
                )

        self.assertEqual(resp.status_code, 204)
        self.assertEqual(
            calls,
            [
                ("POST", f"portal/internal/dsar/users/{self.user_id}/erase"),
                ("POST", f"feed/internal/dsar/users/{self.user_id}/erase"),
                ("POST", f"access/internal/dsar/users/{self.user_id}/erase"),
                ("POST", f"internal/dsar/users/{self.user_id}/erase"),
                ("POST", f"gamification/internal/dsar/users/{self.user_id}/erase"),
                ("POST", f"internal/dsar/users/{self.user_id}/erase"),
                ("DELETE", "auth/me"),
            ],
        )
        self.assertIsNone(SessionStore().get(self.primary_session.session_id))
        self.assertIsNone(SessionStore().get(self.secondary_session.session_id))
        self.assertIsNotNone(SessionStore().get(self.other_session.session_id))

    def test_export_account_aggregates_service_bundles(self):
        self.client.cookies[self.cookie_name] = self.primary_session.session_id
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
            if upstream_path.endswith("/export"):
                service_name = upstream_path.split("/", 1)[0]
                if upstream_path.startswith("internal/"):
                    service_name = (
                        "events"
                        if upstream_base_url.startswith("http://events")
                        else "voting"
                    )
                return httpx.Response(
                    200,
                    json={"service": service_name, "tenant_id": str(self.tenant.id), "user_id": self.user_id},
                )
            return httpx.Response(200, json={"ok": True})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_PORTAL_URL="http://portal:8003/api/v1",
            BFF_UPSTREAM_FEED_URL="http://activity:8006/api/v1",
            BFF_UPSTREAM_ACCESS_URL="http://access:8002/api/v1",
            BFF_UPSTREAM_EVENTS_URL="http://events:8005/api/v1",
            BFF_UPSTREAM_GAMIFICATION_URL="http://gamification:8007/api/v1",
            BFF_UPSTREAM_VOTING_URL="http://voting:8004/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(
                    "/api/v1/account/me/export",
                    HTTP_HOST=self.host,
                )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["service"], "bff")
        self.assertEqual(
            sorted(data["bundles"].keys()),
            ["access", "activity", "bff", "events", "gamification", "portal", "voting"],
        )
        self.assertEqual(data["bundles"]["bff"]["service"], "bff")
        self.assertEqual(
            calls,
            [
                ("GET", f"portal/internal/dsar/users/{self.user_id}/export"),
                ("GET", f"feed/internal/dsar/users/{self.user_id}/export"),
                ("GET", f"access/internal/dsar/users/{self.user_id}/export"),
                ("GET", f"internal/dsar/users/{self.user_id}/export"),
                ("GET", f"gamification/internal/dsar/users/{self.user_id}/export"),
                ("GET", f"internal/dsar/users/{self.user_id}/export"),
            ],
        )


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

    def test_auth_login_without_id_url_returns_error(self):
        """GET /auth/login without ID_PUBLIC_BASE_URL returns 502."""
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
                "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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
        self.assertEqual(session_data.user_id, "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
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
                "sub": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
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
        self.assertEqual(me_data["user"]["id"], "b2c3d4e5-f6a7-8901-bcde-f12345678901")
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


class BffSettingsSecurityTests(SimpleTestCase):
    @staticmethod
    def _import_settings(env: dict[str, str]):
        original_module = sys.modules.get("app.settings")
        try:
            sys.modules.pop("app.settings", None)
            with patch.dict(os.environ, env, clear=True):
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
                    "ALLOWED_HOSTS": ".updspace.com,localhost",
                    "DATABASE_URL": "postgres://user:pass@db:5432/bff_db",
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
                    "DATABASE_URL": "postgres://user:pass@db:5432/bff_db",
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

        self.assertEqual(settings_module.SECRET_KEY, "insects-are-everywhere-bff")
        self.assertEqual(settings_module.ALLOWED_HOSTS, ["*"])
        self.assertEqual(
            settings_module.DATABASES["default"]["ENGINE"],
            "django.db.backends.sqlite3",
        )
        self.assertEqual(settings_module.X_FRAME_OPTIONS, "DENY")


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


class CsrfProtectionTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.tenant = Tenant.objects.create(slug="aef")
        self.host = "aef.updspace.com"
        self.logout_path = "/api/v1/session/logout"

    def test_csrf_bootstrap_sets_host_only_cookie(self):
        resp = self.client.get(
            "/api/v1/csrf",
            HTTP_HOST=self.host,
        )

        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        token = payload.get("csrfToken")
        self.assertIsInstance(token, str)
        self.assertTrue(token)
        self.assertIn(settings.CSRF_COOKIE_NAME, resp.cookies)
        self.assertNotIn(
            "Domain=",
            resp.cookies[settings.CSRF_COOKIE_NAME].OutputString(),
        )

    def test_unsigned_request_requires_csrf(self):
        resp = self.client.post(
            self.logout_path,
            data=b"",
            content_type="application/json",
            HTTP_HOST=self.host,
        )

        self.assertEqual(resp.status_code, 403)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "CSRF_FAILED")

    def test_valid_csrf_allows_request_to_reach_handler(self):
        bootstrap = self.client.get(
            "/api/v1/csrf",
            HTTP_HOST=self.host,
        )
        token = bootstrap.json()["csrfToken"]

        resp = self.client.post(
            self.logout_path,
            data=b"",
            content_type="application/json",
            HTTP_HOST=self.host,
            HTTP_X_CSRF_TOKEN=token,
        )

        self.assertEqual(resp.status_code, 401)
        payload = resp.json()
        self.assertEqual(payload["error"]["code"], "UNAUTHENTICATED")

    def test_internal_session_establish_is_csrf_exempt(self):
        body = json.dumps(
            {
                "user_id": str(uuid.uuid4()),
                "master_flags": {"email_verified": True},
            }
        ).encode("utf-8")
        secret = "callback-secret"
        signature = hmac.new(
            secret.encode("utf-8"),
            hashlib.sha256(body).hexdigest().encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        with self.settings(BFF_UPDSPACEID_CALLBACK_SECRET=secret):
            resp = self.client.post(
                "/api/v1/internal/session/establish",
                data=body,
                content_type="application/json",
                HTTP_HOST=self.host,
                HTTP_X_UPDSPACEID_SIGNATURE=signature,
            )

        self.assertEqual(resp.status_code, 204)
        self.assertIn(
            getattr(settings, "BFF_SESSION_COOKIE_NAME", "updspace_session"),
            resp.cookies,
        )


class BffSessionAuditTests(TestCase):
    """Verify that session create/revoke writes BffAuditEvent records."""

    def setUp(self):
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())

    def test_session_create_writes_audit_event(self):
        from bff.audit import BffAuditEvent

        session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )

        audits = list(
            BffAuditEvent.objects.filter(
                tenant_id=str(self.tenant.id),
                actor_user_id=self.user_id,
                action="session.created",
            )
        )
        self.assertEqual(len(audits), 1)
        event = audits[0]
        self.assertEqual(event.target_type, "bff_session")
        self.assertEqual(event.target_id, session.session_id)
        self.assertEqual(event.metadata["ttl_seconds"], 600)

    def test_session_revoke_writes_audit_event(self):
        from bff.audit import BffAuditEvent

        session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )
        # Clear creation audit
        BffAuditEvent.objects.all().delete()

        SessionStore().revoke(session.session_id)

        audits = list(
            BffAuditEvent.objects.filter(
                tenant_id=str(self.tenant.id),
                actor_user_id=self.user_id,
                action="session.revoked",
            )
        )
        self.assertEqual(len(audits), 1)
        event = audits[0]
        self.assertEqual(event.target_type, "bff_session")
        self.assertEqual(event.target_id, session.session_id)

    def test_logout_triggers_session_revoke_audit(self):
        from bff.audit import BffAuditEvent

        session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        # Clear creation audit
        BffAuditEvent.objects.all().delete()

        client = Client()
        cookie_name = "updspace_session"
        client.cookies[cookie_name] = session.session_id
        client.cookies["updspace_csrf"] = "csrf-token"
        host = "aef.updspace.com"

        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = client.post(
                "/api/v1/session/logout",
                HTTP_HOST=host,
                HTTP_X_CSRF_TOKEN="csrf-token",
            )

        self.assertEqual(resp.status_code, 204)
        audits = list(
            BffAuditEvent.objects.filter(
                action="session.revoked",
            )
        )
        self.assertEqual(len(audits), 1)

    def test_delete_account_writes_audit_event(self):
        from bff.audit import BffAuditEvent

        session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        # Clear creation audit
        BffAuditEvent.objects.all().delete()

        client = Client()
        cookie_name = "updspace_session"
        client.cookies[cookie_name] = session.session_id
        client.cookies["updspace_csrf"] = "csrf-token"
        host = "aef.updspace.com"

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
            if "erase" in upstream_path:
                return httpx.Response(200, json={"ok": True})
            if upstream_path == "auth/me" and method == "DELETE":
                return httpx.Response(204, content=b"")
            return httpx.Response(200, json={"ok": True})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_PORTAL_URL="http://portal:8003/api/v1",
            BFF_UPSTREAM_FEED_URL="http://activity:8006/api/v1",
            BFF_UPSTREAM_ACCESS_URL="http://access:8002/api/v1",
            BFF_UPSTREAM_EVENTS_URL="http://events:8005/api/v1",
            BFF_UPSTREAM_GAMIFICATION_URL="http://gamification:8007/api/v1",
            BFF_UPSTREAM_VOTING_URL="http://voting:8004/api/v1",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = client.delete(
                    "/api/v1/account/me",
                    HTTP_HOST=host,
                    HTTP_X_CSRF_TOKEN="csrf-token",
                )

        self.assertEqual(resp.status_code, 204)

        dsar_audits = list(BffAuditEvent.objects.filter(action="dsar.erased"))
        self.assertEqual(len(dsar_audits), 1)
        self.assertEqual(dsar_audits[0].target_id, "self")
        self.assertIn("voting", dsar_audits[0].metadata["services_erased"])

        account_audits = list(
            BffAuditEvent.objects.filter(action="account.deleted")
        )
        self.assertEqual(len(account_audits), 1)
        event = account_audits[0]
        self.assertEqual(event.target_type, "user_account")
        self.assertEqual(event.target_id, self.user_id)
        self.assertIn("bff", event.metadata["services_erased"])
        self.assertIn("events", event.metadata["services_erased"])

    def test_export_account_writes_audit_event(self):
        from bff.audit import BffAuditEvent

        session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        BffAuditEvent.objects.all().delete()

        client = Client()
        client.cookies["updspace_session"] = session.session_id
        host = "aef.updspace.com"

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
            return httpx.Response(200, json={"service": "ok"})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_PORTAL_URL="http://portal:8003/api/v1",
            BFF_UPSTREAM_FEED_URL="http://activity:8006/api/v1",
            BFF_UPSTREAM_ACCESS_URL="http://access:8002/api/v1",
            BFF_UPSTREAM_EVENTS_URL="http://events:8005/api/v1",
            BFF_UPSTREAM_GAMIFICATION_URL="http://gamification:8007/api/v1",
            BFF_UPSTREAM_VOTING_URL="http://voting:8004/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = client.get("/api/v1/account/me/export", HTTP_HOST=host)

        self.assertEqual(resp.status_code, 200)
        audits = list(BffAuditEvent.objects.filter(action="dsar.exported"))
        self.assertEqual(len(audits), 1)
        self.assertEqual(audits[0].target_id, "self")
        self.assertIn("bff", audits[0].metadata["services_exported"])


class BffRetentionCommandTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())

    def test_purge_retention_deletes_old_sessions_and_audit_rows(self):
        from bff.audit import BffAuditEvent

        old_session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )
        old_session_row = BffSession.objects.get(id=old_session.session_id)
        old_session_row.revoked_at = timezone.now() - timedelta(days=45)
        old_session_row.expires_at = timezone.now() - timedelta(days=45)
        old_session_row.save(update_fields=["revoked_at", "expires_at"])

        fresh_session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )

        old_audit = BffAuditEvent.objects.create(
            tenant_id=self.tenant.id,
            actor_user_id=self.user_id,
            action="session.revoked",
            target_type="bff_session",
            target_id=str(old_session.session_id),
            metadata={},
            created_at=timezone.now() - timedelta(days=400),
        )
        fresh_audit = BffAuditEvent.objects.create(
            tenant_id=self.tenant.id,
            actor_user_id=self.user_id,
            action="session.created",
            target_type="bff_session",
            target_id=str(fresh_session.session_id),
            metadata={},
        )

        call_command(
            "purge_retention",
            "--session-days=30",
            "--audit-days=365",
            stdout=StringIO(),
        )

        self.assertFalse(BffSession.objects.filter(id=old_session.session_id).exists())
        self.assertTrue(BffSession.objects.filter(id=fresh_session.session_id).exists())
        self.assertFalse(BffAuditEvent.objects.filter(id=old_audit.id).exists())
        self.assertTrue(BffAuditEvent.objects.filter(id=fresh_audit.id).exists())
