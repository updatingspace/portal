"""
BFF audit trail.

Provides a local audit table for tracking session lifecycle operations
(creation, revocation, logout, account deletion).

Design notes:
- Metadata MUST NOT contain raw PII.
- Session IDs are internal identifiers and safe to log.
- Model follows the same schema as Portal/Activity audit events.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


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


def log_audit_event(
    *,
    tenant_id: str | uuid.UUID,
    actor_user_id: str | uuid.UUID,
    action: str,
    target_type: str = "",
    target_id: str = "",
    metadata: dict[str, Any] | None = None,
    request_id: str = "",
) -> BffAuditEvent:
    """Write a single audit record.

    Parameters
    ----------
    tenant_id:
        Multi-tenant isolation key.
    actor_user_id:
        The user who performed the action.
    action:
        Stable dot-separated action identifier, e.g. ``session.created``.
    target_type:
        Category of the object affected, e.g. ``bff_session``.
    target_id:
        The session or object ID.
    metadata:
        **PII-safe** context dict — no tokens, no passwords, no PII.
    request_id:
        Distributed trace ID from ``X-Request-Id`` header.
    """
    event = BffAuditEvent.objects.create(
        tenant_id=str(tenant_id),
        actor_user_id=str(actor_user_id),
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        metadata=metadata or {},
        request_id=str(request_id),
    )
    logger.info(
        "audit: %s target=%s/%s actor=%s tenant=%s",
        action,
        target_type,
        target_id,
        actor_user_id,
        tenant_id,
        extra={
            "audit_action": action,
            "tenant_id": str(tenant_id),
            "actor_user_id": str(actor_user_id),
            "request_id": str(request_id),
        },
    )
    return event
