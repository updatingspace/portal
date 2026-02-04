from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import Achievement, AchievementGrant, OutboxMessage


def _encode_cursor(dt: datetime, row_id: UUID) -> str:
    raw = f"{dt.isoformat()}|{row_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")


def _decode_cursor(cursor: str) -> tuple[datetime, UUID] | None:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        dt_raw, id_raw = raw.split("|", 1)
        return datetime.fromisoformat(dt_raw), UUID(id_raw)
    except Exception:
        return None


@dataclass(frozen=True)
class PaginatedResult:
    items: list[Any]
    next_cursor: str | None


def paginate_queryset(
    *,
    qs,
    limit: int,
    cursor: str | None,
    order_by: tuple[str, str],
) -> PaginatedResult:
    limit = min(max(1, limit), 100)
    cursor_dt: datetime | None = None
    cursor_id: UUID | None = None
    if cursor:
        parsed = _decode_cursor(cursor)
        if parsed:
            cursor_dt, cursor_id = parsed

    primary, secondary = order_by
    if cursor_dt and cursor_id:
        qs = qs.filter(
            Q(**{f"{primary}__lt": cursor_dt})
            | Q(**{primary: cursor_dt, f"{secondary}__lt": cursor_id})
        )

    items = list(qs.order_by(f"-{primary}", f"-{secondary}")[: limit + 1])
    has_more = len(items) > limit
    if has_more:
        items = items[:limit]

    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = _encode_cursor(getattr(last, primary), getattr(last, secondary))

    return PaginatedResult(items=items, next_cursor=next_cursor)


@transaction.atomic
def create_outbox_event(*, tenant_id: str, event_type: str, payload: dict[str, Any]) -> OutboxMessage:
    return OutboxMessage.objects.create(
        tenant_id=tenant_id,
        event_type=event_type,
        payload=payload,
    )


@transaction.atomic
def create_grant(
    *,
    achievement: Achievement,
    recipient_id: UUID,
    issuer_id: UUID,
    reason: str | None,
    visibility: str,
) -> AchievementGrant:
    existing = AchievementGrant.objects.filter(
        tenant_id=achievement.tenant_id,
        achievement=achievement,
        recipient_id=recipient_id,
        revoked_at__isnull=True,
    ).first()
    if existing:
        return existing

    grant = AchievementGrant.objects.create(
        tenant_id=achievement.tenant_id,
        achievement=achievement,
        recipient_id=recipient_id,
        issuer_id=issuer_id,
        reason=reason or "",
        visibility=visibility,
    )
    if grant:
        create_outbox_event(
            tenant_id=str(achievement.tenant_id),
            event_type="gamification.grant.created",
            payload={
                "grant_id": str(grant.id),
                "achievement_id": str(achievement.id),
                "recipient_id": str(recipient_id),
                "issuer_id": str(issuer_id),
                "visibility": visibility,
                "reason": reason or "",
                "created_at": grant.created_at.isoformat(),
            },
        )
    return grant


@transaction.atomic
def revoke_grant(
    *,
    grant: AchievementGrant,
    revoked_by: UUID,
) -> AchievementGrant:
    if grant.revoked_at:
        return grant
    grant.revoked_at = timezone.now()
    grant.revoked_by = revoked_by
    grant.save(update_fields=["revoked_at", "revoked_by"])
    create_outbox_event(
        tenant_id=str(grant.tenant_id),
        event_type="gamification.grant.revoked",
        payload={
            "grant_id": str(grant.id),
            "achievement_id": str(grant.achievement_id),
            "recipient_id": str(grant.recipient_id),
            "revoked_by": str(revoked_by),
            "revoked_at": grant.revoked_at.isoformat(),
        },
    )
    return grant
