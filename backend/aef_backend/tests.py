from __future__ import annotations

import os
from unittest import mock

from django.test import TestCase


class HealthcheckTests(TestCase):
    def test_health_endpoint_returns_ok(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


class VersionTests(TestCase):
    def test_version_endpoint_returns_build_id(self):
        """Test version endpoint returns BUILD_ID from environment."""
        with mock.patch.dict(os.environ, {"BUILD_ID": "2025.12.07-123-abc1234"}):
            response = self.client.get("/api/version")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("build_id", data)
        self.assertIn("api_version", data)
        self.assertEqual(data["build_id"], "2025.12.07-123-abc1234")
        self.assertEqual(data["api_version"], "0.1.0")

    def test_version_endpoint_returns_dev_when_no_build_id(self):
        """Test version endpoint returns 'dev' when BUILD_ID not set."""
        with mock.patch.dict(os.environ, {}, clear=False):
            # Remove BUILD_ID if it exists
            if "BUILD_ID" in os.environ:
                del os.environ["BUILD_ID"]
            response = self.client.get("/api/version")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["build_id"], "dev")
        self.assertEqual(data["api_version"], "0.1.0")
