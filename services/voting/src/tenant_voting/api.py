import uuid
import hashlib
import hmac
import json
import time
from typing import Any, cast

import httpx
from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from ninja import Router
# events.models.OutboxMessage import removed (moved to services)

from .context import InternalContext, require_internal_context
from .models import (
    Nomination,
    Option,
    Poll,
    PollInvite,
    PollInviteStatus,
    PollRole,
    PollScopeType,
    PollStatus,
    Vote,
)
from . import services
from .schemas import (
    NominationIn,
    NominationOut,
    NominationUpdateIn,
    OptionIn,
    OptionOut,
    OptionUpdateIn,
    PaginatedPollsOut,
    PaginationMeta,
    ParticipantIn,
    ParticipantOut,
    PollCreateIn,
    PollOut,
    PollResultsOut,
    PollTemplateOut,
    PollUpdateIn,
    VoteCastIn,
    VoteOut,
)
from .templates import get_templates


router = Router(tags=["Voting"])


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data or b"").hexdigest()


def _internal_hmac_headers(*, method: str, path: str, body: bytes, request_id: str) -> dict[str, str]:
    ts = str(int(time.time()))
    secret = getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "")
    if not secret:
        raise RuntimeError("BFF_INTERNAL_HMAC_SECRET is not configured")
    msg = "\n".join([method.upper(), path, _sha256_hex(body), request_id, ts]).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), msg, digestmod=hashlib.sha256).hexdigest()
    return {
        "X-Updspace-Timestamp": ts,
        "X-Updspace-Signature": sig,
    }


def _error_response(
    request,
    *,
    status: int,
    code: str,
    message: str,
    details: dict | None = None,
):
    request_id = request.headers.get("X-Request-Id")
    return JsonResponse(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": request_id,
            }
        },
        status=status,
    )

def _access_check_allowed(
    *,
    tenant_id: str,
    tenant_slug: str,
    user_id: str,
    request_id: str,
    master_flags: dict,
    action: str,
    scope_type: str,
    scope_id: str,
) -> bool:
    base_url = str(getattr(settings, "ACCESS_BASE_URL", "http://access:8002/api/v1")).rstrip("/")
    path = "/api/v1/access/check"
    url = f"{base_url}/access/check"

    payload = {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "action": action,
        "scope": {"type": scope_type, "id": scope_id},
        "master_flags": {
            "suspended": bool(master_flags.get("suspended", False)),
            "banned": bool(master_flags.get("banned", False)),
            "system_admin": bool(master_flags.get("system_admin", False)),
            "membership_status": master_flags.get("membership_status"),
        },
    }
    body = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")

    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "X-Request-Id": request_id,
        "X-Tenant-Id": str(tenant_id),
        "X-Tenant-Slug": str(tenant_slug),
        "X-User-Id": str(user_id),
        "X-Master-Flags": json.dumps(master_flags, separators=(",", ":"), default=str),
    }
    headers.update(_internal_hmac_headers(method="POST", path=path, body=body, request_id=request_id))

    try:
        resp = httpx.post(url, content=body, headers=headers, timeout=5.0)
    except Exception:
        return False

    if resp.status_code != 200:
        return False
    try:
        data = resp.json()
    except Exception:
        return False
    return bool(data.get("allowed"))


def _scope_for_poll(poll: Poll, *, tenant_id: str) -> tuple[str, str]:
    if poll.scope_type in {
        PollScopeType.TENANT,
        PollScopeType.COMMUNITY,
        PollScopeType.TEAM,
    }:
        return poll.scope_type, str(poll.scope_id)
    # EVENT/POST are not first-class RBAC scopes in MVP -> fallback to tenant
    return "TENANT", str(tenant_id)


