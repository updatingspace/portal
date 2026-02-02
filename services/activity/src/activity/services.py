from __future__ import annotations

import base64
import hashlib
import hmac
import json as json_module
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from ninja.errors import HttpError

from activity.connectors.base import RawEventIn
from activity.connectors.registry import get_connector
from activity.enums import AccountLinkStatus
from activity.models import (
    AccountLink,
    ActivityEvent,
    FeedLastSeen,
    Game,
    Outbox,
    OutboxEventType,
    RawEvent,
    Source,
    Subscription,
    make_dedupe_hash,
)
from core.errors import error_payload

logger = logging.getLogger(__name__)


MVP_EVENT_TYPES = {
    "vote.cast",
    "event.created",
    "event.rsvp.changed",
    "post.created",
}


def require_not_suspended(ctx) -> None:
    """Check if user is suspended or banned via master flags.

    Raises HttpError 403 if user is suspended/banned.
    """
    if "suspended" in ctx.master_flags or "banned" in ctx.master_flags:
        raise HttpError(
            403,
            error_payload("ACCESS_DENIED", "Access denied"),
        )


# ============================================================================
# Outbox Helpers
# ============================================================================


def publish_outbox_event(
    *,
    tenant_id: UUID,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
) -> Outbox:
    """
    Create an outbox event for cross-service communication.

    Should be called within a transaction to ensure atomicity.
    """
    return Outbox.objects.create(
        tenant_id=tenant_id,
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        payload_json=payload,
    )


def get_unread_count(*, tenant_id: UUID, user_id: UUID) -> int:
    """
    Get count of feed events since user's last_seen_at.

    Returns 0 if user hasn't viewed feed yet (conservative default).
    """
    last_seen = FeedLastSeen.objects.filter(
        tenant_id=tenant_id,
        user_id=user_id,
    ).first()

    if not last_seen:
        return 0

    return ActivityEvent.objects.filter(
        tenant_id=tenant_id,
        occurred_at__gt=last_seen.last_seen_at,
    ).count()


def get_unread_count_cached(*, tenant_id: UUID, user_id: UUID) -> int:
    """
    Get cached unread activity count.

    Uses cache with short TTL to reduce DB load.
    Cache is invalidated when new events arrive or user views feed.
    """
    cache_key = _unread_cache_key(tenant_id, user_id)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    count = get_unread_count(tenant_id=tenant_id, user_id=user_id)
    cache.set(cache_key, count, UNREAD_CACHE_TTL)
    return count


def update_last_seen(*, tenant_id: UUID, user_id: UUID) -> FeedLastSeen:
    """
    Update user's last_seen_at timestamp for feed.

    Creates record if it doesn't exist.
    Also invalidates the unread count cache.
    """
    obj, _ = FeedLastSeen.objects.update_or_create(
        tenant_id=tenant_id,
        user_id=user_id,
        defaults={"last_seen_at": timezone.now()},
    )
    # Invalidate cache
    cache.delete(_unread_cache_key(tenant_id, user_id))
    return obj


# ============================================================================
# Cursor Encoding/Decoding
# ============================================================================


def _encode_cursor(occurred_at: datetime, event_id: int) -> str:
    """
    Encode pagination cursor as base64.

    Cursor contains: {occurred_at_iso}:{event_id}
    Uses base64 encoding for URL safety.
    """
    cursor_data = f"{occurred_at.isoformat()}:{event_id}"
    return base64.urlsafe_b64encode(cursor_data.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, int] | None:
    """
    Decode pagination cursor.

    Returns (occurred_at, event_id) tuple or None if invalid.
    """
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode()).decode()
        parts = decoded.rsplit(":", 1)
        if len(parts) != 2:
            return None
        occurred_at = datetime.fromisoformat(parts[0])
        event_id = int(parts[1])
        return occurred_at, event_id
    except Exception:
        return None


# ============================================================================
# Caching
# ============================================================================

FEED_CACHE_TTL = 60  # 1 minute
UNREAD_CACHE_TTL = 30  # 30 seconds


