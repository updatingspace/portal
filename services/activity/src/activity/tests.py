from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from django.test import Client, TestCase, override_settings

from activity.connectors.steam import SteamConnector
from activity.connectors.base import RawEventIn
from activity.models import (
    AccountLink,
    ActivityEvent,
    FeedLastSeen,
    Outbox,
    OutboxEventType,
    RawEvent,
    Source,
    Subscription,
)
from activity.services import (
    FeedFilters,
    get_unread_count,
    ingest_raw_and_normalize,
    list_feed,
    publish_outbox_event,
    update_last_seen,
)

TEST_HMAC_SECRET = "test-hmac-secret"


def _body_sha256(body: bytes) -> str:
    return hashlib.sha256(body or b"").hexdigest()


def _internal_signature(
    method: str, path: str, body: bytes, request_id: str, timestamp: int
) -> str:
    msg = "\n".join(
        [method.upper(), path, _body_sha256(body), request_id, str(timestamp)]
    ).encode("utf-8")
    return hmac.new(
        TEST_HMAC_SECRET.encode("utf-8"), msg, digestmod=hashlib.sha256
    ).hexdigest()


def _headers(
    *,
    tenant_id: uuid.UUID,
    tenant_slug: str,
    request_id: str,
    user_id: uuid.UUID | None = None,
    master_flags: str | None = None,
    method: str = "GET",
    path: str = "/",
    body: bytes = b"",
):
    ts = int(time.time())
    sig = _internal_signature(method, path, body, request_id, ts)
    headers = {
        "HTTP_X_TENANT_ID": str(tenant_id),
        "HTTP_X_TENANT_SLUG": tenant_slug,
        "HTTP_X_REQUEST_ID": request_id,
        "HTTP_X_UPDSPACE_TIMESTAMP": str(ts),
        "HTTP_X_UPDSPACE_SIGNATURE": sig,
    }
    if user_id:
        headers["HTTP_X_USER_ID"] = str(user_id)
    if master_flags:
        headers["HTTP_X_MASTER_FLAGS"] = master_flags
    return headers


def _sign(secret: str, body: bytes) -> str:
    sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


@override_settings(BFF_INTERNAL_HMAC_SECRET=TEST_HMAC_SECRET)
class ActivityTenantIsolationTests(TestCase):
    def setUp(self):
        self.client = Client()

    @patch("activity.permissions.has_permission", return_value=True)
    def test_feed_isolated_by_tenant(self, mock_has_permission):
        user_id = uuid.uuid4()
        tenant_a = uuid.uuid4()
        tenant_b = uuid.uuid4()

        # Create subscriptions via API (scopes are tenant-local).
        payload = {"scopes": [{"scope_type": "COMMUNITY", "scope_id": "c1"}]}
        body_a = json.dumps(payload).encode("utf-8")
        resp_a = self.client.post(
            "/api/v1/subscriptions",
            data=body_a,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_a,
                tenant_slug="a",
                request_id="rid-a",
                user_id=user_id,
                method="POST",
                path="/api/v1/subscriptions",
                body=body_a,
            ),
        )
        self.assertEqual(resp_a.status_code, 200)

        body_b = json.dumps(payload).encode("utf-8")
        resp_b = self.client.post(
            "/api/v1/subscriptions",
            data=body_b,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_b,
                tenant_slug="b",
                request_id="rid-b",
                user_id=user_id,
                method="POST",
                path="/api/v1/subscriptions",
                body=body_b,
            ),
        )
        self.assertEqual(resp_b.status_code, 200)

        ActivityEvent.objects.create(
            tenant_id=tenant_a,
            actor_user_id=None,
            target_user_id=None,
            type="vote.cast",
            occurred_at=datetime.now(tz=timezone.utc),
            title="Vote cast",
            payload_json={},
            visibility="community",
            scope_type="COMMUNITY",
            scope_id="c1",
            source_ref="custom:a:1",
        )
        ActivityEvent.objects.create(
            tenant_id=tenant_b,
            actor_user_id=None,
            target_user_id=None,
            type="vote.cast",
            occurred_at=datetime.now(tz=timezone.utc),
            title="Vote cast",
            payload_json={},
            visibility="community",
            scope_type="COMMUNITY",
            scope_id="c1",
            source_ref="custom:b:1",
        )

        feed_a = self.client.get(
            "/api/v1/feed",
            **_headers(
                tenant_id=tenant_a,
                tenant_slug="a",
                request_id="rid-a2",
                user_id=user_id,
                method="GET",
                path="/api/v1/feed",
            ),
        )
        self.assertEqual(feed_a.status_code, 200)
        items_a = feed_a.json()["items"]
        self.assertEqual(len(items_a), 1)
        self.assertEqual(items_a[0]["tenant_id"], str(tenant_a))

        feed_b = self.client.get(
            "/api/v1/feed",
            **_headers(
                tenant_id=tenant_b,
                tenant_slug="b",
                request_id="rid-b2",
                user_id=user_id,
                method="GET",
                path="/api/v1/feed",
            ),
        )
        self.assertEqual(feed_b.status_code, 200)
        items_b = feed_b.json()["items"]
        self.assertEqual(len(items_b), 1)
        self.assertEqual(items_b[0]["tenant_id"], str(tenant_b))


