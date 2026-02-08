"""Tests for path-based multi-tenancy: session tenant context, switch-tenant,
session/tenants, entry/me endpoints."""

from __future__ import annotations

import json
import uuid
from datetime import timedelta
from unittest.mock import patch

import httpx
from django.test import Client, TestCase

from bff.models import Tenant
from bff.session_store import SessionStore
from bff.tenant import (
    resolve_tenant_by_slug,
    tenant_slug_from_host,
    validate_tenant_slug,
)


class TenantSlugValidationTests(TestCase):
    """Unit tests for tenant slug format validation."""

    def test_valid_slugs(self):
        valid = ["aef", "my-tenant", "a1", "foo-bar-baz", "ab", "a" * 32]
        for slug in valid:
            with self.subTest(slug=slug):
                self.assertTrue(validate_tenant_slug(slug), f"Expected valid: {slug}")

    def test_invalid_slugs(self):
        invalid = [
            "",
            "-foo",
            "foo-",
            "foo bar",
            "foo.bar",
            "a" * 33,
            "foo_bar",
            "--",
            " ",
            None,
        ]
        for slug in invalid:
            with self.subTest(slug=slug):
                self.assertFalse(
                    validate_tenant_slug(slug), f"Expected invalid: {slug}"
                )

    def test_single_char_slug(self):
        self.assertTrue(validate_tenant_slug("a"))
        self.assertTrue(validate_tenant_slug("1"))
        self.assertFalse(validate_tenant_slug("-"))


class SessionStoreActiveTenantTests(TestCase):
    """Tests for set_active_tenant / clear_active_tenant on SessionStore."""

    def setUp(self):
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())
        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )

    def test_new_session_has_empty_active_tenant(self):
        data = self.store.get(self.session.session_id)
        self.assertIsNotNone(data)
        self.assertEqual(data.active_tenant_id, "")
        self.assertEqual(data.active_tenant_slug, "")

    def test_set_active_tenant(self):
        updated = self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(self.tenant.id),
            tenant_slug="aef",
        )
        self.assertIsNotNone(updated)
        self.assertEqual(updated.active_tenant_id, str(self.tenant.id))
        self.assertEqual(updated.active_tenant_slug, "aef")
        self.assertNotEqual(updated.active_tenant_set_at, "")
        self.assertEqual(updated.last_tenant_slug, "aef")

    def test_set_active_tenant_persistence(self):
        self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(self.tenant.id),
            tenant_slug="aef",
        )
        data = self.store.get(self.session.session_id)
        self.assertEqual(data.active_tenant_slug, "aef")

    def test_clear_active_tenant(self):
        self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(self.tenant.id),
            tenant_slug="aef",
        )
        cleared = self.store.clear_active_tenant(self.session.session_id)
        self.assertIsNotNone(cleared)
        self.assertEqual(cleared.active_tenant_id, "")
        self.assertEqual(cleared.active_tenant_slug, "")
        # last_tenant should be preserved
        self.assertEqual(cleared.last_tenant_slug, "aef")

    def test_set_active_tenant_nonexistent_session(self):
        result = self.store.set_active_tenant(
            str(uuid.uuid4()),
            tenant_id=str(self.tenant.id),
            tenant_slug="aef",
        )
        self.assertIsNone(result)

    def test_tenants_cache(self):
        tenants = [{"tenant_id": "a", "tenant_slug": "foo"}]
        self.store.cache_user_tenants(self.user_id, tenants, ttl=60)
        cached = self.store.get_cached_user_tenants(self.user_id)
        self.assertEqual(cached, tenants)

    def test_tenants_cache_invalidation(self):
        tenants = [{"tenant_id": "a", "tenant_slug": "foo"}]
        self.store.cache_user_tenants(self.user_id, tenants, ttl=60)
        self.store.invalidate_user_tenants_cache(self.user_id)
        self.assertIsNone(self.store.get_cached_user_tenants(self.user_id))


