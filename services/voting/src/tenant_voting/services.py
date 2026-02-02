import uuid
from typing import Dict
from django.db import transaction, IntegrityError
from django.db.models import Count
from django.utils import timezone

from . import metrics
from .models import (
    NominationKind,
    OutboxMessage,
    Poll,
    Vote,
    Nomination,
    Option,
    PollStatus,
    PollScopeType,
    PollParticipant,
    PollRole,
    PollInvite,
    PollInviteStatus,
    ResultsVisibility,
)
from .schemas import (
    ResultOptionOut,
    ResultNominationOut,
    PollResultsOut,
    NominationIn,
    NominationUpdateIn,
    OptionIn,
    OptionUpdateIn,
    PollCreateIn,
    PollUpdateIn,
)
from .templates import get_template

class VotingServiceError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def get_user_role(poll: Poll, user_id: str) -> str | None:
    if str(poll.created_by) == str(user_id):
        return PollRole.OWNER
    participant = PollParticipant.objects.filter(poll=poll, user_id=user_id).first()
    if participant:
        return participant.role
    return None


def can_view_results(poll: Poll, user_id: str) -> bool:
    if poll.status == PollStatus.CLOSED:
        return True
    if poll.results_visibility == ResultsVisibility.ALWAYS:
        return True
    user_role = get_user_role(poll, user_id)
    if user_role == PollRole.OBSERVER:
        return True
    if poll.results_visibility == ResultsVisibility.ADMINS_ONLY and user_role in {
        PollRole.OWNER,
        PollRole.ADMIN,
        PollRole.MODERATOR,
    }:
        return True
    return False


def _user_votes_for_nomination(nomination: Nomination, user_id: str):
    return Vote.objects.filter(nomination=nomination, user_id=user_id)


def cast_vote(
    *,
    tenant_id: str,
    user_id: str,
    poll: Poll,
    nomination_id: uuid.UUID,
    option_id: uuid.UUID
) -> Vote:
    if poll.status != PollStatus.ACTIVE:
        raise VotingServiceError(code="POLL_CLOSED", message="Poll is not open", status=409)

    now = timezone.now()
    if poll.starts_at and now < poll.starts_at:
        raise VotingServiceError(code="POLL_NOT_STARTED", message="Poll has not started yet", status=409)
    if poll.ends_at and now > poll.ends_at:
        raise VotingServiceError(code="POLL_ENDED", message="Poll has ended", status=409)

    try:
        nomination = Nomination.objects.get(id=nomination_id, poll=poll)
    except Nomination.DoesNotExist:
        raise VotingServiceError(code="NOMINATION_NOT_FOUND", message="Nomination not found", status=404)

    try:
        option = Option.objects.get(id=option_id, nomination=nomination)
    except Option.DoesNotExist:
        raise VotingServiceError(code="OPTION_NOT_FOUND", message="Option not found", status=404)

    user_votes = _user_votes_for_nomination(nomination, user_id)
    if user_votes.filter(option=option).exists():
        raise VotingServiceError(
            code="ALREADY_VOTED",
            message="You have already selected this option",
            status=409,
        )
    if user_votes.count() >= nomination.max_votes:
        raise VotingServiceError(
            code="TOO_MANY_VOTES",
            message="Vote limit reached for this question",
            status=409,
        )

    try:
        with transaction.atomic():
            vote = Vote.objects.create(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                poll=poll,
                nomination=nomination,
                option=option,
                user_id=user_id,
                created_at=timezone.now(),
            )
            metrics.VOTES_SUBMITTED.labels(tenant=tenant_id, poll=str(poll.id)).inc()

            OutboxMessage.objects.create(
                tenant_id=tenant_id,
                event_type="voting.vote.cast",
                payload={
                    "vote_id": str(vote.id),
                    "poll_id": str(poll.id),
                    "nomination_id": str(nomination.id),
                    "option_id": str(option.id),
                    "user_id": str(user_id),
                },
                occurred_at=vote.created_at,
            )
            return vote
    except IntegrityError as exc:
        raise VotingServiceError(
            code="VOTE_CREATION_FAILED",
            message="Unable to record vote",
            status=500,
        ) from exc


