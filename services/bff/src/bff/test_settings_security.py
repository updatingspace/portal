from __future__ import annotations

import importlib
import os
import sys
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from bff.proxy import _filtered_request_headers


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

    def test_requires_internal_hmac_secret_in_strict_mode(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            self._import_settings(
                {
                    "DJANGO_DEBUG": "False",
                    "DJANGO_SECRET_KEY": "test-secret",
                    "ALLOWED_HOSTS": "localhost,bff",
                    "DATABASE_URL": "postgres://user:pass@db:5432/bff_db",
                }
            )

        self.assertIn("BFF_INTERNAL_HMAC_SECRET", str(ctx.exception))

    def test_requires_callback_secret_in_strict_mode(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            self._import_settings(
                {
                    "DJANGO_DEBUG": "False",
                    "DJANGO_SECRET_KEY": "test-secret",
                    "ALLOWED_HOSTS": "localhost,bff",
                    "DATABASE_URL": "postgres://user:pass@db:5432/bff_db",
                    "BFF_INTERNAL_HMAC_SECRET": "test-hmac-secret",
                }
            )

        self.assertIn("BFF_UPDSPACEID_CALLBACK_SECRET", str(ctx.exception))

    def test_accepts_legacy_django_allowed_hosts_env(self):
        settings_module = self._import_settings(
            {
                "DJANGO_DEBUG": "False",
                "DJANGO_SECRET_KEY": "test-secret",
                "DJANGO_ALLOWED_HOSTS": "localhost,bff",
                "DATABASE_URL": "postgres://user:pass@db:5432/bff_db",
                "BFF_INTERNAL_HMAC_SECRET": "test-hmac-secret",
                "BFF_UPDSPACEID_CALLBACK_SECRET": "test-callback-secret",
            }
        )

        self.assertEqual(settings_module.ALLOWED_HOSTS, ["localhost", "bff"])

    def test_enables_https_hardening_in_strict_mode(self):
        settings_module = self._import_settings(
            {
                "DJANGO_DEBUG": "False",
                "DJANGO_SECRET_KEY": "test-secret",
                "ALLOWED_HOSTS": "localhost,bff",
                "DATABASE_URL": "postgres://user:pass@db:5432/bff_db",
                "BFF_INTERNAL_HMAC_SECRET": "test-hmac-secret",
                "BFF_UPDSPACEID_CALLBACK_SECRET": "test-callback-secret",
            }
        )

        self.assertTrue(settings_module.SECURE_SSL_REDIRECT)
        self.assertEqual(settings_module.SECURE_HSTS_SECONDS, 31536000)
        self.assertTrue(settings_module.SESSION_COOKIE_SECURE)
        self.assertTrue(settings_module.CSRF_COOKIE_SECURE)

    def test_debug_escape_hatch_keeps_local_defaults(self):
        settings_module = self._import_settings(
            {
                "DJANGO_DEBUG": "True",
                "DJANGO_ALLOW_INSECURE_DEFAULTS": "1",
                "DJANGO_ALLOW_SQLITE": "1",
            }
        )

        self.assertEqual(
            settings_module.BFF_INTERNAL_HMAC_SECRET,
            "bff-internal-hmac-secret",
        )
        self.assertEqual(
            settings_module.BFF_UPDSPACEID_CALLBACK_SECRET,
            "bff-callback-secret",
        )
        self.assertFalse(settings_module.SECURE_SSL_REDIRECT)
        self.assertEqual(settings_module.SECURE_HSTS_SECONDS, 0)

    def test_filtered_request_headers_default_forwarded_proto_to_https(self):
        headers = _filtered_request_headers({"Accept": "application/json"})

        self.assertEqual(headers["X-Forwarded-Proto"], "https")

    def test_filtered_request_headers_preserves_forwarded_proto(self):
        headers = _filtered_request_headers(
            {
                "Accept": "application/json",
                "X-Forwarded-Proto": "https,http",
            }
        )

        self.assertEqual(headers["X-Forwarded-Proto"], "https")