def _poll_visible(
    poll: Poll,
    *,
    request_id: str,
    tenant_id: str,
    tenant_slug: str,
    user_id: str,
    master_flags: dict,
    permission_key: str,
) -> bool:
    if str(poll.tenant_id) != str(tenant_id):
        return False

    scope_type, scope_id = _scope_for_poll(poll, tenant_id=tenant_id)

    allowed = _access_check_allowed(
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
        user_id=user_id,
        request_id=request_id,
        master_flags=master_flags,
        action=permission_key,
        scope_type=scope_type,
        scope_id=scope_id,
    )
    if not allowed:
        return False

    user_role = services.get_user_role(poll, user_id)
    if poll.visibility == "public":
        return True

    if poll.visibility == "private":
        return user_role is not None

    if poll.visibility == "community" and (
        poll.scope_type == PollScopeType.COMMUNITY
    ):
        return True

    if poll.visibility == "team" and (poll.scope_type == PollScopeType.TEAM):
        return True

    return False


def _require_poll(
    request,
    ctx: InternalContext,
    poll_id: uuid.UUID,
    permission_key: str = "voting.poll.read",
):
    try:
        poll = Poll.objects.get(id=poll_id, tenant_id=ctx.tenant_id)
    except Poll.DoesNotExist:
        return _error_response(
            request, status=404, code="NOT_FOUND", message="Poll not found"
        )

    if not _poll_visible(
        poll,
        request_id=ctx.request_id,
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        master_flags=ctx.master_flags,
        permission_key=permission_key,
    ):
        return _error_response(
            request, status=403, code="FORBIDDEN", message="Permission denied"
        )
    return poll


def _is_global_admin(ctx: InternalContext) -> bool:
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


def _can_manage_poll(ctx: InternalContext, poll: Poll) -> bool:
    if str(poll.created_by) == ctx.user_id:
        return True
    role = services.get_user_role(poll, ctx.user_id)
    if role in {PollRole.OWNER, PollRole.ADMIN}:
        return True
    return _is_global_admin(ctx)


def _require_nomination(
    request, poll: Poll, nomination_id: uuid.UUID
) -> Nomination | JsonResponse:
    try:
        return Nomination.objects.get(id=nomination_id, poll=poll)
    except Nomination.DoesNotExist:
        return _error_response(
            request,
            status=404,
            code="NOMINATION_NOT_FOUND",
            message="Nomination not found",
        )


def _require_option(
    request, poll: Poll, option_id: uuid.UUID
) -> Option | JsonResponse:
    try:
        return Option.objects.get(id=option_id, nomination__poll=poll)
    except Option.DoesNotExist:
        return _error_response(
            request,
            status=404,
            code="OPTION_NOT_FOUND",
            message="Option not found",
        )


@router.get("/polls", response={200: PaginatedPollsOut})
def list_polls(
    request,
    scope_type: str = "TENANT",
    scope_id: str | None = None,
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    """
    List polls with pagination.
    
    Args:
        scope_type: Filter by scope type (TENANT, COMMUNITY, TEAM, EVENT, POST)
        scope_id: Filter by scope ID (defaults to tenant_id)
        status: Filter by poll status (draft, active, closed)
        limit: Maximum number of results (1-100, default 20)
        offset: Number of results to skip (default 0)
    
    Returns:
        Paginated list of polls with metadata
    """
    ctx = require_internal_context(request)
    if scope_id is None:
        scope_id = ctx.tenant_id
    
    # Clamp limit to reasonable bounds
    limit = max(1, min(100, limit))
    offset = max(0, offset)

    # Filter permissions check based on requested scope
    perm_scope_type = scope_type
    perm_scope_id = scope_id
    if perm_scope_type not in {"TENANT", "COMMUNITY", "TEAM"}:
        perm_scope_type = "TENANT"
        perm_scope_id = ctx.tenant_id

    if not _access_check_allowed(
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        request_id=ctx.request_id,
        master_flags=ctx.master_flags,
        action="voting.poll.read",
        scope_type=perm_scope_type,
        scope_id=perm_scope_id,
    ):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )

    # Build base query
    queryset = Poll.objects.filter(
        tenant_id=ctx.tenant_id,
        scope_type=scope_type,
        scope_id=scope_id,
    )
    
    # Apply status filter if provided
    if status:
        queryset = queryset.filter(status=status)
    
    polls = list(
        queryset.order_by("-created_at", "id")
    )

    # Filter visibility per poll
    visible_polls = []
    for p in polls:
        if _poll_visible(
            p,
            request_id=ctx.request_id,
            tenant_id=ctx.tenant_id,
            tenant_slug=ctx.tenant_slug,
            user_id=ctx.user_id,
            master_flags=ctx.master_flags,
            permission_key="voting.poll.read",
        ):
            visible_polls.append(p)

    # Calculate pagination
    total = len(visible_polls)
    paginated_polls = visible_polls[offset:offset + limit]
    
    items = [
        PollOut(
            id=p.id,
            tenant_id=p.tenant_id,
            scope_type=p.scope_type,
            scope_id=p.scope_id,
            title=p.title,
            status=p.status,
            visibility=p.visibility,
            created_by=p.created_by,
            starts_at=p.starts_at,
            ends_at=p.ends_at,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in paginated_polls
    ]
    
    return PaginatedPollsOut(
        items=items,
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_next=offset + limit < total,
            has_prev=offset > 0,
        ),
    )