def _feed_cache_key(tenant_id: UUID, user_id: UUID, filters_hash: str) -> str:
    """Generate cache key for feed queries."""
    return f"activity:feed:{tenant_id}:{user_id}:{filters_hash}"


def _unread_cache_key(tenant_id: UUID, user_id: UUID) -> str:
    """Generate cache key for unread count."""
    return f"activity:unread:{tenant_id}:{user_id}"


def _invalidate_user_feed_cache(tenant_id: UUID, user_id: UUID) -> None:
    """Invalidate all feed caches for a user (called when new events arrive)."""
    # For Django's default cache (memcached/redis), we'd use pattern delete
    # For now, we invalidate the unread count cache
    cache.delete(_unread_cache_key(tenant_id, user_id))


# ============================================================================
# Feed and Data Access
# ============================================================================


@dataclass(frozen=True)
class FeedFilters:
    from_dt: datetime | None
    to_dt: datetime | None
    types: list[str] | None
    scope_type: str | None
    scope_id: str | None


def parse_csv(value: str | None) -> list[str] | None:
    if not value:
        return None
    items = [p.strip() for p in value.split(",") if p.strip()]
    return items or None


def list_feed(
    *,
    tenant_id: UUID,
    user_id: UUID,
    filters: FeedFilters,
    limit: int = 100,
    update_last_seen_flag: bool = True,
) -> list[ActivityEvent]:
    """
    Get activity feed for user with filtering and subscription matching.

    If update_last_seen_flag is True, updates the user's last_seen_at timestamp.
    """
    qs = ActivityEvent.objects.filter(tenant_id=tenant_id)
    if filters.from_dt:
        qs = qs.filter(occurred_at__gte=filters.from_dt)
    if filters.to_dt:
        qs = qs.filter(occurred_at__lte=filters.to_dt)
    if filters.types:
        requested = set(filters.types)
        unknown = sorted(requested - MVP_EVENT_TYPES)
        if unknown:
            raise HttpError(
                400,
                error_payload(
                    "INVALID_EVENT_TYPES",
                    "Unsupported event types requested",
                    details={"unknown": unknown},
                ),
            )
        qs = qs.filter(type__in=list(requested))
    else:
        qs = qs.filter(type__in=list(MVP_EVENT_TYPES))

    if filters.scope_type and filters.scope_id:
        qs = qs.filter(
            scope_type=filters.scope_type,
            scope_id=filters.scope_id,
        )
    else:
        sub = Subscription.objects.filter(
            tenant_id=tenant_id,
            user_id=user_id,
        ).first()
        scopes = []
        if sub and isinstance(sub.rules_json, dict):
            scopes = sub.rules_json.get("scopes") or []
        scope_q = Q()
        for s in scopes:
            st = (s.get("scope_type") or "").strip()
            sid = (s.get("scope_id") or "").strip()
            if st and sid:
                scope_q |= Q(scope_type=st, scope_id=sid)
        if scope_q:
            qs = qs.filter(scope_q)
        else:
            # No subscriptions, no explicit scope => empty feed.
            return []

    items = list(qs.order_by("-occurred_at", "-id")[:limit])

    # Update last_seen timestamp after successful feed retrieval
    if update_last_seen_flag and items:
        update_last_seen(tenant_id=tenant_id, user_id=user_id)

    return items


@dataclass(frozen=True)
class PaginatedFeedResult:
    """Result of paginated feed query."""

    items: list[ActivityEvent]
    next_cursor: str | None
    has_more: bool


