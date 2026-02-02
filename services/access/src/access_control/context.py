from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any, cast

from ninja.errors import HttpError

from core.http import require_context
from core.security import require_internal_signature


@dataclass(frozen=True)
class InternalContext:
    request_id: str
    tenant_id: str
    tenant_slug: str
    user_id: str
    master_flags: dict


def require_internal_context(request) -> InternalContext:
    ctx = require_context(request)
    require_internal_signature(request)

    user_id = request.headers.get("X-User-Id")
    if not user_id:
        raise HttpError(401, cast(Any, {"code": "UNAUTHENTICATED", "message": "X-User-Id is required"}))

    try:
        uuid.UUID(str(user_id))
    except Exception as exc:
        raise HttpError(400, cast(Any, {"code": "INVALID_USER_ID", "message": "X-User-Id must be a UUID"})) from exc

    master_raw = request.headers.get("X-Master-Flags") or "{}"
    try:
        master_flags = json.loads(master_raw)
        if not isinstance(master_flags, dict):
            master_flags = {}
    except Exception:
        master_flags = {}

    return InternalContext(
        request_id=ctx.request_id,
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=str(user_id),
        master_flags=master_flags,
    )

