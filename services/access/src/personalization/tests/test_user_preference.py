"""Unit tests for UserPreference model, service and API.

Test coverage includes:
- Model creation and defaults
- Model validation and constraints
- Service layer operations
- API endpoints (GET, PUT, POST reset)
- Schema validation (theme, timezone, color, etc.)
"""
from __future__ import annotations

import uuid
from unittest.mock import patch

from django.test import Client, TestCase, override_settings
from pydantic import ValidationError

from personalization.models import (
    FontSizeChoice,
    LanguageChoice,
    ProfileVisibilityChoice,
    ThemeChoice,
    UserPreference,
)
from personalization.schemas import (
    AppearanceSchema,
    LocalizationSchema,
    PrivacySchema,
    ThemeEnum,
    validate_hex_color,
    validate_timezone,
)
from personalization.services import UserPreferenceService


class TestUserPreferenceModel(TestCase):
    """Tests for UserPreference Django model."""

    def setUp(self):
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()

    def test_create_preference_with_defaults(self):
        """Create preference with all default values."""
        pref = UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        self.assertEqual(pref.theme, ThemeChoice.AUTO)
        self.assertEqual(pref.language, LanguageChoice.EN)
        self.assertEqual(pref.font_size, FontSizeChoice.MEDIUM)
        self.assertEqual(pref.accent_color, "#8B5CF6")
        self.assertEqual(pref.timezone, "UTC")
        self.assertEqual(pref.profile_visibility, ProfileVisibilityChoice.MEMBERS)
        self.assertFalse(pref.high_contrast)
        self.assertFalse(pref.reduce_motion)
        self.assertTrue(pref.show_online_status)
        self.assertFalse(pref.show_vote_history)
        self.assertTrue(pref.share_activity)
        self.assertTrue(pref.allow_mentions)

    def test_create_preference_with_custom_values(self):
        """Create preference with custom values."""
        pref = UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            theme=ThemeChoice.DARK,
            language=LanguageChoice.RU,
            font_size=FontSizeChoice.LARGE,
            accent_color="#FF5733",
            timezone="Europe/Moscow",
            high_contrast=True,
            reduce_motion=True,
            profile_visibility=ProfileVisibilityChoice.PRIVATE,
        )

        self.assertEqual(pref.theme, ThemeChoice.DARK)
        self.assertEqual(pref.language, LanguageChoice.RU)
        self.assertEqual(pref.font_size, FontSizeChoice.LARGE)
        self.assertEqual(pref.accent_color, "#FF5733")
        self.assertEqual(pref.timezone, "Europe/Moscow")
        self.assertTrue(pref.high_contrast)
        self.assertTrue(pref.reduce_motion)
        self.assertEqual(pref.profile_visibility, ProfileVisibilityChoice.PRIVATE)

    def test_unique_constraint_user_tenant(self):
        """Cannot create duplicate preferences for same user+tenant."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            UserPreference.objects.create(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
            )

    def test_same_user_different_tenants(self):
        """Same user can have different preferences per tenant."""
        tenant1 = uuid.uuid4()
        tenant2 = uuid.uuid4()

        pref1 = UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=tenant1,
            theme=ThemeChoice.LIGHT,
            language=LanguageChoice.EN,
        )
        pref2 = UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=tenant2,
            theme=ThemeChoice.DARK,
            language=LanguageChoice.RU,
        )

        self.assertEqual(pref1.theme, ThemeChoice.LIGHT)
        self.assertEqual(pref2.theme, ThemeChoice.DARK)
        self.assertEqual(pref1.language, LanguageChoice.EN)
        self.assertEqual(pref2.language, LanguageChoice.RU)

    def test_get_or_create_for_user(self):
        """Test get_or_create_for_user creates with defaults."""
        pref, created = UserPreference.get_or_create_for_user(
            self.user_id, self.tenant_id
        )

        self.assertTrue(created)
        self.assertEqual(pref.theme, ThemeChoice.AUTO)

        # Second call returns existing
        pref2, created2 = UserPreference.get_or_create_for_user(
            self.user_id, self.tenant_id
        )

        self.assertFalse(created2)
        self.assertEqual(pref.id, pref2.id)

    def test_get_default_preferences(self):
        """Test get_default_preferences returns expected structure."""
        defaults = UserPreference.get_default_preferences()

        self.assertEqual(defaults["theme"], ThemeChoice.AUTO)
        self.assertEqual(defaults["language"], LanguageChoice.EN)
        self.assertEqual(defaults["timezone"], "UTC")
        self.assertIn("notification_settings", defaults)

    def test_get_default_notification_settings(self):
        """Test default notification settings structure."""
        notif = UserPreference.get_default_notification_settings()

        self.assertIn("email", notif)
        self.assertIn("in_app", notif)
        self.assertIn("push", notif)
        self.assertIn("types", notif)
        self.assertIn("quiet_hours", notif)
        self.assertTrue(notif["email"]["enabled"])
        self.assertEqual(notif["email"]["digest"], "instant")

    def test_update_from_dict(self):
        """Test update_from_dict for partial updates."""
        pref = UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        pref.update_from_dict({
            "theme": ThemeChoice.DARK,
            "language": LanguageChoice.RU,
        })
        pref.save()
        pref.refresh_from_db()

        self.assertEqual(pref.theme, ThemeChoice.DARK)
        self.assertEqual(pref.language, LanguageChoice.RU)
        # Unchanged
        self.assertEqual(pref.font_size, FontSizeChoice.MEDIUM)

    def test_update_from_dict_ignores_unknown_fields(self):
        """Unknown fields in update_from_dict are ignored."""
        pref = UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        # Should not raise
        pref.update_from_dict({
            "unknown_field": "value",
            "id": str(uuid.uuid4()),  # Should be ignored
            "theme": ThemeChoice.LIGHT,
        })

        self.assertEqual(pref.theme, ThemeChoice.LIGHT)

    def test_to_dict(self):
        """Test to_dict serialization."""
        pref = UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            theme=ThemeChoice.DARK,
        )

        data = pref.to_dict()

        self.assertEqual(data["appearance"]["theme"], "dark")
        self.assertIn("localization", data)
        self.assertIn("privacy", data)
        self.assertIn("notifications", data)
        self.assertEqual(data["user_id"], str(self.user_id))
        self.assertEqual(data["tenant_id"], str(self.tenant_id))

    def test_str_representation(self):
        """Test __str__ method."""
        pref = UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        str_repr = str(pref)
        self.assertIn(str(self.user_id), str_repr)
        self.assertIn(str(self.tenant_id), str_repr)


class TestUserPreferenceService(TestCase):
    """Tests for UserPreferenceService."""

    def setUp(self):
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()

    def test_get_preferences_creates_if_not_exists(self):
        """get_preferences creates default if not exists."""
        pref = UserPreferenceService.get_preferences(self.user_id, self.tenant_id)

        self.assertIsNotNone(pref)
        self.assertEqual(pref.user_id, self.user_id)
        self.assertEqual(pref.tenant_id, self.tenant_id)

    def test_update_preferences_appearance(self):
        """Test updating appearance settings."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        pref = UserPreferenceService.update_preferences(
            self.user_id,
            self.tenant_id,
            {
                "appearance": {
                    "theme": "dark",
                    "accent_color": "#00FF00",
                    "high_contrast": True,
                }
            },
        )

        self.assertEqual(pref.theme, "dark")
        self.assertEqual(pref.accent_color, "#00FF00")
        self.assertTrue(pref.high_contrast)

    def test_update_preferences_localization(self):
        """Test updating localization settings."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        pref = UserPreferenceService.update_preferences(
            self.user_id,
            self.tenant_id,
            {
                "localization": {
                    "language": "ru",
                    "timezone": "Europe/Moscow",
                }
            },
        )

        self.assertEqual(pref.language, "ru")
        self.assertEqual(pref.timezone, "Europe/Moscow")

    def test_update_preferences_privacy(self):
        """Test updating privacy settings."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        pref = UserPreferenceService.update_preferences(
            self.user_id,
            self.tenant_id,
            {
                "privacy": {
                    "profile_visibility": "private",
                    "show_online_status": False,
                    "show_vote_history": True,
                }
            },
        )

        self.assertEqual(pref.profile_visibility, "private")
        self.assertFalse(pref.show_online_status)
        self.assertTrue(pref.show_vote_history)

    def test_update_preferences_notifications(self):
        """Test updating notification settings."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        new_notifications = {
            "email": {"enabled": False, "digest": "daily"},
            "in_app": {"enabled": True},
        }

        pref = UserPreferenceService.update_preferences(
            self.user_id,
            self.tenant_id,
            {"notifications": new_notifications},
        )

        self.assertEqual(pref.notification_settings["email"]["enabled"], False)
        self.assertEqual(pref.notification_settings["email"]["digest"], "daily")

    def test_get_defaults(self):
        """Test get_defaults returns proper structure."""
        defaults = UserPreferenceService.get_defaults()

        self.assertIn("appearance", defaults)
        self.assertIn("localization", defaults)
        self.assertIn("notifications", defaults)
        self.assertIn("privacy", defaults)
        self.assertEqual(defaults["appearance"]["theme"], ThemeChoice.AUTO)

    def test_reset_to_defaults(self):
        """Test reset_to_defaults reverts all settings."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            theme=ThemeChoice.DARK,
            language=LanguageChoice.RU,
            profile_visibility=ProfileVisibilityChoice.PRIVATE,
        )

        pref = UserPreferenceService.reset_to_defaults(self.user_id, self.tenant_id)

        self.assertEqual(pref.theme, ThemeChoice.AUTO)
        self.assertEqual(pref.language, LanguageChoice.EN)
        self.assertEqual(pref.profile_visibility, ProfileVisibilityChoice.MEMBERS)


