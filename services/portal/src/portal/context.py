import uuid
from dataclasses import dataclass

from ninja.errors import HttpError

from core.errors import error_payload
from core.http import require_context, require_request_id
from core.security import require_internal_signature


@dataclass(frozen=True)
class PortalContext:
    request_id: str
    tenant_id: uuid.UUID
    tenant_slug: str
    user_id: uuid.UUID
    master_flags: frozenset[str]


def _parse_uuid(value: str, *, code: str, header: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except Exception as exc:
        raise HttpError(
            400,
            error_payload(code, f"{header} must be a UUID"),
        ) from exc


def _parse_flags(value: str | None) -> frozenset[str]:
    if not value:
        return frozenset()
    raw = [part.strip() for part in str(value).split(",")]
    return frozenset({p for p in raw if p})


def require_portal_context(request) -> PortalContext:
    # Prefer BFF middlewares (public API: /api/v1/*)
    rid = getattr(request, "request_id", None) or require_request_id(request)

    resolved_tenant = getattr(request, "tenant", None)
    auth_ctx = getattr(request, "auth_ctx", None)

    if resolved_tenant and auth_ctx:
        tenant_uuid = _parse_uuid(
            str(getattr(resolved_tenant, "id", "")),
            code="INVALID_TENANT_ID",
            header="tenant.id",
        )
        user_uuid = _parse_uuid(
            str(getattr(auth_ctx, "user_id", "")),
            code="INVALID_USER_ID",
            header="auth_ctx.user_id",
        )
        flags = getattr(auth_ctx, "master_flags", None)
        master = (
            frozenset({k for k, v in (flags or {}).items() if v})
            if isinstance(flags, dict)
            else frozenset()
        )
        return PortalContext(
            request_id=str(rid),
            tenant_id=tenant_uuid,
            tenant_slug=str(getattr(resolved_tenant, "slug", "")),
            user_id=user_uuid,
            master_flags=master,
        )

    # Fallback: internal call style (BFF -> service) via headers
    require_internal_signature(request)
    base = require_context(request)
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        raise HttpError(
            401,
            error_payload("UNAUTHORIZED", "X-User-Id is required"),
        )

    tenant_uuid = _parse_uuid(
        str(base.tenant_id),
        code="INVALID_TENANT_ID",
        header="X-Tenant-Id",
    )
    user_uuid = _parse_uuid(
        str(user_id),
        code="INVALID_USER_ID",
        header="X-User-Id",
    )

    flags = _parse_flags(request.headers.get("X-Master-Flags"))
    return PortalContext(
        request_id=str(base.request_id),
        tenant_id=tenant_uuid,
        tenant_slug=str(base.tenant_slug),
        user_id=user_uuid,
        master_flags=flags,
    )