@override_settings(BFF_INTERNAL_HMAC_SECRET=TEST_HMAC_SECRET)
class ActivityDedupeWebhookTests(TestCase):
    def setUp(self):
        self.client = Client()

    @patch.dict(os.environ, {"MINECRAFT_WEBHOOK_SECRET": "test-secret"})
    def test_minecraft_webhook_dedupes_by_dedupe_hash(self):
        tenant_id = uuid.uuid4()

        payload = {
            "type": "event.created",
            "event_id": "e-1",
            "title": "Server event",
            "scope_type": "COMMUNITY",
            "scope_id": "c1",
            "occurred_at": "2026-01-12T00:00:00Z",
        }
        body = json.dumps(payload).encode("utf-8")
        signature = _sign("test-secret", body)

        resp1 = self.client.post(
            "/api/v1/ingest/webhook/minecraft",
            data=body,
            content_type="application/json",
            HTTP_X_SIGNATURE=signature,
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-1",
                method="POST",
                path="/api/v1/ingest/webhook/minecraft",
                body=body,
            ),
        )
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp1.json()["raw_created"], 1)
        self.assertEqual(resp1.json()["activity_created"], 1)

        resp2 = self.client.post(
            "/api/v1/ingest/webhook/minecraft",
            data=body,
            content_type="application/json",
            HTTP_X_SIGNATURE=signature,
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-2",
                method="POST",
                path="/api/v1/ingest/webhook/minecraft",
                body=body,
            ),
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.json()["raw_created"], 0)
        self.assertEqual(resp2.json()["raw_deduped"], 1)

        self.assertEqual(
            RawEvent.objects.filter(tenant_id=tenant_id).count(),
            1,
        )
        self.assertEqual(
            ActivityEvent.objects.filter(tenant_id=tenant_id).count(),
            1,
        )


class OutboxPatternTests(TestCase):
    """Tests for outbox pattern implementation."""

    def setUp(self):
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()

    def test_publish_outbox_event_creates_record(self):
        """Test that publish_outbox_event creates an Outbox record."""
        event = publish_outbox_event(
            tenant_id=self.tenant_id,
            event_type=OutboxEventType.FEED_UPDATED,
            aggregate_type="activity_event",
            aggregate_id="123",
            payload={"event_id": 123, "event_type": "vote.cast"},
        )

        self.assertIsNotNone(event.id)
        self.assertEqual(event.tenant_id, self.tenant_id)
        self.assertEqual(event.event_type, OutboxEventType.FEED_UPDATED)
        self.assertIsNone(event.processed_at)
        self.assertEqual(event.retry_count, 0)

    def test_outbox_created_on_ingest(self):
        """Test that outbox event is created when activity is ingested."""
        # Create source and account link
        source = Source.objects.create(
            tenant_id=self.tenant_id,
            type="minecraft",
            config_json={},
        )
        account_link = AccountLink.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            source=source,
            status="active",
        )

        raw_in = RawEventIn(
            occurred_at=datetime.now(timezone.utc),
            payload_json={
                "type": "event.created",
                "event_id": "test-event",
                "title": "Test Event",
                "scope_type": "COMMUNITY",
                "scope_id": "c1",
            },
        )

        created_raw, created_act = ingest_raw_and_normalize(
            tenant_id=self.tenant_id,
            account_link=account_link,
            raw_in=raw_in,
        )

        self.assertTrue(created_raw)
        self.assertTrue(created_act)

        # Check outbox event was created
        outbox_events = Outbox.objects.filter(
            tenant_id=self.tenant_id,
            event_type=OutboxEventType.FEED_UPDATED,
        )
        self.assertEqual(outbox_events.count(), 1)


