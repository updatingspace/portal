"""Browser multipart requests must survive CSRF validation before proxy signing."""

import hashlib
import hmac
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

import httpx
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

from bff.models import Tenant
from bff.session_store import SessionStore


@override_settings(
    BFF_UPSTREAM_GAMIFICATION_URL="https://gamification.example/api/v1",
    BFF_INTERNAL_HMAC_SECRET="test-multipart-secret",
)
class MultipartProxyTests(TestCase):
    def setUp(self) -> None:
        self.client = Client(enforce_csrf_checks=True)
        self.tenant = Tenant.objects.create(slug="media-test")
        self.host = "portal.updspace.com"
        self.path = "/api/v1/gamification/media"
        session = SessionStore().create(
            tenant_id=str(self.tenant.id),
            user_id=str(uuid4()),
            master_flags={"membership_status": "active"},
            ttl=timedelta(minutes=10),
        )
        SessionStore().set_active_tenant(
            session.session_id,
            tenant_id=str(self.tenant.id),
            tenant_slug=self.tenant.slug,
        )
        self.client.cookies[settings.BFF_SESSION_COOKIE_NAME] = session.session_id
        self.token = self.client.get("/api/v1/csrf", HTTP_HOST=self.host).json()[
            "csrfToken"
        ]
        self.body = encode_multipart(
            BOUNDARY,
            {
                "file": SimpleUploadedFile(
                    "achievement.png",
                    b"\x89PNG\r\n\x1a\n\x00\xffbinary".ljust(2 * 1024 * 1024, b"\0"),
                    content_type="image/png",
                ),
            },
        )

    def test_csrf_protected_upload_preserves_exact_body_and_signature(self) -> None:
        received = []

        def upstream(request: httpx.Request) -> httpx.Response:
            received.append(request)
            return httpx.Response(200, json={"url": self.path + "/" + str(uuid4())})

        with patch(
            "bff.proxy.get_httpx_client",
            side_effect=lambda **_: httpx.Client(
                transport=httpx.MockTransport(upstream)
            ),
        ):
            response = self.client.generic(
                "POST",
                self.path,
                data=self.body,
                content_type=MULTIPART_CONTENT,
                HTTP_HOST=self.host,
                HTTP_X_CSRF_TOKEN=self.token,
            )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(received), 1)
        request = received[0]
        self.assertEqual(request.content, self.body)
        self.assertEqual(request.headers["content-type"], MULTIPART_CONTENT)
        self.assertEqual(request.headers["x-tenant-id"], str(self.tenant.id))
        signed = "\n".join(
            [
                "POST",
                self.path,
                hashlib.sha256(self.body).hexdigest(),
                request.headers["x-request-id"],
                request.headers["x-updspace-timestamp"],
            ]
        ).encode()
        expected = hmac.new(
            b"test-multipart-secret", signed, hashlib.sha256
        ).hexdigest()
        self.assertEqual(request.headers["x-updspace-signature"], expected)

    def test_invalid_csrf_never_reaches_upstream(self) -> None:
        with patch("bff.api.proxy_request") as proxy:
            response = self.client.generic(
                "POST",
                self.path,
                data=self.body,
                content_type=MULTIPART_CONTENT,
                HTTP_HOST=self.host,
                HTTP_X_CSRF_TOKEN="invalid",
            )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "CSRF_FAILED")
        proxy.assert_not_called()

    @override_settings(DATA_UPLOAD_MAX_MEMORY_SIZE=8)
    def test_oversized_body_is_rejected_before_proxying(self) -> None:
        with patch("bff.api.proxy_request") as proxy:
            response = self.client.generic(
                "POST",
                self.path,
                data=self.body,
                content_type=MULTIPART_CONTENT,
                HTTP_HOST=self.host,
                HTTP_X_CSRF_TOKEN=self.token,
            )
        self.assertEqual(response.status_code, 400)
        proxy.assert_not_called()

    def test_foreign_origin_is_rejected_even_with_valid_token(self) -> None:
        with patch("bff.api.proxy_request") as proxy:
            response = self.client.generic(
                "POST",
                self.path,
                data=self.body,
                content_type=MULTIPART_CONTENT,
                HTTP_HOST=self.host,
                HTTP_X_CSRF_TOKEN=self.token,
                HTTP_ORIGIN="https://untrusted.example",
            )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "CSRF_FAILED")
        proxy.assert_not_called()

    def test_expected_tenant_mismatch_is_rejected_before_upload(self) -> None:
        with patch("bff.api.proxy_request") as proxy:
            response = self.client.generic(
                "POST",
                self.path,
                data=self.body,
                content_type=MULTIPART_CONTENT,
                HTTP_HOST=self.host,
                HTTP_X_CSRF_TOKEN=self.token,
                HTTP_X_PORTAL_EXPECTED_TENANT="different-community",
            )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "TENANT_CONTEXT_CHANGED")
        proxy.assert_not_called()

    @override_settings(DATA_UPLOAD_MAX_MEMORY_SIZE=8)
    def test_anonymous_upload_is_denied_before_buffering_large_body(self) -> None:
        self.client.cookies.pop(settings.BFF_SESSION_COOKIE_NAME)
        with patch("bff.api.proxy_request") as proxy:
            response = self.client.generic(
                "POST",
                self.path,
                data=self.body,
                content_type=MULTIPART_CONTENT,
                HTTP_HOST=self.host,
                HTTP_X_CSRF_TOKEN=self.token,
            )
        self.assertEqual(response.status_code, 401)
        proxy.assert_not_called()