def delete_vote(
    *,
    tenant_id: str,
    user_id: str,
    vote_id: uuid.UUID,
) -> None:
    try:
        vote = Vote.objects.select_related("poll").get(
            id=vote_id,
            tenant_id=tenant_id,
            user_id=user_id,
        )
    except Vote.DoesNotExist:
        raise VotingServiceError(code="VOTE_NOT_FOUND", message="Vote not found", status=404)

    poll = vote.poll
    if not poll.allow_revoting:
        raise VotingServiceError(code="REVOTE_NOT_ALLOWED", message="Revoting disabled", status=403)
    if poll.status != PollStatus.ACTIVE:
        raise VotingServiceError(code="POLL_CLOSED", message="Poll is not open", status=409)
    now = timezone.now()
    if poll.ends_at and now > poll.ends_at:
        raise VotingServiceError(code="POLL_ENDED", message="Poll has ended", status=409)

    vote.delete()
    OutboxMessage.objects.create(
        tenant_id=tenant_id,
        event_type="voting.vote.revoked",
        payload={
            "vote_id": str(vote_id),
            "poll_id": str(poll.id),
            "nomination_id": str(vote.nomination_id),
            "option_id": str(vote.option_id),
            "user_id": str(user_id),
        },
        occurred_at=timezone.now(),
    )


def get_poll_results(poll: Poll) -> PollResultsOut:
    metrics.POLL_RESULTS_QUERIES.labels(tenant=str(poll.tenant_id), poll=str(poll.id)).inc()
    rows = (
        Vote.objects.filter(poll=poll)
        .values("nomination_id", "option_id")
        .annotate(count=Count("id"))
    )

    results_map: Dict[uuid.UUID, Dict[uuid.UUID, int]] = {}
    for r in rows:
        nom_id = r["nomination_id"]
        opt_id = r["option_id"]
        cnt = r["count"]
        results_map.setdefault(nom_id, {})[opt_id] = cnt

    nominations = list(poll.nominations.all())
    options_by_nom = {}
    for opt in Option.objects.filter(nomination__poll=poll):
        options_by_nom.setdefault(opt.nomination_id, []).append(opt)

    nomination_results = []
    for nom in nominations:
        nom_opts_counts = results_map.get(nom.id, {})
        res_options = []
        for opt in options_by_nom.get(nom.id, []):
            c = nom_opts_counts.get(opt.id, 0)
            res_options.append(
                ResultOptionOut(
                    option_id=opt.id,
                    text=opt.title,
                    votes=c,
                )
            )
        nomination_results.append(
            ResultNominationOut(
                nomination_id=nom.id,
                title=nom.title,
                options=res_options,
            )
        )

    return PollResultsOut(poll_id=poll.id, nominations=nomination_results)


def can_manage_participants(poll: Poll, user_id: str) -> bool:
    role = get_user_role(poll, user_id)
    return role in {PollRole.OWNER, PollRole.ADMIN}


def assign_participant_role(
    *,
    poll: Poll,
    actor_id: str,
    user_id: str,
    role: str,
) -> PollParticipant:
    if not can_manage_participants(poll, actor_id):
        raise VotingServiceError(
            code="FORBIDDEN",
            message="Managing participants is restricted",
            status=403,
        )
    if role not in PollRole.values:
        raise VotingServiceError(
            code="INVALID_ROLE",
            message=f"Role {role} is not supported",
            status=400,
        )

    participant, _ = PollParticipant.objects.update_or_create(
        poll=poll,
        user_id=user_id,
        defaults={"role": role, "tenant_id": poll.tenant_id},
    )
    invite, _ = PollInvite.objects.update_or_create(
        poll=poll,
        user_id=user_id,
        defaults={
            "role": role,
            "invited_by": actor_id,
            "tenant_id": poll.tenant_id,
            "status": PollInviteStatus.ACCEPTED,
        },
    )
    metrics.INVITES_CREATED.labels(tenant=str(poll.tenant_id), poll=str(poll.id)).inc()
    metrics.PARTICIPANTS_MANAGED.labels(tenant=str(poll.tenant_id), poll=str(poll.id)).inc()
    return participant


def remove_participant(*, poll: Poll, actor_id: str, user_id: str) -> None:
    if not can_manage_participants(poll, actor_id):
        raise VotingServiceError(
            code="FORBIDDEN",
            message="Managing participants is restricted",
            status=403,
        )
    PollParticipant.objects.filter(poll=poll, user_id=user_id).delete()
    PollInvite.objects.filter(poll=poll, user_id=user_id).update(
        status=PollInviteStatus.DECLINED
    )
    metrics.PARTICIPANTS_MANAGED.labels(tenant=str(poll.tenant_id), poll=str(poll.id)).inc()


