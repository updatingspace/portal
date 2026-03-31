from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any

from django.db import transaction
from django.db.models import Count, Prefetch
from django.utils import timezone

from tenant_voting.api import _access_check_allowed
from tenant_voting.context import InternalContext
from tenant_voting.models import (
    Nomination as TenantNomination,
    Option,
    OutboxMessage,
    Poll,
    PollScopeType,
    PollStatus,
    Vote,
)


class NominationNotFoundError(LookupError):
    pass


class OptionNotFoundError(LookupError):
    pass


class VotingClosedError(PermissionError):
    def __init__(self, deadline_at=None):
        self.deadline_at = deadline_at
        super().__init__("Voting is closed")


VoteCounts = dict[str, int]

OPTIONS_PREFETCH = Prefetch(
    "options",
    queryset=Option.objects.order_by("sort_order", "id"),
)
NOMINATIONS_PREFETCH = Prefetch(
    "nominations",
    queryset=(
        TenantNomination.objects.order_by("sort_order", "id")
        .prefetch_related(OPTIONS_PREFETCH)
    ),
)


def is_global_admin(ctx: InternalContext) -> bool:
    return _access_check_allowed(
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        request_id=ctx.request_id,
        master_flags=ctx.master_flags,
        action="voting.votings.admin",
        scope_type="TENANT",
        scope_id=ctx.tenant_id,
    )


def _scope_for_poll(poll: Poll, *, tenant_id: str) -> tuple[str, str]:
    if poll.scope_type in {
        PollScopeType.TENANT,
        PollScopeType.COMMUNITY,
        PollScopeType.TEAM,
    }:
        return str(poll.scope_type), str(poll.scope_id)
    return "TENANT", str(tenant_id)


def _access_allowed(ctx: InternalContext, poll: Poll, *, action: str) -> bool:
    scope_type, scope_id = _scope_for_poll(poll, tenant_id=ctx.tenant_id)
    return _access_check_allowed(
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        request_id=ctx.request_id,
        master_flags=ctx.master_flags,
        action=action,
        scope_type=scope_type,
        scope_id=scope_id,
    )


def _settings_dict(poll: Poll) -> dict[str, Any]:
    if isinstance(poll.settings, dict):
        return dict(poll.settings)
    return {}


def legacy_code_for_poll(poll: Poll) -> str:
    settings = _settings_dict(poll)
    code = settings.get("legacy_code")
    if isinstance(code, str) and code.strip():
        return code.strip()
    return str(poll.id)


def _legacy_rules(poll: Poll) -> dict[str, Any]:
    settings = _settings_dict(poll)
    raw = settings.get("legacy_rules") or settings.get("rules") or {}
    if isinstance(raw, dict):
        return dict(raw)
    return {}


def _show_vote_counts(poll: Poll) -> bool:
    settings = _settings_dict(poll)
    if "show_vote_counts" in settings:
        return bool(settings.get("show_vote_counts"))
    rules = _legacy_rules(poll)
    return bool(rules.get("show_vote_counts", False))


def _is_public_poll(poll: Poll) -> bool:
    return str(poll.visibility) == "public"


def _is_poll_open(poll: Poll) -> bool:
    if poll.status != PollStatus.ACTIVE:
        return False
    now = timezone.now()
    if poll.starts_at and now < poll.starts_at:
        return False
    if poll.ends_at and now > poll.ends_at:
        return False
    return True


def _can_read_poll(
    ctx: InternalContext,
    poll: Poll,
    *,
    include_non_public: bool,
    action: str = "voting.poll.read",
) -> bool:
    if str(poll.tenant_id) != str(ctx.tenant_id):
        return False
    if not _access_allowed(ctx, poll, action=action):
        return False
    if include_non_public:
        return True
    return _is_public_poll(poll)


def _serialize_voting(poll: Poll) -> dict[str, Any]:
    return {
        "id": legacy_code_for_poll(poll),
        "title": poll.title,
        "description": poll.description or None,
        "is_active": poll.status == PollStatus.ACTIVE,
        "is_open": _is_poll_open(poll),
        "is_public": _is_public_poll(poll),
        "deadline_at": poll.ends_at,
        "show_vote_counts": _show_vote_counts(poll),
        "rules": _legacy_rules(poll),
    }


def _serialize_nomination_summary(
    nomination: TenantNomination,
) -> dict[str, Any]:
    return {
        "id": str(nomination.id),
        "title": nomination.title,
        "description": nomination.description or None,
        "kind": nomination.kind,
        "is_active": True,
        "order": nomination.sort_order,
    }


