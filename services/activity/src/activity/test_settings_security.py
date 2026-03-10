from __future__ import annotations

import importlib
import os
import sys
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase


class ActivitySettingsSecurityTests(SimpleTestCase):
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
                    "ALLOWED_HOSTS": "localhost,activity",
                    "DATABASE_URL": "postgres://user:pass@db:5432/activity_db",
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
                    "DATABASE_URL": "postgres://user:pass@db:5432/activity_db",
                }
            )

        self.assertIn("ALLOWED_HOSTS", str(ctx.exception))

    def test_accepts_legacy_django_allowed_hosts_env(self):
        settings_module = self._import_settings(
            {
                "DJANGO_DEBUG": "False",
                "DJANGO_SECRET_KEY": "test-secret",
                "DJANGO_ALLOWED_HOSTS": "localhost,activity",
                "DATABASE_URL": "postgres://user:pass@db:5432/activity_db",
                "ACTIVITY_DATA_ENCRYPTION_KEY": "activity-data-key",
                "BFF_INTERNAL_HMAC_SECRET": "test-hmac-secret",
            }
        )

        self.assertEqual(settings_module.ALLOWED_HOSTS, ["localhost", "activity"])

    def test_requires_distinct_activity_encryption_key_in_strict_mode(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            self._import_settings(
                {
                    "DJANGO_DEBUG": "False",
                    "DJANGO_SECRET_KEY": "test-secret",
                    "ALLOWED_HOSTS": "localhost,activity",
                    "DATABASE_URL": "postgres://user:pass@db:5432/activity_db",
                    "BFF_INTERNAL_HMAC_SECRET": "test-hmac-secret",
                }
            )

        self.assertIn("ACTIVITY_DATA_ENCRYPTION_KEY", str(ctx.exception))

    def test_requires_internal_hmac_secret_in_strict_mode(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            self._import_settings(
                {
                    "DJANGO_DEBUG": "False",
                    "DJANGO_SECRET_KEY": "test-secret",
                    "ALLOWED_HOSTS": "localhost,activity",
                    "DATABASE_URL": "postgres://user:pass@db:5432/activity_db",
                    "ACTIVITY_DATA_ENCRYPTION_KEY": "activity-data-key",
                }
            )

        self.assertIn("BFF_INTERNAL_HMAC_SECRET", str(ctx.exception))

    def test_enables_https_hardening_in_strict_mode(self):
        settings_module = self._import_settings(
            {
                "DJANGO_DEBUG": "False",
                "DJANGO_SECRET_KEY": "test-secret",
                "ALLOWED_HOSTS": "localhost,activity",
                "DATABASE_URL": "postgres://user:pass@db:5432/activity_db",
                "ACTIVITY_DATA_ENCRYPTION_KEY": "activity-data-key",
                "BFF_INTERNAL_HMAC_SECRET": "test-hmac-secret",
            }
        )

        self.assertTrue(settings_module.SECURE_SSL_REDIRECT)
        self.assertIn(r"^api/v1/", settings_module.SECURE_REDIRECT_EXEMPT)
        self.assertEqual(settings_module.SECURE_HSTS_SECONDS, 31536000)
        self.assertTrue(settings_module.SESSION_COOKIE_SECURE)
        self.assertTrue(settings_module.CSRF_COOKIE_SECURE)

    def test_explicit_debug_escape_hatches_enable_local_defaults(self):
        settings_module = self._import_settings(
            {
                "DJANGO_DEBUG": "True",
                "DJANGO_ALLOW_INSECURE_DEFAULTS": "1",
                "DJANGO_ALLOW_SQLITE": "1",
            }
        )

        self.assertEqual(settings_module.SECRET_KEY, "activity-secret")
        self.assertEqual(settings_module.ALLOWED_HOSTS, ["*"])
        self.assertEqual(
            settings_module.DATABASES["default"]["ENGINE"],
            "django.db.backends.sqlite3",
        )
        self.assertEqual(
            settings_module.ACTIVITY_DATA_ENCRYPTION_KEY,
            settings_module.SECRET_KEY,
        )
        self.assertEqual(
            settings_module.BFF_INTERNAL_HMAC_SECRET,
            "activity-internal-hmac-secret",
        )
        self.assertFalse(settings_module.SECURE_SSL_REDIRECT)
        self.assertEqual(settings_module.SECURE_HSTS_SECONDS, 0)
        self.assertEqual(settings_module.X_FRAME_OPTIONS, "DENY")
