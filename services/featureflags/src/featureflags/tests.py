from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from typing import Any, cast

from django.conf import settings
from django.test import Client, TestCase

from .models import FeatureFlag


def _sign(
    method: str,
    path: str,
    body: bytes,
    request_id: str,
    ts: int,
) -> str:
    digest = hashlib.sha256(body or b"").hexdigest()
    msg = "\n".join(
        [method.upper(), path, digest, request_id, str(ts)]
    ).encode("utf-8")
    return hmac.new(
        settings.BFF_INTERNAL_HMAC_SECRET.encode("utf-8"),
        msg,
        hashlib.sha256,
    ).hexdigest()


class FeatureFlagsApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.request_id = str(uuid.uuid4())
        self.tenant_id = str(uuid.uuid4())
        self.user_id = str(uuid.uuid4())

    def _headers(
        self,
        method: str,
        path: str,
        body: bytes = b"",
        *,
        system_admin: bool = True,
    ) -> dict[str, str]:
        ts = int(time.time())
        signature = _sign(method, path, body, self.request_id, ts)
        return {
            "HTTP_X_REQUEST_ID": self.request_id,
            "HTTP_X_TENANT_ID": self.tenant_id,
            "HTTP_X_TENANT_SLUG": "aef",
            "HTTP_X_USER_ID": self.user_id,
            "HTTP_X_MASTER_FLAGS": json.dumps({"system_admin": system_admin}),
            "HTTP_X_UPDSPACE_TIMESTAMP": str(ts),
            "HTTP_X_UPDSPACE_SIGNATURE": signature,
        }

    def test_create_and_evaluate_flags(self):
        create_path = "/api/v1/flags"
        payload: dict[str, Any] = {
            "key": "new_dashboard",
            "enabled": True,
            "rollout": 100,
        }
        body = json.dumps(payload).encode("utf-8")
        response = self.client.post(
            create_path,
            data=body,
            content_type="application/json",
            **cast(Any, self._headers("POST", create_path, body)),
        )
        self.assertEqual(response.status_code, 200)

        eval_path = "/api/v1/flags/evaluate"
        eval_response = self.client.get(
            eval_path,
            **cast(Any, self._headers("GET", eval_path)),
        )
        self.assertEqual(eval_response.status_code, 200)
        data = eval_response.json()
        self.assertEqual(data["feature_flags"]["new_dashboard"], True)

    def test_non_admin_cannot_manage_flags(self):
        list_path = "/api/v1/flags"
        response = self.client.get(
            list_path,
            **cast(Any, self._headers("GET", list_path, system_admin=False)),
        )
        self.assertEqual(response.status_code, 403)

    def test_patch_flag(self):
        FeatureFlag.objects.create(
            key="beta_feed",
            enabled=False,
            rollout=100,
            description="",
            created_by=self.user_id,
            updated_by=self.user_id,
        )

        patch_path = "/api/v1/flags/beta_feed"
        payload = {"enabled": True}
        body = json.dumps(payload).encode("utf-8")
        response = self.client.patch(
            patch_path,
            data=body,
            content_type="application/json",
            **cast(Any, self._headers("PATCH", patch_path, body)),
        )
        self.assertEqual(response.status_code, 200)

        refreshed = FeatureFlag.objects.get(key="beta_feed")
        self.assertTrue(refreshed.enabled)
