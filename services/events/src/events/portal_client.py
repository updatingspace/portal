from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Any

import httpx
from django.conf import settings
from .context import InternalContext

logger = logging.getLogger(__name__)


class PortalClientError(Exception):
    """Base error raised when the portal client cannot satisfy a request."""


class PortalMembershipNotFound(PortalClientError):
    """Raised when a membership check returns 404."""


class PortalServiceUnavailable(PortalClientError):
    """Raised when the portal service cannot be reached."""


def _master_flags_header(flags: dict[str, Any]) -> str | None:
    if not flags:
        return None
    truthy = [str(k) for k, v in flags.items() if v]
    if not truthy:
        return None
    return ",".join(sorted(truthy))


class PortalClient:
    """Simple HTTP client for portal membership checks."""

    def __init__(self) -> None:
        base_url = getattr(settings, "PORTAL_SERVICE_URL", "http://portal:8003/api/v1")
        self._base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=5.0)

    def _sign(
        self,
        method: str,
        path: str,
        body: bytes,
        request_id: str,
    ) -> tuple[str, str]:
        secret = getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "")
        if not secret:
            raise PortalServiceUnavailable("Internal HMAC secret is not configured")

        ts = str(int(time.time()))
        digest = hashlib.sha256(body or b"").hexdigest()
        msg = "\n".join([method.upper(), path, digest, request_id, ts]).encode("utf-8")
        sig = hmac.new(secret.encode("utf-8"), msg, digestmod=hashlib.sha256).hexdigest()
        return ts, sig

    def _request(
        self,
        method: str,
        path: str,
        ctx: InternalContext,
        *,
        body: bytes = b"",
    ) -> dict[str, Any]:
        try:
            ts, sig = self._sign(method, path, body, ctx.request_id)
        except PortalClientError as exc:
            logger.error("Portal client signing failed", extra={"error": str(exc)})
            raise

        headers: dict[str, str] = {
            "X-Request-Id": ctx.request_id,
            "X-Tenant-Id": ctx.tenant_id,
            "X-Tenant-Slug": ctx.tenant_slug,
            "X-User-Id": ctx.user_id,
            "X-Updspace-Timestamp": ts,
            "X-Updspace-Signature": sig,
        }
        if (flags := _master_flags_header(ctx.master_flags)):
            headers["X-Master-Flags"] = flags

        url = f"{self._base_url}{path}"
        try:
            resp = self._client.request(method, url, headers=headers, content=body)
        except httpx.TimeoutException as exc:
            raise PortalServiceUnavailable("Portal request timed out") from exc
        except httpx.RequestError as exc:
            raise PortalServiceUnavailable("Portal request failed") from exc

        if resp.status_code == 404:
            raise PortalMembershipNotFound()
        if resp.status_code >= 500:
            raise PortalServiceUnavailable(
                f"Portal returned {resp.status_code}"
            )
        if resp.status_code != 200:
            raise PortalServiceUnavailable(
                f"Unexpected portal status {resp.status_code}"
            )

        try:
            return resp.json()
        except ValueError as exc:
            raise PortalServiceUnavailable("Portal returned invalid JSON") from exc

    def is_community_member(self, ctx: InternalContext, community_id: str) -> bool:
        try:
            self._request(
                "GET",
                f"/communities/{community_id}/members/{ctx.user_id}",
                ctx,
            )
            return True
        except PortalMembershipNotFound:
            return False

    def is_team_member(self, ctx: InternalContext, team_id: str) -> bool:
        try:
            self._request(
                "GET",
                f"/teams/{team_id}/members/{ctx.user_id}",
                ctx,
            )
            return True
        except PortalMembershipNotFound:
            return False


portal_client = PortalClient()