def list_participants(poll: Poll) -> list[PollParticipant]:
    return list(PollParticipant.objects.filter(poll=poll))


def _ensure_poll_draft(poll: Poll, *, action: str) -> None:
    if poll.status != PollStatus.DRAFT:
        raise VotingServiceError(
            code="POLL_LOCKED",
            message=f"Cannot {action} once poll is {poll.status}",
            status=409,
        )


def _value(source: object, key: str, default=None):
    if isinstance(source, dict):
        return source.get(key, default)
    return getattr(source, key, default)


def _create_option_from_input(nomination: Nomination, payload: object, index: int) -> Option:
    title = _value(payload, "title")
    if not title:
        raise VotingServiceError(code="OPTION_TITLE_REQUIRED", message="Option title is required", status=400)
    option = Option.objects.create(
        nomination=nomination,
        tenant_id=nomination.tenant_id,
        title=title,
        description=_value(payload, "description", "") or "",
        media_url=_value(payload, "media_url", "") or "",
        game_id=_value(payload, "game_id"),
        sort_order=_value(payload, "sort_order", index) or index,
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )
    metrics.OPTIONS_CREATED.labels(tenant=str(nomination.tenant_id), poll=str(nomination.poll_id)).inc()
    return option


def _create_nomination_from_input(poll: Poll, payload: object, index: int) -> Nomination:
    title = _value(payload, "title")
    if not title:
        raise VotingServiceError(code="NOMINATION_TITLE_REQUIRED", message="Question title is required", status=400)
    nomination = Nomination.objects.create(
        poll=poll,
        tenant_id=poll.tenant_id,
        title=title,
        description=_value(payload, "description", "") or "",
        kind=_value(payload, "kind", NominationKind.CUSTOM) or NominationKind.CUSTOM,
        sort_order=_value(payload, "sort_order", index) or index,
        max_votes=_value(payload, "max_votes", 1) or 1,
        is_required=_value(payload, "is_required", False) or False,
        config=_value(payload, "config", {}) or {},
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )
    metrics.NOMINATIONS_CREATED.labels(tenant=str(poll.tenant_id), poll=str(poll.id)).inc()
    options = _value(payload, "options", []) or []
    for option_index, option_payload in enumerate(options):
        _create_option_from_input(nomination, option_payload, option_index)
    return nomination


def create_poll(
    *,
    tenant_id: str,
    user_id: str,
    payload: PollCreateIn,
) -> Poll:
    scope_id = payload.scope_id or tenant_id
    if payload.scope_type != PollScopeType.TENANT and not payload.scope_id:
        raise VotingServiceError(
            code="SCOPE_REQUIRED",
            message="Scope identifier is required for specialized polls",
            status=400,
        )

    template = get_template(payload.template) if payload.template else None
    base_settings = template.get("settings", {}) if template else {}
    merged_settings = {**base_settings, **(payload.settings or {})}

    poll = Poll.objects.create(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        title=payload.title,
        description=payload.description or "",
        status=payload.status,
        scope_type=payload.scope_type,
        scope_id=scope_id,
        visibility=payload.visibility,
        template=payload.template or "",
        allow_revoting=payload.allow_revoting,
        anonymous=payload.anonymous,
        results_visibility=payload.results_visibility,
        settings=merged_settings,
        created_by=user_id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
    )
    PollParticipant.objects.create(
        poll=poll,
        tenant_id=tenant_id,
        user_id=user_id,
        role=PollRole.OWNER,
    )
    PollInvite.objects.create(
        poll=poll,
        tenant_id=tenant_id,
        user_id=user_id,
        role=PollRole.OWNER,
        invited_by=user_id,
        status=PollInviteStatus.ACCEPTED,
    )
    metrics.POLLS_CREATED.labels(tenant=str(tenant_id), poll=str(poll.id)).inc()

    nomination_inputs: list[object] = []
    if template:
        nomination_inputs.extend(template.get("questions", []))
    if payload.nominations:
        nomination_inputs.extend(payload.nominations or [])

    for index, nomination_payload in enumerate(nomination_inputs):
        _create_nomination_from_input(poll, nomination_payload, index)

    return poll


