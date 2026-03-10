"""
Portal audit trail.

Provides a local audit table for tracking write/delete lifecycle operations
on portal domain objects (profile updates, membership changes, erasure).

Design notes:
- Metadata MUST NOT contain raw PII (use field-name lists, counts, hashes).
- Model follows the same structure as Access's TenantAdminAuditEvent.
- Helper ``log_audit_event`` is safe to call inside or outside a transaction.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from portal.models import PortalAuditEvent

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
) -> PortalAuditEvent:
    """Write a single audit record.

    Parameters
    ----------
    tenant_id:
        Multi-tenant isolation key.
    actor_user_id:
        The user who performed the action.
    action:
        Stable dot-separated action identifier, e.g. ``profile.updated``.
    target_type:
        Category of the object affected, e.g. ``portal_profile``.
    target_id:
        The primary key (or equivalent identifier) of the target object.
    metadata:
        **PII-safe** context dict — only field names, counts, hashes, etc.
    request_id:
        Distributed trace ID from ``X-Request-Id`` header.
    """
    event = PortalAuditEvent.objects.create(
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
