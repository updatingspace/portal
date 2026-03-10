from __future__ import annotations

import hashlib
import hmac
import json
import time

import httpx
from django.conf import settings


def _is_suspended_or_banned(master_flags: dict) -> bool:
    status = str(master_flags.get("status", "")).lower()
    if status in {"suspended", "banned"}:
        return True
    if master_flags.get("suspended") is True or master_flags.get("banned") is True:
        return True
    return False


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
    path = "/api/v1/access/check"
    url = f"{base_url}/access/check"

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
        return False
    msg = "\n".join(
        ["POST", path, hashlib.sha256(body).hexdigest(), str(request_id), ts]
    ).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), msg, digestmod=hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Request-Id": str(request_id),
        "X-Tenant-Id": str(tenant_id),
        "X-Tenant-Slug": str(tenant_slug),
        "X-User-Id": str(user_id),
        "X-Master-Flags": json.dumps(master_flags, separators=(",", ":"), default=str),
        "X-Updspace-Timestamp": ts,
        "X-Updspace-Signature": sig,
    }

    try:
        resp = httpx.post(url, content=body, headers=headers, timeout=5.0)
    except Exception:
        return False

    if resp.status_code != 200:
        return False
    try:
        data = resp.json()
    except Exception:
        return False
    return bool(data.get("allowed"))
