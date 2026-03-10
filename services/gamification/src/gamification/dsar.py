from __future__ import annotations

from typing import Any
from uuid import UUID

from django.utils import timezone

from gamification.models import Achievement, AchievementGrant, OutboxMessage

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


def _serialize_achievement(item: Achievement) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "name_i18n": item.name_i18n or {},
        "description": item.description,
        "category_id": str(item.category_id),
        "status": item.status,
        "images": item.images or {},
        "created_by": str(item.created_by),
        "created_at": _iso(item.created_at),
        "updated_at": _iso(item.updated_at),
    }


def _serialize_grant(item: AchievementGrant) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "achievement_id": str(item.achievement_id),
        "recipient_id": str(item.recipient_id),
        "issuer_id": str(item.issuer_id),
        "reason": item.reason,
        "visibility": item.visibility,
        "created_at": _iso(item.created_at),
        "revoked_at": _iso(item.revoked_at),
        "revoked_by": str(item.revoked_by) if item.revoked_by else None,
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


def _matches_outbox(
    item: OutboxMessage,
    *,
    user_token: str,
    achievement_ids: set[str],
    grant_ids: set[str],
) -> bool:
    payload = item.payload or {}
    if not isinstance(payload, dict):
        return False
    if str(payload.get("achievement_id") or "") in achievement_ids:
        return True
    if str(payload.get("grant_id") or "") in grant_ids:
        return True
    for key in ("recipient_id", "issuer_id", "revoked_by"):
        if str(payload.get(key) or "").strip() == user_token:
            return True
    return False


def export_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    achievements_created = list(
        Achievement.objects.filter(tenant_id=tenant_id, created_by=user_id)
        .select_related("category")
        .order_by("created_at", "id")
    )
    grants_received = list(
        AchievementGrant.objects.filter(tenant_id=tenant_id, recipient_id=user_id)
        .order_by("created_at", "id")
    )
    grants_issued = list(
        AchievementGrant.objects.filter(tenant_id=tenant_id, issuer_id=user_id)
        .order_by("created_at", "id")
    )
    grants_revoked = list(
        AchievementGrant.objects.filter(tenant_id=tenant_id, revoked_by=user_id)
        .order_by("created_at", "id")
    )

    achievement_ids = {str(item.id) for item in achievements_created}
    grant_ids = {
        str(item.id)
        for item in [*grants_received, *grants_issued, *grants_revoked]
    }
    user_token = str(user_id)
    outbox_items = [
        item
        for item in OutboxMessage.objects.filter(tenant_id=tenant_id).order_by("occurred_at", "id")
        if _matches_outbox(
            item,
            user_token=user_token,
            achievement_ids=achievement_ids,
            grant_ids=grant_ids,
        )
    ]

    return {
        "service": "gamification",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "exported_at": timezone.now().isoformat(),
        "achievements_created": [_serialize_achievement(item) for item in achievements_created],
        "grants_received": [_serialize_grant(item) for item in grants_received],
        "grants_issued": [_serialize_grant(item) for item in grants_issued],
        "grants_revoked": [_serialize_grant(item) for item in grants_revoked],
        "outbox": [_serialize_outbox(item) for item in outbox_items],
    }


def erase_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    recipient_grant_ids = list(
        AchievementGrant.objects.filter(tenant_id=tenant_id, recipient_id=user_id).values_list("id", flat=True)
    )
    achievement_ids = set(
        Achievement.objects.filter(tenant_id=tenant_id, created_by=user_id).values_list("id", flat=True)
    )

    achievements_anonymized = Achievement.objects.filter(tenant_id=tenant_id, created_by=user_id).update(
        created_by=ANONYMIZED_USER_ID,
    )
    grants_received_deleted, _ = AchievementGrant.objects.filter(
        tenant_id=tenant_id,
        recipient_id=user_id,
    ).delete()
    grants_issued_anonymized = AchievementGrant.objects.filter(
        tenant_id=tenant_id,
        issuer_id=user_id,
    ).update(issuer_id=ANONYMIZED_USER_ID)
    grants_revoked_anonymized = AchievementGrant.objects.filter(
        tenant_id=tenant_id,
        revoked_by=user_id,
    ).update(revoked_by=ANONYMIZED_USER_ID)

    tokens = {str(user_id)}
    outbox_scrubbed = 0
    for item in OutboxMessage.objects.filter(tenant_id=tenant_id).order_by("id"):
        if not _matches_outbox(
            item,
            user_token=str(user_id),
            achievement_ids={str(item_id) for item_id in achievement_ids},
            grant_ids={str(item_id) for item_id in recipient_grant_ids},
        ):
            continue
        payload = item.payload or {}
        new_payload = _scrub_json(payload, tokens=tokens)
        if new_payload != payload:
            item.payload = new_payload
            item.save(update_fields=["payload"])
            outbox_scrubbed += 1

    return {
        "service": "gamification",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "mode": "hybrid",
        "erased_at": timezone.now().isoformat(),
        "counts": {
            "achievements_anonymized": achievements_anonymized,
            "grants_received_deleted": grants_received_deleted,
            "grants_issued_anonymized": grants_issued_anonymized,
            "grants_revoked_anonymized": grants_revoked_anonymized,
            "outbox_scrubbed": outbox_scrubbed,
        },
    }