class TestSchemaValidation(TestCase):
    """Tests for Pydantic schema validation."""

    def test_validate_hex_color_valid(self):
        """Valid hex colors pass validation."""
        self.assertEqual(validate_hex_color("#FF5733"), "#FF5733")
        self.assertEqual(validate_hex_color("#ffffff"), "#FFFFFF")
        self.assertEqual(validate_hex_color("#000000"), "#000000")

    def test_validate_hex_color_invalid(self):
        """Invalid hex colors raise ValueError."""
        with self.assertRaises(ValueError):
            validate_hex_color("FF5733")  # Missing #

        with self.assertRaises(ValueError):
            validate_hex_color("#FFF")  # Too short

        with self.assertRaises(ValueError):
            validate_hex_color("#GGGGGG")  # Invalid chars

    def test_validate_timezone_valid(self):
        """Valid timezones pass validation."""
        self.assertEqual(validate_timezone("UTC"), "UTC")
        self.assertEqual(validate_timezone("Europe/Moscow"), "Europe/Moscow")
        self.assertEqual(validate_timezone("America/New_York"), "America/New_York")

    def test_validate_timezone_invalid(self):
        """Invalid timezones raise ValueError."""
        with self.assertRaises(ValueError):
            validate_timezone("Invalid/Timezone")

        with self.assertRaises(ValueError):
            validate_timezone("Moscow")  # Not IANA format

    def test_appearance_schema_validation(self):
        """Test AppearanceSchema validation."""
        # Valid
        schema = AppearanceSchema(
            theme=ThemeEnum.DARK,
            accent_color="#FF0000",
            high_contrast=True,
        )
        self.assertEqual(schema.theme, ThemeEnum.DARK)
        self.assertEqual(schema.accent_color, "#FF0000")

    def test_localization_schema_timezone_validation(self):
        """Test LocalizationSchema validates timezone."""
        # Valid
        schema = LocalizationSchema(
            language="en",
            timezone="Europe/London",
        )
        self.assertEqual(schema.timezone, "Europe/London")

    def test_privacy_schema_defaults(self):
        """Test PrivacySchema has correct defaults."""
        schema = PrivacySchema()

        self.assertEqual(schema.profile_visibility, "members")
        self.assertTrue(schema.show_online_status)
        self.assertFalse(schema.show_vote_history)