@router.post("/polls", response={201: PollOut})
def create_poll(request, payload: PollCreateIn):
    ctx = require_internal_context(request)
    if not _access_check_allowed(
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        request_id=ctx.request_id,
        master_flags=ctx.master_flags,
        action="voting.poll.read",
        scope_type="TENANT",
        scope_id=ctx.tenant_id,
    ):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )
    try:
        poll = services.create_poll(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            payload=payload,
        )
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return PollOut.from_orm(poll)


@router.get("/polls/templates", response=list[PollTemplateOut])
def list_templates(request):
    require_internal_context(request)
    return get_templates()


@router.get("/polls/{poll_id}", response={200: PollOut})
def get_poll(request, poll_id: uuid.UUID):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    p = poll_or_err

    return PollOut(
        id=p.id,
        tenant_id=p.tenant_id,
        scope_type=p.scope_type,
        scope_id=p.scope_id,
        title=p.title,
        status=p.status,
        visibility=p.visibility,
        created_by=p.created_by,
        starts_at=p.starts_at,
        ends_at=p.ends_at,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@router.put("/polls/{poll_id}", response={200: PollOut})
def update_poll(request, poll_id: uuid.UUID, payload: PollUpdateIn):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err
    if not _can_manage_poll(ctx, poll):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )
    try:
        updated = services.update_poll(poll=poll, payload=payload)
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return PollOut.from_orm(updated)


@router.delete("/polls/{poll_id}")
def delete_poll(request, poll_id: uuid.UUID):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err
    if not _can_manage_poll(ctx, poll):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )
    try:
        services.delete_poll(poll=poll)
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return {"ok": True}


@router.get("/polls/{poll_id}/info", response={200: dict})
def get_poll_info(request, poll_id: uuid.UUID):
    ctx = require_internal_context(request)
    # Check general visibility
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err

    # Load nominations & options
    nominations = list(poll.nominations.all())
    options = list(Option.objects.filter(nomination__poll=poll))

    # Check already voted
    # If user has voted in this poll
    user_votes = Vote.objects.filter(
        tenant_id=ctx.tenant_id,
        poll=poll,
        user_id=ctx.user_id,
    )
    has_voted = user_votes.exists()

    return {
        "poll": PollOut.from_orm(poll),
        "nominations": [NominationOut.from_orm(n) for n in nominations],
        "options": [OptionOut.from_orm(o) for o in options],
        "meta": {
            "has_voted": has_voted,
            "can_vote": (
                poll.status == PollStatus.ACTIVE
                and not has_voted
                and (poll.ends_at is None or poll.ends_at > timezone.now())
            ),
        },
    }


@router.post("/polls/{poll_id}/nominations", response={201: NominationOut})
def add_nomination(request, poll_id: uuid.UUID, payload: NominationIn):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err
    if not _can_manage_poll(ctx, poll):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )
    try:
        nomination = services.create_nomination(poll=poll, payload=payload)
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return NominationOut.from_orm(nomination)