class FeedLastSeenTests(TestCase):
    """Tests for feed last_seen tracking and unread count."""

    def setUp(self):
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()

    def test_update_last_seen_creates_record(self):
        """Test that update_last_seen creates a record."""
        result = update_last_seen(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
        )

        self.assertIsNotNone(result.id)
        self.assertEqual(result.tenant_id, self.tenant_id)
        self.assertEqual(result.user_id, self.user_id)

    def test_get_unread_count_returns_zero_for_new_user(self):
        """Test that unread count is 0 for user with no last_seen."""
        count = get_unread_count(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
        )
        self.assertEqual(count, 0)

    def test_get_unread_count_counts_new_events(self):
        """Test that unread count correctly counts events after last_seen."""
        # Set last_seen to 1 hour ago
        FeedLastSeen.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            last_seen_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )

        # Create events: 2 after last_seen, 1 before
        ActivityEvent.objects.create(
            tenant_id=self.tenant_id,
            type="vote.cast",
            occurred_at=datetime.now(timezone.utc) - timedelta(minutes=30),
            title="New Event 1",
            scope_type="tenant",
            scope_id=str(self.tenant_id),
            source_ref="test:1",
        )
        ActivityEvent.objects.create(
            tenant_id=self.tenant_id,
            type="vote.cast",
            occurred_at=datetime.now(timezone.utc) - timedelta(minutes=15),
            title="New Event 2",
            scope_type="tenant",
            scope_id=str(self.tenant_id),
            source_ref="test:2",
        )
        ActivityEvent.objects.create(
            tenant_id=self.tenant_id,
            type="vote.cast",
            occurred_at=datetime.now(timezone.utc) - timedelta(hours=2),
            title="Old Event",
            scope_type="tenant",
            scope_id=str(self.tenant_id),
            source_ref="test:3",
        )

        count = get_unread_count(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
        )
        self.assertEqual(count, 2)


@override_settings(BFF_INTERNAL_HMAC_SECRET=TEST_HMAC_SECRET)
class FeedLongPollTests(TestCase):
    def setUp(self):
        self.client = Client()

    @patch("activity.permissions.has_permission", return_value=True)
    def test_long_poll_returns_immediately_when_changed(self, mock_has_permission):
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()

        FeedLastSeen.objects.create(
            tenant_id=tenant_id,
            user_id=user_id,
            last_seen_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )

        ActivityEvent.objects.create(
            tenant_id=tenant_id,
            type="vote.cast",
            occurred_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            title="New Event",
            scope_type="tenant",
            scope_id=str(tenant_id),
            source_ref="test:1",
        )

        resp = self.client.get(
            "/api/v1/feed/unread-count/long-poll?last=0&timeout=5",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-lp-1",
                user_id=user_id,
                method="GET",
                path="/api/v1/feed/unread-count/long-poll",
            ),
        )

        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(payload["count"], 1)
        self.assertTrue(payload["changed"])