class SwitchTenantEndpointTests(TestCase):
    """Integration tests for POST /api/v1/session/switch-tenant."""

    CSRF_TOKEN = "test-csrf-token"

    def setUp(self):
        self.client = Client()
        self.tenant_a = Tenant.objects.create(slug="aef")
        self.tenant_b = Tenant.objects.create(slug="other")
        self.user_id = str(uuid.uuid4())

        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant_a.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        self.cookie_name = "updspace_session"
        self.client.cookies["updspace_csrf"] = self.CSRF_TOKEN

    def _mock_memberships(self, memberships):
        """Mock ID service response for user memberships."""

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
            if upstream_path == "me" and method == "GET":
                return httpx.Response(200, json={"memberships": memberships})
            return httpx.Response(404, json={})

        return _mocked_proxy

    def _csrf_post(self, path, data, **kwargs):
        """POST with double-submit CSRF token."""
        return self.client.post(
            path,
            data=data,
            content_type="application/json",
            HTTP_X_CSRF_TOKEN=self.CSRF_TOKEN,
            **kwargs,
        )

    def test_switch_tenant_success(self):
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = [
            {
                "tenant_id": str(self.tenant_a.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "owner",
                "display_name": "AEF",
            },
        ]

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch(
                "bff.api.proxy_request", side_effect=self._mock_memberships(memberships)
            ):
                resp = self._csrf_post(
                    "/api/v1/session/switch-tenant",
                    data=json.dumps({"tenant_slug": "aef"}),
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["active_tenant"]["tenant_slug"], "aef")
        self.assertEqual(data["redirect_to"], "/t/aef/")

        # Verify session was updated
        session_data = self.store.get(self.session.session_id)
        self.assertEqual(session_data.active_tenant_slug, "aef")

    def test_switch_tenant_without_auth(self):
        self.client.cookies["updspace_csrf"] = self.CSRF_TOKEN
        resp = self._csrf_post(
            "/api/v1/session/switch-tenant",
            data=json.dumps({"tenant_slug": "aef"}),
            HTTP_HOST="portal.updating.space",
        )
        self.assertEqual(resp.status_code, 401)

    def test_switch_tenant_invalid_slug(self):
        self.client.cookies[self.cookie_name] = self.session.session_id

        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self._csrf_post(
                "/api/v1/session/switch-tenant",
                data=json.dumps({"tenant_slug": "INVALID SLUG!"}),
                HTTP_HOST="portal.updating.space",
            )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error"]["code"], "INVALID_SLUG")

    def test_switch_tenant_no_membership(self):
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = [
            {
                "tenant_id": str(self.tenant_a.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "member",
                "display_name": "AEF",
            },
        ]

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch(
                "bff.api.proxy_request", side_effect=self._mock_memberships(memberships)
            ):
                resp = self._csrf_post(
                    "/api/v1/session/switch-tenant",
                    data=json.dumps({"tenant_slug": "other"}),
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["error"]["code"], "TENANT_FORBIDDEN")

    def test_switch_tenant_not_found(self):
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = []

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch(
                "bff.api.proxy_request", side_effect=self._mock_memberships(memberships)
            ):
                resp = self._csrf_post(
                    "/api/v1/session/switch-tenant",
                    data=json.dumps({"tenant_slug": "nonexistent"}),
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()["error"]["code"], "TENANT_NOT_FOUND")

    def test_switch_tenant_inactive_membership(self):
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = [
            {
                "tenant_id": str(self.tenant_a.id),
                "tenant_slug": "aef",
                "status": "suspended",
                "base_role": "member",
                "display_name": "AEF",
            },
        ]

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch(
                "bff.api.proxy_request", side_effect=self._mock_memberships(memberships)
            ):
                resp = self._csrf_post(
                    "/api/v1/session/switch-tenant",
                    data=json.dumps({"tenant_slug": "aef"}),
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["error"]["code"], "TENANT_FORBIDDEN")


class SessionTenantsEndpointTests(TestCase):
    """Integration tests for GET /api/v1/session/tenants."""

    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())

        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )
        self.cookie_name = "updspace_session"

    def test_session_tenants_returns_memberships(self):
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = [
            {
                "tenant_id": str(self.tenant.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "owner",
                "display_name": "AEF",
            },
        ]

        def _mocked_proxy(**kwargs):
            if kwargs.get("upstream_path") == "me" and kwargs.get("method") == "GET":
                return httpx.Response(200, json={"memberships": memberships})
            return httpx.Response(404, json={})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(
                    "/api/v1/session/tenants",
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["tenant_slug"], "aef")

    def test_session_tenants_without_auth(self):
        resp = self.client.get(
            "/api/v1/session/tenants",
            HTTP_HOST="portal.updating.space",
        )
        self.assertEqual(resp.status_code, 401)


class EntryMeEndpointTests(TestCase):
    """Integration tests for GET /api/v1/entry/me (tenantless)."""

    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())

        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )
        self.cookie_name = "updspace_session"

    def test_entry_me_returns_user_and_memberships(self):
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = [
            {
                "tenant_id": str(self.tenant.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "owner",
                "display_name": "AEF",
            },
        ]

        def _mocked_proxy(**kwargs):
            if kwargs.get("upstream_path") == "me" and kwargs.get("method") == "GET":
                return httpx.Response(200, json={"memberships": memberships})
            if kwargs.get("upstream_path") == "tenant-applications":
                return httpx.Response(200, json=[])
            return httpx.Response(404, json={})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(
                    "/api/v1/entry/me",
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("user", data)
        self.assertIn("memberships", data)
        self.assertEqual(len(data["memberships"]), 1)
        self.assertEqual(data["memberships"][0]["tenant_slug"], "aef")

    def test_entry_me_includes_last_tenant(self):
        # Set active tenant first to populate last_tenant
        self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(self.tenant.id),
            tenant_slug="aef",
        )
        self.store.clear_active_tenant(self.session.session_id)

        self.client.cookies[self.cookie_name] = self.session.session_id

        def _mocked_proxy(**kwargs):
            if kwargs.get("upstream_path") == "me" and kwargs.get("method") == "GET":
                return httpx.Response(200, json={"memberships": []})
            if kwargs.get("upstream_path") == "tenant-applications":
                return httpx.Response(200, json=[])
            return httpx.Response(404, json={})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(
                    "/api/v1/entry/me",
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["last_tenant"]["tenant_slug"], "aef")

    def test_entry_me_without_auth(self):
        resp = self.client.get(
            "/api/v1/entry/me",
            HTTP_HOST="portal.updating.space",
        )
        self.assertEqual(resp.status_code, 401)

    def test_entry_me_does_not_send_tenant_headers_to_id(self):
        """Membership fetch must NOT send X-Tenant-Id to avoid ID service filtering."""
        self.client.cookies[self.cookie_name] = self.session.session_id

        captured_calls: list[dict] = []

        def _capturing_proxy(**kwargs):
            captured_calls.append(kwargs)
            if kwargs.get("upstream_path") == "me" and kwargs.get("method") == "GET":
                return httpx.Response(200, json={"memberships": []})
            if kwargs.get("upstream_path") == "tenant-applications":
                return httpx.Response(200, json=[])
            return httpx.Response(404, json={})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_capturing_proxy):
                resp = self.client.get(
                    "/api/v1/entry/me",
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 200)

        # Find the /me proxy call
        me_calls = [c for c in captured_calls if c.get("upstream_path") == "me"]
        self.assertEqual(len(me_calls), 1)

        ctx_headers = me_calls[0]["context_headers"]
        self.assertNotIn("X-Tenant-Id", ctx_headers)
        self.assertNotIn("X-Tenant-Slug", ctx_headers)
        self.assertIn("X-User-Id", ctx_headers)


