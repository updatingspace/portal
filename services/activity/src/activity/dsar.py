from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db.models import Q
from django.utils import timezone

from activity.models import (
    AccountLink,
    ActivityEvent,
    FeedLastSeen,
    NewsComment,
    NewsPost,
    NewsReaction,
    Outbox,
    RawEvent,
    Subscription,
)

ANONYMIZED_USER_ID = UUID("00000000-0000-0000-0000-000000000000")
REDACTED_TEXT = "[deleted by user request]"
REDACTED_TITLE = "[deleted]"
REDACTED_EVENT_TITLE = "Activity from deleted account"
REDACTED_VALUE = "[redacted]"


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _scrub_json(value: Any, *, tokens: set[str]) -> Any:
    if isinstance(value, dict):
        return {key: _scrub_json(item, tokens=tokens) for key, item in value.items()}
    if isinstance(value, list):
        return [_scrub_json(item, tokens=tokens) for item in value]
    if isinstance(value, str):
        return REDACTED_VALUE if value.strip() in tokens else value
    return value


def _serialize_account_link(item: AccountLink) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "user_id": str(item.user_id),
        "source_id": item.source_id,
        "status": item.status,
        "settings_json": item.settings_json or {},
        "external_identity_ref": item.external_identity_ref,
        "created_at": _iso(item.created_at),
    }


def _serialize_raw_event(item: RawEvent) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "account_link_id": item.account_link_id,
        "payload_json": item.payload_json or {},
        "fetched_at": _iso(item.fetched_at),
        "dedupe_hash": item.dedupe_hash,
    }


def _serialize_activity_event(item: ActivityEvent) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "actor_user_id": str(item.actor_user_id) if item.actor_user_id else None,
        "target_user_id": str(item.target_user_id) if item.target_user_id else None,
        "type": item.type,
        "occurred_at": _iso(item.occurred_at),
        "title": item.title,
        "payload_json": item.payload_json or {},
        "visibility": item.visibility,
        "scope_type": item.scope_type,
        "scope_id": item.scope_id,
        "source_ref": item.source_ref,
        "raw_event_id": item.raw_event_id,
    }


def _serialize_news_post(item: NewsPost) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "author_user_id": str(item.author_user_id),
        "title": item.title,
        "body": item.body,
        "tags_json": item.tags_json or [],
        "media_json": item.media_json or [],
        "visibility": item.visibility,
        "scope_type": item.scope_type,
        "scope_id": item.scope_id,
        "comments_count": item.comments_count,
        "reactions_count": item.reactions_count,
        "created_at": _iso(item.created_at),
        "updated_at": _iso(item.updated_at),
    }


def _serialize_news_comment(item: NewsComment) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "post_id": str(item.post_id),
        "user_id": str(item.user_id),
        "body": item.body,
        "created_at": _iso(item.created_at),
        "deleted_at": _iso(item.deleted_at),
    }


def _serialize_news_reaction(item: NewsReaction) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "post_id": str(item.post_id),
        "user_id": str(item.user_id),
        "emoji": item.emoji,
        "created_at": _iso(item.created_at),
    }


def _serialize_subscription(item: Subscription) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "user_id": str(item.user_id),
        "rules_json": item.rules_json or {},
        "created_at": _iso(item.created_at),
    }


def _serialize_feed_last_seen(item: FeedLastSeen) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "user_id": str(item.user_id),
        "last_seen_at": _iso(item.last_seen_at),
        "updated_at": _iso(item.updated_at),
    }


def _serialize_outbox(item: Outbox) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "event_type": item.event_type,
        "aggregate_type": item.aggregate_type,
        "aggregate_id": item.aggregate_id,
        "payload_json": item.payload_json or {},
        "created_at": _iso(item.created_at),
        "processed_at": _iso(item.processed_at),
        "error_message": item.error_message,
        "retry_count": item.retry_count,
    }


def _affected_events_queryset(*, tenant_id: UUID, user_id: UUID, raw_event_ids: list[int]):
    query = Q(actor_user_id=user_id) | Q(target_user_id=user_id)
    if raw_event_ids:
        query = query | Q(raw_event_id__in=raw_event_ids)
    return ActivityEvent.objects.filter(tenant_id=tenant_id).filter(query).distinct()


