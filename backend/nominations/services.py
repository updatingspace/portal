from __future__ import annotations

import logging
import time
from collections import defaultdict
from collections.abc import Iterable
from threading import RLock
from typing import Any

from django.conf import settings
from django.db import IntegrityError, OperationalError
from django.db.models import Count, F, Prefetch, Q
from django.utils import timezone

from accounts.services import user_has_telegram_link

from .data import seed_nominations_from_fixture, seed_votings_from_fixture
from .models import Game, Nomination, NominationOption, NominationVote, Voting

logger = logging.getLogger(__name__)


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
    queryset=NominationOption.objects.filter(is_active=True)
    .select_related("game")
    .order_by("order", "title"),
)
VOTING_SELECT = ("voting",)
NOMINATIONS_PREFETCH = Prefetch(
    "nominations",
    queryset=Nomination.objects.order_by("order", "title"),
)

_seed_lock = RLock()
_votings_seeded = False
_nominations_seeded = False


def _run_seed_with_retry(fn) -> bool:
    """
    Run a seeding callable with a few retries to survive transient SQLite locks.
    Returns True when the callable finished (even if it changed nothing).
    """
    delays = (0, 0.15, 0.3)
    for delay in delays:
        try:
            fn()
            return True
        except OperationalError as exc:
            message = str(exc).lower()
            if "locked" not in message:
                raise
            logger.warning(
                "Seeding skipped due to locked database, retrying",
                exc_info=True,
                extra={"delay": delay},
            )
            time.sleep(delay)
        except Exception:
            # Bubble up non-database errors to catch real issues early
            raise
    logger.error("Seeding failed due to locked database after retries")
    return False


def _serialize_game(game: Game) -> dict[str, Any]:
    return {
        "id": game.id,
        "title": game.title,
        "genre": game.genre or None,
        "studio": game.studio or None,
        "release_year": game.release_year,
        "description": game.description or None,
        "image_url": game.image_url or None,
    }


def list_games(search: str | None = None) -> list[dict[str, Any]]:
    ensure_nominations_seeded()
    games_qs = Game.objects.all()
    if search:
        games_qs = games_qs.filter(
            Q(title__icontains=search)
            | Q(genre__icontains=search)
            | Q(studio__icontains=search)
            | Q(description__icontains=search)
        )
    games = games_qs.order_by("title", "id")
    logger.info(
        "Games listed",
        extra={"search": search, "count": games.count()},
    )
    return [_serialize_game(game) for game in games]


def get_game_payload(game_id: str) -> dict[str, Any] | None:
    ensure_nominations_seeded()
    game = Game.objects.filter(id=game_id).first()
    if not game:
        logger.warning(
            "Game payload requested for unknown game",
            extra={"game_id": game_id},
        )
        return None
    logger.info(
        "Game payload fetched",
        extra={"game_id": game_id},
    )
    return _serialize_game(game)


def update_game_from_payload(game_id: str, data: dict[str, Any]) -> dict[str, Any]:
    ensure_nominations_seeded()
    game = Game.objects.filter(id=game_id).first()
    if not game:
        logger.warning(
            "Game update failed: game not found",
            extra={"game_id": game_id},
        )
        raise LookupError(game_id)

    updated_fields: list[str] = []
    for field in ("title", "genre", "studio", "description", "image_url"):
        if field in data:
            value = data.get(field)
            normalized = value.strip() if isinstance(value, str) else value
            if getattr(game, field) != (normalized or ""):
                setattr(game, field, normalized or "")
                updated_fields.append(field)

    if "release_year" in data:
        value = data.get("release_year")
        release_year = None
        if isinstance(value, int):
            release_year = value
        elif isinstance(value, str):
            try:
                release_year = int(value)
            except (TypeError, ValueError):
                release_year = None
        if game.release_year != release_year:
            game.release_year = release_year
            updated_fields.append("release_year")

    if updated_fields:
        try:
            game.save(update_fields=updated_fields)
        except IntegrityError as exc:
            logger.warning(
                "Game update failed: duplicate title",
                extra={"game_id": game_id, "title": getattr(game, "title", None)},
            )
            raise ValueError("Игра с таким названием уже существует") from exc
        logger.info(
            "Game updated",
            extra={
                "game_id": game_id,
                "fields": updated_fields,
            },
        )

    return _serialize_game(game)


