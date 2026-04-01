from __future__ import annotations

from datetime import timedelta
from typing import Any
from uuid import UUID

from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from bff.audit import BffAuditEvent
from bff.models import BffSession
from bff.session_store import _cache_key


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _serialize_session(item: BffSession) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "user_id": str(item.user_id),
        "master_flags": item.master_flags or {},
        "expires_at": _iso(item.expires_at),
        "created_at": _iso(item.created_at),
        "revoked_at": _iso(item.revoked_at),
    }


def _serialize_audit_event(item: BffAuditEvent) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "actor_user_id": str(item.actor_user_id),
        "action": item.action,
        "target_type": item.target_type,
        "target_id": item.target_id,
        "metadata": item.metadata or {},
        "request_id": item.request_id,
        "created_at": _iso(item.created_at),
    }


def export_user_data(*, tenant_id: UUID | str, user_id: UUID | str) -> dict[str, Any]:
    sessions = list(
        BffSession.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at", "id")
    )
    audit_events = list(
        BffAuditEvent.objects.filter(tenant_id=tenant_id)
        .filter(Q(actor_user_id=user_id) | Q(target_id=str(user_id)))
        .order_by("created_at", "id")
    )
    return {
        "service": "bff",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "exported_at": timezone.now().isoformat(),
        "sessions": [_serialize_session(item) for item in sessions],
        "audit_events": [_serialize_audit_event(item) for item in audit_events],
    }


def erase_user_data(*, tenant_id: UUID | str, user_id: UUID | str) -> dict[str, Any]:
    sessions = list(
        BffSession.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("id")
    )
    now = timezone.now()
    session_ids = [str(item.id) for item in sessions]
    for session_id in session_ids:
        cache.delete(_cache_key(session_id))

    BffSession.objects.filter(id__in=session_ids, revoked_at__isnull=True).update(revoked_at=now)

    return {
        "service": "bff",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "mode": "hard-delete-sessions",
        "erased_at": now.isoformat(),
        "counts": {
            "sessions_revoked": len(session_ids),
        },
    }


def purge_retention(*, session_days: int, audit_days: int) -> dict[str, Any]:
    now = timezone.now()
    session_cutoff = now - timedelta(days=session_days)
    audit_cutoff = now - timedelta(days=audit_days)
    sessions = list(
        BffSession.objects.filter(
            Q(revoked_at__lt=session_cutoff) | Q(expires_at__lt=session_cutoff)
        ).order_by("id")
    )
    session_ids = [str(item.id) for item in sessions]
    for session_id in session_ids:
        cache.delete(_cache_key(session_id))
    sessions_deleted, _ = BffSession.objects.filter(id__in=session_ids).delete() if session_ids else (0, {})
    audit_events_deleted, _ = BffAuditEvent.objects.filter(created_at__lt=audit_cutoff).delete()

    return {
        "service": "bff",
        "executed_at": now.isoformat(),
        "cutoffs": {
            "sessions_before": session_cutoff.isoformat(),
            "audit_before": audit_cutoff.isoformat(),
        },
        "counts": {
            "sessions_deleted": sessions_deleted,
            "audit_events_deleted": audit_events_deleted,
        },
    }
