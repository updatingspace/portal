from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class AchievementStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    PUBLISHED = "published", "published"
    HIDDEN = "hidden", "hidden"
    ACTIVE = "active", "active"


class GrantVisibility(models.TextChoices):
    PUBLIC = "public", "public"
    PRIVATE = "private", "private"


class AchievementCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)
    slug = models.SlugField(max_length=64)
    name_i18n = models.JSONField(default=dict)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gamification_category"
        indexes = [
            models.Index(fields=["tenant_id", "order"], name="g_category_tenant_order_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "slug"],
                name="g_category_tenant_slug_unique",
            ),
        ]


class Achievement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)

    name_i18n = models.JSONField(default=dict)
    description = models.TextField(blank=True, default="")
    category = models.ForeignKey(
        AchievementCategory,
        on_delete=models.PROTECT,
        related_name="achievements",
    )
    status = models.CharField(
        max_length=16,
        choices=AchievementStatus.choices,
        default=AchievementStatus.DRAFT,
        db_index=True,
    )
    images = models.JSONField(default=dict)

    created_by = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gamification_achievement"
        indexes = [
            models.Index(fields=["tenant_id", "created_at"], name="g_ach_tenant_created_idx"),
            models.Index(fields=["tenant_id", "status"], name="g_ach_tenant_status_idx"),
            models.Index(fields=["tenant_id", "category"], name="g_ach_tenant_category_idx"),
        ]


class AchievementGrant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)

    achievement = models.ForeignKey(
        Achievement,
        on_delete=models.CASCADE,
        related_name="grants",
    )
    recipient_id = models.UUIDField(db_index=True)
    issuer_id = models.UUIDField(db_index=True)
    reason = models.TextField(blank=True, default="")
    visibility = models.CharField(
        max_length=16,
        choices=GrantVisibility.choices,
        default=GrantVisibility.PUBLIC,
        db_index=True,
    )
    created_at = models.DateTimeField(default=timezone.now)

    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = "gamification_grant"
        indexes = [
            models.Index(fields=["tenant_id", "recipient_id"], name="g_grant_tenant_recipient_idx"),
            models.Index(fields=["tenant_id", "achievement"], name="g_grant_tenant_ach_idx"),
            models.Index(fields=["tenant_id", "created_at"], name="g_grant_tenant_created_idx"),
            models.Index(fields=["tenant_id", "visibility"], name="g_grant_tenant_vis_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "achievement", "recipient_id"],
                condition=models.Q(revoked_at__isnull=True),
                name="g_grant_unique_achievement_recipient",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.tenant_id and self.achievement_id:
            self.tenant_id = self.achievement.tenant_id
        return super().save(*args, **kwargs)


class OutboxMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant_id = models.UUIDField(db_index=True)
    event_type = models.CharField(max_length=128, db_index=True)
    payload = models.JSONField(default=dict)

    occurred_at = models.DateTimeField(default=timezone.now)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "gamification_outbox"
        indexes = [
            models.Index(fields=["tenant_id", "occurred_at"], name="g_outbox_tenant_occ_idx"),
            models.Index(fields=["event_type", "occurred_at"], name="g_outbox_type_occ_idx"),
            models.Index(fields=["published_at"], name="g_outbox_published_idx"),
        ]
