from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.request

from django.conf import settings
from ninja.errors import HttpError

from portal.context import PortalContext
from core.errors import error_payload


class AccessService:
    @staticmethod
    def _deny_all(ctx: PortalContext, permission: str) -> None:
        raise HttpError(
            403,
            error_payload(
                "FORBIDDEN",
                "Access denied",
                details={"permission": permission},
            ),
        )

    @staticmethod
    def _build_signed_headers(*, request_id: str, path: str, body: bytes) -> dict[str, str]:
        ts = str(int(time.time()))
        secret = getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "") or ""
        if not secret:
            raise RuntimeError("BFF_INTERNAL_HMAC_SECRET is not configured")

        message = "\n".join(
            [
                "POST",
                path,
                hashlib.sha256(body or b"").hexdigest(),
                request_id,
                ts,
            ]
        ).encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), message, digestmod=hashlib.sha256).hexdigest()
        return {
            "X-Updspace-Timestamp": ts,
            "X-Updspace-Signature": signature,
        }

    @staticmethod
    def check(
        ctx: PortalContext,
        permission: str,
        *,
        scope_type: str,
        scope_id: str,
    ) -> None:
        if "suspended" in ctx.master_flags or "banned" in ctx.master_flags:
            AccessService._deny_all(ctx, permission)
        if "system_admin" in ctx.master_flags:
            return

        access_base_url = os.getenv("ACCESS_BASE_URL")
        access_service_url = os.getenv("ACCESS_SERVICE_URL")
        access_url = access_base_url or access_service_url

        allow_all_in_dev = os.getenv("ACCESS_ALLOW_ALL_IN_DEV")
        if allow_all_in_dev is None:
            allow_all_in_dev = (
                "1"
                if (getattr(settings, "DEBUG", False) or getattr(settings, "RUNNING_TESTS", False))
                else "0"
            )
        if not access_url:
            if str(allow_all_in_dev).strip() in {"1", "true", "yes", "on"}:
                return
            AccessService._deny_all(ctx, permission)

        payload = {
            "tenant_id": str(ctx.tenant_id),
            "user_id": str(ctx.user_id),
            "action": permission,
            "scope": {
                "type": str(scope_type).upper(),
                "id": str(scope_id),
            },
            "master_flags": {
                "suspended": "suspended" in ctx.master_flags,
                "banned": "banned" in ctx.master_flags,
                "system_admin": "system_admin" in ctx.master_flags,
            },
        }
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")

        if access_base_url:
            base = access_base_url.rstrip("/")
            target_url = f"{base}/access/check"
            path = "/api/v1/access/check"
        else:
            base = access_service_url.rstrip("/") if access_service_url else ""
            target_url = f"{base}/check"
            path = "/check"

        signed_headers = AccessService._build_signed_headers(
            request_id=ctx.request_id,
            path=path,
            body=body,
        )

        req = urllib.request.Request(
            target_url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Request-Id": ctx.request_id,
                "X-Tenant-Id": str(ctx.tenant_id),
                "X-Tenant-Slug": str(ctx.tenant_slug),
                "X-User-Id": str(ctx.user_id),
                "X-Master-Flags": json.dumps(
                    {
                        "suspended": "suspended" in ctx.master_flags,
                        "banned": "banned" in ctx.master_flags,
                        "system_admin": "system_admin" in ctx.master_flags,
                    },
                    separators=(",", ":"),
                ),
                **signed_headers,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read().decode("utf-8")
        except Exception:
            raise HttpError(
                502,
                error_payload(
                    "ACCESS_UNAVAILABLE",
                    "Access service unavailable",
                    details={"permission": permission},
                ),
            )

        try:
            data = json.loads(raw)
        except Exception:
            data = None

        allowed = False
        if isinstance(data, dict):
            allowed = bool(data.get("allowed"))
        if not allowed:
            AccessService._deny_all(ctx, permission)
