from __future__ import annotations

import uuid
from dataclasses import dataclass
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


def _cache_key(session_id: str) -> str:
    return f"bff:session:{session_id}"


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
        }
        cache.set(_cache_key(session_id), payload, timeout=max(ttl_seconds, 1))
        return SessionData(**payload)

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