@override_settings(BFF_INTERNAL_HMAC_SECRET=TEST_HMAC_SECRET)
class NewsCreateTests(TestCase):
    def setUp(self):
        self.client = Client()

    @patch("activity.permissions.has_permission", return_value=True)
    def test_news_create_basic(self, mock_has_permission):
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()
        body = json.dumps(
            {
                "title": "Patch notes",
                "body": "Мы обновили сервер.",
                "tags": ["patch"],
                "visibility": "public",
                "scope_type": "TENANT",
                "scope_id": str(tenant_id),
                "media": [],
            }
        ).encode("utf-8")

        resp = self.client.post(
            "/api/v1/news",
            data=body,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-1",
                user_id=user_id,
                method="POST",
                path="/api/v1/news",
                body=body,
            ),
        )

        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(payload["type"], "news.posted")

    @patch("activity.permissions.has_permission", return_value=True)
    def test_news_reactions_and_comments(self, mock_has_permission):
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()
        body = json.dumps(
            {
                "title": "Patch notes",
                "body": "Мы обновили сервер.",
                "tags": ["patch"],
                "visibility": "public",
                "scope_type": "TENANT",
                "scope_id": str(tenant_id),
                "media": [],
            }
        ).encode("utf-8")

        create_resp = self.client.post(
            "/api/v1/news",
            data=body,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-2",
                user_id=user_id,
                method="POST",
                path="/api/v1/news",
                body=body,
            ),
        )
        self.assertEqual(create_resp.status_code, 200)
        news_id = create_resp.json()["payload_json"]["news_id"]

        react_body = json.dumps({"emoji": "🔥", "action": "add"}).encode("utf-8")
        react_resp = self.client.post(
            f"/api/v1/news/{news_id}/reactions",
            data=react_body,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-react",
                user_id=user_id,
                method="POST",
                path=f"/api/v1/news/{news_id}/reactions",
                body=react_body,
            ),
        )
        self.assertEqual(react_resp.status_code, 200)
        list_reactions_resp = self.client.get(
            f"/api/v1/news/{news_id}/reactions?limit=10",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-react-list",
                user_id=user_id,
                method="GET",
                path=f"/api/v1/news/{news_id}/reactions",
            ),
        )
        self.assertEqual(list_reactions_resp.status_code, 200)
        list_payload = list_reactions_resp.json()
        self.assertEqual(len(list_payload), 1)
        self.assertEqual(list_payload[0]["emoji"], "🔥")
        self.assertEqual(list_payload[0]["user_id"], str(user_id))

        comment_body = json.dumps({"body": "Круто!"}).encode("utf-8")
        comment_resp = self.client.post(
            f"/api/v1/news/{news_id}/comments",
            data=comment_body,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-comment",
                user_id=user_id,
                method="POST",
                path=f"/api/v1/news/{news_id}/comments",
                body=comment_body,
            ),
        )
        self.assertEqual(comment_resp.status_code, 200)
        parent_comment = comment_resp.json()
        parent_comment_id = parent_comment["id"]
        self.assertIsNone(parent_comment["parent_id"])
        self.assertEqual(parent_comment["likes_count"], 0)

        reply_body = json.dumps({"body": "Ответ", "parent_id": parent_comment_id}).encode("utf-8")
        reply_resp = self.client.post(
            f"/api/v1/news/{news_id}/comments",
            data=reply_body,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-comment-reply",
                user_id=user_id,
                method="POST",
                path=f"/api/v1/news/{news_id}/comments",
                body=reply_body,
            ),
        )
        self.assertEqual(reply_resp.status_code, 200)
        reply_payload = reply_resp.json()
        self.assertEqual(reply_payload["parent_id"], parent_comment_id)

        second_comment_body = json.dumps({"body": "Ещё один корень"}).encode("utf-8")
        second_comment_resp = self.client.post(
            f"/api/v1/news/{news_id}/comments",
            data=second_comment_body,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-comment-2",
                user_id=user_id,
                method="POST",
                path=f"/api/v1/news/{news_id}/comments",
                body=second_comment_body,
            ),
        )
        self.assertEqual(second_comment_resp.status_code, 200)
        second_root_comment = second_comment_resp.json()

        list_comments_resp = self.client.get(
            f"/api/v1/news/{news_id}/comments?limit=10",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-comment-list",
                user_id=user_id,
                method="GET",
                path=f"/api/v1/news/{news_id}/comments",
            ),
        )
        self.assertEqual(list_comments_resp.status_code, 200)
        comments_payload = list_comments_resp.json()
        self.assertEqual(len(comments_payload), 3)

        root_page_resp = self.client.get(
            f"/api/v1/news/{news_id}/comments/page?limit=1",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-comment-page-1",
                user_id=user_id,
                method="GET",
                path=f"/api/v1/news/{news_id}/comments/page",
            ),
        )
        self.assertEqual(root_page_resp.status_code, 200)
        root_page_payload = root_page_resp.json()
        self.assertEqual(len(root_page_payload["items"]), 1)
        self.assertTrue(root_page_payload["has_more"])
        self.assertIsNotNone(root_page_payload["next_cursor"])
        self.assertEqual(root_page_payload["items"][0]["id"], parent_comment_id)
        self.assertEqual(root_page_payload["items"][0]["replies_count"], 1)

        root_page_2_resp = self.client.get(
            f"/api/v1/news/{news_id}/comments/page?limit=1&cursor={root_page_payload['next_cursor']}",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-comment-page-2",
                user_id=user_id,
                method="GET",
                path=f"/api/v1/news/{news_id}/comments/page",
            ),
        )
        self.assertEqual(root_page_2_resp.status_code, 200)
        root_page_2_payload = root_page_2_resp.json()
        self.assertEqual(len(root_page_2_payload["items"]), 1)
        self.assertEqual(root_page_2_payload["items"][0]["id"], second_root_comment["id"])

        child_page_resp = self.client.get(
            f"/api/v1/news/{news_id}/comments/page?parent_id={parent_comment_id}&limit=10",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-comment-page-child",
                user_id=user_id,
                method="GET",
                path=f"/api/v1/news/{news_id}/comments/page",
            ),
        )
        self.assertEqual(child_page_resp.status_code, 200)
        child_page_payload = child_page_resp.json()
        self.assertEqual(len(child_page_payload["items"]), 1)
        self.assertEqual(child_page_payload["items"][0]["id"], reply_payload["id"])

        like_body = json.dumps({"action": "add"}).encode("utf-8")
        like_resp = self.client.post(
            f"/api/v1/news/{news_id}/comments/{parent_comment_id}/likes",
            data=like_body,
            content_type="application/json",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-comment-like",
                user_id=user_id,
                method="POST",
                path=f"/api/v1/news/{news_id}/comments/{parent_comment_id}/likes",
                body=like_body,
            ),
        )
        self.assertEqual(like_resp.status_code, 200)
        like_payload = like_resp.json()
        self.assertEqual(like_payload["likes_count"], 1)
        self.assertTrue(like_payload["my_liked"])

        delete_resp = self.client.delete(
            f"/api/v1/news/{news_id}/comments/{parent_comment_id}",
            **_headers(
                tenant_id=tenant_id,
                tenant_slug="t",
                request_id="rid-news-comment-delete",
                user_id=user_id,
                method="DELETE",
                path=f"/api/v1/news/{news_id}/comments/{parent_comment_id}",
            ),
        )
        self.assertEqual(delete_resp.status_code, 200)
        deleted_payload = delete_resp.json()
        self.assertTrue(deleted_payload["deleted"])
        self.assertEqual(deleted_payload["body"], "Комментарий удалён")
        self.assertIsNone(deleted_payload["user_id"])


