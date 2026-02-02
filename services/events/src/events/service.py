from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .models import Attendance, Event, EventVisibility, OutboxMessage, RSVP


def _emit_outbox(*, tenant_id, event_type: str, payload: dict) -> None:
    OutboxMessage.objects.create(tenant_id=tenant_id, event_type=event_type, payload=payload)


def create_event(*, tenant_id, created_by, data: dict) -> Event:
    event = Event.objects.create(
        tenant_id=tenant_id,
        scope_type=data["scope_type"],
        scope_id=data["scope_id"],
        title=data["title"],
        description=data.get("description") or "",
        starts_at=data["starts_at"],
        ends_at=data["ends_at"],
        location_text=data.get("location_text") or "",
        location_url=data.get("location_url") or None,
        game_id=data.get("game_id") or None,
        visibility=data.get("visibility") or EventVisibility.PUBLIC,
        created_by=created_by,
    )
    _emit_outbox(
        tenant_id=tenant_id,
        event_type="event.created",
        payload={
            "event_id": str(event.id),
            "tenant_id": str(tenant_id),
        "scope_type": event.scope_type,
        "scope_id": event.scope_id,
        "created_by": str(created_by),
        "created_at": event.created_at.isoformat(),
    },
)
    return event


def update_event(*, event: Event, data: dict) -> Event:
    updates: dict[str, object | None] = {}
    if "title" in data and data["title"] is not None:
        updates["title"] = data["title"]
    if "description" in data:
        updates["description"] = (data["description"] or "")
    if "starts_at" in data and data["starts_at"] is not None:
        updates["starts_at"] = data["starts_at"]
    if "ends_at" in data and data["ends_at"] is not None:
        updates["ends_at"] = data["ends_at"]
    if "location_text" in data:
        updates["location_text"] = data["location_text"] or ""
    if "location_url" in data:
        updates["location_url"] = data["location_url"] or None
    if "game_id" in data:
        updates["game_id"] = data["game_id"] or None
    if "visibility" in data and data["visibility"] is not None:
        updates["visibility"] = data["visibility"]

    if not updates:
        return event

    for field, value in updates.items():
        setattr(event, field, value)
    event.save(update_fields=list(updates.keys()))

    _emit_outbox(
        tenant_id=event.tenant_id,
        event_type="event.updated",
        payload={
            "event_id": str(event.id),
            "tenant_id": str(event.tenant_id),
            "scope_type": event.scope_type,
            "scope_id": event.scope_id,
            "updated_fields": list(updates.keys()),
            "updated_at": event.updated_at.isoformat(),
        },
    )

    return event


@transaction.atomic
def set_rsvp(*, tenant_id, event: Event, user_id, status: str) -> RSVP:
    rsvp, created = RSVP.objects.select_for_update().get_or_create(
        tenant_id=tenant_id,
        event=event,
        user_id=user_id,
        defaults={"status": status},
    )
    changed = created or (rsvp.status != status)
    if changed:
        rsvp.status = status
        rsvp.save(update_fields=["status", "updated_at"])

        _emit_outbox(
            tenant_id=tenant_id,
            event_type="event.rsvp.changed",
            payload={
                "event_id": str(event.id),
                "tenant_id": str(tenant_id),
                "user_id": str(user_id),
                "status": status,
                "updated_at": rsvp.updated_at.isoformat(),
            },
        )
    return rsvp


@transaction.atomic
def mark_attendance(*, tenant_id, event: Event, user_id, marked_by) -> Attendance:
    att, _ = Attendance.objects.select_for_update().get_or_create(
        tenant_id=tenant_id,
        event=event,
        user_id=user_id,
        defaults={"marked_by": marked_by, "marked_at": timezone.now()},
    )
    # If already exists, keep original (idempotent)
    return att
