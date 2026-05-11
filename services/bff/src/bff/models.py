from __future__ import annotations

import uuid

from django.db import models


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
    active_tenant_id = models.UUIDField(null=True, blank=True)
    active_tenant_slug = models.SlugField(max_length=64, blank=True, default="")
    active_tenant_set_at = models.DateTimeField(null=True, blank=True)
    last_tenant_slug = models.SlugField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "BFF session"
        verbose_name_plural = "BFF sessions"
        indexes = [
            models.Index(fields=["tenant", "user_id"]),
            models.Index(fields=["expires_at"]),
        ]


class BffOauthState(models.Model):
    state = models.CharField(primary_key=True, max_length=128)
    tenant_id = models.UUIDField(db_index=True)
    next_path = models.CharField(max_length=512)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "BFF OAuth state"
        verbose_name_plural = "BFF OAuth states"
        db_table = "bff_oauth_state"


class BffRateLimitWindow(models.Model):
    bucket_key = models.CharField(primary_key=True, max_length=255)
    count = models.PositiveIntegerField(default=1)
    window_started_at = models.DateTimeField(db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "BFF rate limit window"
        verbose_name_plural = "BFF rate limit windows"
        db_table = "bff_rate_limit_window"


# Audit model lives in bff.audit but must be discoverable by Django.
from bff.audit import BffAuditEvent  # noqa: E402, F401

__all__ = [
    "Tenant",
    "BffSession",
    "BffOauthState",
    "BffRateLimitWindow",
    "BffAuditEvent",
]
