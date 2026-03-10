from __future__ import annotations

import hashlib
import uuid

from django.db import models
from django.utils import timezone

from activity.enums import AccountLinkStatus, ScopeType, SourceType, Visibility


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class Game(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    name = models.CharField(max_length=128)
    tags_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "act_game"
        indexes = [
            models.Index(
                fields=["tenant_id", "name"],
                name="act_game_tenant_name_idx",
            ),
        ]


class Source(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    type = models.CharField(max_length=32, choices=SourceType.choices)
    config_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "act_source"
        indexes = [
            models.Index(
                fields=["tenant_id", "type"],
                name="act_source_tenant_type_idx",
            ),
        ]


class AccountLink(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    user_id = models.UUIDField()
    source = models.ForeignKey(
        Source,
        on_delete=models.CASCADE,
        related_name="account_links",
    )
    status = models.CharField(
        max_length=16,
        choices=AccountLinkStatus.choices,
        default=AccountLinkStatus.ACTIVE,
    )
    settings_json = models.JSONField(default=dict)
    external_identity_ref = models.CharField(
        max_length=256,
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "act_account_link"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "user_id", "source"],
                name="act_account_link_tenant_user_source_uniq",
            )
        ]
        indexes = [
            models.Index(
                fields=["tenant_id", "user_id"],
                name="act_acclink_tenant_user_idx",
            ),
            models.Index(
                fields=["tenant_id", "source"],
                name="act_acclink_tenant_source_idx",
            ),
        ]


class RawEvent(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    account_link = models.ForeignKey(
        AccountLink,
        on_delete=models.CASCADE,
        related_name="raw_events",
    )
    payload_json = models.JSONField(default=dict)
    fetched_at = models.DateTimeField(default=timezone.now)
    dedupe_hash = models.CharField(max_length=64)

    class Meta:
        db_table = "act_raw_event"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "dedupe_hash"],
                name="act_raw_event_dedupe_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["tenant_id", "account_link"],
                name="act_raw_tenant_acclink_idx",
            ),
            models.Index(
                fields=["tenant_id", "fetched_at"],
                name="act_raw_tenant_fetched_idx",
            ),
        ]


class ActivityEvent(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    actor_user_id = models.UUIDField(null=True, blank=True)
    target_user_id = models.UUIDField(null=True, blank=True)
    type = models.CharField(max_length=64)
    occurred_at = models.DateTimeField()
    title = models.CharField(max_length=256)
    payload_json = models.JSONField(default=dict)
    visibility = models.CharField(
        max_length=16,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
    )
    scope_type = models.CharField(
        max_length=16,
        choices=ScopeType.choices,
        default=ScopeType.TENANT,
    )
    scope_id = models.CharField(max_length=128)
    source_ref = models.CharField(max_length=255)
    raw_event = models.ForeignKey(
        RawEvent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_events",
    )

    class Meta:
        db_table = "act_activity_event"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "source_ref"],
                name="act_event_source_ref_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["tenant_id", "occurred_at"],
                name="act_event_tenant_occurred_idx",
            ),
            models.Index(
                fields=["tenant_id", "type", "occurred_at"],
                name="act_ev_tnt_type_occ_idx",
            ),
            models.Index(
                fields=["tenant_id", "scope_type", "scope_id", "occurred_at"],
                name="act_event_scope_idx",
            ),
            # Indexes for user-specific queries (my activities, activities about me)
            models.Index(
                fields=["tenant_id", "actor_user_id", "-occurred_at"],
                name="act_ev_tnt_actor_occ_idx",
            ),
            models.Index(
                fields=["tenant_id", "target_user_id", "-occurred_at"],
                name="act_ev_tnt_target_occ_idx",
            ),
        ]


