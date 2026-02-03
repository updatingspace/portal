"""
Integration tests for Activity service production flows.

Covers:
- News creation + feed visibility
- News reactions/comments
- Media upload URL handshake
"""
from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path
from unittest.mock import patch

from django.test import Client, TestCase, override_settings

from activity.media import UploadUrl
from activity.models import NewsPost

BFF_SRC = Path(__file__).resolve().parents[4] / "services" / "bff" / "src"
if str(BFF_SRC) not in sys.path:
    sys.path.insert(0, str(BFF_SRC))

from bff.security import sign_internal_request


def _headers(
    *,
    method: str,
    path: str,
    body: bytes,
    tenant_id: str,
    tenant_slug: str,
    user_id: str,
    request_id: str,
    master_flags: dict | None = None,
):
    signed = sign_internal_request(
        method=method,
        path=path,
        body=body,
        request_id=request_id,
    )
    return {
        "HTTP_HOST": "testserver",
        "HTTP_X_REQUEST_ID": request_id,
        "HTTP_X_TENANT_ID": tenant_id,
        "HTTP_X_TENANT_SLUG": tenant_slug,
        "HTTP_X_USER_ID": user_id,
        "HTTP_X_MASTER_FLAGS": json.dumps(master_flags or {}, separators=(",", ":")),
        "HTTP_X_UPDSPACE_TIMESTAMP": signed.timestamp,
        "HTTP_X_UPDSPACE_SIGNATURE": signed.signature,
        "CONTENT_TYPE": "application/json",
    }


