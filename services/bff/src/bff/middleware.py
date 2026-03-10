from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

from .errors import error_response
from .session_store import SessionStore
from .tenant import resolve_tenant


REQUEST_ID_HEADER = "HTTP_X_REQUEST_ID"

# Endpoints that work without any tenant context (tenantless mode)
TENANTLESS_PREFIXES = (
    "/api/v1/entry/",
    "/api/v1/session/switch-tenant",
    "/api/v1/session/tenants",
)

# Endpoints that don't require authentication
PUBLIC_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/session/login",
    "/api/v1/session/callback",
    "/api/v1/internal/",
    "/api/v1/dev/",
)


@dataclass(frozen=True)
class AuthContext:
    session_id: str
    tenant_id: str
    tenant_slug: str
    user_id: str
    master_flags: dict
    # Path-based tenancy: active tenant from session
    active_tenant_id: str = ""
    active_tenant_slug: str = ""


def _get_request_id(request: HttpRequest) -> str:
    value = request.META.get(REQUEST_ID_HEADER)
    if value:
        return str(value)
    return str(uuid.uuid4())


def _is_tenantless_endpoint(path: str) -> bool:
    """Check if the endpoint can work without tenant context."""
    return any(path.startswith(prefix) for prefix in TENANTLESS_PREFIXES)


class RequestIdMiddleware(MiddlewareMixin):
    def process_request(self, request: HttpRequest):
        request.request_id = _get_request_id(request)

    def process_response(self, request: HttpRequest, response: HttpResponse):
        rid = getattr(request, "request_id", None)
        if rid:
            response["X-Request-Id"] = rid
        return response


class ErrorMappingMiddleware(MiddlewareMixin):
    def process_exception(self, request: HttpRequest, exception: Exception):
        if not request.path.startswith("/api/v1/"):
            return None

        # Avoid leaking exception details in prod.
        details = None
        if getattr(settings, "DEBUG", False):
            details = {
                "exception": exception.__class__.__name__,
            }

        return error_response(
            code="INTERNAL_ERROR",
            message="Internal error",
            request_id=getattr(request, "request_id", None),
            status=500,
            details=details,
        )


class TenantResolveMiddleware(MiddlewareMixin):
    """Resolve tenant from Host header (legacy/subdomain mode).

    In path-based tenancy mode, tenant context comes from the BFF session
    (active_tenant_*). Host-based resolution is kept for backwards
    compatibility and will be used as a fallback.

    Tenantless endpoints (entry/me, switch-tenant, session/tenants) are
    allowed to proceed without a resolved tenant.
    """

    def process_request(self, request: HttpRequest):
        if not request.path.startswith("/api/v1/"):
            return None

        # Try host-based resolution (legacy / subdomain alias)
        tenant = resolve_tenant(request.get_host())
        request.tenant = tenant  # May be None for path-based mode

        # For tenantless endpoints, don't require host-based tenant
        if _is_tenantless_endpoint(request.path):
            return None

        # For public endpoints (auth/login/callback), allow no tenant
        if any(request.path.startswith(p) for p in PUBLIC_PREFIXES):
            return None

        # In path-based mode, tenant requirement is enforced by
        # CookieSessionAuthMiddleware using active_tenant from session.
        # If host-based resolution succeeded (legacy mode), we keep it.
        # If not, we let the request proceed — the session middleware
        # will enforce tenant context from the active session tenant.
        return None


class CookieSessionAuthMiddleware(MiddlewareMixin):
    """Authenticate request from session cookie.

    In path-based tenancy mode, the AuthContext uses the active_tenant_*
    fields from the session instead of requiring tenant from Host header.
    """

    def __init__(self, get_response):
        super().__init__(get_response)
        self.store = SessionStore()

    def process_request(self, request: HttpRequest):
        if not request.path.startswith("/api/v1/"):
            return None

        # Public endpoints can opt-out by setting attribute in view.
        # We treat missing session as anonymous and enforce in handlers.
        cookie_name = getattr(
            settings,
            "BFF_SESSION_COOKIE_NAME",
            "updspace_session",
        )
        session_id = request.COOKIES.get(cookie_name)
        if not session_id:
            request.auth_ctx = None
            return None

        session = self.store.get(session_id)
        if not session:
            request.auth_ctx = None
            return None

        # Determine tenant context: prefer active_tenant from session (path-based),
        # fall back to host-based resolved tenant (legacy mode)
        host_tenant = getattr(request, "tenant", None)
        active_tid = session.active_tenant_id
        active_tslug = session.active_tenant_slug

        if active_tid and active_tslug:
            # Path-based mode: use active tenant from session
            effective_tenant_id = active_tid
            effective_tenant_slug = active_tslug
        elif host_tenant:
            # Legacy mode: use host-resolved tenant
            # Verify session belongs to this tenant
            if session.tenant_id != host_tenant.id:
                return error_response(
                    code="TENANT_MISMATCH",
                    message="Session belongs to a different tenant",
                    request_id=getattr(request, "request_id", None),
                    status=403,
                )
            effective_tenant_id = host_tenant.id
            effective_tenant_slug = host_tenant.slug
        else:
            # No tenant context available — for tenantless endpoints this is fine
            if _is_tenantless_endpoint(request.path) or any(
                request.path.startswith(p) for p in PUBLIC_PREFIXES
            ):
                request.auth_ctx = AuthContext(
                    session_id=session.session_id,
                    tenant_id=session.tenant_id,
                    tenant_slug="",
                    user_id=session.user_id,
                    master_flags=session.master_flags,
                    active_tenant_id="",
                    active_tenant_slug="",
                )
                return None
            # For tenant-required endpoints without active tenant
            return error_response(
                code="TENANT_NOT_SELECTED",
                message="No active tenant. Call POST /session/switch-tenant first.",
                request_id=getattr(request, "request_id", None),
                status=403,
            )

        request.auth_ctx = AuthContext(
            session_id=session.session_id,
            tenant_id=session.tenant_id,
            tenant_slug=effective_tenant_slug,
            user_id=session.user_id,
            master_flags=session.master_flags,
            active_tenant_id=effective_tenant_id,
            active_tenant_slug=effective_tenant_slug,
        )
        return None


class SessionRateLimitMiddleware(MiddlewareMixin):
    def __init__(self, get_response):
        super().__init__(get_response)
        from django.core.cache import cache

        self.cache = cache

    def process_request(self, request: HttpRequest):
        if not request.path.startswith("/api/v1/session/"):
            return None

        limit = int(getattr(settings, "BFF_SESSION_RATE_LIMIT_PER_MIN", 60))
        if limit <= 0:
            return None

        ident = request.META.get("REMOTE_ADDR", "unknown")
        key = f"bff:rl:session:{ident}"
        current = self.cache.get(key)
        if current is None:
            self.cache.set(key, 1, timeout=60)
            return None

        if int(current) >= limit:
            return error_response(
                code="RATE_LIMITED",
                message="Too many requests",
                request_id=getattr(request, "request_id", None),
                status=429,
            )

        self.cache.incr(key)
        return None