class DownstreamTenantHeadersTests(TestCase):
    """Verify downstream services get correct X-Tenant-* headers from active session tenant."""

    def setUp(self):
        self.client = Client()
        self.tenant_a = Tenant.objects.create(slug="aef")
        self.tenant_b = Tenant.objects.create(slug="beta")
        self.user_id = str(uuid.uuid4())

        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant_a.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )
        # Set active tenant to tenant_a
        self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(self.tenant_a.id),
            tenant_slug="aef",
        )
        self.cookie_name = "updspace_session"

    def test_proxy_uses_active_tenant_from_session(self):
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
            captured.update(context_headers)
            return httpx.Response(200, json={"ok": True})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_PORTAL_URL="http://portal:8003/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(
                    "/api/v1/portal/something",
                    # Note: host doesn't need to match tenant (path-based mode)
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(captured.get("X-Tenant-Id"), str(self.tenant_a.id))
        self.assertEqual(captured.get("X-Tenant-Slug"), "aef")


class SessionMeWithActiveTenantTests(TestCase):
    """Tests for session/me returning active_tenant and available_tenants."""

    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())

        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(self.tenant.id),
            tenant_slug="aef",
        )
        self.cookie_name = "updspace_session"

    def test_session_me_includes_active_tenant(self):
        self.client.cookies[self.cookie_name] = self.session.session_id

        memberships = [
            {
                "tenant_id": str(self.tenant.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "owner",
                "display_name": "AEF",
            },
        ]

        def _mocked_proxy(**kwargs):
            up = kwargs.get("upstream_path", "")
            method = kwargs.get("method", "GET")
            if up == "portal/me" and method == "GET":
                return httpx.Response(200, json={"username": "user1"})
            if up == "me" and method == "GET":
                return httpx.Response(
                    200,
                    json={
                        "user": {"first_name": "Test"},
                        "memberships": memberships,
                    },
                )
            if "check" in up:
                return httpx.Response(
                    200,
                    json={
                        "allowed": True,
                        "effective_permissions": ["portal.profile.read_self"],
                        "effective_roles": [],
                    },
                )
            if up == "access/rollout/evaluate":
                return httpx.Response(
                    200,
                    json={
                        "feature_flags": {"new_header": True},
                        "experiments": {"home_v2": {"eligible": True, "variant": "B"}},
                    },
                )
            return httpx.Response(200, json={})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_PORTAL_URL="http://portal:8003/api/v1",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
            BFF_UPSTREAM_ACCESS_URL="http://access:8002/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(
                    "/api/v1/session/me",
                    HTTP_HOST="aef.updspace.com",
                )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("active_tenant", data)
        self.assertIsNotNone(data["active_tenant"])
        self.assertEqual(data["active_tenant"]["tenant_slug"], "aef")
        self.assertIn("available_tenants", data)
        self.assertIn("feature_flags", data)
        self.assertIn("experiments", data)


