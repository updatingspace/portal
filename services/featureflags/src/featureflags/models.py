from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class FeatureFlag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True, default="")
    enabled = models.BooleanField(default=False)
    rollout = models.PositiveSmallIntegerField(default=100)
    created_by = models.UUIDField()
    updated_by = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "feature_flags"
        indexes = [
            models.Index(fields=["enabled"], name="feature_flags_enabled_idx"),
            models.Index(fields=["updated_at"], name="feature_flags_updated_idx"),
        ]


class FeatureFlagAuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor_user_id = models.UUIDField(db_index=True)
    action = models.CharField(max_length=64, db_index=True)
    flag_key = models.CharField(max_length=120, db_index=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "feature_flag_audit_events"


class OutboxMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=128, db_index=True)
    payload = models.JSONField(default=dict)
    occurred_at = models.DateTimeField(default=timezone.now)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "feature_flag_outbox"
        indexes = [
            models.Index(fields=["event_type", "occurred_at"], name="ff_outbox_type_occ_idx"),
            models.Index(fields=["published_at"], name="ff_outbox_pub_idx"),
        ]
