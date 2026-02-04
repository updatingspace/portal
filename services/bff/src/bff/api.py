from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from urllib.parse import urlencode

from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect, StreamingHttpResponse
from ninja import NinjaAPI, Router

from .errors import error_response
from .proxy import proxy_request
from .security import verify_updspaceid_callback
from .session_store import SessionStore

logger = logging.getLogger(__name__)
router = Router()


@dataclass(frozen=True)
class _LoginPayload:
    email: str
    next: str | None


def _require_auth(request: HttpRequest):
    ctx = getattr(request, "auth_ctx", None)
    if not ctx:
        return None, error_response(
            code="UNAUTHENTICATED",
            message="Authentication required",
            request_id=getattr(request, "request_id", None),
            status=401,
        )
    return ctx, None


@router.get("/session/me")
def session_me(request: HttpRequest):
    ctx, err = _require_auth(request)
    if err:
        return err

    # MVP aggregation: user + portal profile (optional)
    upstream = getattr(settings, "BFF_UPSTREAM_PORTAL_URL", "")
    portal_profile: dict[str, Any] | None = None
    id_profile: dict[str, Any] | None = None
    tenant_membership: dict[str, Any] | None = None
    if upstream:
        resp = proxy_request(
            upstream_base_url=upstream,
            upstream_path="portal/me",
            method="GET",
            query_string="",
            body=b"",
            incoming_headers=request.headers,
            context_headers={
                "X-Request-Id": request.request_id,
                "X-Tenant-Id": ctx.tenant_id,
                "X-Tenant-Slug": ctx.tenant_slug,
                "X-User-Id": ctx.user_id,
                "X-Master-Flags": json.dumps(
                    ctx.master_flags,
                    separators=(",", ":"),
                ),
            },
            request_id=request.request_id,
        )
        if resp.status_code == 200:
            portal_profile = resp.json()
        else:
            # Keep /me resilient; return user even if portal is down.
            portal_profile = None

    # Optional aggregation: UpdSpaceID /me to expose membership/base_role/system_admin flags
    id_upstream = getattr(settings, "BFF_UPSTREAM_ID_URL", "")
    if id_upstream:
        try:
            id_resp = proxy_request(
                upstream_base_url=id_upstream,
                upstream_path="me",
                method="GET",
                query_string="",
                body=b"",
                incoming_headers=request.headers,
                context_headers={
                    "X-Request-Id": request.request_id,
                    "X-Tenant-Id": ctx.tenant_id,
                    "X-Tenant-Slug": ctx.tenant_slug,
                    "X-User-Id": ctx.user_id,
                },
                request_id=request.request_id,
            )
            if id_resp.status_code == 200:
                id_profile = id_resp.json()
                memberships = id_profile.get("memberships") if isinstance(id_profile, dict) else None
                if isinstance(memberships, list):
                    for m in memberships:
                        try:
                            if str(m.get("tenant_id")) == str(ctx.tenant_id) or str(m.get("tenant_slug")) == str(ctx.tenant_slug):
                                tenant_membership = m
                                break
                        except Exception:
                            continue
        except Exception:
            id_profile = None

    def _safe_str(value: Any) -> str | None:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return None

    def _should_sync_profile(portal: dict[str, Any] | None, id_user: dict[str, Any] | None) -> dict[str, str] | None:
        if not id_user:
            return None
        first = _safe_str(id_user.get("first_name"))
        last = _safe_str(id_user.get("last_name"))
        username = _safe_str(id_user.get("username"))
        display_name = _safe_str(id_user.get("display_name"))

        portal_first = _safe_str(portal.get("first_name") if portal else None)
        portal_last = _safe_str(portal.get("last_name") if portal else None)
        portal_username = _safe_str(portal.get("username") if portal else None)
        portal_display_name = _safe_str(portal.get("display_name") if portal else None)

        payload: dict[str, str] = {}
        if first and not portal_first:
            payload["first_name"] = first
        if last and not portal_last:
            payload["last_name"] = last
        if username and not portal_username:
            payload["username"] = username
        if display_name and not portal_display_name:
            payload["display_name"] = display_name
        return payload or None

    # Best-effort sync: if portal profile has no name, use ID profile names
    if upstream and id_profile:
        try:
            id_user = id_profile.get("user") if isinstance(id_profile, dict) else None
            if isinstance(id_user, dict):
                sync_payload = _should_sync_profile(portal_profile, id_user)
                if sync_payload:
                    sync_resp = proxy_request(
                        upstream_base_url=upstream,
                        upstream_path="portal/me",
                        method="PATCH",
                        query_string="",
                        body=json.dumps(sync_payload).encode("utf-8"),
                        incoming_headers=request.headers,
                        context_headers={
                            "X-Request-Id": request.request_id,
                            "X-Tenant-Id": ctx.tenant_id,
                            "X-Tenant-Slug": ctx.tenant_slug,
                            "X-User-Id": ctx.user_id,
                            "X-Master-Flags": json.dumps(
                                ctx.master_flags,
                                separators=(",", ":"),
                            ),
                            "Content-Type": "application/json",
                        },
                        request_id=request.request_id,
                    )
                    if sync_resp.status_code == 200:
                        portal_profile = sync_resp.json()
        except Exception:
            # Keep /me resilient; ignore sync errors.
            pass

    id_frontend_base_url = getattr(settings, "ID_PUBLIC_BASE_URL", "") or id_upstream
    if id_frontend_base_url:
        id_frontend_base_url = str(id_frontend_base_url).rstrip("/")
        if id_frontend_base_url.endswith("/api/v1"):
            id_frontend_base_url = id_frontend_base_url[:-7]
    else:
        id_frontend_base_url = None

    return {
        "user": {"id": ctx.user_id, "master_flags": ctx.master_flags},
        "tenant": {"id": ctx.tenant_id, "slug": ctx.tenant_slug},
        "portal_profile": portal_profile,
        "id_profile": id_profile,
        "tenant_membership": tenant_membership,
        "id_frontend_base_url": id_frontend_base_url,
        "request_id": request.request_id,
    }


