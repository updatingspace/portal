from __future__ import annotations

from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from tenant_voting.context import require_internal_context

from .compat import (
    NominationNotFoundError,
    OptionNotFoundError,
    VotingClosedError,
    get_nomination_with_status,
    list_nominations,
    record_vote,
)
from .schemas import (
    NominationSchema,
    VoteRequestSchema,
    VoteResponseSchema,
)

router = Router(tags=["nominations"])


@router.get("/", response=list[NominationSchema])
def get_all_nominations(request, voting: str | None = None):
    """
    Опционально можно передать код голосования (?voting=test),
    чтобы получить только связанные номинации.
    """
    ctx = require_internal_context(request)
    return list_nominations(ctx, voting_code=voting)


@router.get("/{nomination_id}", response=NominationSchema)
def get_nomination_detail(request, nomination_id: str):
    ctx = require_internal_context(request)
    nomination = get_nomination_with_status(ctx, nomination_id)
    if not nomination:
        raise HttpError(
            404,
            {"code": "NOT_FOUND", "message": "Nomination not found"},
        )
    return nomination


@router.post("/{nomination_id}/vote", response=VoteResponseSchema)
def vote_for_option(request, nomination_id: str, payload: VoteRequestSchema):
    ctx = require_internal_context(request)

    try:
        counts, nomination = record_vote(ctx, nomination_id, payload.option_id)
    except NominationNotFoundError as exc:
        raise HttpError(
            404,
            {"code": "NOT_FOUND", "message": "Nomination not found"},
        ) from exc
    except OptionNotFoundError as exc:
        raise HttpError(
            400,
            {
                "code": "OPTION_NOT_FOUND",
                "message": "Option not found for this nomination",
            },
        ) from exc
    except VotingClosedError as exc:
        detail = "Голосование завершено"
        if exc.deadline_at:
            detail = f"{detail}. Дедлайн: {exc.deadline_at.isoformat()}"
        raise HttpError(
            403,
            {"code": "VOTING_CLOSED", "message": detail},
        ) from exc
    except PermissionError as exc:
        raise HttpError(
            403,
            {"code": "FORBIDDEN", "message": str(exc)},
        ) from exc

    poll = nomination.poll
    now = timezone.now()
    is_open = (
        poll.status == "active"
        and (poll.starts_at is None or poll.starts_at <= now)
        and (poll.ends_at is None or now <= poll.ends_at)
    )

    return {
        "nomination_id": nomination_id,
        "option_id": payload.option_id,
        "counts": counts,
        "user_vote": payload.option_id,
        "is_voting_open": is_open,
        "can_vote": is_open,
        "requires_telegram_link": False,
        "voting_deadline": poll.ends_at,
    }
