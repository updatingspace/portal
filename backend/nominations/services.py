from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from django.conf import settings
from django.db.models import Count, Prefetch

from accounts.services import user_has_telegram_link

from .data import seed_nominations_from_fixture, seed_votings_from_fixture
from .models import Nomination, NominationOption, NominationVote, Voting


class NominationNotFoundError(LookupError):
    pass


class OptionNotFoundError(LookupError):
    pass


class VotingClosedError(PermissionError):
    def __init__(self, deadline_at=None):
        self.deadline_at = deadline_at
        super().__init__("Voting is closed")


class TelegramLinkRequiredError(PermissionError):
    """
    Возникает, если правила требуют привязку Telegram для голосования.
    """


VoteCounts = dict[str, int]

OPTIONS_PREFETCH = Prefetch(
    "options",
    queryset=NominationOption.objects.filter(is_active=True).order_by("order", "title"),
)
VOTING_SELECT = ("voting",)
NOMINATIONS_PREFETCH = Prefetch(
    "nominations",
    queryset=Nomination.objects.order_by("order", "title"),
)


def _resolve_vote_permissions(user: Any) -> tuple[bool, bool]:
    is_authenticated = bool(user and getattr(user, "is_authenticated", False))
    if not is_authenticated:
        return False, False

    require_telegram = bool(
        getattr(settings, "TELEGRAM_REQUIRE_LINK_FOR_VOTING", False)
    )
    if require_telegram and not user_has_telegram_link(user):
        return False, True

    return True, False


def ensure_votings_seeded() -> None:
    seed_votings_from_fixture(force=False)


def ensure_nominations_seeded() -> None:
    ensure_votings_seeded()
    seed_nominations_from_fixture(force=False)


def get_nomination(nomination_id: str) -> Nomination | None:
    ensure_nominations_seeded()
    return (
        Nomination.objects.filter(id=nomination_id, is_active=True)
        .select_related(*VOTING_SELECT)
        .prefetch_related(OPTIONS_PREFETCH)
        .first()
    )


def get_vote_counts(nomination_id: str) -> VoteCounts:
    votes = (
        NominationVote.objects.filter(nomination_id=nomination_id)
        .values("option_id")
        .annotate(total=Count("id"))
    )
    return {item["option_id"]: item["total"] for item in votes}


def get_vote_counts_map(
    nomination_ids: Iterable[str] | None = None,
) -> dict[str, VoteCounts]:
    result: dict[str, VoteCounts] = defaultdict(dict)
    votes_qs = NominationVote.objects.values("nomination_id", "option_id").annotate(
        total=Count("id")
    )
    if nomination_ids is not None:
        votes_qs = votes_qs.filter(nomination_id__in=list(nomination_ids))
    votes = votes_qs
    for item in votes:
        result[item["nomination_id"]][item["option_id"]] = item["total"]
    return {nomination_id: dict(counts) for nomination_id, counts in result.items()}


def get_user_votes_map(user) -> dict[str, str]:
    if not user or not getattr(user, "is_authenticated", False):
        return {}
    votes = NominationVote.objects.filter(user=user).values_list(
        "nomination_id", "option_id"
    )
    return {nomination_id: option_id for nomination_id, option_id in votes}


def _serialize_voting(voting: Voting) -> dict[str, Any]:
    return {
        "id": voting.code,
        "title": voting.title,
        "description": voting.description or None,
        "is_active": voting.is_active,
        "is_open": voting.is_open,
        "deadline_at": voting.deadline_at,
        "show_vote_counts": voting.expose_vote_counts,
        "rules": voting.rules or {},
    }


def _serialize_nomination_summary(nomination: Nomination) -> dict[str, Any]:
    return {
        "id": nomination.id,
        "title": nomination.title,
        "description": nomination.description or None,
        "is_active": nomination.is_active,
        "order": nomination.order,
    }


def list_votings_overview() -> list[dict[str, Any]]:
    """
    Return all votings with lightweight nomination metadata to drive the frontend overview.
    """
    ensure_nominations_seeded()
    votings = list(
        Voting.objects.order_by("order", "title").prefetch_related(NOMINATIONS_PREFETCH)
    )

    result: list[dict[str, Any]] = []
    for voting in votings:
        nominations = list(voting.nominations.all())
        result.append(
            {
                **_serialize_voting(voting),
                "nominations": [_serialize_nomination_summary(n) for n in nominations],
                "nomination_count": len(nominations),
            }
        )
    return result


