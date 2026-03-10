from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .models import BffSession, Tenant


@dataclass(frozen=True)
class SessionData:
    session_id: str
    tenant_id: str
    user_id: str
    master_flags: dict[str, Any]
    expires_at: str
    # Path-based multi-tenancy: active tenant in session
    active_tenant_id: str = ""
    active_tenant_slug: str = ""
    active_tenant_set_at: str = ""
    last_tenant_slug: str = ""


def _cache_key(session_id: str) -> str:
    return f"bff:session:{session_id}"


def _tenants_cache_key(user_id: str) -> str:
    return f"bff:tenants:{user_id}"


class SessionStore:
    def create(
        self,
        *,
        tenant_id: str,
        user_id: str,
        master_flags: dict[str, Any],
        ttl: timedelta,
    ) -> SessionData:
        now = timezone.now()
        expires_at = now + ttl
        session_id = str(uuid.uuid4())

        payload: dict[str, Any] = {
            "session_id": session_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "master_flags": master_flags,
            "expires_at": expires_at.isoformat(),
            "active_tenant_id": "",
            "active_tenant_slug": "",
            "active_tenant_set_at": "",
            "last_tenant_slug": "",
        }

        cache.set(
            _cache_key(session_id),
            payload,
            timeout=int(ttl.total_seconds()),
        )

        if getattr(settings, "BFF_SESSION_DB_FALLBACK", False):
            tenant = Tenant.objects.get(id=tenant_id)
            BffSession.objects.create(
                id=session_id,
                tenant=tenant,
                user_id=user_id,
                master_flags=master_flags,
                expires_at=expires_at,
            )

        return SessionData(**payload)

    def get(self, session_id: str) -> SessionData | None:
        payload = cache.get(_cache_key(session_id))
        if payload:
            # Ensure backwards compat with sessions created before active_tenant fields
            payload.setdefault("active_tenant_id", "")
            payload.setdefault("active_tenant_slug", "")
            payload.setdefault("active_tenant_set_at", "")
            payload.setdefault("last_tenant_slug", "")
            return SessionData(**payload)

        if not getattr(settings, "BFF_SESSION_DB_FALLBACK", False):
            return None

        db = (
            BffSession.objects.filter(id=session_id, revoked_at__isnull=True)
            .select_related("tenant")
            .first()
        )
        if not db:
            return None
        if db.expires_at <= timezone.now():
            return None

        ttl_seconds = int((db.expires_at - timezone.now()).total_seconds())
        payload = {
            "session_id": str(db.id),
            "tenant_id": str(db.tenant_id),
            "user_id": str(db.user_id),
            "master_flags": db.master_flags or {},
            "expires_at": db.expires_at.isoformat(),
            "active_tenant_id": "",
            "active_tenant_slug": "",
            "active_tenant_set_at": "",
            "last_tenant_slug": "",
        }
        cache.set(_cache_key(session_id), payload, timeout=max(ttl_seconds, 1))
        return SessionData(**payload)

    def set_active_tenant(
        self,
        session_id: str,
        *,
        tenant_id: str,
        tenant_slug: str,
    ) -> SessionData | None:
        """Set the active tenant in an existing session (path-based tenancy)."""
        payload = cache.get(_cache_key(session_id))
        if not payload:
            return None

        payload.setdefault("active_tenant_id", "")
        payload.setdefault("active_tenant_slug", "")
        payload.setdefault("active_tenant_set_at", "")
        payload.setdefault("last_tenant_slug", "")

        now = timezone.now()
        payload["active_tenant_id"] = tenant_id
        payload["active_tenant_slug"] = tenant_slug
        payload["active_tenant_set_at"] = now.isoformat()
        payload["last_tenant_slug"] = tenant_slug

        # Preserve remaining TTL
        expires_at_str = payload.get("expires_at", "")
        try:
            from datetime import datetime

            expires_at = datetime.fromisoformat(expires_at_str)
            if timezone.is_naive(expires_at):
                from zoneinfo import ZoneInfo

                expires_at = expires_at.replace(tzinfo=ZoneInfo("UTC"))
            ttl_seconds = max(int((expires_at - now).total_seconds()), 1)
        except Exception:
            ttl_seconds = int(timedelta(days=14).total_seconds())

        cache.set(_cache_key(session_id), payload, timeout=ttl_seconds)
        return SessionData(**payload)

    def clear_active_tenant(self, session_id: str) -> SessionData | None:
        """Clear the active tenant from session (return to tenantless state)."""
        payload = cache.get(_cache_key(session_id))
        if not payload:
            return None

        payload["active_tenant_id"] = ""
        payload["active_tenant_slug"] = ""
        payload["active_tenant_set_at"] = ""

        expires_at_str = payload.get("expires_at", "")
        try:
            from datetime import datetime

            expires_at = datetime.fromisoformat(expires_at_str)
            now = timezone.now()
            if timezone.is_naive(expires_at):
                from zoneinfo import ZoneInfo

                expires_at = expires_at.replace(tzinfo=ZoneInfo("UTC"))
            ttl_seconds = max(int((expires_at - now).total_seconds()), 1)
        except Exception:
            ttl_seconds = int(timedelta(days=14).total_seconds())

        cache.set(_cache_key(session_id), payload, timeout=ttl_seconds)
        return SessionData(**payload)

    def cache_user_tenants(
        self,
        user_id: str,
        tenants: list[dict[str, Any]],
        ttl: int = 120,
    ) -> None:
        """Cache the user's available tenants list."""
        cache.set(_tenants_cache_key(user_id), tenants, timeout=ttl)

    def get_cached_user_tenants(self, user_id: str) -> list[dict[str, Any]] | None:
        """Get cached tenants list for user, or None if expired/missing."""
        return cache.get(_tenants_cache_key(user_id))

    def invalidate_user_tenants_cache(self, user_id: str) -> None:
        """Invalidate the cached tenants list (e.g. after switch or membership change)."""
        cache.delete(_tenants_cache_key(user_id))

    def revoke(self, session_id: str) -> None:
        cache.delete(_cache_key(session_id))
        if getattr(settings, "BFF_SESSION_DB_FALLBACK", False):
            (
                BffSession.objects.filter(
                    id=session_id,
                    revoked_at__isnull=True,
                )
                .update(revoked_at=timezone.now())
            )
