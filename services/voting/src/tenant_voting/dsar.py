from __future__ import annotations

from typing import Any
from uuid import UUID

from django.utils import timezone

from tenant_voting.models import OutboxMessage, Poll, PollInvite, PollParticipant, Vote

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


def _serialize_poll(item: Poll) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "title": item.title,
        "description": item.description,
        "status": item.status,
        "scope_type": item.scope_type,
        "scope_id": item.scope_id,
        "visibility": item.visibility,
        "template": item.template,
        "allow_revoting": item.allow_revoting,
        "anonymous": item.anonymous,
        "results_visibility": item.results_visibility,
        "settings": item.settings or {},
        "created_by": str(item.created_by),
        "starts_at": _iso(item.starts_at),
        "ends_at": _iso(item.ends_at),
        "created_at": _iso(item.created_at),
        "updated_at": _iso(item.updated_at),
    }


def _serialize_participant(item: PollParticipant) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "poll_id": str(item.poll_id),
        "user_id": str(item.user_id),
        "role": item.role,
        "added_at": _iso(item.added_at),
    }


def _serialize_invite(item: PollInvite) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "poll_id": str(item.poll_id),
        "user_id": str(item.user_id),
        "role": item.role,
        "invited_by": str(item.invited_by),
        "status": item.status,
        "token": str(item.token),
        "created_at": _iso(item.created_at),
    }


def _serialize_vote(item: Vote) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "poll_id": str(item.poll_id),
        "nomination_id": str(item.nomination_id),
        "option_id": str(item.option_id),
        "user_id": str(item.user_id),
        "created_at": _iso(item.created_at),
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


def _matches_outbox(item: OutboxMessage, *, user_token: str, vote_ids: set[str]) -> bool:
    payload = item.payload or {}
    if not isinstance(payload, dict):
        return False
    if str(payload.get("vote_id") or "") in vote_ids:
        return True
    return str(payload.get("user_id") or "").strip() == user_token


def export_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    polls_created = list(
        Poll.objects.filter(tenant_id=tenant_id, created_by=user_id).order_by("created_at", "id")
    )
    participants = list(
        PollParticipant.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("added_at", "id")
    )
    invites_received = list(
        PollInvite.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at", "id")
    )
    invites_sent = list(
        PollInvite.objects.filter(tenant_id=tenant_id, invited_by=user_id).order_by("created_at", "id")
    )
    votes = list(Vote.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at", "id"))

    vote_ids = {str(item.id) for item in votes}
    user_token = str(user_id)
    outbox_items = [
        item
        for item in OutboxMessage.objects.filter(tenant_id=tenant_id).order_by("occurred_at", "id")
        if _matches_outbox(item, user_token=user_token, vote_ids=vote_ids)
    ]

    return {
        "service": "voting",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "exported_at": timezone.now().isoformat(),
        "polls_created": [_serialize_poll(item) for item in polls_created],
        "participants": [_serialize_participant(item) for item in participants],
        "invites_received": [_serialize_invite(item) for item in invites_received],
        "invites_sent": [_serialize_invite(item) for item in invites_sent],
        "votes": [_serialize_vote(item) for item in votes],
        "outbox": [_serialize_outbox(item) for item in outbox_items],
    }


def erase_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    vote_ids = list(Vote.objects.filter(tenant_id=tenant_id, user_id=user_id).values_list("id", flat=True))

    polls_anonymized = Poll.objects.filter(tenant_id=tenant_id, created_by=user_id).update(
        created_by=ANONYMIZED_USER_ID,
    )
    participants_deleted, _ = PollParticipant.objects.filter(tenant_id=tenant_id, user_id=user_id).delete()
    invites_received_deleted, _ = PollInvite.objects.filter(tenant_id=tenant_id, user_id=user_id).delete()
    invites_sent_anonymized = PollInvite.objects.filter(tenant_id=tenant_id, invited_by=user_id).update(
        invited_by=ANONYMIZED_USER_ID,
    )
    votes_deleted, _ = Vote.objects.filter(tenant_id=tenant_id, user_id=user_id).delete()

    tokens = {str(user_id)}
    outbox_scrubbed = 0
    for item in OutboxMessage.objects.filter(tenant_id=tenant_id).order_by("id"):
        if not _matches_outbox(item, user_token=str(user_id), vote_ids={str(item_id) for item_id in vote_ids}):
            continue
        payload = item.payload or {}
        new_payload = _scrub_json(payload, tokens=tokens)
        if new_payload != payload:
            item.payload = new_payload
            item.save(update_fields=["payload"])
            outbox_scrubbed += 1

    return {
        "service": "voting",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "mode": "hybrid",
        "erased_at": timezone.now().isoformat(),
        "counts": {
            "polls_anonymized": polls_anonymized,
            "participants_deleted": participants_deleted,
            "invites_received_deleted": invites_received_deleted,
            "invites_sent_anonymized": invites_sent_anonymized,
            "votes_deleted": votes_deleted,
            "outbox_scrubbed": outbox_scrubbed,
        },
    }