def create_game_from_payload(data: dict[str, Any]) -> dict[str, Any]:
    ensure_nominations_seeded()
    title_value = data.get("title")
    if not title_value or not (isinstance(title_value, str) and title_value.strip()):
        logger.info("Game create rejected: missing title")
        raise ValueError("Название игры обязательно")

    game = Game(
        title=title_value.strip(),
        genre=(data.get("genre") or "").strip(),
        studio=(data.get("studio") or "").strip(),
        description=(data.get("description") or "").strip(),
        image_url=(data.get("image_url") or "").strip() or None,
    )

    release_year = None
    if "release_year" in data:
        value = data.get("release_year")
        if isinstance(value, int):
            release_year = value
        elif isinstance(value, str):
            try:
                release_year = int(value)
            except (TypeError, ValueError):
                release_year = None
    if release_year is not None:
        game.release_year = release_year

    try:
        game.save()
    except IntegrityError as exc:
        logger.warning(
            "Game create failed: duplicate title",
            extra={"title": getattr(game, "title", None)},
        )
        raise ValueError("Игра с таким названием уже существует") from exc
    logger.info(
        "Game created",
        extra={"game_id": game.id, "title": game.title},
    )

    return _serialize_game(game)


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
    global _votings_seeded
    if _votings_seeded:
        return
    with _seed_lock:
        if _votings_seeded:
            return
        success = _run_seed_with_retry(lambda: seed_votings_from_fixture(force=False))
        _votings_seeded = bool(success)


def ensure_nominations_seeded() -> None:
    global _nominations_seeded
    if _nominations_seeded:
        return
    with _seed_lock:
        if _nominations_seeded:
            return
        ensure_votings_seeded()
        success = _run_seed_with_retry(
            lambda: seed_nominations_from_fixture(force=False)
        )
        _nominations_seeded = bool(success)


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
        "is_public": voting.is_public,
        "deadline_at": voting.deadline_at,
        "show_vote_counts": voting.expose_vote_counts,
        "rules": voting.rules or {},
    }


def _serialize_nomination_summary(nomination: Nomination) -> dict[str, Any]:
    return {
        "id": nomination.id,
        "title": nomination.title,
        "description": nomination.description or None,
        "kind": nomination.kind,
        "is_active": nomination.is_active,
        "order": nomination.order,
    }


def list_votings_overview(include_non_public: bool = False) -> list[dict[str, Any]]:
    """
    Return all votings with lightweight nomination metadata to drive the frontend overview.
    """
    ensure_nominations_seeded()
    votings = list(
        Voting.objects.order_by("order", "title").prefetch_related(NOMINATIONS_PREFETCH)
    )

    result: list[dict[str, Any]] = []
    for voting in votings:
        if not include_non_public and not voting.is_public:
            continue
        nominations = list(voting.nominations.all())
        result.append(
            {
                **_serialize_voting(voting),
                "nominations": [_serialize_nomination_summary(n) for n in nominations],
                "nomination_count": len(nominations),
            }
        )
    return result


def list_votings_feed(
    limit: int = 20, include_non_public: bool = False
) -> list[dict[str, Any]]:
    """
    Lightweight feed for the главная страница: только активные/публичные голосования
    без списка номинаций, ограничено лимитом.
    """
    ensure_nominations_seeded()
    qs = (
        Voting.objects.filter(is_active=True)
        .annotate(nomination_count=Count("nominations"))
        .order_by(F("deadline_at").asc(nulls_last=True), "order", "title")
    )
    feed: list[dict[str, Any]] = []
    for voting in qs:
        if not include_non_public and not voting.is_public:
            continue

        payload = _serialize_voting(voting)
        payload["nomination_count"] = getattr(voting, "nomination_count", 0)
        feed.append(payload)

        if len(feed) >= max(1, limit):
            break

    return feed