@override_settings(BFF_INTERNAL_HMAC_SECRET="test-secret", NEWS_MEDIA_BUCKET="unit-test-bucket")
class NewsIntegrationTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._perm_patch = patch("activity.permissions.has_permission", return_value=True)
        cls._perm_patch.start()

    @classmethod
    def tearDownClass(cls):
        cls._perm_patch.stop()
        super().tearDownClass()

    def setUp(self):
        self.client = Client()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = "aef"
        self.user_id = str(uuid.uuid4())

    def _post(self, path: str, payload: dict, request_id: str):
        body = json.dumps(payload).encode("utf-8")
        return self.client.post(
            path,
            data=body,
            content_type="application/json",
            **_headers(
                method="POST",
                path=path,
                body=body,
                tenant_id=self.tenant_id,
                tenant_slug=self.tenant_slug,
                user_id=self.user_id,
                request_id=request_id,
            ),
        )

    def _get(self, path: str, request_id: str):
        path_only = path.split("?", 1)[0]
        return self.client.get(
            path,
            **_headers(
                method="GET",
                path=path_only,
                body=b"",
                tenant_id=self.tenant_id,
                tenant_slug=self.tenant_slug,
                user_id=self.user_id,
                request_id=request_id,
            ),
        )

    def _patch(self, path: str, payload: dict, request_id: str):
        body = json.dumps(payload).encode("utf-8")
        return self.client.patch(
            path,
            data=body,
            content_type="application/json",
            **_headers(
                method="PATCH",
                path=path,
                body=body,
                tenant_id=self.tenant_id,
                tenant_slug=self.tenant_slug,
                user_id=self.user_id,
                request_id=request_id,
            ),
        )

    def _delete(self, path: str, request_id: str):
        return self.client.delete(
            path,
            **_headers(
                method="DELETE",
                path=path,
                body=b"",
                tenant_id=self.tenant_id,
                tenant_slug=self.tenant_slug,
                user_id=self.user_id,
                request_id=request_id,
            ),
        )

    def test_news_create_appears_in_feed_v2(self):
        scopes_payload = {
            "scopes": [
                {
                    "scope_type": "TENANT",
                    "scope_id": self.tenant_id,
                }
            ]
        }
        resp = self._post("/api/v1/subscriptions", scopes_payload, "rid-sub-1")
        self.assertEqual(resp.status_code, 200)

        news_payload = {
            "title": "Patch notes",
            "body": "Мы обновили сервер.",
            "tags": ["patch"],
            "visibility": "public",
            "scope_type": "TENANT",
            "scope_id": self.tenant_id,
            "media": [
                {
                    "type": "image",
                    "key": f"news/{self.tenant_id}/asset.jpg",
                    "content_type": "image/jpeg",
                    "size_bytes": 1234,
                },
                {
                    "type": "youtube",
                    "url": "https://youtu.be/abc123",
                    "video_id": "abc123",
                },
            ],
        }

        with patch("activity.api.generate_download_url", return_value="https://cdn.test/news.jpg"):
            create_resp = self._post("/api/v1/news", news_payload, "rid-news-1")
        self.assertEqual(create_resp.status_code, 200)
        data = create_resp.json()
        self.assertEqual(data["type"], "news.posted")
        self.assertIn("news_id", data["payload_json"])

        feed_resp = self._get("/api/v1/v2/feed?limit=10", "rid-feed-1")
        self.assertEqual(feed_resp.status_code, 200)
        feed = feed_resp.json()
        self.assertTrue(feed["items"], "Expected at least one feed item")
        self.assertEqual(feed["items"][0]["type"], "news.posted")

    def test_news_reactions_and_comments_flow(self):
        news_payload = {
            "title": "Patch notes",
            "body": "Мы обновили сервер.",
            "tags": ["patch"],
            "visibility": "public",
            "scope_type": "TENANT",
            "scope_id": self.tenant_id,
            "media": [],
        }
        create_resp = self._post("/api/v1/news", news_payload, "rid-news-2")
        self.assertEqual(create_resp.status_code, 200)
        news_id = create_resp.json()["payload_json"]["news_id"]

        reaction_payload = {"emoji": "🔥", "action": "add"}
        react_resp = self._post(
            f"/api/v1/news/{news_id}/reactions",
            reaction_payload,
            "rid-react-1",
        )
        self.assertEqual(react_resp.status_code, 200)
        reactions = react_resp.json()
        self.assertEqual(reactions[0]["emoji"], "🔥")
        self.assertEqual(reactions[0]["count"], 1)

        comment_payload = {"body": "Годно!"}
        comment_resp = self._post(
            f"/api/v1/news/{news_id}/comments",
            comment_payload,
            "rid-comment-1",
        )
        self.assertEqual(comment_resp.status_code, 200)

        list_resp = self._get(f"/api/v1/news/{news_id}/comments?limit=10", "rid-comment-2")
        self.assertEqual(list_resp.status_code, 200)
        comments = list_resp.json()
        self.assertEqual(comments[0]["body"], "Годно!")

        post = NewsPost.objects.get(id=news_id)
        self.assertEqual(post.comments_count, 1)
        self.assertEqual(post.reactions_count, 1)

    def test_news_media_upload_url(self):
        upload_payload = {
            "filename": "news.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 100,
        }
        mocked = UploadUrl(
            key=f"news/{self.tenant_id}/news.jpg",
            upload_url="https://s3.test/upload",
            upload_headers={"Content-Type": "image/jpeg"},
            expires_in=900,
        )
        with patch("activity.api.generate_upload_url", return_value=mocked):
            resp = self._post("/api/v1/news/media/upload-url", upload_payload, "rid-upload-1")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["key"], mocked.key)
        self.assertEqual(data["upload_url"], mocked.upload_url)
        self.assertEqual(data["upload_headers"], mocked.upload_headers)
        self.assertEqual(data["expires_in"], mocked.expires_in)

    def test_news_update_and_delete(self):
        create_resp = self._post(
            "/api/v1/news",
            {
                "title": "Patch notes",
                "body": "Мы обновили сервер.",
                "tags": ["patch"],
                "visibility": "public",
                "scope_type": "TENANT",
                "scope_id": self.tenant_id,
                "media": [],
            },
            "rid-news-3",
        )
        self.assertEqual(create_resp.status_code, 200)
        news_id = create_resp.json()["payload_json"]["news_id"]

        update_resp = self._patch(
            f"/api/v1/news/{news_id}",
            {
                "body": "Обновление #patch вышло.",
                "tags": ["patch"],
                "visibility": "public",
            },
            "rid-news-update-1",
        )
        self.assertEqual(update_resp.status_code, 200)
        payload = update_resp.json()["payload_json"]
        self.assertEqual(payload["body"], "Обновление #patch вышло.")
        self.assertEqual(payload["tags"], ["patch"])

        delete_resp = self._delete(f"/api/v1/news/{news_id}", "rid-news-delete-1")
        self.assertEqual(delete_resp.status_code, 204)
        self.assertFalse(NewsPost.objects.filter(id=news_id).exists())

    def test_subscriptions_list_empty_then_set(self):
        list_resp = self._get("/api/v1/subscriptions", "rid-sub-list-1")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(list_resp.json()["items"], [])

        payload = {
            "scopes": [
                {
                    "scope_type": "TENANT",
                    "scope_id": self.tenant_id,
                }
            ]
        }
        upsert_resp = self._post("/api/v1/subscriptions", payload, "rid-sub-upsert-1")
        self.assertEqual(upsert_resp.status_code, 200)

        list_resp = self._get("/api/v1/subscriptions", "rid-sub-list-2")
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.json()["items"]
        self.assertEqual(len(items), 1)