def _serialize_option(option: Option) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if option.description:
        payload["description"] = option.description
    if option.game_id:
        payload["game_id"] = str(option.game_id)
    return {
        "id": str(option.id),
        "title": option.title,
        "image_url": option.media_url or None,
        "game": None,
        "payload": payload,
    }


def _build_nomination_payload(
    nomination: TenantNomination,
    poll: Poll,
    *,
    user_vote: str | None,
    counts: VoteCounts | None,
) -> dict[str, Any]:
    return {
        "id": str(nomination.id),
        "title": nomination.title,
        "description": nomination.description or None,
        "kind": nomination.kind,
        "config": (
            nomination.config
            if isinstance(nomination.config, dict)
            else {}
        ),
        "options": [
            _serialize_option(option)
            for option in nomination.options.all()
        ],
        "counts": counts if _show_vote_counts(poll) else None,
        "user_vote": user_vote,
        "voting_deadline": poll.ends_at,
        "is_voting_open": _is_poll_open(poll),
        "can_vote": _is_poll_open(poll),
        "requires_telegram_link": False,
        "voting": _serialize_voting(poll),
    }


def _polls_queryset(*, active_only: bool) -> Any:
    queryset = Poll.objects.all().prefetch_related(NOMINATIONS_PREFETCH)
    if active_only:
        queryset = queryset.filter(status=PollStatus.ACTIVE)
    return queryset.order_by("ends_at", "created_at", "id")


def _load_visible_polls(
    ctx: InternalContext,
    *,
    include_non_public: bool,
    active_only: bool,
) -> list[Poll]:
    polls = list(
        _polls_queryset(active_only=active_only).filter(
            tenant_id=ctx.tenant_id,
        )
    )
    return [
        poll
        for poll in polls
        if _can_read_poll(
            ctx,
            poll,
            include_non_public=include_non_public,
            action="voting.poll.read",
        )
    ]


def _vote_counts_map(nomination_ids: list[uuid.UUID]) -> dict[str, VoteCounts]:
    rows = (
        Vote.objects.filter(nomination_id__in=nomination_ids)
        .values("nomination_id", "option_id")
        .annotate(total=Count("id"))
    )
    result: dict[str, VoteCounts] = defaultdict(dict)
    for row in rows:
        result[str(row["nomination_id"])][str(row["option_id"])] = row["total"]
    return {key: dict(value) for key, value in result.items()}


def _get_user_vote_map(
    ctx: InternalContext,
    nomination_ids: list[uuid.UUID],
) -> dict[str, str]:
    rows = (
        Vote.objects.filter(
            user_id=ctx.user_id,
            nomination_id__in=nomination_ids,
        )
        .order_by("created_at", "id")
        .values_list("nomination_id", "option_id")
    )
    result: dict[str, str] = {}
    for nomination_id, option_id in rows:
        result[str(nomination_id)] = str(option_id)
    return result


def list_votings_overview(
    ctx: InternalContext, *, include_non_public: bool = False
) -> list[dict[str, Any]]:
    polls = _load_visible_polls(
        ctx,
        include_non_public=include_non_public,
        active_only=False,
    )
    result: list[dict[str, Any]] = []
    for poll in polls:
        nominations = list(poll.nominations.all())
        result.append(
            {
                **_serialize_voting(poll),
                "nominations": [
                    _serialize_nomination_summary(nomination)
                    for nomination in nominations
                ],
                "nomination_count": len(nominations),
            }
        )
    return result


def list_votings_feed(
    ctx: InternalContext, *, limit: int = 20, include_non_public: bool = False
) -> list[dict[str, Any]]:
    polls = _load_visible_polls(
        ctx,
        include_non_public=include_non_public,
        active_only=True,
    )
    result: list[dict[str, Any]] = []
    for poll in polls[: max(1, limit)]:
        payload = _serialize_voting(poll)
        payload["nomination_count"] = len(poll.nominations.all())
        result.append(payload)
    return result


