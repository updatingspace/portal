from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db.models import Q
from django.utils import timezone

from events.models import Attendance, Event, OutboxMessage, RSVP

ANONYMIZED_USER_ID = UUID("00000000-0000-0000-0000-000000000000")
REDACTED_VALUE = "[redacted]"


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _scrub_json(value: Any, *, tokens: set[str]) -> Any:
    if isinstance(value, dict):
        return {key: _scrub_json(item, tokens=tokens) for key, item in value.items()}
    if isinstance(value, list):
        return [_scrub_json(item, tokens=tokens) for item in value]
    if isinstance(value, str):
        return REDACTED_VALUE if value.strip() in tokens else value
    return value


def _serialize_event(item: Event) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "scope_type": item.scope_type,
        "scope_id": item.scope_id,
        "title": item.title,
        "description": item.description,
        "starts_at": _iso(item.starts_at),
        "ends_at": _iso(item.ends_at),
        "location_text": item.location_text,
        "location_url": item.location_url,
        "game_id": item.game_id,
        "visibility": item.visibility,
        "created_by": str(item.created_by),
        "created_at": _iso(item.created_at),
        "updated_at": _iso(item.updated_at),
    }


def _serialize_rsvp(item: RSVP) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "event_id": str(item.event_id),
        "user_id": str(item.user_id),
        "status": item.status,
        "updated_at": _iso(item.updated_at),
    }


def _serialize_attendance(item: Attendance) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "event_id": str(item.event_id),
        "user_id": str(item.user_id),
        "marked_by": str(item.marked_by),
        "marked_at": _iso(item.marked_at),
    }


def _serialize_outbox(item: OutboxMessage) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "event_type": item.event_type,
        "payload": item.payload or {},
        "occurred_at": _iso(item.occurred_at),
        "published_at": _iso(item.published_at),
    }


def _matches_outbox(item: OutboxMessage, *, user_token: str, event_ids: set[str]) -> bool:
    payload = item.payload or {}
    if not isinstance(payload, dict):
        return False
    if str(payload.get("event_id") or "") in event_ids:
        return True
    for key in ("created_by", "user_id", "marked_by"):
        if str(payload.get(key) or "").strip() == user_token:
            return True
    return False


def export_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    events_created = list(
        Event.objects.filter(tenant_id=tenant_id, created_by=user_id).order_by("created_at", "id")
    )
    rsvps = list(RSVP.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("updated_at", "id"))
    attendance = list(
        Attendance.objects.filter(tenant_id=tenant_id)
        .filter(Q(user_id=user_id) | Q(marked_by=user_id))
        .order_by("marked_at", "id")
    )

    event_ids = {str(item.id) for item in events_created}
    user_token = str(user_id)
    outbox_items = [
        item
        for item in OutboxMessage.objects.filter(tenant_id=tenant_id).order_by("occurred_at", "id")
        if _matches_outbox(item, user_token=user_token, event_ids=event_ids)
    ]

    return {
        "service": "events",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "exported_at": timezone.now().isoformat(),
        "events_created": [_serialize_event(item) for item in events_created],
        "rsvps": [_serialize_rsvp(item) for item in rsvps],
        "attendance": [_serialize_attendance(item) for item in attendance],
        "outbox": [_serialize_outbox(item) for item in outbox_items],
    }


def erase_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    events_created = list(
        Event.objects.filter(tenant_id=tenant_id, created_by=user_id).values_list("id", flat=True)
    )
    event_ids = {str(item) for item in events_created}
    tokens = {str(user_id)}

    events_anonymized = Event.objects.filter(tenant_id=tenant_id, created_by=user_id).update(
        created_by=ANONYMIZED_USER_ID,
    )
    rsvps_deleted, _ = RSVP.objects.filter(tenant_id=tenant_id, user_id=user_id).delete()
    attendance_deleted, _ = Attendance.objects.filter(tenant_id=tenant_id, user_id=user_id).delete()
    attendance_marked_by_redacted = Attendance.objects.filter(
        tenant_id=tenant_id,
        marked_by=user_id,
    ).update(marked_by=ANONYMIZED_USER_ID)

    outbox_scrubbed = 0
    for item in OutboxMessage.objects.filter(tenant_id=tenant_id).order_by("id"):
        if not _matches_outbox(item, user_token=str(user_id), event_ids=event_ids):
            continue
        payload = item.payload or {}
        new_payload = _scrub_json(payload, tokens=tokens)
        if new_payload != payload:
            item.payload = new_payload
            item.save(update_fields=["payload"])
            outbox_scrubbed += 1

    return {
        "service": "events",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "mode": "hybrid",
        "erased_at": timezone.now().isoformat(),
        "counts": {
            "events_anonymized": events_anonymized,
            "rsvps_deleted": rsvps_deleted,
            "attendance_deleted": attendance_deleted,
            "attendance_marked_by_redacted": attendance_marked_by_redacted,
            "outbox_scrubbed": outbox_scrubbed,
        },
    }