# ===================================================================
# Additional edge-case tests for full branch coverage
# ===================================================================


class TenantSlugFromHostTests(TestCase):
    """Edge case tests for tenant_slug_from_host."""

    def test_exact_suffix_returns_none(self):
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            self.assertIsNone(tenant_slug_from_host("updspace.com"))

    def test_subdomain_extracted(self):
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            self.assertEqual(tenant_slug_from_host("aef.updspace.com"), "aef")

    def test_host_with_port(self):
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            self.assertEqual(tenant_slug_from_host("aef.updspace.com:8080"), "aef")

    def test_unrelated_host_returns_none(self):
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            self.assertIsNone(tenant_slug_from_host("example.com"))

    def test_api_prefix_skipped(self):
        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com", BFF_TENANT_API_PREFIX="api"
        ):
            self.assertEqual(tenant_slug_from_host("api.aef.updspace.com"), "aef")

    def test_empty_subdomain(self):
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            self.assertIsNone(tenant_slug_from_host(".updspace.com"))

    def test_uppercase_host_normalized(self):
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            self.assertEqual(tenant_slug_from_host("AEF.UPDSPACE.COM"), "aef")

    def test_reserved_slug_portal_returns_none(self):
        """portal.localhost should NOT resolve to tenant slug 'portal'."""
        with self.settings(BFF_TENANT_HOST_SUFFIX="localhost"):
            self.assertIsNone(tenant_slug_from_host("portal.localhost"))

    def test_reserved_slug_www_returns_none(self):
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            self.assertIsNone(tenant_slug_from_host("www.updspace.com"))

    def test_reserved_slug_admin_returns_none(self):
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            self.assertIsNone(tenant_slug_from_host("admin.updspace.com"))

    def test_custom_reserved_slugs(self):
        with self.settings(
            BFF_TENANT_HOST_SUFFIX="localhost",
            BFF_RESERVED_HOST_SLUGS=("portal", "staging"),
        ):
            self.assertIsNone(tenant_slug_from_host("portal.localhost"))
            self.assertIsNone(tenant_slug_from_host("staging.localhost"))
            self.assertEqual(tenant_slug_from_host("aef.localhost"), "aef")


