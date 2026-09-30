"""The expected context is a consistency check, never an authorization source."""

from datetime import timedelta
from uuid import uuid4

from django.http import HttpResponse
from django.test import RequestFactory, TestCase

from bff.middleware import CookieSessionAuthMiddleware
from bff.models import Tenant
from bff.session_store import SessionStore


class ExpectedTenantTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(slug="first")
        self.store = SessionStore()
        self.session = self.store.create(
            tenant_id=str(self.tenant.id),
            user_id=str(uuid4()),
            master_flags={},
            ttl=timedelta(minutes=10),
        )
        self.store.set_active_tenant(
            self.session.session_id, tenant_id=str(self.tenant.id), tenant_slug="first"
        )
        self.middleware = CookieSessionAuthMiddleware(lambda request: HttpResponse())

    def call(self, expected=None, path="/api/v1/events/events"):
        request = RequestFactory().post(path)
        request.COOKIES["updspace_session"] = self.session.session_id
        if expected is not None:
            request.META["HTTP_X_PORTAL_EXPECTED_TENANT"] = expected
        return self.middleware.process_request(request)

    def test_other_tab_cannot_write_to_unexpected_tenant(self):
        response = self.call("second")
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 409)
        self.assertIn(b"TENANT_CONTEXT_CHANGED", response.content)

    def test_matching_context_is_allowed(self):
        self.assertIsNone(self.call("first"))

    def test_older_clients_remain_compatible(self):
        self.assertIsNone(self.call())

    def test_context_recovery_endpoint_is_allowed(self):
        self.assertIsNone(self.call("second", "/api/v1/session/switch-tenant"))