class TestPreferencesAPI(TestCase):
    """Integration tests for preferences API endpoints."""

    def setUp(self):
        self.client = Client()
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.headers = {
            "HTTP_X_USER_ID": str(self.user_id),
            "HTTP_X_TENANT_ID": str(self.tenant_id),
        }

    def test_get_preferences_creates_default(self):
        """GET /preferences creates default if not exists."""
        response = self.client.get(
            "/api/personalization/preferences",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["appearance"]["theme"], "auto")
        self.assertEqual(data["localization"]["language"], "en")

    def test_get_preferences_returns_existing(self):
        """GET /preferences returns existing preferences."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            theme=ThemeChoice.DARK,
            language=LanguageChoice.RU,
        )

        response = self.client.get(
            "/api/personalization/preferences",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["appearance"]["theme"], "dark")
        self.assertEqual(data["localization"]["language"], "ru")

    def test_get_preferences_requires_auth_headers(self):
        """GET /preferences requires X-User-Id and X-Tenant-Id headers."""
        response = self.client.get("/api/personalization/preferences")
        self.assertEqual(response.status_code, 401)

    def test_put_preferences_updates(self):
        """PUT /preferences updates existing preferences."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
        )

        response = self.client.put(
            "/api/personalization/preferences",
            data={
                "appearance": {
                    "theme": "dark",
                    "accent_color": "#00FF00",
                },
            },
            content_type="application/json",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["appearance"]["theme"], "dark")
        self.assertEqual(data["appearance"]["accent_color"], "#00FF00")

    def test_put_preferences_partial_update(self):
        """PUT /preferences supports partial updates."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            theme=ThemeChoice.DARK,
            language=LanguageChoice.RU,
        )

        # Only update language
        response = self.client.put(
            "/api/personalization/preferences",
            data={
                "localization": {"language": "en"},
            },
            content_type="application/json",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["localization"]["language"], "en")
        # Theme should remain unchanged
        self.assertEqual(data["appearance"]["theme"], "dark")

    def test_get_defaults(self):
        """GET /preferences/defaults returns default structure."""
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
        """POST /preferences/reset resets to defaults."""
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            theme=ThemeChoice.DARK,
            language=LanguageChoice.RU,
        )

        response = self.client.post(
            "/api/personalization/preferences/reset",
            **self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["appearance"]["theme"], "auto")
        self.assertEqual(data["localization"]["language"], "en")

    def test_preferences_per_tenant_isolation(self):
        """Preferences are isolated per tenant."""
        tenant1 = uuid.uuid4()
        tenant2 = uuid.uuid4()

        # Create preference for tenant1
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=tenant1,
            theme=ThemeChoice.DARK,
        )

        # Create preference for tenant2
        UserPreference.objects.create(
            user_id=self.user_id,
            tenant_id=tenant2,
            theme=ThemeChoice.LIGHT,
        )

        # Get tenant1 preference
        response1 = self.client.get(
            "/api/personalization/preferences",
            HTTP_X_USER_ID=str(self.user_id),
            HTTP_X_TENANT_ID=str(tenant1),
        )
        self.assertEqual(response1.json()["appearance"]["theme"], "dark")

        # Get tenant2 preference
        response2 = self.client.get(
            "/api/personalization/preferences",
            HTTP_X_USER_ID=str(self.user_id),
            HTTP_X_TENANT_ID=str(tenant2),
        )
        self.assertEqual(response2.json()["appearance"]["theme"], "light")
