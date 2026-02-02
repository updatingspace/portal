from __future__ import annotations

import uuid
from dataclasses import dataclass

from ninja.errors import HttpError

from core.errors import error_payload
from core.http import require_context
from core.security import require_internal_signature


@dataclass(frozen=True)
class ActivityContext:
    request_id: str
    tenant_id: uuid.UUID
    tenant_slug: str
    user_id: uuid.UUID | None
    master_flags: frozenset[str]
    preferred_language: str  # "en" or "ru"


def _parse_uuid(value: str, *, code: str, header: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except Exception as exc:
        raise HttpError(
            400,
            error_payload(code, f"{header} must be a UUID"),
        ) from exc


def _parse_flags(value: str | None) -> frozenset[str]:
    """
    Parse master flags from X-Master-Flags header.
    
    BFF sends flags as JSON dict, e.g., {"system_admin": true, "tenant_admin": true}.
    We extract keys where the value is truthy.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    if not value:
        return frozenset()
    
    # Try to parse as JSON dict first (BFF format)
    try:
        import json
        data = json.loads(value)
        if isinstance(data, dict):
            # Extract keys with truthy values
            flags = frozenset(k for k, v in data.items() if v)
            logger.debug("Parsed master_flags from JSON: %s -> %s", data, flags)
            return flags
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning("Failed to parse master_flags as JSON: %s, error: %s", value, e)
        pass
    
    # Fallback: comma-separated list
    raw = [part.strip() for part in str(value).split(",")]
    flags_fallback = frozenset({p for p in raw if p})
    logger.debug("Parsed master_flags from CSV: %s -> %s", value, flags_fallback)
    return flags_fallback


def _get_preferred_language(request) -> str:
    """
    Get user's preferred language from request headers.

    Priority:
    1. X-Preferred-Language header (set by BFF from user profile)
    2. Accept-Language header (browser preference)
    3. Default to "en"
    """
    # Check custom header (set by BFF from user profile)
    preferred = request.headers.get("X-Preferred-Language", "").lower()
    if preferred in ("ru", "ru-ru"):
        return "ru"

    # Check Accept-Language header
    accept_lang = request.headers.get("Accept-Language", "").lower()
    if "ru" in accept_lang:
        return "ru"

    return "en"


def require_activity_context(
    request,
    *,
    require_user: bool = True,
) -> ActivityContext:
    require_internal_signature(request)
    base = require_context(request)

    tenant_uuid = _parse_uuid(
        str(base.tenant_id),
        code="INVALID_TENANT_ID",
        header="X-Tenant-Id",
    )

    user_id = request.headers.get("X-User-Id")
    user_uuid: uuid.UUID | None
    if user_id:
        user_uuid = _parse_uuid(
            str(user_id),
            code="INVALID_USER_ID",
            header="X-User-Id",
        )
    else:
        user_uuid = None

    if require_user and not user_uuid:
        raise HttpError(
            401,
            error_payload("UNAUTHORIZED", "X-User-Id is required"),
        )

    flags = _parse_flags(request.headers.get("X-Master-Flags"))
    preferred_language = _get_preferred_language(request)

    return ActivityContext(
        request_id=str(base.request_id),
        tenant_id=tenant_uuid,
        tenant_slug=str(base.tenant_slug),
        user_id=user_uuid,
        master_flags=flags,
        preferred_language=preferred_language,
    )
