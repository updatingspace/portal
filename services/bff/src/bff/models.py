from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Tenant"
        verbose_name_plural = "Tenants"


class BffSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    user_id = models.UUIDField()
    master_flags = models.JSONField(default=dict)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "BFF session"
        verbose_name_plural = "BFF sessions"
        indexes = [
            models.Index(fields=["tenant", "user_id"]),
            models.Index(fields=["expires_at"]),
        ]


class BffAuditEvent(models.Model):
    """Immutable audit record for BFF session lifecycle operations."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)
    actor_user_id = models.UUIDField(db_index=True)
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=32, blank=True)
    target_id = models.CharField(max_length=128, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "bff_audit_event"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant_id", "action"], name="b_audit_tnt_action_idx"),
            models.Index(fields=["tenant_id", "created_at"], name="b_audit_tnt_created_idx"),
            models.Index(
                fields=["tenant_id", "actor_user_id", "-created_at"],
                name="b_audit_tnt_actor_idx",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.action} by {self.actor_user_id} ({self.tenant_id})"

__all__ = ["Tenant", "BffSession", "BffAuditEvent"]
