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


@dataclass(frozen=True)
class AuthContext:
    session_id: str
    tenant_id: str
    tenant_slug: str
    user_id: str
    master_flags: dict


def _get_request_id(request: HttpRequest) -> str:
    value = request.META.get(REQUEST_ID_HEADER)
    if value:
        return str(value)
    return str(uuid.uuid4())


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
    def process_request(self, request: HttpRequest):
        if not request.path.startswith("/api/v1/"):
            return None

        tenant = resolve_tenant(request.get_host())
        if not tenant:
            return error_response(
                code="TENANT_NOT_FOUND",
                message="Unknown tenant",
                request_id=getattr(request, "request_id", None),
                status=404,
            )

        request.tenant = tenant
        return None


class CookieSessionAuthMiddleware(MiddlewareMixin):
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

        tenant = getattr(request, "tenant", None)
        if not tenant:
            request.auth_ctx = None
            return None

        if session.tenant_id != tenant.id:
            return error_response(
                code="TENANT_MISMATCH",
                message="Session belongs to a different tenant",
                request_id=getattr(request, "request_id", None),
                status=403,
            )

        request.auth_ctx = AuthContext(
            session_id=session.session_id,
            tenant_id=session.tenant_id,
            tenant_slug=tenant.slug,
            user_id=session.user_id,
            master_flags=session.master_flags,
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
