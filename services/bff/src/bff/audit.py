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

from bff.models import BffAuditEvent

logger = logging.getLogger(__name__)


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