class ResolveTenantBySlugTests(TestCase):
    """Tests for resolve_tenant_by_slug path-based resolution."""

    def test_resolve_existing_tenant(self):
        Tenant.objects.create(slug="existing")
        result = resolve_tenant_by_slug("existing")
        self.assertIsNotNone(result)
        self.assertEqual(result.slug, "existing")

    def test_resolve_nonexistent_slug(self):
        result = resolve_tenant_by_slug("nonexistent")
        self.assertIsNone(result)

    def test_resolve_invalid_slug_format(self):
        result = resolve_tenant_by_slug("INVALID!")
        self.assertIsNone(result)

    def test_resolve_empty_slug(self):
        result = resolve_tenant_by_slug("")
        self.assertIsNone(result)

    def test_resolve_auto_create_in_dev_mode(self):
        with self.settings(DEBUG=True, BFF_DEV_AUTO_TENANT=True):
            result = resolve_tenant_by_slug("auto-created")
            self.assertIsNotNone(result)
            self.assertEqual(result.slug, "auto-created")
            # Tenant should exist in DB now
            self.assertTrue(Tenant.objects.filter(slug="auto-created").exists())


class SessionStoreEdgeCaseTests(TestCase):
    """Additional edge cases for SessionStore."""

    def setUp(self):
        self.tenant = Tenant.objects.create(slug="test")
        self.user_id = str(uuid.uuid4())
        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )

    def test_set_active_tenant_twice_updates(self):
        """Second set_active_tenant overwrites the first."""
        tenant_b = Tenant.objects.create(slug="other")
        self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(self.tenant.id),
            tenant_slug="test",
        )
        self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(tenant_b.id),
            tenant_slug="other",
        )
        data = self.store.get(self.session.session_id)
        self.assertEqual(data.active_tenant_slug, "other")
        self.assertEqual(data.last_tenant_slug, "other")

    def test_clear_then_set_preserves_last(self):
        """Clear then re-set should update last_tenant to new value."""
        self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(self.tenant.id),
            tenant_slug="test",
        )
        self.store.clear_active_tenant(self.session.session_id)
        data = self.store.get(self.session.session_id)
        self.assertEqual(data.active_tenant_slug, "")
        self.assertEqual(data.last_tenant_slug, "test")

        # Re-set to different tenant
        tenant_b = Tenant.objects.create(slug="new-tenant")
        self.store.set_active_tenant(
            self.session.session_id,
            tenant_id=str(tenant_b.id),
            tenant_slug="new-tenant",
        )
        data = self.store.get(self.session.session_id)
        self.assertEqual(data.active_tenant_slug, "new-tenant")
        self.assertEqual(data.last_tenant_slug, "new-tenant")

    def test_clear_nonexistent_session(self):
        result = self.store.clear_active_tenant(str(uuid.uuid4()))
        self.assertIsNone(result)

    def test_revoke_removes_session(self):
        self.store.revoke(self.session.session_id)
        self.assertIsNone(self.store.get(self.session.session_id))

    def test_cache_overwrite(self):
        """Re-caching tenants list overwrites previous."""
        self.store.cache_user_tenants(self.user_id, [{"a": 1}], ttl=60)
        self.store.cache_user_tenants(self.user_id, [{"b": 2}], ttl=60)
        cached = self.store.get_cached_user_tenants(self.user_id)
        self.assertEqual(cached, [{"b": 2}])

    def test_cache_miss_returns_none(self):
        self.assertIsNone(self.store.get_cached_user_tenants("nonexistent-user"))


