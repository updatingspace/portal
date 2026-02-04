from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass
from unittest import mock

from django.conf import settings
from django.test import Client, TestCase, override_settings

from .models import Achievement, AchievementCategory, AchievementStatus, GrantVisibility


API_PREFIX = "/api/v1"
ACHIEVEMENTS_ROOT = f"{API_PREFIX}/gamification/achievements"


@dataclass(frozen=True)
class SignedHeaders:
    timestamp: str
    signature: str


def _body_sha256(body: bytes) -> str:
    return hashlib.sha256(body or b"").hexdigest()


def sign_internal_request(
    *,
    method: str,
    path: str,
    body: bytes,
    request_id: str,
) -> SignedHeaders:
    secret = getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "")
    if not secret:
        raise RuntimeError("BFF_INTERNAL_HMAC_SECRET is not configured")

    ts = str(int(time.time()))
    msg = "\n".join(
        [
            method.upper(),
            path,
            _body_sha256(body),
            request_id,
            ts,
        ]
    ).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), msg, digestmod=hashlib.sha256).hexdigest()
    return SignedHeaders(timestamp=ts, signature=sig)


def _headers(
    *,
    method: str,
    path: str,
    body: bytes,
    tenant_id: str,
    tenant_slug: str,
    user_id: str,
    master_flags: dict,
    request_id: str,
):
    signed = sign_internal_request(method=method, path=path, body=body, request_id=request_id)
    return {
        "HTTP_X_REQUEST_ID": request_id,
        "HTTP_X_TENANT_ID": tenant_id,
        "HTTP_X_TENANT_SLUG": tenant_slug,
        "HTTP_X_USER_ID": user_id,
        "HTTP_X_MASTER_FLAGS": json.dumps(master_flags, separators=(",", ":")),
        "HTTP_X_UPDSPACE_TIMESTAMP": signed.timestamp,
        "HTTP_X_UPDSPACE_SIGNATURE": signed.signature,
        "CONTENT_TYPE": "application/json",
    }


def _mock_has_permission(allowed: set[str]):
    def _inner(**kwargs) -> bool:
        permission_key = kwargs.get("permission_key", "")
        master_flags = kwargs.get("master_flags", {})
        if master_flags.get("suspended") or master_flags.get("banned"):
            return False
        return permission_key in allowed or master_flags.get("system_admin") is True
    return _inner


