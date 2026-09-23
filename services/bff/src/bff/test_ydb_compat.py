from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import TestCase

from django.db import models
from django.test import RequestFactory, override_settings
from ydb_backend.backend.operations import DatabaseOperations

from app.ydb_compat import install_ydb_compatibility
from bff.middleware import ErrorMappingMiddleware


class YdbCompatibilityTests(TestCase):
    def setUp(self):
        install_ydb_compatibility()
        self.ops = DatabaseOperations(None)

    def convert(self, value):
        expression = SimpleNamespace(output_field=models.DateTimeField())
        for converter in self.ops.get_db_converters(expression):
            value = converter(value, expression, None)
        return value

    @override_settings(USE_TZ=True, TIME_ZONE="Europe/Moscow")
    def test_naive_timestamp_is_utc_not_local_timezone(self):
        value = datetime(2026, 9, 23, 0, 17)  # noqa: DTZ001 - driver regression fixture
        self.assertEqual(self.convert(value), value.replace(tzinfo=timezone.utc))

    @override_settings(USE_TZ=True)
    def test_aware_and_null_values_are_preserved(self):
        value = datetime(2026, 9, 23, tzinfo=timezone(timedelta(hours=3)))
        self.assertIs(self.convert(value), value)
        self.assertIsNone(self.convert(None))

    @override_settings(USE_TZ=False)
    def test_naive_mode_is_preserved(self):
        value = datetime(2026, 9, 23)  # noqa: DTZ001 - USE_TZ=False fixture
        self.assertIs(self.convert(value), value)

    def test_json_dictionary_is_encoded(self):
        self.assertEqual(
            self.ops.adapt_json_value({"verified": True}, None), '{"verified":true}'
        )

    def test_installation_is_idempotent(self):
        before = DatabaseOperations.get_db_converters
        install_ydb_compatibility()
        self.assertIs(DatabaseOperations.get_db_converters, before)


class ErrorDiagnosticTests(TestCase):
    @override_settings(DEBUG=False)
    def test_exception_is_correlated_without_secret_values(self):
        request = RequestFactory().get("/api/v1/auth/callback?code=do-not-log")
        request.request_id = "test-request-id"
        middleware = ErrorMappingMiddleware(lambda request: None)
        try:
            raise TypeError("private-password-or-database-parameter")
        except TypeError as exc:
            with self.assertLogs("bff.middleware", level="ERROR") as captured:
                response = middleware.process_exception(request, exc)
        log = " ".join(captured.output)
        self.assertIn("test-request-id", log)
        self.assertIn("TypeError", log)
        self.assertNotIn("do-not-log", log)
        self.assertNotIn("private-password", log)
        self.assertEqual(response.status_code, 500)
