from __future__ import annotations

import json
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.test import Client, TestCase


User = get_user_model()


def post_json(client: Client, path: str, payload: dict[str, Any]):
    return client.post(path, data=json.dumps(payload), content_type="application/json")


class AuthApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.password = "StrongPass123!"

    def _create_user(
        self,
        username: str = "ivan",
        email: str = "ivan@example.com",
        password: str | None = None,
        is_active: bool = True,
    ):
        user = User.objects.create_user(username=username, email=email, password=password or self.password)
        if not is_active:
            user.is_active = False
            user.save(update_fields=["is_active"])
        return user

    def _login(self, client: Client, login: str, password: str | None = None):
        response = post_json(
            client,
            "/api/auth/login",
            {"login": login, "password": password or self.password},
        )
        self.assertEqual(response.status_code, 200)
        return response

    def test_register_creates_user_and_session(self):
        payload = {
            "username": "newuser",
            "email": "new@example.com",
            "password": self.password,
            "password_confirm": self.password,
        }
        response = post_json(self.client, "/api/auth/register", payload)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(User.objects.filter(username="newuser", email="new@example.com").exists())
        self.assertEqual(data["user"]["username"], payload["username"])
        self.assertEqual(data["user"]["email"], payload["email"])

        session_key = self.client.session.session_key
        self.assertIsNotNone(session_key)
        self.assertEqual(data["session"]["session_key"], session_key)
        self.assertTrue(Session.objects.filter(session_key=session_key).exists())

        meta = self.client.session.get("session_meta")
        self.assertIsInstance(meta, dict)
        self.assertIn("created_at", meta)
        self.assertIn("last_seen_at", meta)

    def test_register_rejects_mismatched_passwords(self):
        payload = {
            "username": "badpass",
            "email": "bad@example.com",
            "password": "BadPass123!",
            "password_confirm": "Mismatch!",
        }
        response = post_json(self.client, "/api/auth/register", payload)

        self.assertEqual(response.status_code, 400)
        self.assertIn("Пароли не совпадают", response.json()["detail"])

    def test_login_by_username_and_email(self):
        user = self._create_user(username="pavel", email="pavel@example.com")

        response_username = self._login(self.client, user.username)
        data_username = response_username.json()
        self.assertEqual(data_username["user"]["username"], "pavel")

        client_email = Client()
        response_email = self._login(client_email, user.email)
        data_email = response_email.json()
        self.assertEqual(data_email["user"]["email"], "pavel@example.com")

    def test_login_rejects_invalid_credentials(self):
        user = self._create_user(username="olga", email="olga@example.com")
        response = post_json(
            self.client,
            "/api/auth/login",
            {"login": user.username, "password": "WrongPass!"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("Неверный логин или пароль", response.json()["detail"])

    def test_login_rejects_inactive_user(self):
        user = self._create_user(username="inactive", email="inactive@example.com", is_active=False)
        response = post_json(
            self.client,
            "/api/auth/login",
            {"login": user.username, "password": self.password},
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("Аккаунт отключен", response.json()["detail"])

    def test_logout_clears_authenticated_session(self):
        user = self._create_user(username="kate", email="kate@example.com")
        self._login(self.client, user.username)

        response = self.client.post("/api/auth/logout")

        self.assertEqual(response.status_code, 204)
        self.assertIsNone(self.client.session.get("_auth_user_id"))

    def test_logout_returns_204_for_anonymous(self):
        response = self.client.post("/api/auth/logout")
        self.assertEqual(response.status_code, 204)

    def test_profile_requires_authentication(self):
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_profile_returns_user_and_sessions(self):
        user = self._create_user(username="masha", email="masha@example.com")
        self._login(self.client, user.username)

        response = self.client.get("/api/auth/me")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["user"]["username"], "masha")
        self.assertEqual(len(data["sessions"]), 1)
        self.assertTrue(data["sessions"][0]["is_current"])
        self.assertEqual(data["sessions"][0]["session_key"], self.client.session.session_key)

    def test_sessions_endpoint_requires_authentication(self):
        response = self.client.get("/api/auth/sessions")
        self.assertEqual(response.status_code, 401)

    def test_sessions_endpoint_lists_all_sessions_and_marks_current(self):
        user = self._create_user(username="sergey", email="sergey@example.com")
        client_one = Client()
        client_two = Client()
        self._login(client_one, user.username)
        self._login(client_two, user.username)

        session_one = client_one.session.session_key
        session_two = client_two.session.session_key
        response = client_two.get("/api/auth/sessions")

        self.assertEqual(response.status_code, 200)
        sessions = response.json()
        self.assertEqual(len(sessions), 2)
        current = next(item for item in sessions if item["is_current"])
        other = next(item for item in sessions if not item["is_current"])
        self.assertEqual(current["session_key"], session_two)
        self.assertEqual(other["session_key"], session_one)

    def test_drop_session_requires_authentication(self):
        response = self.client.delete("/api/auth/sessions/unknown")
        self.assertEqual(response.status_code, 401)

    def test_drop_session_removes_other_session(self):
        user = self._create_user(username="victor", email="victor@example.com")
        client_one = Client()
        client_two = Client()
        self._login(client_one, user.username)
        self._login(client_two, user.username)

        session_one = client_one.session.session_key
        session_two = client_two.session.session_key

        response = client_one.delete(f"/api/auth/sessions/{session_two}")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Session.objects.filter(session_key=session_two).exists())
        self.assertTrue(Session.objects.filter(session_key=session_one).exists())
        self.assertIsNotNone(client_one.session.get("_auth_user_id"))

    def test_drop_session_logs_out_current_session(self):
        user = self._create_user(username="tim", email="tim@example.com")
        self._login(self.client, user.username)
        session_key = self.client.session.session_key

        response = self.client.delete(f"/api/auth/sessions/{session_key}")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Session.objects.filter(session_key=session_key).exists())
        self.assertIsNone(self.client.session.get("_auth_user_id"))

    def test_drop_session_returns_404_for_foreign_session(self):
        user_one = self._create_user(username="userone", email="userone@example.com")
        user_two = self._create_user(username="usertwo", email="usertwo@example.com")

        client_one = Client()
        client_two = Client()
        self._login(client_one, user_one.username)
        self._login(client_two, user_two.username)

        session_two = client_two.session.session_key

        response = client_one.delete(f"/api/auth/sessions/{session_two}")

        self.assertEqual(response.status_code, 404)
        self.assertTrue(Session.objects.filter(session_key=session_two).exists())

    def test_drop_all_sessions_requires_authentication(self):
        response = self.client.post("/api/auth/sessions/revoke_all")
        self.assertEqual(response.status_code, 401)

    def test_drop_all_sessions_removes_other_sessions_only(self):
        user = self._create_user(username="aleksey", email="aleksey@dev.com")
        client_one = Client()
        client_two = Client()
        self._login(client_one, user.username)
        self._login(client_two, user.username)

        session_one = client_one.session.session_key
        session_two = client_two.session.session_key

        response = client_one.post("/api/auth/sessions/revoke_all")

        self.assertEqual(response.status_code, 204)
        self.assertTrue(Session.objects.filter(session_key=session_one).exists())
        self.assertFalse(Session.objects.filter(session_key=session_two).exists())
        self.assertIsNotNone(client_one.session.get("_auth_user_id"))