class NewsPost(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField()
    author_user_id = models.UUIDField()
    title = models.CharField(max_length=256, blank=True)
    body = models.TextField()
    tags_json = models.JSONField(default=list)
    media_json = models.JSONField(default=list)
    visibility = models.CharField(
        max_length=16,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
    )
    scope_type = models.CharField(
        max_length=16,
        choices=ScopeType.choices,
        default=ScopeType.TENANT,
    )
    scope_id = models.CharField(max_length=128)
    comments_count = models.PositiveIntegerField(default=0)
    reactions_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "act_news_post"
        indexes = [
            models.Index(fields=["tenant_id", "created_at"], name="act_news_tnt_created_idx"),
            models.Index(fields=["tenant_id", "scope_type", "scope_id"], name="act_news_scope_idx"),
        ]


class NewsReaction(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    post = models.ForeignKey(
        NewsPost,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user_id = models.UUIDField()
    emoji = models.CharField(max_length=32)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "act_news_reaction"
        constraints = [
            models.UniqueConstraint(
                fields=["post", "user_id", "emoji"],
                name="act_news_reaction_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant_id", "post"], name="act_news_react_post_idx"),
        ]


class NewsComment(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    post = models.ForeignKey(
        NewsPost,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )
    user_id = models.UUIDField()
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "act_news_comment"
        indexes = [
            models.Index(fields=["tenant_id", "post", "created_at"], name="act_news_comment_idx"),
            models.Index(fields=["tenant_id", "post", "parent", "created_at"], name="act_news_comment_parent_idx"),
        ]


class NewsCommentReaction(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    comment = models.ForeignKey(
        NewsComment,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user_id = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "act_news_comment_reaction"
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user_id"],
                name="act_news_comment_reaction_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant_id", "comment"], name="act_news_comment_react_idx"),
        ]


class Subscription(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    user_id = models.UUIDField()
    rules_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "act_subscription"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "user_id"],
                name="act_sub_tenant_user_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["tenant_id", "user_id"],
                name="act_sub_tenant_user_idx",
            ),
        ]


class OutboxEventType(models.TextChoices):
    """Outbox event types for cross-service communication."""

    FEED_UPDATED = "activity.feed.updated", "Feed Updated"
    SYNC_COMPLETED = "activity.sync.completed", "Sync Completed"
    SYNC_FAILED = "activity.sync.failed", "Sync Failed"
    ACCOUNT_LINKED = "activity.account.linked", "Account Linked"
    ACCOUNT_UNLINKED = "activity.account.unlinked", "Account Unlinked"


class Outbox(models.Model):
    """
    Outbox table for reliable cross-service event delivery.

    Events are written here atomically with the main transaction,
    then processed asynchronously by a background worker.
    """

    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField(db_index=True)
    event_type = models.CharField(
        max_length=64,
        choices=OutboxEventType.choices,
    )
    aggregate_type = models.CharField(max_length=64, default="activity_event")
    aggregate_id = models.CharField(max_length=128)
    payload_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)
    processed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    error_message = models.TextField(blank=True, null=True)
    retry_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "act_outbox"
        indexes = [
            models.Index(
                fields=["processed_at", "created_at"],
                name="act_outbox_pending_idx",
            ),
            models.Index(
                fields=["tenant_id", "event_type"],
                name="act_outbox_tenant_type_idx",
            ),
        ]
        ordering = ["created_at"]

    def __str__(self) -> str:
        status = "processed" if self.processed_at else "pending"
        return f"Outbox({self.id}, {self.event_type}, {status})"


class FeedLastSeen(models.Model):
    """
    Tracks when user last viewed their feed.

    Used for calculating unread count in real-time updates.
    """

    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField()
    user_id = models.UUIDField()
    last_seen_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "act_feed_last_seen"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "user_id"],
                name="act_feed_last_seen_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["tenant_id", "user_id"],
                name="act_feed_last_seen_idx",
            ),
        ]


def source_ref_for_raw(*, source: Source, raw_event_id: int) -> str:
    return f"{source.type}:{source.id}:raw:{raw_event_id}"


def make_dedupe_hash(*, source_type: str, key: str) -> str:
    return sha256_hex(f"{source_type}:{key}")


def uuid_from_str(value: str) -> uuid.UUID:
    return uuid.UUID(str(value))
