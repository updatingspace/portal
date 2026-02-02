from __future__ import annotations

import json
import os
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

        access_url = os.getenv("ACCESS_SERVICE_URL")
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
            "request_id": ctx.request_id,
            "tenant_id": str(ctx.tenant_id),
            "actor_user_id": str(ctx.user_id),
            "permission": permission,
            "scope_type": scope_type,
            "scope_id": scope_id,
        }

        req = urllib.request.Request(
            access_url.rstrip("/") + "/check",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Request-Id": ctx.request_id},
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