class FeedFilteringTests(TestCase):
    """Tests for feed filtering and subscription matching."""

    def setUp(self):
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()
        self.now = datetime.now(timezone.utc)

    def test_feed_returns_empty_without_subscription(self):
        """Test that feed returns empty list without subscription."""
        ActivityEvent.objects.create(
            tenant_id=self.tenant_id,
            type="vote.cast",
            occurred_at=self.now,
            title="Event",
            scope_type="tenant",
            scope_id=str(self.tenant_id),
            source_ref="test:1",
        )

        items = list_feed(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            filters=FeedFilters(
                from_dt=None, to_dt=None, types=None, scope_type=None, scope_id=None
            ),
            update_last_seen_flag=False,
        )

        self.assertEqual(len(items), 0)

    def test_feed_filters_by_event_type(self):
        """Test that feed filters by event type."""
        Subscription.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            rules_json={"scopes": [{"scope_type": "tenant", "scope_id": str(self.tenant_id)}]},
        )

        ActivityEvent.objects.create(
            tenant_id=self.tenant_id,
            type="vote.cast",
            occurred_at=self.now,
            title="Vote Event",
            scope_type="tenant",
            scope_id=str(self.tenant_id),
            source_ref="test:1",
        )
        ActivityEvent.objects.create(
            tenant_id=self.tenant_id,
            type="post.created",
            occurred_at=self.now,
            title="Post Event",
            scope_type="tenant",
            scope_id=str(self.tenant_id),
            source_ref="test:2",
        )

        items = list_feed(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            filters=FeedFilters(
                from_dt=None, to_dt=None, types=["vote.cast"], scope_type=None, scope_id=None
            ),
            update_last_seen_flag=False,
        )

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].type, "vote.cast")

    def test_feed_filters_by_date_range(self):
        """Test that feed filters by date range."""
        Subscription.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            rules_json={"scopes": [{"scope_type": "tenant", "scope_id": str(self.tenant_id)}]},
        )

        ActivityEvent.objects.create(
            tenant_id=self.tenant_id,
            type="vote.cast",
            occurred_at=self.now - timedelta(hours=2),
            title="Old Event",
            scope_type="tenant",
            scope_id=str(self.tenant_id),
            source_ref="test:1",
        )
        ActivityEvent.objects.create(
            tenant_id=self.tenant_id,
            type="vote.cast",
            occurred_at=self.now,
            title="New Event",
            scope_type="tenant",
            scope_id=str(self.tenant_id),
            source_ref="test:2",
        )

        items = list_feed(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            filters=FeedFilters(
                from_dt=self.now - timedelta(hours=1),
                to_dt=None,
                types=None,
                scope_type=None,
                scope_id=None,
            ),
            update_last_seen_flag=False,
        )

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].title, "New Event")


