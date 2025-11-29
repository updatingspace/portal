from __future__ import annotations

from django.test import TestCase


class HealthcheckTests(TestCase):
    def test_health_endpoint_returns_ok(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
