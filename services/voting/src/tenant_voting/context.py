from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any, cast

from ninja.errors import HttpError

from core.security import require_internal_signature
from core.http import require_context


@dataclass(frozen=True)
class InternalContext:
    request_id: str
    tenant_id: str
    tenant_slug: str
    user_id: str
    master_flags: dict


def require_internal_context(request) -> InternalContext:
    base = require_context(request)

    resolved = getattr(request, "tenant", None)
    if resolved is not None:
        resolved_id = getattr(resolved, "id", None)
        if resolved_id is not None and str(resolved_id) != str(base.tenant_id):
            raise HttpError(
                403,
                cast(
                    Any,
                    {
                        "code": "TENANT_MISMATCH",
                        "message": (
                            "X-Tenant-Id does not match resolved tenant"
                        ),
                    },
                ),
            )

    # Enforce BFF -> service signature (same as events service)
    require_internal_signature(request)

    user_id = request.headers.get("X-User-Id")
    if not user_id:
        raise HttpError(
            401,
            cast(
                Any,
                {
                    "code": "UNAUTHENTICATED",
                    "message": "X-User-Id is required",
                },
            ),
        )

    try:
        uuid.UUID(str(user_id))
    except Exception as exc:
        raise HttpError(
            400,
            cast(
                Any,
                {
                    "code": "INVALID_USER_ID",
                    "message": "X-User-Id must be a UUID",
                },
            ),
        ) from exc

    master_raw = request.headers.get("X-Master-Flags") or "{}"
    try:
        master_flags = json.loads(master_raw)
        if not isinstance(master_flags, dict):
            master_flags = {}
    except Exception:
        master_flags = {}

    return InternalContext(
        request_id=base.request_id,
        tenant_id=base.tenant_id,
        tenant_slug=base.tenant_slug,
        user_id=str(user_id),
        master_flags=master_flags,
    )