def _validate_status_transition(poll: Poll, target_status: str) -> None:
    if poll.status == target_status:
        return
    if target_status == PollStatus.ACTIVE:
        if poll.status != PollStatus.DRAFT:
            raise VotingServiceError(
                code="INVALID_STATUS_TRANSITION",
                message="Poll already activated",
                status=400,
            )
        nominations = list(poll.nominations.all())
        if not nominations:
            raise VotingServiceError(
                code="NO_QUESTIONS",
                message="Poll needs at least one question",
                status=400,
            )
        for nomination in nominations:
            if not Option.objects.filter(nomination=nomination).exists():
                raise VotingServiceError(
                    code="NO_OPTIONS",
                    message=f"Question '{nomination.title}' must have options",
                    status=400,
                )
    elif target_status == PollStatus.CLOSED:
        if poll.status != PollStatus.ACTIVE:
            raise VotingServiceError(
                code="INVALID_STATUS_TRANSITION",
                message="Only active polls can be closed",
                status=400,
            )
    else:
        raise VotingServiceError(
            code="INVALID_STATUS",
            message="Cannot revert poll to a draft state",
            status=400,
        )


def update_poll(*, poll: Poll, payload: PollUpdateIn) -> Poll:
    updated = False
    if payload.title is not None:
        poll.title = payload.title
        updated = True
    if payload.description is not None:
        poll.description = payload.description
        updated = True
    if payload.visibility is not None:
        poll.visibility = payload.visibility
        updated = True
    if payload.allow_revoting is not None:
        poll.allow_revoting = payload.allow_revoting
        updated = True
    if payload.anonymous is not None:
        poll.anonymous = payload.anonymous
        updated = True
    if payload.results_visibility is not None:
        poll.results_visibility = payload.results_visibility
        updated = True
    if payload.settings is not None:
        poll.settings = payload.settings
        updated = True
    if payload.starts_at is not None:
        poll.starts_at = payload.starts_at
        updated = True
    if payload.ends_at is not None:
        poll.ends_at = payload.ends_at
        updated = True
    if payload.status is not None and payload.status != poll.status:
        _validate_status_transition(poll, payload.status)
        poll.status = payload.status
        updated = True
    if updated:
        poll.save()
    return poll


def delete_poll(*, poll: Poll) -> None:
    _ensure_poll_draft(poll, action="delete this poll")
    poll.delete()


def create_nomination(*, poll: Poll, payload: NominationIn) -> Nomination:
    _ensure_poll_draft(poll, action="add questions")
    return _create_nomination_from_input(poll, payload, index=Nomination.objects.filter(poll=poll).count())


def update_nomination(*, nomination: Nomination, payload: NominationUpdateIn) -> Nomination:
    _ensure_poll_draft(nomination.poll, action="edit questions")
    if payload.title is not None:
        nomination.title = payload.title
    if payload.description is not None:
        nomination.description = payload.description
    if payload.kind is not None:
        nomination.kind = payload.kind
    if payload.sort_order is not None:
        nomination.sort_order = payload.sort_order
    if payload.max_votes is not None:
        nomination.max_votes = payload.max_votes
    if payload.is_required is not None:
        nomination.is_required = payload.is_required
    if payload.config is not None:
        nomination.config = payload.config
    nomination.save()
    return nomination


def delete_nomination(*, nomination: Nomination) -> None:
    _ensure_poll_draft(nomination.poll, action="remove questions")
    if Vote.objects.filter(nomination=nomination).exists():
        raise VotingServiceError(
            code="NOMINATION_HAS_VOTES",
            message="Cannot remove a question with recorded votes",
            status=409,
        )
    nomination.delete()


def create_option(*, nomination: Nomination, payload: OptionIn) -> Option:
    _ensure_poll_draft(nomination.poll, action="add options")
    return _create_option_from_input(nomination, payload, index=Option.objects.filter(nomination=nomination).count())


def update_option(*, option: Option, payload: OptionUpdateIn) -> Option:
    _ensure_poll_draft(option.nomination.poll, action="edit options")
    if payload.title is not None:
        option.title = payload.title
    if payload.description is not None:
        option.description = payload.description
    if payload.media_url is not None:
        option.media_url = payload.media_url
    if payload.game_id is not None:
        option.game_id = payload.game_id
    if payload.sort_order is not None:
        option.sort_order = payload.sort_order
    option.save()
    return option


def delete_option(*, option: Option) -> None:
    _ensure_poll_draft(option.nomination.poll, action="remove options")
    if Vote.objects.filter(option=option).exists():
        raise VotingServiceError(
            code="OPTION_HAS_VOTES",
            message="Cannot remove an option with votes",
            status=409,
        )
    option.delete()
