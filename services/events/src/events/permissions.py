from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import urlsplit

from django.conf import settings

from app.access_client import check_access, unavailable


def _is_suspended_or_banned(master_flags: dict) -> bool:
    status = str(master_flags.get("status", "")).lower()
    if status in {"suspended", "banned"}:
        return True
    return bool(master_flags.get("suspended") is True or master_flags.get("banned") is True)


def _is_system_admin(master_flags: dict) -> bool:
    return bool(
        master_flags.get("system_admin") is True
        or master_flags.get("is_system_admin") is True
    )


def has_permission(
    *,
    tenant_id: str,
    tenant_slug: str,
    user_id: str,
    master_flags: dict,
    permission_key: str,
    scope_type: str,
    scope_id: str,
    request_id: str,
) -> bool:
    if _is_suspended_or_banned(master_flags):
        return False
    if _is_system_admin(master_flags):
        return True

    base_url = str(getattr(settings, "ACCESS_BASE_URL", "http://access:8002/api/v1")).rstrip("/")
    url = f"{base_url}/access/check"
    path = urlsplit(url).path

    payload = {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "action": permission_key,
        "scope": {"type": scope_type, "id": scope_id},
        "master_flags": {
            "suspended": bool(master_flags.get("suspended", False)),
            "banned": bool(master_flags.get("banned", False)),
            "system_admin": bool(master_flags.get("system_admin", False)),
            "membership_status": master_flags.get("membership_status"),
        },
    }
    body = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")

    ts = str(int(time.time()))
    secret = getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "")
    if not secret:
        unavailable(request_id=str(request_id), reason="missing_hmac_secret")

    msg = "\n".join(["POST", path, hashlib.sha256(body).hexdigest(), str(request_id), ts]).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), msg, digestmod=hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Request-Id": str(request_id),
        "X-Tenant-Id": str(tenant_id),
        "X-Tenant-Slug": str(tenant_slug),
        "X-User-Id": str(user_id),
        "X-Forwarded-Proto": "https",
        "X-Master-Flags": json.dumps(master_flags, separators=(",", ":"), default=str),
        "X-Updspace-Timestamp": ts,
        "X-Updspace-Signature": sig,
    }

    return check_access(url=url, body=body, headers=headers)


def has_scope_membership(
    *,
    tenant_id: str,
    tenant_slug: str,
    user_id: str,
    scope_type: str,
    scope_id: str,
    request_id: str,
) -> bool:
    # Best-effort membership check: treat "membership" as having read permission for events in that scope.
    return has_permission(
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
        user_id=user_id,
        master_flags={},
        permission_key="events.event.read",
        scope_type=scope_type,
        scope_id=scope_id,
        request_id=request_id,
    )