@router.post("/session/logout")
def session_logout(request: HttpRequest):
    ctx, err = _require_auth(request)
    if err:
        return err

    from .session_store import SessionStore

    SessionStore().revoke(ctx.session_id)

    cookie_name = getattr(
        settings,
        "BFF_SESSION_COOKIE_NAME",
        "updspace_session",
    )
    resp = HttpResponse(status=204)
    resp.delete_cookie(
        cookie_name,
        domain=getattr(settings, "BFF_COOKIE_DOMAIN", None),
        path="/",
    )
    return resp


# Alias for /session/logout for backward compatibility
@router.post("/logout")
def logout_alias(request: HttpRequest):
    """Alias for /session/logout."""
    return session_logout(request)


@router.get("/auth/login")
def auth_login_redirect(request: HttpRequest, next: str | None = None):
    """
    Initiates OIDC login flow by redirecting to ID.UpdSpace.
    After user authenticates, they are redirected back to /auth/callback.
    """
    tenant = getattr(request, "tenant", None)
    if not tenant:
        return error_response(
            code="TENANT_NOT_FOUND",
            message="Unknown tenant",
            request_id=getattr(request, "request_id", None),
            status=404,
        )

    # Get OIDC configuration
    id_public_url = getattr(settings, "ID_PUBLIC_BASE_URL", "") or getattr(
        settings, "BFF_UPSTREAM_ID_URL", ""
    )
    if not id_public_url:
        return error_response(
            code="OIDC_NOT_CONFIGURED",
            message="ID service URL is not configured",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    client_id = getattr(settings, "BFF_OIDC_CLIENT_ID", "")
    if not client_id:
        return error_response(
            code="OIDC_NOT_CONFIGURED",
            message="OIDC client_id is not configured",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    # Build callback URL
    scheme = request.scheme or "http"
    host = request.get_host()
    callback_url = f"{scheme}://{host}/api/v1/auth/callback"

    # Store next path in state (we'll use it after callback)
    import secrets
    state = secrets.token_urlsafe(32)

    # Store state → next mapping in cache (short TTL)
    from django.core.cache import cache
    next_path = next if next else "/"
    # Prevent open redirects
    if next_path.startswith("http://") or next_path.startswith("https://") or next_path.startswith("//"):
        next_path = "/"
    cache.set(f"oauth_state:{state}", {"next": next_path, "tenant_id": str(tenant.id)}, timeout=600)

    # Build authorization URL
    id_public_url = id_public_url.rstrip("/")
    authorize_url = getattr(settings, "BFF_OIDC_AUTHORIZE_URL", "") or f"{id_public_url}/authorize"

    params = {
        "client_id": client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid profile",
        "state": state,
    }
    auth_url = f"{authorize_url}?{urlencode(params)}"

    return HttpResponseRedirect(auth_url)


@router.get("/auth/callback")
def auth_callback(request: HttpRequest, code: str | None = None, state: str | None = None, error: str | None = None):
    """
    OIDC callback handler. Exchanges authorization code for tokens and creates session.
    """
    if error:
        return error_response(
            code="OAUTH_ERROR",
            message=f"Authorization denied: {error}",
            request_id=getattr(request, "request_id", None),
            status=400,
        )

    if not code or not state:
        return error_response(
            code="BAD_REQUEST",
            message="Missing code or state parameter",
            request_id=getattr(request, "request_id", None),
            status=400,
        )

    # Retrieve state from cache
    from django.core.cache import cache
    state_data = cache.get(f"oauth_state:{state}")
    if not state_data:
        return error_response(
            code="INVALID_STATE",
            message="Invalid or expired state",
            request_id=getattr(request, "request_id", None),
            status=400,
        )
    cache.delete(f"oauth_state:{state}")

    next_path = state_data.get("next", "/")
    # tenant_id from state can be used to validate tenant consistency if needed
    _ = state_data.get("tenant_id")

    tenant = getattr(request, "tenant", None)
    if not tenant:
        return error_response(
            code="TENANT_NOT_FOUND",
            message="Unknown tenant",
            request_id=getattr(request, "request_id", None),
            status=404,
        )

    # Exchange code for tokens
    # BFF_UPSTREAM_ID_URL points to /api/v1, but OAuth endpoints are at /oauth/
    # We need to construct the base URL without the /api/v1 suffix
    id_url = getattr(settings, "BFF_UPSTREAM_ID_URL", "") or getattr(settings, "ID_BASE_URL", "")
    if not id_url:
        return error_response(
            code="UPSTREAM_NOT_CONFIGURED",
            message="ID upstream is not configured",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    # Strip /api/v1 suffix to get base URL for OAuth endpoints
    id_base_url = id_url.rstrip("/")
    if id_base_url.endswith("/api/v1"):
        id_base_url = id_base_url[:-7]  # Remove /api/v1

    client_id = getattr(settings, "BFF_OIDC_CLIENT_ID", "")
    client_secret = getattr(settings, "BFF_OIDC_CLIENT_SECRET", "")

    scheme = request.scheme or "http"
    host = request.get_host()
    callback_url = f"{scheme}://{host}/api/v1/auth/callback"

    # Token exchange
    import httpx
    token_url = f"{id_base_url}/oauth/token"

    try:
        token_resp = httpx.post(
            token_url,
            json={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": callback_url,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=10.0,
        )
    except Exception:
        return error_response(
            code="UPSTREAM_UNAVAILABLE",
            message="ID service unavailable during token exchange",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    if token_resp.status_code != 200:
        return error_response(
            code="TOKEN_EXCHANGE_FAILED",
            message="Failed to exchange authorization code",
            request_id=getattr(request, "request_id", None),
            status=401,
            details={"upstream_status": token_resp.status_code},
        )

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    # Get user info
    userinfo_url = f"{id_base_url}/oauth/userinfo"
    try:
        userinfo_resp = httpx.get(
            userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
    except Exception:
        return error_response(
            code="UPSTREAM_UNAVAILABLE",
            message="ID service unavailable during userinfo fetch",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    if userinfo_resp.status_code != 200:
        return error_response(
            code="USERINFO_FAILED",
            message="Failed to fetch user info",
            request_id=getattr(request, "request_id", None),
            status=401,
        )

    userinfo = userinfo_resp.json()
    user_id = userinfo.get("sub") or userinfo.get("user_id")

    if not user_id:
        return error_response(
            code="INVALID_USERINFO",
            message="User ID not found in userinfo",
            request_id=getattr(request, "request_id", None),
            status=401,
        )

    # Create BFF session
    master_flags = userinfo.get("master_flags", {})
    if not isinstance(master_flags, dict):
        master_flags = {}

    session = SessionStore().create(
        tenant_id=str(tenant.id),
        user_id=str(user_id),
        master_flags=master_flags,
        ttl=timedelta(days=14),
    )

    cookie_name = getattr(settings, "BFF_SESSION_COOKIE_NAME", "updspace_session")
    response = HttpResponseRedirect(next_path)
    response.set_cookie(
        cookie_name,
        session.session_id,
        httponly=True,
        secure=not getattr(settings, "DEBUG", False),
        samesite=getattr(settings, "BFF_COOKIE_SAMESITE", "Lax"),
        domain=getattr(settings, "BFF_COOKIE_DOMAIN", None),
        path="/",
        max_age=int(timedelta(days=14).total_seconds()),
    )
    return response


@router.post("/session/login")
def session_login(request: HttpRequest):
    """
    Magic link login flow (POST with email).
    For redirect-based OIDC login, use GET /auth/login.
    """
    tenant = getattr(request, "tenant", None)
    if not tenant:
        return error_response(
            code="TENANT_NOT_FOUND",
            message="Unknown tenant",
            request_id=getattr(request, "request_id", None),
            status=404,
        )

    try:
        payload = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        return error_response(
            code="BAD_REQUEST",
            message="Invalid JSON",
            request_id=getattr(request, "request_id", None),
            status=400,
        )

    email = str(payload.get("email") or "").strip()
    next_path = payload.get("next")
    next_path = str(next_path).strip() if next_path is not None else None

    if not email:
        return error_response(
            code="BAD_REQUEST",
            message="email is required",
            request_id=getattr(request, "request_id", None),
            status=400,
        )

    upstream = getattr(settings, "BFF_UPSTREAM_ID_URL", "")
    if not upstream:
        return error_response(
            code="UPSTREAM_NOT_CONFIGURED",
            message="ID upstream is not configured",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    scheme = request.scheme or "http"
    host = request.get_host()

    callback_url = f"{scheme}://{host}/api/v1/session/callback"
    if next_path:
        callback_url = callback_url + "?" + urlencode({"next": next_path})

    body = json.dumps(
        {"email": email, "redirect_to": callback_url},
        separators=(",", ":"),
    ).encode("utf-8")

    try:
        resp = proxy_request(
            upstream_base_url=upstream,
            upstream_path="auth/magic-link/request",
            method="POST",
            query_string="",
            body=body,
            incoming_headers=request.headers,
            context_headers={
                "X-Request-Id": request.request_id,
                "X-Tenant-Id": str(tenant.id),
                "X-Tenant-Slug": str(tenant.slug),
                "Content-Type": "application/json",
            },
            request_id=request.request_id,
        )
    except Exception:
        return error_response(
            code="UPSTREAM_UNAVAILABLE",
            message="ID upstream is unavailable",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    if resp.status_code >= 400:
        try:
            details = resp.json()
        except Exception:
            details = {"upstream_body": resp.text}
        return error_response(
            code="UPSTREAM_ERROR",
            message="ID upstream returned error",
            request_id=getattr(request, "request_id", None),
            status=resp.status_code,
            details={"id": details},
        )

    try:
        out = resp.json()
    except Exception:
        out = {"ok": True, "sent": True}

    # Pass through dev_magic_link if present
    return {
        "ok": True,
        "sent": bool(out.get("sent", True)),
        "dev_magic_link": out.get("dev_magic_link"),
        "request_id": request.request_id,
    }


@router.get("/session/callback")
def session_callback(request: HttpRequest, code: str, next: str | None = None):
    tenant = getattr(request, "tenant", None)
    if not tenant:
        return error_response(
            code="TENANT_NOT_FOUND",
            message="Unknown tenant",
            request_id=getattr(request, "request_id", None),
            status=404,
        )

    upstream = getattr(settings, "BFF_UPSTREAM_ID_URL", "")
    if not upstream:
        return error_response(
            code="UPSTREAM_NOT_CONFIGURED",
            message="ID upstream is not configured",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    body = json.dumps({"code": code}, separators=(",", ":")).encode("utf-8")

    try:
        resp = proxy_request(
            upstream_base_url=upstream,
            upstream_path="auth/exchange",
            method="POST",
            query_string="",
            body=body,
            incoming_headers=request.headers,
            context_headers={
                "X-Request-Id": request.request_id,
                "X-Tenant-Id": str(tenant.id),
                "X-Tenant-Slug": str(tenant.slug),
                "Content-Type": "application/json",
            },
            request_id=request.request_id,
        )
    except Exception:
        return error_response(
            code="UPSTREAM_UNAVAILABLE",
            message="ID upstream is unavailable",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    if resp.status_code >= 400:
        try:
            details = resp.json()
        except Exception:
            details = {"upstream_body": resp.text}
        return error_response(
            code=(
                "UNAUTHORIZED" if resp.status_code == 401 else "UPSTREAM_ERROR"
            ),
            message="ID exchange failed",
            request_id=getattr(request, "request_id", None),
            status=resp.status_code,
            details={"id": details},
        )

    payload = resp.json()
    user_id = str(payload.get("user_id") or "")
    master_flags = payload.get("master_flags")
    if not isinstance(master_flags, dict):
        master_flags = {}
    ttl_seconds = payload.get("ttl_seconds")

    try:
        ttl = (
            timedelta(seconds=int(ttl_seconds))
            if ttl_seconds
            else timedelta(days=14)
        )
    except Exception:
        ttl = timedelta(days=14)

    session = SessionStore().create(
        tenant_id=str(tenant.id),
        user_id=user_id,
        master_flags=dict(master_flags),
        ttl=ttl,
    )

    cookie_name = getattr(
        settings,
        "BFF_SESSION_COOKIE_NAME",
        "updspace_session",
    )
    redirect_to = next if next else "/"
    # Avoid open redirects
    if isinstance(redirect_to, str) and (
        redirect_to.startswith("http://")
        or redirect_to.startswith("https://")
        or redirect_to.startswith("//")
    ):
        redirect_to = "/"
    response = HttpResponseRedirect(redirect_to)
    response.set_cookie(
        cookie_name,
        session.session_id,
        httponly=True,
        secure=not getattr(settings, "DEBUG", False),
        samesite=getattr(settings, "BFF_COOKIE_SAMESITE", "Lax"),
        domain=getattr(settings, "BFF_COOKIE_DOMAIN", None),
        path="/",
        max_age=int(ttl.total_seconds()),
    )
    return response


@router.post("/internal/session/establish")
def internal_establish_session(request: HttpRequest):
    body = request.body or b""
    signature = request.headers.get("X-UpdSpaceID-Signature")
    if not verify_updspaceid_callback(body=body, signature=signature):
        return error_response(
            code="UNAUTHORIZED",
            message="Invalid UpdSpaceID callback signature",
            request_id=getattr(request, "request_id", None),
            status=401,
        )

    try:
        payload = json.loads(body.decode("utf-8")) if body else {}
    except Exception:
        return error_response(
            code="BAD_REQUEST",
            message="Invalid JSON",
            request_id=getattr(request, "request_id", None),
            status=400,
        )

    ctx_tenant = getattr(request, "tenant", None)
    if not ctx_tenant:
        return error_response(
            code="TENANT_NOT_FOUND",
            message="Unknown tenant",
            request_id=getattr(request, "request_id", None),
            status=404,
        )

    user_id = payload.get("user_id")
    master_flags = payload.get("master_flags") or {}
    ttl_seconds = payload.get("ttl_seconds")

    if not user_id:
        return error_response(
            code="BAD_REQUEST",
            message="user_id is required",
            request_id=getattr(request, "request_id", None),
            status=400,
        )

    try:
        ttl = (
            timedelta(seconds=int(ttl_seconds))
            if ttl_seconds
            else timedelta(days=14)
        )
    except Exception:
        ttl = timedelta(days=14)

    session = SessionStore().create(
        tenant_id=ctx_tenant.id,
        user_id=str(user_id),
        master_flags=dict(master_flags),
        ttl=ttl,
    )

    cookie_name = getattr(
        settings,
        "BFF_SESSION_COOKIE_NAME",
        "updspace_session",
    )
    response = HttpResponse(status=204)
    response.set_cookie(
        cookie_name,
        session.session_id,
        httponly=True,
        secure=not getattr(settings, "DEBUG", False),
        samesite=getattr(settings, "BFF_COOKIE_SAMESITE", "Lax"),
        domain=getattr(settings, "BFF_COOKIE_DOMAIN", None),
        path="/",
        max_age=int(ttl.total_seconds()),
    )
    return response


def _proxy_group(
    request: HttpRequest,
    group: str,
    upstream_setting: str,
    path: str,
    ensure_prefix: str | None = None,
):
    ctx, err = _require_auth(request)
    if err:
        return err

    upstream = getattr(settings, upstream_setting, "")
    if not upstream:
        return error_response(
            code="UPSTREAM_NOT_CONFIGURED",
            message=f"Upstream for {group} is not configured",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    upstream_path = path or ""
    if ensure_prefix:
        base = upstream.rstrip("/")
        if base.endswith(f"/{ensure_prefix}"):
            upstream = base
        else:
            upstream_path = f"{ensure_prefix}/{upstream_path}".rstrip("/")

    body = request.body or b""
    
    # Debug log for master_flags being sent
    logger.debug(
        "Proxying to %s with master_flags: %s",
        group,
        ctx.master_flags,
        extra={"request_id": request.request_id},
    )
    
    accept_header = request.headers.get("accept", "")
    is_stream = "event-stream" in accept_header or upstream_path.startswith("feed/sse")
    is_long_poll = upstream_path.endswith("unread-count/long-poll")

    try:
        resp_result = proxy_request(
            upstream_base_url=upstream,
            upstream_path=upstream_path,
            method=request.method,
            query_string=request.META.get("QUERY_STRING", ""),
            body=body,
            incoming_headers=request.headers,
            context_headers={
                "X-Request-Id": request.request_id,
                "X-Tenant-Id": ctx.tenant_id,
                "X-Tenant-Slug": ctx.tenant_slug,
                "X-User-Id": ctx.user_id,
                "X-Master-Flags": json.dumps(
                    ctx.master_flags,
                    separators=(",", ":"),
                ),
            },
            request_id=request.request_id,
            stream=is_stream,
            timeout=35 if is_long_poll else None,
        )
    except RuntimeError as exc:
        # e.g. missing BFF_INTERNAL_HMAC_SECRET
        return error_response(
            code="CONFIG_ERROR",
            message=str(exc) or "BFF is not configured",
            request_id=request.request_id,
            status=500,
        )
    except Exception as exc:
        logger.exception(
            "BFF proxy error for %s/%s",
            group,
            upstream_path,
            extra={
                "request_id": request.request_id,
                "upstream_url": upstream,
                "error": str(exc),
            },
        )
        return error_response(
            code="UPSTREAM_UNAVAILABLE",
            message=f"{group} upstream is unavailable",
            request_id=request.request_id,
            status=502,
        )

    if is_stream:
        resp, iterator, close_stream = resp_result
    else:
        resp = resp_result

    # Map upstream errors to unified shape
    if resp.status_code >= 400:
        details: dict[str, Any] = {}
        try:
            details["upstream_body"] = resp.json()
        except Exception:
            details["upstream_body"] = resp.text
        details["upstream_status"] = resp.status_code
        if is_stream:
            close_stream()
        return error_response(
            code="UPSTREAM_ERROR",
            message=f"{group} upstream returned error",
            request_id=request.request_id,
            status=resp.status_code,
            details=details,
        )

    content_type = resp.headers.get("content-type", "application/json")
    
    # Check if this is a streaming response (e.g., SSE)
    if is_stream or (content_type and "event-stream" in content_type):
        if not is_stream:
            # Fallback: avoid loading entire response into memory
            def iterator():
                try:
                    for chunk in resp.iter_bytes(chunk_size=1024):
                        yield chunk
                finally:
                    resp.close()
            stream_iter = iterator()
        else:
            stream_iter = iterator()
        streaming_response = StreamingHttpResponse(
            stream_iter,
            status=resp.status_code,
            content_type=content_type,
        )
        # Copy important headers for SSE
        for header_name in ["cache-control", "x-accel-buffering"]:
            header_value = resp.headers.get(header_name)
            if header_value:
                streaming_response[header_name] = header_value
        return streaming_response
    
    try:
        return HttpResponse(
            resp.content,
            status=resp.status_code,
            content_type=content_type,
        )
    except Exception as exc:
        logger.exception(
            "BFF response processing error for %s/%s",
            group,
            upstream_path,
            extra={
                "request_id": request.request_id,
                "status_code": resp.status_code,
                "error": str(exc),
            },
        )
        return error_response(
            code="UPSTREAM_UNAVAILABLE",
            message=f"{group} response processing failed",
            request_id=request.request_id,
            status=502,
        )


# -----------------------------------------------
# /portal/applications → ID service (not Portal!)
# These routes handle admin application management which lives in UpdSpaceID.
# -----------------------------------------------
@router.api_operation(
    ["GET"],
    "/portal/applications",
)
def proxy_portal_applications_list(request: HttpRequest):
    """List pending/approved applications (from ID service)."""
    return _proxy_group(request, "id", "BFF_UPSTREAM_ID_URL", "applications")


@router.api_operation(
    ["POST"],
    "/portal/applications/{application_id}/approve",
)
def proxy_portal_applications_approve(request: HttpRequest, application_id: int):
    """Approve an application (in ID service)."""
    return _proxy_group(request, "id", "BFF_UPSTREAM_ID_URL", f"applications/{application_id}/approve")


@router.api_operation(
    ["POST"],
    "/portal/applications/{application_id}/reject",
)
def proxy_portal_applications_reject(request: HttpRequest, application_id: int):
    """Reject an application (in ID service)."""
    return _proxy_group(request, "id", "BFF_UPSTREAM_ID_URL", f"applications/{application_id}/reject")


# Root endpoint handlers for services (when path is empty or just /)
@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/access",
)
def proxy_access_root(request: HttpRequest):
    return _proxy_group(request, "access", "BFF_UPSTREAM_ACCESS_URL", "", ensure_prefix="access")


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/access/{path:path}",
)
def proxy_access(request: HttpRequest, path: str):
    return _proxy_group(request, "access", "BFF_UPSTREAM_ACCESS_URL", path, ensure_prefix="access")


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/portal",
)
def proxy_portal_root(request: HttpRequest):
    return _proxy_group(request, "portal", "BFF_UPSTREAM_PORTAL_URL", "")


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/portal/profiles",
)
def proxy_portal_profiles(request: HttpRequest):
    return _proxy_group(request, "portal", "BFF_UPSTREAM_PORTAL_URL", "profiles", ensure_prefix="portal")


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/portal/{path:path}",
)
def proxy_portal(request: HttpRequest, path: str):
    return _proxy_group(request, "portal", "BFF_UPSTREAM_PORTAL_URL", path)


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/voting",
)
def proxy_voting_root(request: HttpRequest):
    return _proxy_group(request, "voting", "BFF_UPSTREAM_VOTING_URL", "")


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/voting/{path:path}",
)
def proxy_voting(request: HttpRequest, path: str):
    return _proxy_group(request, "voting", "BFF_UPSTREAM_VOTING_URL", path)


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/events",
)
def proxy_events_root(request: HttpRequest):
    return _proxy_group(request, "events", "BFF_UPSTREAM_EVENTS_URL", "")


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/events/{path:path}",
)
def proxy_events(request: HttpRequest, path: str):
    return _proxy_group(request, "events", "BFF_UPSTREAM_EVENTS_URL", path)


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/gamification",
)
def proxy_gamification_root(request: HttpRequest):
    return _proxy_group(
        request,
        "gamification",
        "BFF_UPSTREAM_GAMIFICATION_URL",
        "",
        ensure_prefix="gamification",
    )


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/gamification/{path:path}",
)
def proxy_gamification(request: HttpRequest, path: str):
    return _proxy_group(
        request,
        "gamification",
        "BFF_UPSTREAM_GAMIFICATION_URL",
        path,
        ensure_prefix="gamification",
    )


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/feed",
)
def proxy_feed_root(request: HttpRequest):
    return _proxy_group(request, "feed", "BFF_UPSTREAM_FEED_URL", "")


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/feed/{path:path}",
)
def proxy_feed(request: HttpRequest, path: str):
    return _proxy_group(request, "feed", "BFF_UPSTREAM_FEED_URL", path)


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/activity/{path:path}",
)
def proxy_activity(request: HttpRequest, path: str):
    """Alias for /feed - frontend uses /activity/feed endpoint."""
    return _proxy_group(request, "feed", "BFF_UPSTREAM_FEED_URL", path)


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/account/{path:path}",
)
def proxy_account(request: HttpRequest, path: str):
    """Proxy account management endpoints to ID service."""
    ctx = getattr(request, "auth_ctx", None)
    if not ctx:
        return error_response(
            code="UNAUTHORIZED",
            message="Authentication required",
            request_id=getattr(request, "request_id", None),
            status=401,
        )

    upstream = getattr(settings, "BFF_UPSTREAM_ID_URL", "")
    if not upstream:
        return error_response(
            code="UPSTREAM_NOT_CONFIGURED",
            message="ID upstream is not configured",
            request_id=getattr(request, "request_id", None),
            status=502,
        )

    tenant = getattr(request, "tenant", None)
    body = request.body or b""

    context_headers = {
        "X-Request-Id": request.request_id,
        "X-User-Id": ctx.user_id,
    }
    if tenant:
        context_headers["X-Tenant-Id"] = str(tenant.id)
        context_headers["X-Tenant-Slug"] = str(tenant.slug)
    else:
        context_headers["X-Tenant-Id"] = ctx.tenant_id
        context_headers["X-Tenant-Slug"] = ctx.tenant_slug

    try:
        resp = proxy_request(
            upstream_base_url=upstream,
            upstream_path=f"auth/{path}",  # ID service has all account routes under /auth/
            method=request.method,
            query_string=request.META.get("QUERY_STRING", ""),
            body=body,
            incoming_headers=request.headers,
            context_headers=context_headers,
            request_id=request.request_id,
        )
    except Exception:
        return error_response(
            code="UPSTREAM_UNAVAILABLE",
            message="ID service unavailable",
            request_id=request.request_id,
            status=502,
        )

    return HttpResponse(
        resp.content,
        status=resp.status_code,
        content_type=resp.headers.get("content-type", "application/json"),
    )


