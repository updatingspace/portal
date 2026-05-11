from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.core.cache import cache
from django.utils import timezone

from .models import BffSession, Tenant

logger = logging.getLogger(__name__)


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
    @staticmethod
    def _to_session_data(session: BffSession) -> SessionData:
        return SessionData(
            session_id=str(session.id),
            tenant_id=str(session.tenant_id),
            user_id=str(session.user_id),
            master_flags=session.master_flags or {},
            expires_at=session.expires_at.isoformat(),
            active_tenant_id=str(session.active_tenant_id) if session.active_tenant_id else "",
            active_tenant_slug=session.active_tenant_slug or "",
            active_tenant_set_at=(
                session.active_tenant_set_at.isoformat()
                if session.active_tenant_set_at
                else ""
            ),
            last_tenant_slug=session.last_tenant_slug or "",
        )

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

        tenant = Tenant.objects.get(id=tenant_id)
        BffSession.objects.create(
            id=session_id,
            tenant=tenant,
            user_id=user_id,
            master_flags=master_flags,
            expires_at=expires_at,
        )

        # Audit: session creation (PII-safe)
        try:
            from .audit import log_audit_event as _log_audit

            _log_audit(
                tenant_id=tenant_id,
                actor_user_id=user_id,
                action="session.created",
                target_type="bff_session",
                target_id=session_id,
                metadata={
                    "ttl_seconds": int(ttl.total_seconds()),
                },
            )
        except Exception:
            logger.warning("Failed to write session.created audit event", exc_info=True)

        return SessionData(**payload)

    def get(self, session_id: str) -> SessionData | None:
        db = (
            BffSession.objects.filter(
                id=session_id,
                revoked_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            .select_related("tenant")
            .first()
        )
        if not db:
            return None
        return self._to_session_data(db)

    def set_active_tenant(
        self,
        session_id: str,
        *,
        tenant_id: str,
        tenant_slug: str,
    ) -> SessionData | None:
        """Set the active tenant in an existing session (path-based tenancy)."""
        now = timezone.now()
        updated = BffSession.objects.filter(
            id=session_id,
            revoked_at__isnull=True,
            expires_at__gt=now,
        ).update(
            active_tenant_id=tenant_id,
            active_tenant_slug=tenant_slug,
            active_tenant_set_at=now,
            last_tenant_slug=tenant_slug,
        )
        if not updated:
            return None
        session = BffSession.objects.select_related("tenant").filter(id=session_id).first()
        return self._to_session_data(session) if session else None

    def clear_active_tenant(self, session_id: str) -> SessionData | None:
        """Clear the active tenant from session (return to tenantless state)."""
        now = timezone.now()
        updated = BffSession.objects.filter(
            id=session_id,
            revoked_at__isnull=True,
            expires_at__gt=now,
        ).update(
            active_tenant_id=None,
            active_tenant_slug="",
            active_tenant_set_at=None,
        )
        if not updated:
            return None
        session = BffSession.objects.select_related("tenant").filter(id=session_id).first()
        return self._to_session_data(session) if session else None

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
        # Look up session to get tenant/user for audit before revoking
        session_row = BffSession.objects.filter(
            id=session_id,
            revoked_at__isnull=True,
        ).first()

        (
            BffSession.objects.filter(
                id=session_id,
                revoked_at__isnull=True,
            )
            .update(revoked_at=timezone.now())
        )

        if session_row:
            self.invalidate_user_tenants_cache(str(session_row.user_id))

        # Audit: session revocation (PII-safe)
        if session_row:
            try:
                from .audit import log_audit_event as _log_audit

                _log_audit(
                    tenant_id=str(session_row.tenant_id),
                    actor_user_id=str(session_row.user_id),
                    action="session.revoked",
                    target_type="bff_session",
                    target_id=session_id,
                )
            except Exception:
                logger.warning("Failed to write session.revoked audit event", exc_info=True)