@router.put("/polls/{poll_id}/nominations/{nomination_id}", response={200: NominationOut})
def update_nomination(request, poll_id: uuid.UUID, nomination_id: uuid.UUID, payload: NominationUpdateIn):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err
    if not _can_manage_poll(ctx, poll):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )
    nomination_or_err = _require_nomination(request, poll, nomination_id)
    if isinstance(nomination_or_err, JsonResponse):
        return nomination_or_err
    nomination = nomination_or_err
    try:
        updated = services.update_nomination(nomination=nomination, payload=payload)
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return NominationOut.from_orm(updated)


@router.delete("/polls/{poll_id}/nominations/{nomination_id}")
def delete_nomination(request, poll_id: uuid.UUID, nomination_id: uuid.UUID):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err
    if not _can_manage_poll(ctx, poll):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )
    nomination_or_err = _require_nomination(request, poll, nomination_id)
    if isinstance(nomination_or_err, JsonResponse):
        return nomination_or_err
    nomination = nomination_or_err
    try:
        services.delete_nomination(nomination=nomination)
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return {"ok": True}


@router.post("/polls/{poll_id}/nominations/{nomination_id}/options", response={201: OptionOut})
def add_option(
    request,
    poll_id: uuid.UUID,
    nomination_id: uuid.UUID,
    payload: OptionIn,
):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err
    if not _can_manage_poll(ctx, poll):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )
    nomination_or_err = _require_nomination(request, poll, nomination_id)
    if isinstance(nomination_or_err, JsonResponse):
        return nomination_or_err
    nomination = nomination_or_err
    try:
        option = services.create_option(nomination=nomination, payload=payload)
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return OptionOut.from_orm(option)


@router.put("/polls/{poll_id}/options/{option_id}", response={200: OptionOut})
def update_option(request, poll_id: uuid.UUID, option_id: uuid.UUID, payload: OptionUpdateIn):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err
    if not _can_manage_poll(ctx, poll):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )
    option_or_err = _require_option(request, poll, option_id)
    if isinstance(option_or_err, JsonResponse):
        return option_or_err
    option = option_or_err
    try:
        updated = services.update_option(option=option, payload=payload)
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return OptionOut.from_orm(updated)


@router.delete("/polls/{poll_id}/options/{option_id}")
def delete_option(request, poll_id: uuid.UUID, option_id: uuid.UUID):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err
    if not _can_manage_poll(ctx, poll):
        return _error_response(
            request,
            status=403,
            code="FORBIDDEN",
            message="Permission denied",
        )
    option_or_err = _require_option(request, poll, option_id)
    if isinstance(option_or_err, JsonResponse):
        return option_or_err
    option = option_or_err
    try:
        services.delete_option(option=option)
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return {"ok": True}


