from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from ninja import Schema


# ============================================================================
# Error Responses
# ============================================================================


class ErrorDetailOut(Schema):
    """Detailed error information."""

    code: str
    message: str
    details: dict[str, Any] | None = None
    request_id: str | None = None


class ErrorOut(Schema):
    """Standard error response wrapper."""

    error: ErrorDetailOut


# ============================================================================
# Health & Monitoring
# ============================================================================


class HealthStatus(str, Enum):
    OK = "ok"
    DEGRADED = "degraded"
    ERROR = "error"


class HealthCheckOut(Schema):
    """Individual health check result."""

    name: str
    status: HealthStatus
    latency_ms: float
    message: str
    details: dict[str, Any] | None = None


class HealthOut(Schema):
    """Health endpoint response."""

    status: HealthStatus
    service: str
    timestamp: datetime
    checks: list[HealthCheckOut] | None = None


class MetricsOut(Schema):
    """Service metrics response."""

    activity_events_total: int
    raw_events_total: int
    account_links_total: int
    outbox_pending: int
    outbox_failed: int
    timestamp: datetime


# ============================================================================
# Games
# ============================================================================


class GameOut(Schema):
    """Game in tenant's catalog."""

    id: int
    tenant_id: UUID
    name: str
    tags_json: dict[str, Any]


class GameCreateIn(Schema):
    """Payload for creating a game."""

    name: str
    tags_json: dict[str, Any] | None = None


# ============================================================================
# Sources & Account Links
# ============================================================================


class SourceType(str, Enum):
    """Supported external source types."""

    STEAM = "steam"
    MINECRAFT = "minecraft"
    DISCORD = "discord"
    CUSTOM = "custom"


class SourceOut(Schema):
    """External data source."""

    id: int
    tenant_id: UUID
    type: str


class SourceDetailOut(Schema):
    """Detailed source information (admin)."""

    id: int
    tenant_id: UUID
    type: str
    config_json: dict[str, Any]
    created_at: datetime


class AccountLinkStatus(str, Enum):
    """Status of account link."""

    ACTIVE = "active"
    PENDING = "pending"
    DISABLED = "disabled"
    ERROR = "error"


class AccountLinkOut(Schema):
    """Link between user and external source."""

    id: int
    tenant_id: UUID
    user_id: UUID
    source_id: int
    status: str
    settings_json: dict[str, Any]
    external_identity_ref: str | None


class AccountLinkDetailOut(Schema):
    """Detailed account link with sync status."""

    id: int
    tenant_id: UUID
    user_id: UUID
    source_id: int
    source_type: str
    status: str
    settings_json: dict[str, Any]
    external_identity_ref: str | None
    last_sync_at: datetime | None
    last_error: str | None
    created_at: datetime


class AccountLinkCreateIn(Schema):
    """Payload for creating an account link."""

    source_id: int
    status: str | None = None
    settings_json: dict[str, Any] | None = None
    external_identity_ref: str | None = None


# ============================================================================
# Subscriptions
# ============================================================================


class ScopeRuleIn(Schema):
    """Scope subscription rule."""

    scope_type: str  # "tenant", "COMMUNITY", "TEAM"
    scope_id: str


class SubscriptionIn(Schema):
    """Payload for creating/updating subscription."""

    scopes: list[ScopeRuleIn]


class SubscriptionOut(Schema):
    """User's feed subscription."""

    id: int
    tenant_id: UUID
    user_id: UUID
    rules_json: dict[str, Any]


class SubscriptionsOut(Schema):
    """List of user subscriptions."""

    items: list[SubscriptionOut]


# ============================================================================
# Activity Events & Feed
# ============================================================================


class ActivityEventType(str, Enum):
    """Supported activity event types (MVP)."""

    VOTE_CAST = "vote.cast"
    EVENT_CREATED = "event.created"
    EVENT_RSVP_CHANGED = "event.rsvp.changed"
    POST_CREATED = "post.created"
    NEWS_POSTED = "news.posted"
    # Connector events (Phase 2)
    GAME_ACHIEVEMENT = "game.achievement"
    GAME_PLAYTIME = "game.playtime"
    STEAM_PRIVATE = "steam.private"
    MINECRAFT_SESSION = "minecraft.session"


class ActivityEventOut(Schema):
    """Activity event in the feed."""

    id: int
    tenant_id: UUID
    actor_user_id: UUID | None
    target_user_id: UUID | None
    type: str
    occurred_at: datetime
    title: str
    payload_json: dict[str, Any]
    visibility: str
    scope_type: str
    scope_id: str
    source_ref: str