class SteamConnectorTests(TestCase):
    """Tests for Steam connector."""

    def test_dedupe_key_achievement(self):
        """Test dedupe key generation for achievements."""
        connector = SteamConnector()
        raw = RawEventIn(
            occurred_at=datetime.now(timezone.utc),
            payload_json={
                "kind": "achievement",
                "steamid": "12345",
                "appid": 440,
                "apiname": "tf_play_game_friends",
            },
        )

        key = connector.dedupe_key(raw)
        self.assertEqual(key, "achievement:12345:440:tf_play_game_friends")

    def test_dedupe_key_playtime(self):
        """Test dedupe key generation for playtime."""
        connector = SteamConnector()
        now = datetime.now(timezone.utc)
        raw = RawEventIn(
            occurred_at=now,
            payload_json={
                "kind": "playtime",
                "steamid": "12345",
                "appid": 440,
            },
        )

        key = connector.dedupe_key(raw)
        self.assertIn("playtime:12345:440:", key)
        self.assertIn(now.strftime("%Y-%m-%d"), key)

    def test_normalize_achievement(self):
        """Test normalization of achievement events."""
        connector = SteamConnector()
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()

        source = Source.objects.create(
            tenant_id=tenant_id,
            type="steam",
            config_json={},
        )
        account_link = AccountLink.objects.create(
            tenant_id=tenant_id,
            user_id=user_id,
            source=source,
            status="active",
        )
        raw = RawEvent.objects.create(
            tenant_id=tenant_id,
            account_link=account_link,
            payload_json={
                "kind": "achievement",
                "steamid": "12345",
                "appid": 440,
                "game_name": "Team Fortress 2",
                "apiname": "tf_play_game_friends",
                "name": "With Friends Like These",
                "unlocktime": 1705000000,
            },
            dedupe_hash="test",
        )

        event = connector.normalize(raw, account_link)

        self.assertEqual(event.type, "game.achievement")
        self.assertIn("With Friends Like These", event.title)
        self.assertIn("Team Fortress 2", event.title)
        self.assertEqual(event.actor_user_id, user_id)
        self.assertEqual(event.payload_json["source"], "steam")

    def test_normalize_private_profile(self):
        """Test normalization of private profile events."""
        connector = SteamConnector()
        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()

        source = Source.objects.create(
            tenant_id=tenant_id,
            type="steam",
            config_json={},
        )
        account_link = AccountLink.objects.create(
            tenant_id=tenant_id,
            user_id=user_id,
            source=source,
            status="active",
        )
        raw = RawEvent.objects.create(
            tenant_id=tenant_id,
            account_link=account_link,
            payload_json={
                "kind": "private",
                "steamid": "12345",
            },
            dedupe_hash="test-private",
        )

        event = connector.normalize(raw, account_link)

        self.assertEqual(event.type, "steam.private")
        self.assertEqual(event.visibility, "private")


@override_settings(BFF_INTERNAL_HMAC_SECRET=TEST_HMAC_SECRET)
class PermissionTests(TestCase):
    """Tests for permission checks."""

    def setUp(self):
        self.client = Client()
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()

    def test_suspended_user_denied_access(self):
        """Test that suspended users cannot access feed."""
        resp = self.client.get(
            "/api/v1/feed",
            **_headers(
                tenant_id=self.tenant_id,
                tenant_slug="test",
                request_id="rid-1",
                user_id=self.user_id,
                master_flags="suspended",
                method="GET",
                path="/api/v1/feed",
            ),
        )
        self.assertEqual(resp.status_code, 403)

    def test_banned_user_denied_access(self):
        """Test that banned users cannot access feed."""
        resp = self.client.get(
            "/api/v1/feed",
            **_headers(
                tenant_id=self.tenant_id,
                tenant_slug="test",
                request_id="rid-1",
                user_id=self.user_id,
                master_flags="banned",
                method="GET",
                path="/api/v1/feed",
            ),
        )
        self.assertEqual(resp.status_code, 403)