def _serialize_option(option: NominationOption) -> dict[str, Any]:
    return {
        "id": option.id,
        "title": option.title,
        "image_url": option.image_url or None,
        "game": _serialize_game(option.game) if option.game else None,
        "payload": option.payload if isinstance(option.payload, dict) else {},
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
    config_payload = nomination.config if isinstance(nomination.config, dict) else {}

    return {
        "id": nomination.id,
        "title": nomination.title,
        "description": nomination.description or None,
        "kind": nomination.kind,
        "config": config_payload,
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
    include_non_public = bool(getattr(user, "is_superuser", False))

    nominations_qs = Nomination.objects.filter(is_active=True)
    if voting_code:
        nominations_qs = nominations_qs.filter(voting__code=voting_code)

    nominations = list(
        nominations_qs.select_related(*VOTING_SELECT)
        .prefetch_related(OPTIONS_PREFETCH)
        .order_by("voting__order", "order", "title")
    )

    if not include_non_public:
        nominations = [
            nomination for nomination in nominations if nomination.voting.is_public
        ]

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
    include_non_public = bool(getattr(user, "is_superuser", False))
    if not include_non_public and not nomination.voting.is_public:
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
        logger.warning(
            "Vote rejected: nomination not found",
            extra={
                "nomination_id": nomination_id,
                "user_id": getattr(user, "id", None),
            },
        )
        raise NominationNotFoundError(nomination_id)

    is_superuser = bool(getattr(user, "is_superuser", False))
    if not is_superuser and not nomination.voting.is_public:
        logger.warning(
            "Vote rejected: voting not public",
            extra={
                "nomination_id": nomination_id,
                "voting_id": getattr(nomination.voting, "code", None),
                "user_id": getattr(user, "id", None),
            },
        )
        raise PermissionError("Voting not published")

    option = next(
        (
            opt
            for opt in nomination.options.all()
            if opt.id == option_id and opt.is_active
        ),
        None,
    )
    if not option:
        logger.warning(
            "Vote rejected: option not found",
            extra={
                "nomination_id": nomination_id,
                "option_id": option_id,
                "user_id": getattr(user, "id", None),
            },
        )
        raise OptionNotFoundError(option_id)

    voting = nomination.voting
    if not voting.is_open or not nomination.is_active or not voting.is_active:
        logger.warning(
            "Vote rejected: voting closed",
            extra={
                "nomination_id": nomination_id,
                "voting_id": getattr(voting, "id", None),
                "option_id": option_id,
                "user_id": getattr(user, "id", None),
            },
        )
        raise VotingClosedError(voting.deadline_at)

    can_vote, requires_telegram_link = _resolve_vote_permissions(user)
    if not can_vote:
        if requires_telegram_link:
            logger.warning(
                "Vote rejected: telegram link required",
                extra={
                    "nomination_id": nomination_id,
                    "user_id": getattr(user, "id", None),
                },
            )
            raise TelegramLinkRequiredError(
                "Для голосования привяжите Telegram в профиле"
            )
        raise PermissionError("Authentication required")

    NominationVote.objects.update_or_create(
        user=user,
        nomination=nomination,
        defaults={"option": option},
    )
    logger.info(
        "Vote recorded",
        extra={
            "nomination_id": nomination_id,
            "option_id": option_id,
            "user_id": getattr(user, "id", None),
            "voting_id": getattr(voting, "code", None),
        },
    )

    counts = get_vote_counts(nomination_id) if voting.expose_vote_counts else None

    return counts, nomination


def _serialize_admin_nomination(
    nomination: Nomination, counts: VoteCounts | None
) -> dict[str, Any]:
    votes_total = sum(counts.values()) if counts else None
    return {
        "id": nomination.id,
        "title": nomination.title,
        "status": "active" if nomination.is_active else "archived",
        "votes": votes_total,
        "updated_at": nomination.updated_at,
    }


def get_admin_voting_detail(voting_code: str) -> dict[str, Any] | None:
    ensure_nominations_seeded()
    voting = (
        Voting.objects.filter(code=voting_code)
        .prefetch_related(NOMINATIONS_PREFETCH)
        .first()
    )
    if not voting:
        return None

    nominations = list(voting.nominations.all())
    counts_map = get_vote_counts_map([nom.id for nom in nominations])

    return {
        **_serialize_voting(voting),
        "nomination_count": len(nominations),
        "nominations": [
            _serialize_admin_nomination(nomination, counts_map.get(nomination.id))
            for nomination in nominations
        ],
    }


def update_voting_from_admin_payload(
    voting_code: str, data: dict[str, Any]
) -> dict[str, Any]:
    ensure_votings_seeded()
    voting = Voting.objects.filter(code=voting_code).first()
    if not voting:
        logger.warning(
            "Admin voting update failed: not found",
            extra={"voting_code": voting_code},
        )
        raise LookupError(voting_code)

    payload = dict(data)
    close_now = bool(payload.pop("close_now", False))
    if close_now:
        payload["deadline_at"] = timezone.now()
        payload.setdefault("is_active", False)

    updated_fields: set[str] = set()

    if "title" in payload and payload.get("title") is not None:
        title = (
            payload.get("title").strip()
            if isinstance(payload.get("title"), str)
            else payload.get("title")
        )
        if title and title != voting.title:
            voting.title = title
            updated_fields.add("title")

    if "description" in payload:
        description = payload.get("description") or ""
        if voting.description != description:
            voting.description = description
            updated_fields.add("description")

    if "deadline_at" in payload:
        deadline_at = payload.get("deadline_at")
        if voting.deadline_at != deadline_at:
            voting.deadline_at = deadline_at
            updated_fields.add("deadline_at")

    if "is_active" in payload and payload.get("is_active") is not None:
        is_active = bool(payload.get("is_active"))
        if voting.is_active != is_active:
            voting.is_active = is_active
            updated_fields.add("is_active")

    if "is_public" in payload and payload.get("is_public") is not None:
        prev_public = voting.is_public
        voting.set_public(bool(payload.get("is_public")))
        if prev_public != voting.is_public or "rules" not in updated_fields:
            updated_fields.add("rules")

    if close_now:
        updated_fields.update({"deadline_at", "is_active"})

    if updated_fields:
        voting.save(update_fields=list(updated_fields))
        logger.info(
            "Voting updated via admin API",
            extra={
                "voting_code": voting_code,
                "fields": sorted(updated_fields),
                "close_now": close_now,
            },
        )

    return get_admin_voting_detail(voting_code) or _serialize_voting(voting)


def get_admin_dashboard_metrics() -> dict[str, int]:
    ensure_nominations_seeded()
    votings = list(Voting.objects.all())
    published = [voting for voting in votings if voting.is_public]
    draft_votings = len(votings) - len(published)
    active_votings = len([v for v in published if v.is_active])
    archived_votings = len([v for v in published if not v.is_active])
    open_for_voting = len([v for v in published if v.is_active and v.is_open])

    open_nominations = sum(
        1
        for nomination in Nomination.objects.select_related("voting").filter(
            is_active=True
        )
        if nomination.voting.is_public
    )

    total_votes = NominationVote.objects.count()
    unique_voters = (
        NominationVote.objects.values("user_id").distinct().count()
        if total_votes
        else 0
    )

    logger.info(
        "Admin dashboard metrics calculated",
        extra={
            "votings": len(votings),
            "published": len(published),
            "drafts": draft_votings,
            "active": active_votings,
            "archived": archived_votings,
            "votes": total_votes,
            "unique_voters": unique_voters,
        },
    )

    return {
        "active_votings": active_votings,
        "draft_votings": draft_votings,
        "archived_votings": archived_votings,
        "total_votes": total_votes,
        "unique_voters": unique_voters,
        "open_nominations": open_nominations,
        "open_for_voting": open_for_voting,
    }