def _affected_outbox_entries(
    *,
    tenant_id: UUID,
    user_id: UUID,
    account_link_ids: list[int],
) -> list[Outbox]:
    account_link_id_values = {str(item) for item in account_link_ids}
    matched: list[Outbox] = []
    for item in Outbox.objects.filter(tenant_id=tenant_id).order_by("created_at", "id"):
        payload = item.payload_json or {}
        actor_user_id = payload.get("actor_user_id") if isinstance(payload, dict) else None
        target_user_id = payload.get("target_user_id") if isinstance(payload, dict) else None
        aggregate_matches = (
            item.aggregate_type == "account_link"
            and str(item.aggregate_id) in account_link_id_values
        )
        if aggregate_matches or str(actor_user_id) == str(user_id) or str(target_user_id) == str(user_id):
            matched.append(item)
    return matched


def export_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    account_links = list(
        AccountLink.objects.filter(tenant_id=tenant_id, user_id=user_id)
        .select_related("source")
        .order_by("created_at", "id")
    )
    account_link_ids = [item.id for item in account_links]
    raw_events = list(
        RawEvent.objects.filter(tenant_id=tenant_id, account_link_id__in=account_link_ids).order_by(
            "fetched_at",
            "id",
        )
    ) if account_link_ids else []
    raw_event_ids = [item.id for item in raw_events]
    activity_events = list(
        _affected_events_queryset(
            tenant_id=tenant_id,
            user_id=user_id,
            raw_event_ids=raw_event_ids,
        ).order_by("occurred_at", "id")
    )
    news_posts = list(
        NewsPost.objects.filter(tenant_id=tenant_id, author_user_id=user_id).order_by("created_at")
    )
    news_comments = list(
        NewsComment.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at", "id")
    )
    news_reactions = list(
        NewsReaction.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at", "id")
    )
    subscriptions = list(
        Subscription.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at", "id")
    )
    feed_last_seen = list(
        FeedLastSeen.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("last_seen_at", "id")
    )
    outbox_items = _affected_outbox_entries(
        tenant_id=tenant_id,
        user_id=user_id,
        account_link_ids=account_link_ids,
    )

    return {
        "service": "activity",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "exported_at": timezone.now().isoformat(),
        "account_links": [_serialize_account_link(item) for item in account_links],
        "raw_events": [_serialize_raw_event(item) for item in raw_events],
        "activity_events": [_serialize_activity_event(item) for item in activity_events],
        "news_posts": [_serialize_news_post(item) for item in news_posts],
        "news_comments": [_serialize_news_comment(item) for item in news_comments],
        "news_reactions": [_serialize_news_reaction(item) for item in news_reactions],
        "subscriptions": [_serialize_subscription(item) for item in subscriptions],
        "feed_last_seen": [_serialize_feed_last_seen(item) for item in feed_last_seen],
        "outbox": [_serialize_outbox(item) for item in outbox_items],
    }