class MiddlewareTenantContextTests(TestCase):
    """Tests for middleware tenant context resolution paths."""

    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())

        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )
        self.cookie_name = "updspace_session"

    def test_tenantless_endpoint_without_tenant(self):
        """Tenantless endpoints should work without active tenant."""
        self.client.cookies[self.cookie_name] = self.session.session_id

        memberships = [
            {
                "tenant_id": str(self.tenant.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "owner",
                "display_name": "AEF",
            },
        ]

        def _mocked_proxy(**kwargs):
            up = kwargs.get("upstream_path", "")
            if up == "me" and kwargs.get("method") == "GET":
                return httpx.Response(200, json={"memberships": memberships})
            if up == "tenant-applications":
                return httpx.Response(200, json=[])
            return httpx.Response(404, json={})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked_proxy):
                resp = self.client.get(
                    "/api/v1/entry/me",
                    HTTP_HOST="portal.updating.space",  # No tenant subdomain
                )
        self.assertEqual(resp.status_code, 200)

    def test_tenant_required_endpoint_without_active_tenant_returns_403(self):
        """Non-tenantless endpoints without active tenant → 403."""
        self.client.cookies[self.cookie_name] = self.session.session_id

        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self.client.get(
                "/api/v1/portal/something",
                HTTP_HOST="portal.updating.space",  # No tenant match
            )
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["error"]["code"], "TENANT_NOT_SELECTED")

    def test_request_without_session_proceeds(self):
        """Unauthenticated request on API path proceeds (auth enforced per-handler)."""
        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self.client.get(
                "/api/v1/session/login",
                HTTP_HOST="portal.updating.space",
            )
        # Should not be 403 — public endpoint
        self.assertNotEqual(resp.status_code, 403)


class RateLimitTests(TestCase):
    """Tests for session rate limiting middleware."""

    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="rl-test")
        self.user_id = str(uuid.uuid4())
        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={},
            ttl=timedelta(minutes=10),
        )
        self.cookie_name = "updspace_session"

    def test_rate_limit_triggered(self):
        """Exceeding rate limit on session endpoints returns 429."""
        self.client.cookies[self.cookie_name] = self.session.session_id

        memberships = [
            {
                "tenant_id": str(self.tenant.id),
                "tenant_slug": "rl-test",
                "status": "active",
                "base_role": "owner",
                "display_name": "RL",
            },
        ]

        def _mocked(**kwargs):
            if kwargs.get("upstream_path") == "me" and kwargs.get("method") == "GET":
                return httpx.Response(200, json={"memberships": memberships})
            return httpx.Response(200, json={})

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
            BFF_SESSION_RATE_LIMIT_PER_MIN=3,
        ):
            with patch("bff.api.proxy_request", side_effect=_mocked):
                # Make requests up to the limit
                for _ in range(3):
                    self.client.get(
                        "/api/v1/session/tenants",
                        HTTP_HOST="portal.updating.space",
                    )
                # This one should be rate-limited
                resp = self.client.get(
                    "/api/v1/session/tenants",
                    HTTP_HOST="portal.updating.space",
                )
        self.assertEqual(resp.status_code, 429)
        self.assertEqual(resp.json()["error"]["code"], "RATE_LIMITED")