def list_nominations(
    ctx: InternalContext, *, voting_code: str | None = None
) -> list[dict[str, Any]]:
    include_non_public = is_global_admin(ctx)
    polls = _load_visible_polls(
        ctx,
        include_non_public=include_non_public,
        active_only=False,
    )
    if voting_code:
        polls = [
            poll for poll in polls if legacy_code_for_poll(poll) == voting_code
        ]

    items = [
        (poll, nomination)
        for poll in polls
        for nomination in poll.nominations.all()
    ]
    nominations = [nomination for _, nomination in items]
    nomination_ids = [nomination.id for nomination in nominations]
    vote_counts_needed = [
        nomination.id
        for poll, nomination in items
        if _show_vote_counts(poll)
    ]
    counts_map = (
        _vote_counts_map(vote_counts_needed) if vote_counts_needed else {}
    )
    user_votes = (
        _get_user_vote_map(ctx, nomination_ids) if nomination_ids else {}
    )

    return [
        _build_nomination_payload(
            nomination,
            poll,
            user_vote=user_votes.get(str(nomination.id)),
            counts=counts_map.get(str(nomination.id)),
        )
        for poll, nomination in items
    ]


def get_nomination_with_status(
    ctx: InternalContext,
    nomination_id: str,
) -> dict[str, Any] | None:
    try:
        parsed = uuid.UUID(str(nomination_id))
    except Exception:
        return None

    nomination = (
        TenantNomination.objects.filter(
            id=parsed,
            poll__tenant_id=ctx.tenant_id,
        )
        .select_related("poll")
        .prefetch_related(OPTIONS_PREFETCH)
        .first()
    )
    if not nomination:
        return None

    include_non_public = is_global_admin(ctx)
    if not _can_read_poll(
        ctx,
        nomination.poll,
        include_non_public=include_non_public,
        action="voting.poll.read",
    ):
        return None

    user_votes = _get_user_vote_map(ctx, [nomination.id])
    counts = None
    if _show_vote_counts(nomination.poll):
        counts_map = _vote_counts_map([nomination.id])
        counts = counts_map.get(str(nomination.id))

    return _build_nomination_payload(
        nomination,
        nomination.poll,
        user_vote=user_votes.get(str(nomination.id)),
        counts=counts,
    )


def record_vote(
    ctx: InternalContext,
    nomination_id: str,
    option_id: str,
) -> tuple[VoteCounts | None, TenantNomination]:
    try:
        nomination_uuid = uuid.UUID(str(nomination_id))
    except Exception as exc:
        raise NominationNotFoundError(nomination_id) from exc

    nomination = (
        TenantNomination.objects.filter(
            id=nomination_uuid,
            poll__tenant_id=ctx.tenant_id,
        )
        .select_related("poll")
        .prefetch_related(OPTIONS_PREFETCH)
        .first()
    )
    if not nomination:
        raise NominationNotFoundError(nomination_id)

    include_non_public = is_global_admin(ctx)
    if not _can_read_poll(
        ctx,
        nomination.poll,
        include_non_public=include_non_public,
        action="voting.vote.cast",
    ):
        raise PermissionError("Voting not published")

    try:
        option_uuid = uuid.UUID(str(option_id))
    except Exception as exc:
        raise OptionNotFoundError(option_id) from exc

    option = next(
        (opt for opt in nomination.options.all() if opt.id == option_uuid),
        None,
    )
    if not option:
        raise OptionNotFoundError(option_id)

    if not _is_poll_open(nomination.poll):
        raise VotingClosedError(nomination.poll.ends_at)

    with transaction.atomic():
        existing_votes = list(
            Vote.objects.select_for_update()
            .filter(
                tenant_id=ctx.tenant_id,
                poll=nomination.poll,
                nomination=nomination,
                user_id=ctx.user_id,
            )
            .order_by("created_at", "id")
        )

        unchanged = (
            len(existing_votes) == 1
            and existing_votes[0].option_id == option.id
        )
        if not unchanged:
            if existing_votes:
                Vote.objects.filter(
                    id__in=[vote.id for vote in existing_votes]
                ).delete()
            vote = Vote.objects.create(
                tenant_id=ctx.tenant_id,
                poll=nomination.poll,
                nomination=nomination,
                option=option,
                user_id=ctx.user_id,
                created_at=timezone.now(),
            )
            OutboxMessage.objects.create(
                tenant_id=ctx.tenant_id,
                event_type="voting.vote.cast",
                payload={
                    "vote_id": str(vote.id),
                    "poll_id": str(nomination.poll_id),
                    "nomination_id": str(nomination.id),
                    "option_id": str(option.id),
                    "user_id": str(ctx.user_id),
                    "legacy_api": True,
                },
                occurred_at=vote.created_at,
            )

    counts = None
    if _show_vote_counts(nomination.poll):
        counts_map = _vote_counts_map([nomination.id])
        counts = counts_map.get(str(nomination.id))

    return counts, nomination