class FeedOut(Schema):
    """Feed response (legacy, offset-based)."""

    items: list[ActivityEventOut]


class FeedOutV2(Schema):
    """Feed response with cursor-based pagination."""

    items: list[ActivityEventOut]
    next_cursor: str | None  # Base64 encoded cursor for next page
    has_more: bool  # Whether more items exist


class FeedFiltersIn(Schema):
    """Feed query filters (for documentation)."""

    from_: datetime | None = None  # Filter events after this datetime
    to: datetime | None = None  # Filter events before this datetime
    types: str | None = None  # Comma-separated event types
    scope_type: str | None = None  # Filter by scope type
    scope_id: str | None = None  # Filter by scope ID
    limit: int = 50  # Max items per page (1-100)
    cursor: str | None = None  # Pagination cursor (v2 only)


# ============================================================================
# Sync & Webhooks
# ============================================================================


class SyncRunOut(Schema):
    """Result of sync operation."""

    ok: bool
    raw_created: int
    raw_deduped: int
    activity_created: int


class SyncStatusOut(Schema):
    """Sync status for an account link."""

    account_link_id: int
    source_type: str
    last_sync_at: datetime | None
    last_error: str | None
    next_sync_at: datetime | None
    is_syncing: bool


class WebhookIngestOut(Schema):
    """Result of webhook ingestion."""

    ok: bool
    raw_created: int
    raw_deduped: int
    activity_created: int


# ============================================================================
# Unread Count & Real-time
# ============================================================================


class UnreadCountOut(Schema):
    """Response for unread feed count."""

    count: int


class UnreadCountLongPollOut(Schema):
    """Long-poll response for unread feed count."""

    count: int
    changed: bool
    waited_ms: int
    server_time: datetime


class SSEEventOut(Schema):
    """SSE event data (for documentation)."""

    event: str  # "unread", "heartbeat", "close", "error"
    count: int | None = None
    timestamp: datetime | None = None
    message: str | None = None
    reason: str | None = None


# ============================================================================
# News
# ============================================================================


class NewsMediaIn(Schema):
    type: str  # "image" | "youtube"
    key: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None
    width: int | None = None
    height: int | None = None
    caption: str | None = None
    url: str | None = None
    video_id: str | None = None
    title: str | None = None


class NewsCreateIn(Schema):
    title: str | None = None
    body: str
    tags: list[str] = []
    visibility: str
    scope_type: str | None = None
    scope_id: str | None = None
    media: list[NewsMediaIn] = []


class NewsUpdateIn(Schema):
    title: str | None = None
    body: str | None = None
    tags: list[str] | None = None
    visibility: str | None = None
    media: list[NewsMediaIn] | None = None


class NewsMediaUploadIn(Schema):
    filename: str
    content_type: str
    size_bytes: int


class NewsMediaUploadOut(Schema):
    key: str
    upload_url: str
    upload_headers: dict[str, str]
    expires_in: int


class NewsReactionIn(Schema):
    emoji: str
    action: Literal["add", "remove"] = "add"


class NewsReactionOut(Schema):
    emoji: str
    count: int


class NewsReactionDetailOut(Schema):
    id: int
    user_id: UUID
    emoji: str
    created_at: datetime


class NewsCommentIn(Schema):
    body: str
    parent_id: int | None = None


class NewsCommentOut(Schema):
    id: int
    user_id: UUID | None
    body: str
    created_at: datetime
    parent_id: int | None = None
    deleted: bool = False
    likes_count: int = 0
    my_liked: bool = False
    replies_count: int = 0


class NewsCommentPageOut(Schema):
    items: list[NewsCommentOut]
    next_cursor: str | None = None
    has_more: bool = False
    parent_id: int | None = None


class NewsCommentLikeIn(Schema):
    action: Literal["add", "remove"] = "add"


class NewsCommentLikeOut(Schema):
    likes_count: int
    my_liked: bool


# ============================================================================
# Outbox (Admin/Debug)
# ============================================================================


class OutboxEventOut(Schema):
    """Schema for outbox event details (admin/debug)."""

    id: int
    tenant_id: UUID
    event_type: str
    aggregate_type: str
    aggregate_id: str
    payload_json: dict[str, Any]
    created_at: datetime
    processed_at: datetime | None
    retry_count: int
