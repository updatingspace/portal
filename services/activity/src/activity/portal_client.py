from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Any
from urllib.parse import urlsplit

import httpx
from django.conf import settings

from activity.context import ActivityContext

logger = logging.getLogger(__name__)


class PortalClient:
    def __init__(self) -> None:
        base_url = getattr(settings, "PORTAL_SERVICE_URL", "http://portal:8003/api/v1")
        self._base_url = str(base_url).rstrip("/")
        self._client = httpx.Client(timeout=5.0)

    def _signed_path(self, path: str) -> str:
        base_path = urlsplit(self._base_url).path.rstrip("/")
        relative_path = f"/{path.lstrip('/')}"
        return f"{base_path}{relative_path}" if base_path else relative_path

    def _sign(self, method: str, path: str, body: bytes, request_id: str) -> tuple[str, str]:
        secret = getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "")
        if not secret:
            raise RuntimeError("Internal HMAC secret is not configured")

        timestamp = str(int(time.time()))
        digest = hashlib.sha256(body or b"").hexdigest()
        message = "\n".join([method.upper(), path, digest, request_id, timestamp]).encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), message, digestmod=hashlib.sha256).hexdigest()
        return timestamp, signature

    def list_profiles(self, ctx: ActivityContext, user_ids: list[str]) -> dict[str, dict[str, Any]]:
        unique_ids = [user_id.strip() for user_id in dict.fromkeys(user_ids) if user_id and user_id.strip()]
        if not unique_ids:
            return {}

        request_path = "/portal/internal/profiles"
        path = f"{request_path}?user_ids={','.join(unique_ids)}"
        try:
            timestamp, signature = self._sign("GET", self._signed_path(request_path), b"", ctx.request_id)
        except Exception as exc:
            logger.warning("Portal profile signing failed", extra={"error": str(exc)})
            return {}

        headers = {
            "X-Request-Id": ctx.request_id,
            "X-Tenant-Id": str(ctx.tenant_id),
            "X-Tenant-Slug": ctx.tenant_slug,
            "X-User-Id": str(ctx.user_id) if ctx.user_id else "",
            "X-Forwarded-Proto": "https",
            "X-Updspace-Timestamp": timestamp,
            "X-Updspace-Signature": signature,
        }
        if ctx.master_flags:
            headers["X-Master-Flags"] = ",".join(sorted(ctx.master_flags))

        try:
            response = self._client.get(f"{self._base_url}{path}", headers=headers)
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            logger.warning(
                "Portal profile lookup failed",
                extra={
                    "tenant_id": str(ctx.tenant_id),
                    "request_id": ctx.request_id,
                    "error": str(exc),
                },
            )
            return {}

        if not isinstance(payload, list):
            return {}

        result: dict[str, dict[str, Any]] = {}
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            user_id = entry.get("user_id")
            if isinstance(user_id, str) and user_id:
                result[user_id] = entry
        return result


portal_client = PortalClient()