def list_feed_paginated(
    *,
    tenant_id: UUID,
    user_id: UUID,
    filters: FeedFilters,
    limit: int = 50,
    cursor: str | None = None,
    update_last_seen_flag: bool = True,
) -> PaginatedFeedResult:
    """
    Get activity feed with cursor-based pagination.

    Cursor-based pagination provides:
    - Stable results even when new items are added
    - Better performance for large datasets
    - No duplicate items when paginating

    Args:
        tenant_id: Tenant ID for filtering
        user_id: User ID for subscription matching
        filters: Feed filters (types, date range, scope)
        limit: Maximum items per page (default 50, max 100)
        cursor: Opaque cursor from previous response
        update_last_seen_flag: Whether to update last_seen timestamp

    Returns:
        PaginatedFeedResult with items, next_cursor, and has_more flag
    """
    # Validate and clamp limit
    limit = min(max(1, limit), 100)

    # Parse cursor if provided
    cursor_occurred_at: datetime | None = None
    cursor_event_id: int | None = None
    if cursor:
        parsed = _decode_cursor(cursor)
        if parsed:
            cursor_occurred_at, cursor_event_id = parsed
        else:
            raise HttpError(
                400,
                error_payload("INVALID_CURSOR", "Invalid pagination cursor"),
            )

    # Build base query (same as list_feed)
    qs = ActivityEvent.objects.filter(tenant_id=tenant_id)

    if filters.from_dt:
        qs = qs.filter(occurred_at__gte=filters.from_dt)
    if filters.to_dt:
        qs = qs.filter(occurred_at__lte=filters.to_dt)
    if filters.types:
        requested = set(filters.types)
        unknown = sorted(requested - MVP_EVENT_TYPES)
        if unknown:
            raise HttpError(
                400,
                error_payload(
                    "INVALID_EVENT_TYPES",
                    "Unsupported event types requested",
                    details={"unknown": unknown},
                ),
            )
        qs = qs.filter(type__in=list(requested))
    else:
        qs = qs.filter(type__in=list(MVP_EVENT_TYPES))

    # Apply scope filters
    if filters.scope_type and filters.scope_id:
        qs = qs.filter(
            scope_type=filters.scope_type,
            scope_id=filters.scope_id,
        )
    else:
        sub = Subscription.objects.filter(
            tenant_id=tenant_id,
            user_id=user_id,
        ).first()
        scopes = []
        if sub and isinstance(sub.rules_json, dict):
            scopes = sub.rules_json.get("scopes") or []
        scope_q = Q()
        for s in scopes:
            st = (s.get("scope_type") or "").strip()
            sid = (s.get("scope_id") or "").strip()
            if st and sid:
                scope_q |= Q(scope_type=st, scope_id=sid)
        if scope_q:
            qs = qs.filter(scope_q)
        else:
            return PaginatedFeedResult(items=[], next_cursor=None, has_more=False)

    # Apply cursor-based pagination
    # We order by (occurred_at DESC, id DESC), so cursor checks for items "before" the cursor
    if cursor_occurred_at and cursor_event_id:
        qs = qs.filter(
            Q(occurred_at__lt=cursor_occurred_at)
            | Q(occurred_at=cursor_occurred_at, id__lt=cursor_event_id)
        )

    # Fetch limit + 1 to check if there are more items
    items = list(qs.order_by("-occurred_at", "-id")[: limit + 1])

    has_more = len(items) > limit
    if has_more:
        items = items[:limit]

    # Generate next cursor from last item
    next_cursor: str | None = None
    if has_more and items:
        last_item = items[-1]
        next_cursor = _encode_cursor(last_item.occurred_at, last_item.id)

    # Update last_seen timestamp on first page fetch
    if update_last_seen_flag and not cursor and items:
        update_last_seen(tenant_id=tenant_id, user_id=user_id)

    return PaginatedFeedResult(
        items=items,
        next_cursor=next_cursor,
        has_more=has_more,
    )


@transaction.atomic
def create_game(
    *,
    tenant_id,
    name: str,
    tags_json: dict[str, Any] | None,
) -> Game:
    return Game.objects.create(
        tenant_id=tenant_id,
        name=name,
        tags_json=tags_json or {},
    )


def list_games(*, tenant_id) -> list[Game]:
    return list(
        Game.objects.filter(tenant_id=tenant_id).order_by("name", "id")
    )


def list_sources(*, tenant_id) -> list[Source]:
    return list(
        Source.objects.filter(tenant_id=tenant_id).order_by("type", "id")
    )


