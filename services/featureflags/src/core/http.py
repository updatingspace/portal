from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ninja.errors import HttpError

from core.errors import error_payload


@dataclass(frozen=True)
class RequestContext:
    request_id: str
    tenant_id: str
    tenant_slug: str


def require_request_id(request: Any) -> str:
    request_id = request.headers.get("X-Request-Id")
    if not request_id:
        raise HttpError(
            400,
            error_payload("MISSING_REQUEST_ID", "X-Request-Id is required"),
        )
    return request_id


def require_context(request: Any) -> RequestContext:
    request_id = require_request_id(request)
    tenant_id = request.headers.get("X-Tenant-Id")
    tenant_slug = request.headers.get("X-Tenant-Slug")
    if not tenant_id or not tenant_slug:
        raise HttpError(
            400,
            error_payload("MISSING_TENANT_CONTEXT", "Tenant headers required"),
        )
    return RequestContext(
        request_id=request_id,
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
    )
