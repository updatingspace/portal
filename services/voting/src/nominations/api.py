from __future__ import annotations

from ninja import Router
from ninja.errors import HttpError

from .schemas import (
    NominationSchema,
    VoteRequestSchema,
    VoteResponseSchema,
)
from .services import (
    NominationNotFoundError,
    OptionNotFoundError,
    TelegramLinkRequiredError,
    VotingClosedError,
    get_nomination_with_status,
    list_nominations,
    record_vote,
)

router = Router(tags=["nominations"])


@router.get("/", response=list[NominationSchema])
def get_all_nominations(request, voting: str | None = None):
    """
    Опционально можно передать код голосования (?voting=test), чтобы получить только
    связанные номинации.
    """
    return list_nominations(request.user, voting_code=voting)


@router.get("/{nomination_id}", response=NominationSchema)
def get_nomination_detail(request, nomination_id: str):
    nomination = get_nomination_with_status(nomination_id, request.user)
    if not nomination:
        raise HttpError(404, "Nomination not found")
    return nomination


@router.post("/{nomination_id}/vote", response=VoteResponseSchema)
def vote_for_option(request, nomination_id: str, payload: VoteRequestSchema):
    if not request.user.is_authenticated:
        raise HttpError(401, "Требуется авторизация для голосования")

    try:
        counts, nomination = record_vote(nomination_id, payload.option_id, request.user)
    except NominationNotFoundError as exc:
        raise HttpError(404, "Nomination not found") from exc
    except OptionNotFoundError as exc:
        raise HttpError(400, "Option not found for this nomination") from exc
    except VotingClosedError as exc:
        detail = "Голосование завершено"
        if exc.deadline_at:
            detail = f"{detail}. Дедлайн: {exc.deadline_at.isoformat()}"
        raise HttpError(403, detail) from exc
    except TelegramLinkRequiredError as exc:
        raise HttpError(403, str(exc)) from exc
    except PermissionError as exc:
        raise HttpError(403, str(exc)) from exc

    voting = nomination.voting
    is_open = voting.is_open and voting.is_active and nomination.is_active

    return {
        "nomination_id": nomination_id,
        "option_id": payload.option_id,
        "counts": counts,
        "user_vote": payload.option_id,
        "is_voting_open": is_open,
        "can_vote": is_open,
        "requires_telegram_link": False,
        "voting_deadline": voting.deadline_at,
    }
