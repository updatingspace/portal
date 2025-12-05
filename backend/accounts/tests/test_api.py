from __future__ import annotations

import json
import time
from unittest.mock import patch

from allauth.account.models import EmailAddress
from allauth.mfa import app_settings as mfa_app_settings
from allauth.mfa.totp.internal import auth as totp_auth
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from ninja_jwt.tokens import RefreshToken

from core.models import UserSessionMeta, UserSessionToken

User = get_user_model()


def post_json(client: Client, path: str, payload: dict, *, token: str | None = None):
    headers = {"content_type": "application/json"}
    if token:
        headers["HTTP_X_SESSION_TOKEN"] = token
    return client.post(path, data=json.dumps(payload), **headers)


def patch_json(client: Client, path: str, payload: dict, *, token: str | None = None):
    headers = {"content_type": "application/json"}
    if token:
        headers["HTTP_X_SESSION_TOKEN"] = token
    return client.patch(path, data=json.dumps(payload), **headers)


class AccountsApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.password = "StrongPass123!"
        self.user = self._create_user()

    def _create_user(
        self,
        username: str = "ivan",
        email: str = "ivan@example.com",
        password: str | None = None,
    ) -> User:
        return User.objects.create_user(
            username=username, email=email, password=password or self.password
        )

    def login_and_get_token(
        self,
        client: Client | None = None,
        email: str | None = None,
        password: str | None = None,
    ) -> str:
        client = client or self.client
        resp = post_json(
            client,
            "/api/auth/login",
            {"email": email or self.user.email, "password": password or self.password},
        )
        self.assertEqual(resp.status_code, 200)
        token = resp.headers.get("X-Session-Token")
        self.assertTrue(token)
        return str(token)

    def test_headless_login_and_profile_requires_auth(self):
        resp = self.client.get("/api/auth/me")
        self.assertEqual(resp.status_code, 401)

        token = self.login_and_get_token()
        resp_ok = self.client.get("/api/auth/me", HTTP_X_SESSION_TOKEN=token)
        self.assertEqual(resp_ok.status_code, 200)
        data = resp_ok.json()
        self.assertEqual(data["username"], self.user.username)
        self.assertEqual(data["email"], self.user.email)
        self.assertFalse(data["has_2fa"])
        self.assertEqual(data["oauth_providers"], [])
        self.assertFalse(data["is_staff"])
        self.assertFalse(data["is_superuser"])

    def test_headless_login_rejects_invalid_credentials(self):
        resp = post_json(
            self.client,
            "/api/auth/login",
            {"email": self.user.email, "password": "wrong"},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("invalid credentials", resp.json()["detail"])

    def test_issue_jwt_and_refresh(self):
        token = self.login_and_get_token()
        resp_pair = self.client.post(
            "/api/auth/jwt/from_session", HTTP_X_SESSION_TOKEN=token
        )
        self.assertEqual(resp_pair.status_code, 200)
        payload = resp_pair.json()
        self.assertIn("access", payload)
        self.assertIn("refresh", payload)
        self.assertTrue(
            UserSessionMeta.objects.filter(
                user=self.user, session_key=self.client.session.session_key
            ).exists()
        )
        self.assertTrue(UserSessionToken.objects.filter(user=self.user).exists())

        resp_refresh = post_json(
            self.client,
            "/api/auth/refresh",
            {"refresh": payload["refresh"]},
        )
        self.assertEqual(resp_refresh.status_code, 200)
        refreshed = resp_refresh.json()
        self.assertIn("access", refreshed)
        self.assertIn("refresh", refreshed)

        resp_bad = post_json(
            self.client, "/api/auth/refresh", {"refresh": "not-a-token"}
        )
        self.assertEqual(resp_bad.status_code, 401)

        stray = RefreshToken.for_user(self.user)
        self.user.delete()
        resp_missing_user = post_json(
            self.client,
            "/api/auth/refresh",
            {"refresh": str(stray)},
        )
        self.assertEqual(resp_missing_user.status_code, 401)

    def test_change_password_validations_and_success(self):
        token = self.login_and_get_token()

        wrong_cur = post_json(
            self.client,
            "/api/auth/change_password",
            {"current_password": "nope", "new_password": "NewPass123!"},
            token=token,
        )
        self.assertEqual(wrong_cur.status_code, 400)

        empty_new = post_json(
            self.client,
            "/api/auth/change_password",
            {"current_password": self.password, "new_password": ""},
            token=token,
        )
        self.assertEqual(empty_new.status_code, 400)

        same_new = post_json(
            self.client,
            "/api/auth/change_password",
            {"current_password": self.password, "new_password": self.password},
            token=token,
        )
        self.assertEqual(same_new.status_code, 400)

        short_new = post_json(
            self.client,
            "/api/auth/change_password",
            {"current_password": self.password, "new_password": "short"},
            token=token,
        )
        self.assertEqual(short_new.status_code, 400)

        ok = post_json(
            self.client,
            "/api/auth/change_password",
            {"current_password": self.password, "new_password": "BetterPass123!"},
            token=token,
        )
        self.assertEqual(ok.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BetterPass123!"))

    def test_profile_update_and_avatar_without_field(self):
        token = self.login_and_get_token()

        resp_update = patch_json(
            self.client,
            "/api/auth/profile",
            {"first_name": "  Alice ", "last_name": "  Smith  "},
            token=token,
        )
        self.assertEqual(resp_update.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Alice")
        self.assertEqual(self.user.last_name, "Smith")

        fake_avatar = SimpleUploadedFile(
            "avatar.png", b"binarydata", content_type="image/png"
        )
        resp_avatar = self.client.post(
            "/api/auth/avatar",
            data={"avatar": fake_avatar},
            HTTP_X_SESSION_TOKEN=token,
        )
        self.assertEqual(resp_avatar.status_code, 200)
        data = resp_avatar.json()
        self.assertTrue(data["ok"])
        self.assertIn("Поле avatar отсутствует", data["message"])

    def test_email_status_and_resend(self):
        token = self.login_and_get_token()
        EmailAddress.objects.create(
            user=self.user, email=self.user.email, primary=True, verified=True
        )
        resp_status = self.client.get("/api/auth/email", HTTP_X_SESSION_TOKEN=token)
        self.assertEqual(resp_status.status_code, 200)
        payload = resp_status.json()
        self.assertEqual(payload["email"], self.user.email)
        self.assertTrue(payload["verified"])

        resp_resend = self.client.post(
            "/api/auth/email/resend", HTTP_X_SESSION_TOKEN=token
        )
        self.assertEqual(resp_resend.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(ACCOUNT_UNIQUE_EMAIL=True)
    def test_change_email_rejects_invalid_and_duplicates(self):
        token = self.login_and_get_token()
        other = self._create_user(username="other", email="other@example.com")
        EmailAddress.objects.create(
            user=other, email="dup@example.com", primary=True, verified=True
        )

        invalid = post_json(
            self.client,
            "/api/auth/email/change",
            {"new_email": "bad-email"},
            token=token,
        )
        self.assertEqual(invalid.status_code, 400)

        same = post_json(
            self.client,
            "/api/auth/email/change",
            {"new_email": self.user.email},
            token=token,
        )
        self.assertEqual(same.status_code, 200)

        dup = post_json(
            self.client,
            "/api/auth/email/change",
            {"new_email": "dup@example.com"},
            token=token,
        )
        self.assertEqual(dup.status_code, 400)

    def test_sessions_listing_and_revocation(self):
        token = self.login_and_get_token()
        resp_sessions = self.client.get(
            "/api/auth/sessions", HTTP_X_SESSION_TOKEN=token
        )
        self.assertEqual(resp_sessions.status_code, 200)
        sessions = resp_sessions.json()["sessions"]
        self.assertTrue(any(s["current"] for s in sessions))

        resp_missing = self.client.delete(
            "/api/auth/sessions/unknown",
            HTTP_X_SESSION_TOKEN=token,
        )
        self.assertEqual(resp_missing.status_code, 404)

        # Создаём вторую сессию для массового отключения
        other_client = Client()
        token_other = self.login_and_get_token(
            other_client, self.user.email, self.password
        )
        other_client.get("/api/auth/sessions", HTTP_X_SESSION_TOKEN=token_other)
        second_key = other_client.session.session_key

        bulk = post_json(
            self.client,
            "/api/auth/sessions/bulk",
            {"all_except_current": True},
            token=token,
        )
        self.assertEqual(bulk.status_code, 200)
        body = bulk.json()
        self.assertIn(second_key, body.get("revoked_ids", []))
        self.assertEqual(body.get("current"), self.client.session.session_key)

    def test_revoked_session_is_blocked(self):
        token = self.login_and_get_token()
        session_key = self.client.session.session_key
        UserSessionMeta.objects.update_or_create(
            user=self.user,
            session_key=session_key,
            defaults={
                "session_token": token,
                "revoked_at": timezone.now(),
                "revoked_reason": "manual",
            },
        )
        resp = self.client.get("/api/auth/sessions", HTTP_X_SESSION_TOKEN=token)
        self.assertEqual(resp.status_code, 401)

    def test_logout_and_session_cleanup(self):
        token = self.login_and_get_token()
        resp_logout = self.client.post("/api/auth/logout", HTTP_X_SESSION_TOKEN=token)
        self.assertEqual(resp_logout.status_code, 200)
        self.assertIsNone(self.client.session.get("_auth_user_id"))

    def test_oauth_provider_helpers(self):
        token = self.login_and_get_token()

        with patch(
            "accounts.services.oauth.OAuthService.configured_provider_ids",
            return_value={"dummy"},
        ), patch(
            "accounts.services.oauth.registry.as_choices",
            return_value=[("dummy", "Dummy")],
        ):
            resp_list = self.client.get(
                "/api/auth/oauth/providers", HTTP_X_SESSION_TOKEN=token
            )
            self.assertEqual(resp_list.status_code, 200)
            providers = resp_list.json()["providers"]
            self.assertEqual(providers, [{"id": "dummy", "name": "Dummy"}])

        resp_unknown = self.client.get(
            "/api/auth/oauth/link/missing", HTTP_X_SESSION_TOKEN=token
        )
        self.assertEqual(resp_unknown.status_code, 404)

        with patch(
            "accounts.services.oauth.OAuthService.configured_provider_ids",
            return_value={"dummy"},
        ), patch(
            "accounts.services.oauth.registry.as_choices",
            return_value=[("dummy", "Dummy")],
        ), patch(
            "accounts.services.oauth.reverse", return_value="/dummy/login/"
        ):
            resp_link = self.client.get(
                "/api/auth/oauth/link/dummy", HTTP_X_SESSION_TOKEN=token
            )
            self.assertEqual(resp_link.status_code, 200)
            link = resp_link.json()
            self.assertIn("process=connect", link["authorize_url"])
            self.assertEqual(link["method"], "POST")

    def test_mfa_totp_full_flow(self):
        token = self.login_and_get_token()

        resp_status = self.client.get(
            "/api/auth/mfa/status", HTTP_X_SESSION_TOKEN=token
        )
        self.assertEqual(resp_status.status_code, 200)
        self.assertFalse(resp_status.json()["has_totp"])

        resp_begin = self.client.post(
            "/api/auth/mfa/totp/begin",
            content_type="application/json",
            HTTP_X_SESSION_TOKEN=token,
        )
        self.assertEqual(resp_begin.status_code, 200)
        begin_payload = resp_begin.json()
        secret = begin_payload["secret"]
        counter = int(time.time()) // mfa_app_settings.TOTP_PERIOD
        code = totp_auth.format_hotp_value(totp_auth.hotp_value(secret, counter))

        resp_confirm = post_json(
            self.client,
            "/api/auth/mfa/totp/confirm",
            {"code": code},
            token=token,
        )
        self.assertEqual(resp_confirm.status_code, 200)
        confirm_payload = resp_confirm.json()
        self.assertTrue(confirm_payload["ok"])
        self.assertTrue(confirm_payload["recovery_codes"])

        resp_status_after = self.client.get(
            "/api/auth/mfa/status", HTTP_X_SESSION_TOKEN=token
        )
        self.assertEqual(resp_status_after.status_code, 200)
        data_after = resp_status_after.json()
        self.assertTrue(data_after["has_totp"])
        self.assertGreaterEqual(data_after["recovery_codes_left"], 0)

        resp_disable = self.client.post(
            "/api/auth/mfa/totp/disable",
            content_type="application/json",
            HTTP_X_SESSION_TOKEN=token,
        )
        self.assertEqual(resp_disable.status_code, 200)
        resp_status_final = self.client.get(
            "/api/auth/mfa/status", HTTP_X_SESSION_TOKEN=token
        )
        self.assertEqual(resp_status_final.status_code, 200)
        self.assertFalse(resp_status_final.json()["has_totp"])

    def test_regenerate_recovery_codes(self):
        token = self.login_and_get_token()

        resp_begin = self.client.post(
            "/api/auth/mfa/totp/begin",
            content_type="application/json",
            HTTP_X_SESSION_TOKEN=token,
        )
        self.assertEqual(resp_begin.status_code, 200)
        secret = resp_begin.json()["secret"]
        counter = int(time.time()) // mfa_app_settings.TOTP_PERIOD
        code = totp_auth.format_hotp_value(totp_auth.hotp_value(secret, counter))
        resp_confirm = post_json(
            self.client,
            "/api/auth/mfa/totp/confirm",
            {"code": code},
            token=token,
        )
        self.assertEqual(resp_confirm.status_code, 200)

        resp_regen = self.client.post(
            "/api/auth/mfa/recovery/regenerate",
            content_type="application/json",
            HTTP_X_SESSION_TOKEN=token,
        )
        self.assertEqual(resp_regen.status_code, 200)
        codes = resp_regen.json()["recovery_codes"]
        self.assertTrue(isinstance(codes, list) and len(codes) > 0)

    def test_passkeys_begin_respects_session_auth(self):
        token = self.login_and_get_token()

        resp_list = self.client.get("/api/auth/passkeys", HTTP_X_SESSION_TOKEN=token)
        self.assertEqual(resp_list.status_code, 200)
        self.assertEqual(resp_list.json()["authenticators"], [])

        resp_begin = post_json(
            self.client,
            "/api/auth/passkeys/begin",
            {"passwordless": True},
            token=token,
        )
        self.assertEqual(resp_begin.status_code, 200)
        body = resp_begin.json()
        self.assertIn("creation_options", body)
        self.assertIn("publicKey", body["creation_options"])
