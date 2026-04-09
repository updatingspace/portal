from __future__ import annotations

import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from core.models import HomePageModal
from core.models import UserPreference as CoreUserPreference
from personalization.models import UserPreference

User = get_user_model()


class UserPreferenceModelTests(TestCase):
    """Tests for CoreUserPreference model (from core.models)"""

    def setUp(self):
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()

    def test_create_user_preference(self):
        """Test creating a user preference with defaults"""
        pref = CoreUserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        self.assertEqual(pref.theme, "auto")
        self.assertEqual(pref.theme_source, "portal")
        self.assertEqual(pref.accent_color, "#007AFF")
        self.assertEqual(pref.font_size, "medium")
        self.assertEqual(pref.language, "en")
        self.assertEqual(pref.timezone, "UTC")
        self.assertEqual(pref.profile_visibility, "members")
        self.assertTrue(pref.show_online_status)
        self.assertFalse(pref.show_vote_history)

    def test_user_preference_unique_constraint(self):
        """Test that user_id + tenant_id must be unique"""
        CoreUserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            CoreUserPreference.objects.create(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
            )

    def test_get_default_notification_settings(self):
        """Test default notification settings structure"""
        pref = CoreUserPreference(user_id=self.user_id, tenant_id=self.tenant_id)
        defaults = pref.get_default_notification_settings()

        self.assertIn("email", defaults)
        self.assertIn("in_app", defaults)
        self.assertIn("push", defaults)
        self.assertIn("types", defaults)
        self.assertIn("quiet_hours", defaults)
        self.assertTrue(defaults["email"]["enabled"])
        self.assertEqual(defaults["email"]["digest"], "daily")


class UserPreferenceApiTests(TestCase):
    """Tests for UserPreference API endpoints"""

    def setUp(self):
        self.client = Client()
        self.user_uuid = uuid.uuid4()
        self.tenant_uuid = uuid.uuid4()
        self.user_id = str(self.user_uuid)
        self.tenant_id = str(self.tenant_uuid)
        self.headers = {
            "HTTP_X_USER_ID": self.user_id,
            "HTTP_X_TENANT_ID": self.tenant_id,
        }

    def test_get_preferences_creates_default(self):
        """Test that GET creates default preferences if none exist"""
        response = self.client.get(
            "/api/personalization/preferences",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["user_id"], self.user_id)
        self.assertEqual(data["tenant_id"], self.tenant_id)
        self.assertEqual(data["appearance"]["theme"], "auto")
        self.assertEqual(data["appearance"]["theme_source"], "portal")
        self.assertEqual(data["localization"]["language"], "en")

    def test_get_preferences_returns_existing(self):
        """Test that GET returns existing preferences"""
        UserPreference.objects.create(
            user_id=self.user_uuid,
            tenant_id=self.tenant_uuid,
            theme="dark",
            language="ru",
        )

        response = self.client.get(
            "/api/personalization/preferences",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["appearance"]["theme"], "dark")
        self.assertEqual(data["appearance"]["theme_source"], "portal")
        self.assertEqual(data["localization"]["language"], "ru")

    def test_get_preferences_requires_context(self):
        """Test that GET requires user and tenant context"""
        response = self.client.get("/api/personalization/preferences")
        self.assertEqual(response.status_code, 401)

    def test_update_preferences_partial(self):
        """Test partial update of preferences"""
        UserPreference.objects.create(
            user_id=self.user_uuid,
            tenant_id=self.tenant_uuid,
        )

        response = self.client.put(
            "/api/personalization/preferences",
            data={"appearance": {"theme": "dark"}},
            content_type="application/json",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["appearance"]["theme"], "dark")
        self.assertEqual(data["appearance"]["theme_source"], "portal")
        # Other fields should remain default
        self.assertEqual(data["appearance"]["font_size"], "medium")

    def test_update_preferences_localization(self):
        """Test updating localization settings"""
        response = self.client.put(
            "/api/personalization/preferences",
            data={"localization": {"language": "ru", "timezone": "Europe/Moscow"}},
            content_type="application/json",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["localization"]["language"], "ru")
        self.assertEqual(data["localization"]["timezone"], "Europe/Moscow")

    def test_update_preferences_privacy(self):
        """Test updating privacy settings"""
        response = self.client.put(
            "/api/personalization/preferences",
            data={
                "privacy": {
                    "profile_visibility": "private",
                    "show_online_status": False,
                }
            },
            content_type="application/json",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["privacy"]["profile_visibility"], "private")
        self.assertFalse(data["privacy"]["show_online_status"])

    def test_get_default_preferences(self):
        """Test getting default preferences structure"""
        response = self.client.get(
            "/api/personalization/preferences/defaults",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("appearance", data)
        self.assertIn("localization", data)
        self.assertIn("notifications", data)
        self.assertIn("privacy", data)

    def test_reset_preferences(self):
        """Test resetting preferences to defaults"""
        # Create custom preferences
        UserPreference.objects.create(
            user_id=self.user_uuid,
            tenant_id=self.tenant_uuid,
            theme="dark",
            language="ru",
            profile_visibility="private",
        )

        # Reset to defaults
        response = self.client.post(
            "/api/personalization/preferences/reset",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["appearance"]["theme"], "auto")
        self.assertEqual(data["appearance"]["theme_source"], "portal")
        self.assertEqual(data["localization"]["language"], "en")
        self.assertEqual(data["privacy"]["profile_visibility"], "members")


class HomePageModalApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username="user",
            email="user@example.com",
            password="StrongPass123!",
        )
        self.superuser = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="StrongPass123!",
        )

    def test_list_homepage_modals_filters_by_date_and_activity(self):
        now = timezone.now()
        HomePageModal.objects.create(
            title="Active",
            content="Visible",
            is_active=True,
            start_date=now - timedelta(seconds=1),
            end_date=now + timedelta(seconds=1),
            order=1,
        )
        HomePageModal.objects.create(
            title="Future",
            content="Hidden",
            is_active=True,
            start_date=now + timedelta(hours=1),
            order=2,
        )
        HomePageModal.objects.create(
            title="Past",
            content="Hidden",
            is_active=True,
            end_date=now - timedelta(hours=1),
            order=3,
        )
        HomePageModal.objects.create(
            title="Inactive",
            content="Hidden",
            is_active=False,
            order=4,
        )

        response = self.client.get("/api/personalization/homepage-modals")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        titles = {item["title"] for item in data}
        self.assertEqual(titles, {"Active"})

    def test_admin_modals_require_superuser(self):
        # Anonymous request without headers returns 401
        response = self.client.get("/api/personalization/admin/homepage-modals")
        self.assertEqual(response.status_code, 401)

        # Authenticated non-superuser returns 403
        self.client.force_login(self.user)
        response = self.client.get("/api/personalization/admin/homepage-modals")
        self.assertEqual(response.status_code, 403)

        # Superuser can access
        self.client.force_login(self.superuser)
        response = self.client.get("/api/personalization/admin/homepage-modals")
        self.assertEqual(response.status_code, 200)