def erase_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    account_links = list(
        AccountLink.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at", "id")
    )
    account_link_ids = [item.id for item in account_links]
    external_refs = {
        item.external_identity_ref.strip()
        for item in account_links
        if isinstance(item.external_identity_ref, str) and item.external_identity_ref.strip()
    }
    tokens = {str(user_id), *external_refs}

    raw_events = list(
        RawEvent.objects.filter(tenant_id=tenant_id, account_link_id__in=account_link_ids).order_by("id")
    ) if account_link_ids else []
    raw_event_ids = [item.id for item in raw_events]
    activity_events = list(
        _affected_events_queryset(
            tenant_id=tenant_id,
            user_id=user_id,
            raw_event_ids=raw_event_ids,
        ).order_by("id")
    )

    now = timezone.now()

    news_posts_redacted = NewsPost.objects.filter(
        tenant_id=tenant_id,
        author_user_id=user_id,
    ).update(
        author_user_id=ANONYMIZED_USER_ID,
        title=REDACTED_TITLE,
        body=REDACTED_TEXT,
        tags_json=[],
        media_json=[],
        updated_at=now,
    )
    news_comments_redacted = NewsComment.objects.filter(
        tenant_id=tenant_id,
        user_id=user_id,
    ).update(
        user_id=ANONYMIZED_USER_ID,
        body=REDACTED_TEXT,
    )

    reaction_post_ids = list(
        NewsReaction.objects.filter(tenant_id=tenant_id, user_id=user_id).values_list("post_id", flat=True)
    )
    news_reactions_deleted, _ = NewsReaction.objects.filter(
        tenant_id=tenant_id,
        user_id=user_id,
    ).delete()
    for post_id in sorted({item for item in reaction_post_ids}):
        remaining = NewsReaction.objects.filter(post_id=post_id).count()
        NewsPost.objects.filter(id=post_id).update(reactions_count=remaining)

    activity_events_redacted = 0
    for item in activity_events:
        updates: list[str] = []
        payload_json = item.payload_json or {}
        new_payload = _scrub_json(payload_json, tokens=tokens)
        new_title = item.title

        if item.type == "news.posted" and item.actor_user_id == user_id:
            new_title = REDACTED_EVENT_TITLE
            if isinstance(payload_json, dict) and payload_json.get("news_id"):
                new_payload = {
                    "news_id": payload_json.get("news_id"),
                    "redacted": True,
                }
            else:
                new_payload = {"redacted": True}

        if item.actor_user_id == user_id:
            item.actor_user_id = None
            updates.append("actor_user_id")
        if item.target_user_id == user_id:
            item.target_user_id = None
            updates.append("target_user_id")
        if item.raw_event_id in raw_event_ids:
            item.raw_event = None
            updates.append("raw_event")
        if new_payload != payload_json:
            item.payload_json = new_payload
            updates.append("payload_json")
        if new_title != item.title:
            item.title = new_title
            updates.append("title")

        if updates:
            item.save(update_fields=updates)
            activity_events_redacted += 1

    account_link_outbox_deleted = 0
    if account_link_ids:
        account_link_outbox_deleted, _ = Outbox.objects.filter(
            tenant_id=tenant_id,
            aggregate_type="account_link",
            aggregate_id__in=[str(item) for item in account_link_ids],
        ).delete()

    outbox_scrubbed = 0
    for item in Outbox.objects.filter(tenant_id=tenant_id).order_by("id"):
        payload_json = item.payload_json or {}
        new_payload = _scrub_json(payload_json, tokens=tokens)
        if new_payload != payload_json:
            item.payload_json = new_payload
            item.save(update_fields=["payload_json"])
            outbox_scrubbed += 1

    raw_events_deleted, _ = RawEvent.objects.filter(
        tenant_id=tenant_id,
        account_link_id__in=account_link_ids,
    ).delete() if account_link_ids else (0, {})
    account_links_deleted, _ = AccountLink.objects.filter(
        tenant_id=tenant_id,
        id__in=account_link_ids,
    ).delete() if account_link_ids else (0, {})
    subscriptions_deleted, _ = Subscription.objects.filter(
        tenant_id=tenant_id,
        user_id=user_id,
    ).delete()
    feed_last_seen_deleted, _ = FeedLastSeen.objects.filter(
        tenant_id=tenant_id,
        user_id=user_id,
    ).delete()

    return {
        "service": "activity",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "mode": "hybrid",
        "erased_at": timezone.now().isoformat(),
        "counts": {
            "news_posts_redacted": news_posts_redacted,
            "news_comments_redacted": news_comments_redacted,
            "news_reactions_deleted": news_reactions_deleted,
            "activity_events_redacted": activity_events_redacted,
            "account_link_outbox_deleted": account_link_outbox_deleted,
            "outbox_scrubbed": outbox_scrubbed,
            "raw_events_deleted": raw_events_deleted,
            "account_links_deleted": account_links_deleted,
            "subscriptions_deleted": subscriptions_deleted,
            "feed_last_seen_deleted": feed_last_seen_deleted,
        },
    }