@override_settings(BFF_INTERNAL_HMAC_SECRET="test-secret")
class GamificationApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = "aef"
        self.user_id = str(uuid.uuid4())
        self.category = AchievementCategory.objects.create(
            tenant_id=self.tenant_id,
            slug="event",
            name_i18n={"en": "Event"},
            order=0,
            is_active=True,
        )

    @mock.patch("gamification.api.has_permission", side_effect=_mock_has_permission(set()))
    def test_list_achievements_public_only(self, _mock_perm):
        Achievement.objects.create(
            tenant_id=self.tenant_id,
            name_i18n={"en": "Public"},
            description="",
            category=self.category,
            status=AchievementStatus.PUBLISHED,
            images={"small": "s.png"},
            created_by=self.user_id,
        )
        Achievement.objects.create(
            tenant_id=self.tenant_id,
            name_i18n={"en": "Draft"},
            description="",
            category=self.category,
            status=AchievementStatus.DRAFT,
            images={},
            created_by=self.user_id,
        )

        path = f"{ACHIEVEMENTS_ROOT}"
        headers = _headers(
            method="GET",
            path=path,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        resp = self.client.get(path, **headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["status"], "published")

    @mock.patch(
        "gamification.api.has_permission",
        side_effect=_mock_has_permission(
            {
                "gamification.achievements.create",
                "gamification.achievements.edit",
                "gamification.achievements.publish",
                "gamification.achievements.hide",
                "gamification.achievements.view_private",
            }
        ),
    )
    def test_create_and_update_achievement(self, _mock_perm):
        payload = {
            "name_i18n": {"en": "New Achievement"},
            "description": "Desc",
            "category": "event",
            "status": "draft",
        }
        body = json.dumps(payload).encode("utf-8")
        path = f"{ACHIEVEMENTS_ROOT}"
        headers = _headers(
            method="POST",
            path=path,
            body=body,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        resp = self.client.post(path, data=body, content_type="application/json", **headers)
        self.assertEqual(resp.status_code, 200)
        achievement_id = resp.json()["id"]

        update_payload = {"status": "published", "images": {"small": "s.png"}}
        update_body = json.dumps(update_payload).encode("utf-8")
        update_path = f"{ACHIEVEMENTS_ROOT}/{achievement_id}"
        update_headers = _headers(
            method="PATCH",
            path=update_path,
            body=update_body,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        update_resp = self.client.patch(
            update_path, data=update_body, content_type="application/json", **update_headers
        )
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["status"], "published")

    @mock.patch(
        "gamification.api.has_permission",
        side_effect=_mock_has_permission(
            {
                "gamification.achievements.assign",
                "gamification.achievements.revoke",
                "gamification.achievements.view_private",
            }
        ),
    )
    def test_grant_create_and_revoke(self, _mock_perm):
        achievement = Achievement.objects.create(
            tenant_id=self.tenant_id,
            name_i18n={"en": "Grantable"},
            description="",
            category=self.category,
            status=AchievementStatus.PUBLISHED,
            images={"small": "s.png"},
            created_by=self.user_id,
        )
        recipient_id = str(uuid.uuid4())
        payload = {
            "recipient_id": recipient_id,
            "reason": "Thanks",
            "visibility": GrantVisibility.PUBLIC,
        }
        body = json.dumps(payload).encode("utf-8")
        path = f"{ACHIEVEMENTS_ROOT}/{achievement.id}/grants"
        headers = _headers(
            method="POST",
            path=path,
            body=body,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        resp = self.client.post(path, data=body, content_type="application/json", **headers)
        self.assertEqual(resp.status_code, 200)
        grant_id = resp.json()["id"]

        revoke_path = f"{API_PREFIX}/gamification/grants/{grant_id}/revoke"
        revoke_headers = _headers(
            method="POST",
            path=revoke_path,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        revoke_resp = self.client.post(
            revoke_path, data=b"", content_type="application/json", **revoke_headers
        )
        self.assertEqual(revoke_resp.status_code, 200)
        self.assertIsNotNone(revoke_resp.json()["revoked_at"])

    @mock.patch(
        "gamification.api.has_permission",
        side_effect=_mock_has_permission(
            {
                "gamification.achievements.edit",
                "gamification.achievements.view_private",
            }
        ),
    )
    def test_create_and_list_categories(self, _mock_perm):
        payload = {
            "id": "fun",
            "name_i18n": {"ru": "Фан"},
            "order": 0,
            "is_active": True,
        }
        body = json.dumps(payload).encode("utf-8")
        path = f"{API_PREFIX}/gamification/categories"
        headers = _headers(
            method="POST",
            path=path,
            body=body,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        resp = self.client.post(path, data=body, content_type="application/json", **headers)
        self.assertEqual(resp.status_code, 200)

        list_headers = _headers(
            method="GET",
            path=path,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        list_resp = self.client.get(path, **list_headers)
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.json()["items"]
        self.assertTrue(any(item["id"] == "fun" for item in items))

    @mock.patch("gamification.api.has_permission", side_effect=_mock_has_permission(set()))
    def test_create_category_requires_permission(self, _mock_perm):
        payload = {
            "id": "blocked",
            "name_i18n": {"ru": "Нет доступа"},
        }
        body = json.dumps(payload).encode("utf-8")
        path = f"{API_PREFIX}/gamification/categories"
        headers = _headers(
            method="POST",
            path=path,
            body=body,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        resp = self.client.post(path, data=body, content_type="application/json", **headers)
        self.assertEqual(resp.status_code, 403)

    @mock.patch(
        "gamification.api.has_permission",
        side_effect=_mock_has_permission(
            {
                "gamification.achievements.assign",
                "gamification.achievements.view_private",
            }
        ),
    )
    def test_grants_visibility_filter_requires_permission(self, _mock_perm):
        achievement = Achievement.objects.create(
            tenant_id=self.tenant_id,
            name_i18n={"en": "Grantable"},
            description="",
            category=self.category,
            status=AchievementStatus.PUBLISHED,
            images={"small": "s.png"},
            created_by=self.user_id,
        )
        Achievement.objects.create(
            tenant_id=self.tenant_id,
            name_i18n={"en": "Other"},
            description="",
            category=self.category,
            status=AchievementStatus.PUBLISHED,
            images={"small": "s.png"},
            created_by=self.user_id,
        )

        # Create a private grant directly
        AchievementGrant = achievement.grants.model
        AchievementGrant.objects.create(
            tenant_id=self.tenant_id,
            achievement=achievement,
            recipient_id=uuid.uuid4(),
            issuer_id=uuid.uuid4(),
            reason="Hidden",
            visibility=GrantVisibility.PRIVATE,
        )

        list_path = f"{API_PREFIX}/gamification/achievements/{achievement.id}/grants?visibility=private"
        headers = _headers(
            method="GET",
            path=f"{API_PREFIX}/gamification/achievements/{achievement.id}/grants",
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        resp = self.client.get(list_path, **headers)
        self.assertEqual(resp.status_code, 200)
