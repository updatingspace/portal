from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin
from ninja.errors import HttpError

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


class DoubleSubmitCsrfMiddleware(MiddlewareMixin):
    """Minimal CSRF guard for cookie-auth API.

    - Issues a non-HttpOnly CSRF cookie if missing
    - For unsafe methods requires `X-CSRF-Token` header to match cookie

    This is intentionally scoped to `/api/v1/`.
    """

    def process_request(self, request: HttpRequest):
        if not request.path.startswith("/api/v1/"):
            return None

        # Login bootstrap endpoints must work before a CSRF cookie exists.
        if request.path in {"/api/v1/session/login", "/api/v1/session/callback"}:
            request._dont_enforce_csrf_checks = True
            return None

        # Server-to-server internal endpoints (e.g. IdP callbacks)
        # must not require browser CSRF.
        if request.path.startswith("/api/v1/internal/"):
            request._dont_enforce_csrf_checks = True
            return None

        # Dev endpoints should not require CSRF (curl/API testing)
        if request.path.startswith("/api/v1/dev/"):
            request._dont_enforce_csrf_checks = True
            return None

        # We enforce CSRF ourselves (double-submit)
        # and must not trigger Django's CSRF checks.
        request._dont_enforce_csrf_checks = True

        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return None

        # Internally signed service-to-service requests must not require
        # browser CSRF tokens.
        if request.META.get("HTTP_X_UPDSPACE_SIGNATURE") and request.META.get(
            "HTTP_X_UPDSPACE_TIMESTAMP"
        ):
            from .security import require_internal_signature

            try:
                require_internal_signature(request)
                return None
            except HttpError as exc:
                payload = exc.message
                code = "UNAUTHORIZED"
                message = "Unauthorized"
                if isinstance(payload, dict):
                    code = str(payload.get("code") or code)
                    message = str(payload.get("message") or message)
                return error_response(
                    code=code,
                    message=message,
                    request_id=getattr(request, "request_id", None),
                    status=int(getattr(exc, "status_code", 401) or 401),
                    details={},
                )

        csrf_cookie = getattr(
            settings,
            "BFF_CSRF_COOKIE_NAME",
            "updspace_csrf",
        )
        csrf_header = getattr(settings, "BFF_CSRF_HEADER", "HTTP_X_CSRF_TOKEN")

        cookie_val = request.COOKIES.get(csrf_cookie)
        header_val = request.META.get(csrf_header)

        if not cookie_val or not header_val or cookie_val != header_val:
            return error_response(
                code="CSRF_FAILED",
                message="CSRF token missing or invalid",
                request_id=getattr(request, "request_id", None),
                status=403,
            )
        return None

    def process_response(self, request: HttpRequest, response: HttpResponse):
        if not request.path.startswith("/api/v1/"):
            return response

        csrf_cookie = getattr(
            settings,
            "BFF_CSRF_COOKIE_NAME",
            "updspace_csrf",
        )
        if request.COOKIES.get(csrf_cookie):
            return response

        token = str(uuid.uuid4())
        # cookie is readable by JS (double-submit)
        response.set_cookie(
            csrf_cookie,
            token,
            httponly=False,
            secure=not getattr(settings, "DEBUG", False),
            samesite=getattr(settings, "BFF_COOKIE_SAMESITE", "Lax"),
            domain=getattr(settings, "BFF_COOKIE_DOMAIN", None),
            path="/",
        )
        return response


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