@transaction.atomic
def create_account_link(
    *,
    tenant_id,
    user_id,
    source_id: int,
    status: str | None,
    settings_json: dict | None,
    external_identity_ref: str | None,
) -> AccountLink:
    source = Source.objects.filter(tenant_id=tenant_id, id=source_id).first()
    if not source:
        raise HttpError(
            404,
            error_payload("SOURCE_NOT_FOUND", "Источник не найден"),
        )
    st = (
        status or AccountLinkStatus.ACTIVE
    ).strip() or AccountLinkStatus.ACTIVE
    if st not in AccountLinkStatus.values:
        raise HttpError(
            400,
            error_payload("INVALID_STATUS", "Некорректный статус"),
        )
    try:
        return AccountLink.objects.create(
            tenant_id=tenant_id,
            user_id=user_id,
            source=source,
            status=st,
            settings_json=settings_json or {},
            external_identity_ref=external_identity_ref,
        )
    except IntegrityError as exc:
        raise HttpError(
            409,
            error_payload("ALREADY_LINKED", "Источник уже привязан"),
        ) from exc


@transaction.atomic
def upsert_subscription(
    *,
    tenant_id,
    user_id,
    scopes: list[dict[str, str]],
) -> Subscription:
    rules = {"scopes": scopes}
    obj, _ = Subscription.objects.update_or_create(
        tenant_id=tenant_id,
        user_id=user_id,
        defaults={"rules_json": rules},
    )
    return obj


def _sleep(seconds: float) -> None:
    time.sleep(seconds)


def _backoff_delay(attempt: int, base: float, max_delay: float) -> float:
    return min(max_delay, base * (2 ** max(0, attempt - 1)))


@transaction.atomic
def ingest_raw_and_normalize(
    *,
    tenant_id,
    account_link: AccountLink,
    raw_in: RawEventIn,
) -> tuple[bool, bool]:
    connector = get_connector(account_link.source.type)
    key = connector.dedupe_key(raw_in)
    dedupe_hash = make_dedupe_hash(
        source_type=account_link.source.type,
        key=key,
    )

    raw_created = False
    try:
        raw = RawEvent.objects.create(
            tenant_id=tenant_id,
            account_link=account_link,
            payload_json=raw_in.payload_json or {},
            fetched_at=timezone.now(),
            dedupe_hash=dedupe_hash,
        )
        raw_created = True
    except IntegrityError:
        return False, False

    activity = connector.normalize(raw, account_link)
    activity.tenant_id = tenant_id
    activity.raw_event = raw

    try:
        activity.save()

        # Publish outbox event for cross-service notification
        publish_outbox_event(
            tenant_id=tenant_id,
            event_type=OutboxEventType.FEED_UPDATED,
            aggregate_type="activity_event",
            aggregate_id=str(activity.id),
            payload={
                "event_id": activity.id,
                "event_type": activity.type,
                "actor_user_id": str(activity.actor_user_id) if activity.actor_user_id else None,
                "target_user_id": str(activity.target_user_id) if activity.target_user_id else None,
                "scope_type": activity.scope_type,
                "scope_id": activity.scope_id,
                "occurred_at": activity.occurred_at.isoformat() if activity.occurred_at else None,
            },
        )

        logger.info(
            "Activity event created",
            extra={
                "tenant_id": str(tenant_id),
                "event_id": activity.id,
                "event_type": activity.type,
            },
        )
        return raw_created, True
    except IntegrityError:
        # Duplicate source_ref for tenant
        return raw_created, False