@router.api_operation(
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "/auth/{path:path}",
    auth=None,  # Auth endpoints are often public (login)
)
def proxy_auth(request: HttpRequest, path: str):
    # We don't use _proxy_group because it requires auth
    upstream = getattr(settings, "BFF_UPSTREAM_ID_URL", "") or getattr(
        settings,
        "ID_BASE_URL",
        "",
    )
    if not upstream:
        return error_response(
            code="UPSTREAM_NOT_CONFIGURED",
            message="Upstream for auth is not configured",
            request_id=getattr(request, "request_id", None),
            status=502,
        )
    
    body = request.body or b""
    try:
        resp = proxy_request(
            upstream_base_url=upstream,
            upstream_path=f"auth/{path}",  # ID service exposes /auth/
            method=request.method,
            query_string=request.META.get("QUERY_STRING", ""),
            body=body,
            incoming_headers=request.headers,
            context_headers={
                "X-Request-Id": request.request_id,
            },
            request_id=request.request_id,
        )
    except Exception:
        return error_response(
            code="UPSTREAM_UNAVAILABLE",
            message="Auth service unavailable",
            request_id=request.request_id,
            status=502,
        )

    return HttpResponse(
        resp.content,
        status=resp.status_code,
        content_type=resp.headers.get("content-type", "application/json"),
    )


########################################
# API setup
########################################

api = NinjaAPI(title="UpdSpace BFF", version="1")
api.add_router("/", router)
