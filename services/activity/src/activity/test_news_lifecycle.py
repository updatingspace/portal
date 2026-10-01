"""News API regression scenarios, also executed against local YDB in CI."""

import json
from unittest.mock import patch
from uuid import UUID, uuid4

from django.http import HttpResponse
from django.test import Client, TestCase, override_settings

from activity.audit import ActivityAuditEvent
from activity.models import ActivityEvent, NewsPost, Outbox
from activity.tests import TEST_HMAC_SECRET, _headers


@override_settings(BFF_INTERNAL_HMAC_SECRET=TEST_HMAC_SECRET)
class NewsLifecycleTests(TestCase):
    def setUp(self) -> None:
        self.client = Client()
        self.tenant_id = uuid4()
        self.user_id = uuid4()
        for target in [
            patch("activity.permissions.has_permission", return_value=True),
            patch("activity.api.portal_client.list_profiles", return_value={}),
        ]:
            target.start()
            self.addCleanup(target.stop)

    def request(
        self,
        method: str,
        path: str,
        payload: dict[str, object] | None = None,
        *,
        tenant_id: UUID | None = None,
    ) -> HttpResponse:
        body = json.dumps(payload).encode() if payload is not None else b""
        return self.client.generic(
            method,
            path,
            data=body,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_id or self.tenant_id,
                tenant_slug="test",
                user_id=self.user_id,
                request_id=str(uuid4()),
                method=method,
                path=path.split("?", 1)[0],
                body=body,
            ),
        )

    def create_post(self, **changes: object) -> str:
        response = self.request(
            "POST",
            "/api/v1/news",
            {
                "body": "Local regression post",
                "scope_type": "TENANT",
                "visibility": "public",
                "media": [],
                **changes,
            },
        )
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["payload_json"]["news_id"]

    def test_create_read_update_delete_keeps_one_linked_feed_event(self) -> None:
        news_id = self.create_post()
        path = f"/api/v1/news/{news_id}"
        events = ActivityEvent.objects.filter(
            tenant_id=self.tenant_id,
            source_ref=f"news:{news_id}",
        )
        self.assertEqual(events.count(), 1)
        event_id = events.get().id
        for method, payload in [("GET", None), ("PATCH", {"body": "Edited post"})]:
            response = self.request(method, path, payload)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(response.json()["id"], event_id)
        self.assertEqual(events.get().payload_json["body"], "Edited post")
        subscription = self.request(
            "POST",
            "/api/v1/subscriptions",
            {
                "scopes": [{"scope_type": "TENANT", "scope_id": str(self.tenant_id)}],
            },
        )
        self.assertEqual(subscription.status_code, 200, subscription.content)
        feed = self.request("GET", "/api/v1/feed")
        self.assertEqual(feed.status_code, 200, feed.content)
        self.assertEqual(
            [item["payload_json"]["news_id"] for item in feed.json()["items"]],
            [news_id],
        )
        paginated = self.request("GET", "/api/v1/v2/feed?limit=1")
        self.assertEqual(paginated.status_code, 200, paginated.content)
        self.assertEqual(
            paginated.json()["items"][0]["payload_json"]["news_id"], news_id
        )
        foreign_tenant = uuid4()
        for method, payload in [
            ("GET", None),
            ("PATCH", {"body": "Forbidden", "visibility": "public"}),
            ("DELETE", None),
        ]:
            response = self.request(method, path, payload, tenant_id=foreign_tenant)
            self.assertEqual(response.status_code, 404, response.content)
        response = self.request("DELETE", path)
        self.assertEqual(response.status_code, 204, response.content)
        self.assertFalse(events.exists())
        self.assertFalse(
            NewsPost.objects.filter(tenant_id=self.tenant_id, id=news_id).exists()
        )
        self.assertEqual(
            ActivityAuditEvent.objects.filter(tenant_id=self.tenant_id).count(), 3
        )
        self.assertEqual(
            Outbox.objects.filter(
                tenant_id=self.tenant_id, aggregate_id=news_id
            ).count(),
            3,
        )

    def test_draft_publish_hide_keeps_feed_in_sync(self) -> None:
        news_id = self.create_post(status="draft")
        events = ActivityEvent.objects.filter(
            tenant_id=self.tenant_id, source_ref=f"news:{news_id}"
        )
        self.assertFalse(events.exists())
        for status, expected in [("published", 1), ("published", 1), ("draft", 0)]:
            response = self.request(
                "PATCH", f"/api/v1/news/{news_id}", {"status": status}
            )
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(events.count(), expected)

    def test_failed_publication_rolls_back_post_audit_and_outbox(self) -> None:
        self.client.raise_request_exception = False
        with patch(
            "activity.api._publish_news_change",
            side_effect=RuntimeError("simulated failure"),
        ):
            response = self.request(
                "POST",
                "/api/v1/news",
                {"body": "Rollback test", "visibility": "public"},
            )
        self.assertEqual(response.status_code, 500)
        for model in [NewsPost, ActivityEvent, ActivityAuditEvent, Outbox]:
            self.assertFalse(
                model.objects.filter(tenant_id=self.tenant_id).exists(), model.__name__
            )

    def test_reactions_comments_views_and_media_permissions(self) -> None:
        news_id = self.create_post()
        path = f"/api/v1/news/{news_id}"
        for emoji in ["👍", "🔥", "👍"]:
            response = self.request(
                "POST", path + "/reactions", {"emoji": emoji, "action": "add"}
            )
            self.assertEqual(response.status_code, 200, response.content)
        response = self.request("GET", path)
        self.assertEqual(response.status_code, 200, response.content)
        counts = response.json()["payload_json"]["reaction_counts"]
        self.assertEqual({r["emoji"]: r["count"] for r in counts}, {"👍": 1, "🔥": 1})
        comment = self.request("POST", path + "/comments", {"body": "Local comment"})
        self.assertEqual(comment.status_code, 200, comment.content)
        comment_id = comment.json()["id"]
        for suffix in ["/comments", "/comments/page", "/reactions"]:
            response = self.request("GET", path + suffix)
            self.assertEqual(response.status_code, 200, response.content)
        self.user_id = uuid4()
        for expected in [True, False]:
            view = self.request("POST", path + "/views")
            self.assertEqual(view.status_code, 200, view.content)
            self.assertEqual(view.json(), {"counted": expected, "views_count": 1})
        response = self.request(
            "POST", path + f"/comments/{comment_id}/likes", {"action": "add"}
        )
        self.assertEqual(response.status_code, 200, response.content)
        for suffix in ["/comments", "/reactions", "/views"]:
            response = self.request(
                "POST",
                path + suffix,
                {"body": "Forbidden", "emoji": "👍", "action": "add"},
                tenant_id=uuid4(),
            )
            self.assertEqual(response.status_code, 404, response.content)
        with patch("activity.permissions.has_permission", return_value=False):
            response = self.request(
                "POST", "/api/v1/news", {"body": "Forbidden", "visibility": "public"}
            )
            self.assertEqual(response.status_code, 403, response.content)
            response = self.request(
                "POST",
                "/api/v1/news/media/upload-url",
                {
                    "filename": "test.png",
                    "content_type": "image/png",
                    "size_bytes": 100,
                },
            )
            self.assertEqual(response.status_code, 403, response.content)