@router.post("/votes", response={201: VoteCastIn})
def cast_vote(request, payload: VoteCastIn):
    try:
        ctx = require_internal_context(request)
        poll_or_err = _require_poll(
            request,
            ctx,
            payload.poll_id,
            permission_key="voting.vote.cast",
        )
        if isinstance(poll_or_err, JsonResponse):
            return poll_or_err
        poll = poll_or_err

        services.cast_vote(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            poll=poll,
            nomination_id=payload.nomination_id,
            option_id=payload.option_id,
        )
        
        return payload

    except services.VotingServiceError as e:
        return _error_response(
            request,
            status=e.status,
            code=e.code,
            message=e.message,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e


@router.delete("/votes/{vote_id}")
def remove_vote(request, vote_id: uuid.UUID):
    ctx = require_internal_context(request)

    try:
        vote = Vote.objects.select_related("poll").get(
            id=vote_id,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
        )
    except Vote.DoesNotExist:
        return _error_response(
            request,
            status=404,
            code="NOT_FOUND",
            message="Vote not found",
        )
    poll = vote.poll
    poll_or_err = _require_poll(
        request,
        ctx,
        poll.id,
        permission_key="voting.vote.cast",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err

    try:
        services.delete_vote(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            vote_id=vote_id,
        )
    except services.VotingServiceError as e:
        return _error_response(
            request,
            status=e.status,
            code=e.code,
            message=e.message,
        )
    return {"ok": True}


@router.get("/polls/{poll_id}/votes/me", response={200: list[VoteOut]})
def get_my_votes(request, poll_id: uuid.UUID):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.vote.read_own",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err

    votes = Vote.objects.filter(
        tenant_id=ctx.tenant_id,
        poll=poll,
        user_id=ctx.user_id,
    )
    return [
        VoteOut(
            id=v.id,
            poll_id=v.poll_id,
            nomination_id=v.nomination_id,
            option_id=v.option_id,
            user_id=v.user_id,
            created_at=v.created_at,
        )
        for v in votes
    ]


@router.get("/polls/{poll_id}/results", response={200: PollResultsOut})
def get_results(request, poll_id: uuid.UUID):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.results.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err

    if not services.can_view_results(poll, ctx.user_id):
        return _error_response(
            request,
            status=403,
            code="RESULTS_HIDDEN",
            message="Results are not visible yet",
        )

    # Visibility gating for results (in addition to permission)
    if poll.visibility in {"community", "team"}:
        if poll.visibility == "community" and (
            poll.scope_type == PollScopeType.COMMUNITY
        ):
            if not _access_check_allowed(
                tenant_id=ctx.tenant_id,
                tenant_slug=ctx.tenant_slug,
                user_id=ctx.user_id,
                request_id=ctx.request_id,
                master_flags=ctx.master_flags,
                action="voting.poll.read",
                scope_type="COMMUNITY",
                scope_id=str(poll.scope_id),
            ):
                return _error_response(
                    request,
                    status=403,
                    code="FORBIDDEN",
                    message="Results not visible",
                )
        if poll.visibility == "team" and poll.scope_type == PollScopeType.TEAM:
            if not _access_check_allowed(
                tenant_id=ctx.tenant_id,
                tenant_slug=ctx.tenant_slug,
                user_id=ctx.user_id,
                request_id=ctx.request_id,
                master_flags=ctx.master_flags,
                action="voting.poll.read",
                scope_type="TEAM",
                scope_id=str(poll.scope_id),
            ):
                return _error_response(
                    request,
                    status=403,
                    code="FORBIDDEN",
                    message="Results not visible",
                )

    # Aggregate votes per option per nomination
    return services.get_poll_results(poll)


@router.get("/polls/{poll_id}/participants", response=list[ParticipantOut])
def poll_participants(request, poll_id: uuid.UUID):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err

    invites = {
        invite.user_id: invite
        for invite in PollInvite.objects.filter(poll=poll)
    }

    participants = services.list_participants(poll)
    result = []
    for participant in participants:
        invite = invites.get(participant.user_id)
        result.append(
            ParticipantOut(
                user_id=participant.user_id,
                role=participant.role,
                invited_by=invite.invited_by if invite else poll.created_by,
                status=invite.status if invite else PollInviteStatus.ACCEPTED,
            )
        )
    return result


@router.post("/polls/{poll_id}/participants", response=ParticipantOut)
def add_participant(request, poll_id: uuid.UUID, payload: ParticipantIn):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err

    try:
        participant = services.assign_participant_role(
            poll=poll,
            actor_id=ctx.user_id,
            user_id=str(payload.user_id),
            role=payload.role,
        )
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )

    invite = PollInvite.objects.filter(poll=poll, user_id=participant.user_id).first()
    return ParticipantOut(
        user_id=participant.user_id,
        role=participant.role,
        invited_by=invite.invited_by if invite else ctx.user_id,
        status=invite.status if invite else PollInviteStatus.ACCEPTED,
    )


@router.delete("/polls/{poll_id}/participants/{user_id}")
def remove_participant(request, poll_id: uuid.UUID, user_id: uuid.UUID):
    ctx = require_internal_context(request)
    poll_or_err = _require_poll(
        request,
        ctx,
        poll_id,
        permission_key="voting.poll.read",
    )
    if isinstance(poll_or_err, JsonResponse):
        return poll_or_err
    poll = poll_or_err

    try:
        services.remove_participant(
            poll=poll,
            actor_id=ctx.user_id,
            user_id=str(user_id),
        )
    except services.VotingServiceError as exc:
        return _error_response(
            request,
            status=exc.status,
            code=exc.code,
            message=exc.message,
        )
    return {"ok": True}