def _serialize_option(option: NominationOption) -> dict[str, Any]:
    return {
        "id": option.id,
        "title": option.title,
        "image_url": option.image_url or None,
    }


def _build_nomination_payload(
    nomination: Nomination,
    voting: Voting,
    user_vote: str | None,
    counts: VoteCounts | None,
    can_vote: bool,
    requires_telegram_link: bool,
) -> dict[str, Any]:
    options = [_serialize_option(option) for option in nomination.options.all()]
    is_voting_open = voting.is_open and voting.is_active and nomination.is_active
    counts_payload = counts if voting.expose_vote_counts else None

    return {
        "id": nomination.id,
        "title": nomination.title,
        "description": nomination.description or None,
        "options": options,
        "counts": counts_payload,
        "user_vote": user_vote,
        "voting_deadline": voting.deadline_at,
        "is_voting_open": is_voting_open,
        "can_vote": can_vote and is_voting_open,
        "requires_telegram_link": requires_telegram_link,
        "voting": _serialize_voting(voting),
    }


def list_nominations(user=None, voting_code: str | None = None) -> list[dict[str, Any]]:
    ensure_nominations_seeded()
    user_can_vote, requires_telegram_link = _resolve_vote_permissions(user)
    user_votes = get_user_votes_map(user) if user_can_vote else {}

    nominations_qs = Nomination.objects.filter(is_active=True)
    if voting_code:
        nominations_qs = nominations_qs.filter(voting__code=voting_code)

    nominations = list(
        nominations_qs.select_related(*VOTING_SELECT)
        .prefetch_related(OPTIONS_PREFETCH)
        .order_by("voting__order", "order", "title")
    )

    nomination_ids_with_counts = [
        nomination.id
        for nomination in nominations
        if nomination.voting.expose_vote_counts
    ]
    counts_map = (
        get_vote_counts_map(nomination_ids_with_counts)
        if nomination_ids_with_counts
        else {}
    )

    return [
        _build_nomination_payload(
            nomination=nomination,
            voting=nomination.voting,
            user_vote=user_votes.get(nomination.id),
            counts=counts_map.get(nomination.id),
            can_vote=user_can_vote,
            requires_telegram_link=requires_telegram_link,
        )
        for nomination in nominations
    ]


def get_nomination_with_status(nomination_id: str, user=None) -> dict[str, Any] | None:
    nomination = get_nomination(nomination_id)
    if not nomination:
        return None

    user_can_vote, requires_telegram_link = _resolve_vote_permissions(user)
    user_vote = None
    voting = nomination.voting

    if user_can_vote:
        user_vote = (
            NominationVote.objects.filter(user=user, nomination_id=nomination_id)
            .values_list("option_id", flat=True)
            .first()
        )

    counts = get_vote_counts(nomination_id) if voting.expose_vote_counts else None

    return _build_nomination_payload(
        nomination=nomination,
        voting=voting,
        user_vote=user_vote,
        counts=counts,
        can_vote=user_can_vote,
        requires_telegram_link=requires_telegram_link,
    )


def record_vote(
    nomination_id: str, option_id: str, user
) -> tuple[VoteCounts | None, Nomination]:
    nomination = get_nomination(nomination_id)
    if not nomination:
        raise NominationNotFoundError(nomination_id)

    option = next(
        (
            opt
            for opt in nomination.options.all()
            if opt.id == option_id and opt.is_active
        ),
        None,
    )
    if not option:
        raise OptionNotFoundError(option_id)

    voting = nomination.voting
    if not voting.is_open or not nomination.is_active or not voting.is_active:
        raise VotingClosedError(voting.deadline_at)

    can_vote, requires_telegram_link = _resolve_vote_permissions(user)
    if not can_vote:
        if requires_telegram_link:
            raise TelegramLinkRequiredError(
                "Для голосования привяжите Telegram в профиле"
            )
        raise PermissionError("Authentication required")

    NominationVote.objects.update_or_create(
        user=user,
        nomination=nomination,
        defaults={"option": option},
    )

    counts = get_vote_counts(nomination_id) if voting.expose_vote_counts else None

    return counts, nomination