class SwitchTenantEdgeCaseTests(TestCase):
    """Edge case tests for switch-tenant endpoint."""

    CSRF_TOKEN = "test-csrf-token"

    def setUp(self):
        self.client = Client()
        self.tenant = Tenant.objects.create(slug="aef")
        self.user_id = str(uuid.uuid4())

        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant.id),
            user_id=self.user_id,
            master_flags={"email_verified": True},
            ttl=timedelta(minutes=10),
        )
        self.cookie_name = "updspace_session"
        self.client.cookies["updspace_csrf"] = self.CSRF_TOKEN

    def _mock_memberships(self, memberships):
        def _mocked(**kwargs):
            if kwargs.get("upstream_path") == "me" and kwargs.get("method") == "GET":
                return httpx.Response(200, json={"memberships": memberships})
            return httpx.Response(404, json={})

        return _mocked

    def _csrf_post(self, path, data, **kwargs):
        return self.client.post(
            path,
            data=data,
            content_type="application/json",
            HTTP_X_CSRF_TOKEN=self.CSRF_TOKEN,
            **kwargs,
        )

    def test_switch_to_same_tenant_succeeds(self):
        """Switching to the same slug that's already active should still succeed."""
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = [
            {
                "tenant_id": str(self.tenant.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "owner",
                "display_name": "AEF",
            },
        ]

        # First switch
        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch(
                "bff.api.proxy_request", side_effect=self._mock_memberships(memberships)
            ):
                resp1 = self._csrf_post(
                    "/api/v1/session/switch-tenant",
                    data=json.dumps({"tenant_slug": "aef"}),
                    HTTP_HOST="portal.updating.space",
                )
        self.assertEqual(resp1.status_code, 200)

        # Second switch to same tenant
        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch(
                "bff.api.proxy_request", side_effect=self._mock_memberships(memberships)
            ):
                resp2 = self._csrf_post(
                    "/api/v1/session/switch-tenant",
                    data=json.dumps({"tenant_slug": "aef"}),
                    HTTP_HOST="portal.updating.space",
                )
        self.assertEqual(resp2.status_code, 200)

    def test_switch_empty_body(self):
        """Missing body returns 422 or similar error."""
        self.client.cookies[self.cookie_name] = self.session.session_id

        with self.settings(BFF_TENANT_HOST_SUFFIX="updspace.com"):
            resp = self._csrf_post(
                "/api/v1/session/switch-tenant",
                data="{}",
                HTTP_HOST="portal.updating.space",
            )
        # Should fail validation (missing tenant_slug)
        self.assertIn(resp.status_code, [400, 422])

    def test_switch_double_encoded_body(self):
        """Quoted JSON string payloads should still be accepted."""
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = [
            {
                "tenant_id": str(self.tenant.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "owner",
                "display_name": "AEF",
            },
        ]

        double_encoded = json.dumps(json.dumps({"tenant_slug": "aef"}))

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch(
                "bff.api.proxy_request", side_effect=self._mock_memberships(memberships)
            ):
                resp = self._csrf_post(
                    "/api/v1/session/switch-tenant",
                    data=double_encoded,
                    HTTP_HOST="portal.updating.space",
                )

        self.assertEqual(resp.status_code, 200)

    def test_switch_tenant_updates_last_tenant(self):
        """After switching, last_tenant_slug in session should be updated."""
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = [
            {
                "tenant_id": str(self.tenant.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "owner",
                "display_name": "AEF",
            },
        ]

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch(
                "bff.api.proxy_request", side_effect=self._mock_memberships(memberships)
            ):
                self._csrf_post(
                    "/api/v1/session/switch-tenant",
                    data=json.dumps({"tenant_slug": "aef"}),
                    HTTP_HOST="portal.updating.space",
                )

        session_data = self.store.get(self.session.session_id)
        self.assertEqual(session_data.last_tenant_slug, "aef")

    def test_switch_tenant_redirect_to(self):
        """Response should include redirect_to with /t/<slug>/."""
        self.client.cookies[self.cookie_name] = self.session.session_id
        memberships = [
            {
                "tenant_id": str(self.tenant.id),
                "tenant_slug": "aef",
                "status": "active",
                "base_role": "owner",
                "display_name": "AEF",
            },
        ]

        with self.settings(
            BFF_TENANT_HOST_SUFFIX="updspace.com",
            BFF_UPSTREAM_ID_URL="http://id:8001/api/v1",
        ):
            with patch(
                "bff.api.proxy_request", side_effect=self._mock_memberships(memberships)
            ):
                resp = self._csrf_post(
                    "/api/v1/session/switch-tenant",
                    data=json.dumps({"tenant_slug": "aef"}),
                    HTTP_HOST="portal.updating.space",
                )

        data = resp.json()
        self.assertEqual(data["redirect_to"], "/t/aef/")