def run_sync(*, tenant_id, account_link_id: int) -> dict[str, int]:
    link = (
        AccountLink.objects.select_related("source")
        .filter(tenant_id=tenant_id, id=account_link_id)
        .first()
    )
    if not link:
        raise HttpError(
            404,
            error_payload("ACCOUNT_LINK_NOT_FOUND", "AccountLink not found"),
        )

    connector = get_connector(link.source.type)
    caps = connector.describe()
    if not caps.can_sync:
        raise HttpError(
            400,
            error_payload(
                "SYNC_NOT_SUPPORTED",
                "Sync is not supported for this source",
            ),
        )

    limits = connector.rate_limits()
    if limits.requests_per_minute:
        key = f"act:sync:rl:{tenant_id}:{account_link_id}"
        try:
            current = cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=60)
            current = 1
        if current > int(limits.requests_per_minute):
            raise HttpError(
                429,
                error_payload(
                    "RATE_LIMITED",
                    "Too many sync requests",
                    details={"limit_per_minute": limits.requests_per_minute},
                ),
            )

    policy = connector.retry_policy()
    last_exc: Exception | None = None
    for attempt in range(1, max(1, policy.max_attempts) + 1):
        try:
            raw_list = connector.sync(link)
            raw_created = 0
            raw_deduped = 0
            activity_created = 0
            for raw_in in raw_list:
                created_raw, created_act = ingest_raw_and_normalize(
                    tenant_id=tenant_id,
                    account_link=link,
                    raw_in=raw_in,
                )
                if created_raw:
                    raw_created += 1
                else:
                    raw_deduped += 1
                if created_act:
                    activity_created += 1

            # Publish sync completion event
            with transaction.atomic():
                publish_outbox_event(
                    tenant_id=tenant_id,
                    event_type=OutboxEventType.SYNC_COMPLETED,
                    aggregate_type="account_link",
                    aggregate_id=str(account_link_id),
                    payload={
                        "account_link_id": account_link_id,
                        "source_type": link.source.type,
                        "raw_created": raw_created,
                        "raw_deduped": raw_deduped,
                        "activity_created": activity_created,
                    },
                )

            logger.info(
                "Sync completed",
                extra={
                    "tenant_id": str(tenant_id),
                    "account_link_id": account_link_id,
                    "raw_created": raw_created,
                    "activity_created": activity_created,
                },
            )

            return {
                "raw_created": raw_created,
                "raw_deduped": raw_deduped,
                "activity_created": activity_created,
            }
        except HttpError:
            raise
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "Sync attempt failed",
                extra={
                    "tenant_id": str(tenant_id),
                    "account_link_id": account_link_id,
                    "attempt": attempt,
                    "error": str(exc),
                },
            )
            if attempt >= policy.max_attempts:
                break
            delay = _backoff_delay(
                attempt,
                policy.base_delay_seconds,
                policy.max_delay_seconds,
            )
            _sleep(delay)

    # Publish sync failure event
    with transaction.atomic():
        publish_outbox_event(
            tenant_id=tenant_id,
            event_type=OutboxEventType.SYNC_FAILED,
            aggregate_type="account_link",
            aggregate_id=str(account_link_id),
            payload={
                "account_link_id": account_link_id,
                "source_type": link.source.type,
                "error": str(last_exc) if last_exc else "unknown",
            },
        )

    logger.error(
        "Sync failed after retries",
        extra={
            "tenant_id": str(tenant_id),
            "account_link_id": account_link_id,
            "error": str(last_exc) if last_exc else "unknown",
        },
    )

    raise HttpError(
        502,
        error_payload(
            "SYNC_FAILED",
            "Sync failed",
            details={"error": str(last_exc) if last_exc else "unknown"},
        ),
    )


def verify_hmac_signature(
    *,
    secret: str,
    body: bytes,
    header_value: str | None,
) -> None:
    if not header_value:
        raise HttpError(
            401,
            error_payload("MISSING_SIGNATURE", "X-Signature is required"),
        )

    algo, sep, sig = header_value.partition("=")
    if not sep:
        # Allow raw hex signature
        algo = "sha256"
        sig = header_value

    algo = algo.lower().strip()
    if algo != "sha256":
        raise HttpError(
            400,
            error_payload(
                "INVALID_SIGNATURE",
                "Only sha256 signatures are supported",
            ),
        )

    expected = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, sig.strip()):
        raise HttpError(
            401,
            error_payload("INVALID_SIGNATURE", "Signature mismatch"),
        )


def minecraft_webhook_secret() -> str:
    value = os.getenv("MINECRAFT_WEBHOOK_SECRET") or os.getenv(
        "ACTIVITY_MINECRAFT_WEBHOOK_SECRET"
    )
    if not value:
        raise HttpError(
            500,
            error_payload(
                "WEBHOOK_SECRET_NOT_CONFIGURED",
                "Minecraft webhook secret is not configured",
            ),
        )
    return value
