"""
Permission checking for Activity service.

Uses Access service for RBAC checks, with fallback for system admins
and suspended/banned users.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from uuid import UUID

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


def _is_suspended_or_banned(master_flags: frozenset[str]) -> bool:
    """Check if user is suspended or banned via master flags."""
    return "suspended" in master_flags or "banned" in master_flags


def _is_system_admin(master_flags: frozenset[str]) -> bool:
    """Check if user has system admin privileges."""
    return "system_admin" in master_flags


def has_permission(
    *,
    tenant_id: UUID,
    tenant_slug: str,
    user_id: UUID,
    master_flags: frozenset[str],
    permission_key: str,
    scope_type: str = "tenant",
    scope_id: str | None = None,
    request_id: str,
) -> bool:
    """
    Check if user has the specified permission.

    Args:
        tenant_id: The tenant UUID
        tenant_slug: The tenant slug
        user_id: The user UUID
        master_flags: Set of master flags from ID service
        permission_key: Permission to check (e.g., 'activity.feed.read')
        scope_type: Scope type ('tenant', 'community', 'team')
        scope_id: Scope ID (defaults to tenant_id if not specified)
        request_id: Request ID for tracing

    Returns:
        True if user has permission, False otherwise
    """
    # Suspended/banned users have no permissions
    if _is_suspended_or_banned(master_flags):
        return False

    # System admins bypass permission checks
    if _is_system_admin(master_flags):
        return True

    # Use tenant_id as default scope_id
    effective_scope_id = scope_id or str(tenant_id)

    base_url = str(
        getattr(settings, "ACCESS_BASE_URL", "http://access:8002/api/v1")
    ).rstrip("/")
    path = "/api/v1/access/check"
    url = f"{base_url}/access/check"

    payload = {
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "action": permission_key,
        "scope": {"type": scope_type, "id": effective_scope_id},
        "master_flags": {
            "suspended": "suspended" in master_flags,
            "banned": "banned" in master_flags,
            "system_admin": "system_admin" in master_flags,
        },
    }
    body = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")

    ts = str(int(time.time()))
    secret = getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "")
    if not secret:
        logger.warning(
            "BFF_INTERNAL_HMAC_SECRET not configured, denying permission",
            extra={"permission_key": permission_key, "user_id": str(user_id)},
        )
        return False

    msg = "\n".join(
        ["POST", path, hashlib.sha256(body).hexdigest(), str(request_id), ts]
    ).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), msg, digestmod=hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Request-Id": str(request_id),
        "X-Tenant-Id": str(tenant_id),
        "X-Tenant-Slug": str(tenant_slug),
        "X-User-Id": str(user_id),
        "X-Master-Flags": ",".join(sorted(master_flags)),
        "X-Updspace-Timestamp": ts,
        "X-Updspace-Signature": sig,
    }

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, content=body, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                allowed = data.get("allowed", False)
                logger.debug(
                    "Permission check result",
                    extra={
                        "permission_key": permission_key,
                        "user_id": str(user_id),
                        "allowed": allowed,
                    },
                )
                return bool(allowed)
            logger.warning(
                "Access service returned non-200",
                extra={
                    "status_code": resp.status_code,
                    "permission_key": permission_key,
                    "user_id": str(user_id),
                },
            )
            return False
    except httpx.TimeoutException:
        logger.error(
            "Access service timeout",
            extra={
                "permission_key": permission_key,
                "user_id": str(user_id),
                "url": url,
            },
        )
        return False
    except Exception as exc:
        logger.error(
            "Access service error",
            extra={
                "permission_key": permission_key,
                "user_id": str(user_id),
                "error": str(exc),
            },
            exc_info=True,
        )
        return False


def require_permission(
    *,
    ctx,
    permission_key: str,
    scope_type: str = "tenant",
    scope_id: str | None = None,
) -> None:
    """
    Require user to have the specified permission.

    Raises HttpError 403 if permission is denied.

    Args:
        ctx: ActivityContext from request
        permission_key: Permission to check
        scope_type: Scope type ('tenant', 'community', 'team')
        scope_id: Scope ID (defaults to tenant_id)
    """
    from ninja.errors import HttpError

    from core.errors import error_payload

    if ctx.user_id is None:
        raise HttpError(
            401,
            error_payload("UNAUTHORIZED", "Authentication required"),
        )

    if not has_permission(
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        master_flags=ctx.master_flags,
        permission_key=permission_key,
        scope_type=scope_type,
        scope_id=scope_id,
        request_id=ctx.request_id,
    ):
        raise HttpError(
            403,
            error_payload("FORBIDDEN", "Permission denied"),
        )


# Permission constants for Activity service
class Permissions:
    """Activity service permission keys."""

    # Feed access
    FEED_READ = "activity.feed.read"

    # Source management
    SOURCES_LINK = "activity.sources.link"
    SOURCES_MANAGE = "activity.sources.manage"

    # Admin operations
    ADMIN_SYNC = "activity.admin.sync"
    ADMIN_GAMES = "activity.admin.games"

    # News
    NEWS_CREATE = "activity.news.create"
    NEWS_MANAGE = "activity.news.manage"
