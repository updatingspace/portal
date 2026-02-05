from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone as dt_timezone
from typing import Any, cast

from django.db.models import Count
from django.http import HttpResponse, JsonResponse
from django.utils import timezone as dj_timezone
from django.utils.timezone import is_naive, make_aware
from ninja import NinjaAPI, Query, Router
from ninja.errors import HttpError

from .context import InternalContext, require_internal_context
from .models import Event, RSVP, RSVPStatus
from .permissions import has_permission, has_scope_membership
from .portal_client import PortalServiceUnavailable, portal_client
from .schemas import AttendanceMarkIn, EventCreateIn, EventListOut, EventOut, EventUpdateIn, RsvpSetIn
from .service import create_event, mark_attendance, set_rsvp, update_event

logger = logging.getLogger(__name__)

api = NinjaAPI(title="UpdSpace Events", version="1", urls_namespace="events")
router = Router(tags=["events"])


# =========================
# Common helpers
# =========================
def _to_aware(dt: datetime) -> datetime:
    if is_naive(dt):
        return make_aware(dt)
    return dt


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


@api.exception_handler(HttpError)
def on_http_error(request, exc: HttpError):
    status = getattr(exc, "status_code", 500)
    detail = getattr(exc, "message", None)
    if isinstance(detail, dict):
        code = str(detail.get("code") or "HTTP_ERROR")
        msg = str(detail.get("message") or "Request failed")
        raw_details = detail.get("details")
        details = raw_details if isinstance(raw_details, dict) else {}
        return _error_response(request, status=status, code=code, message=msg, details=details)
    msg = str(detail) if detail else "Request failed"
    return _error_response(request, status=status, code="HTTP_ERROR", message=msg)


def _parse_uuid(value: str, *, code: str, message: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except Exception as exc:
        raise HttpError(400, cast(Any, {"code": code, "message": message})) from exc


def _parse_iso_datetime(value: str, *, code: str, message: str) -> datetime:
    try:
        return _to_aware(datetime.fromisoformat(value))
    except Exception as exc:
        raise HttpError(400, cast(Any, {"code": code, "message": message})) from exc


def _require_perm_ctx(ctx: InternalContext, permission_key: str, scope_type: str, scope_id: str):
    if not has_permission(
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        master_flags=ctx.master_flags,
        permission_key=permission_key,
        scope_type=scope_type,
        scope_id=scope_id,
        request_id=ctx.request_id,
    ):
        raise HttpError(403, cast(Any, {"code": "FORBIDDEN", "message": "Permission denied"}))


def _get_event_or_404(ctx: InternalContext, event_id: str) -> Event:
    event_uuid = _parse_uuid(event_id, code="INVALID_EVENT_ID", message="Invalid event id")
    event = Event.objects.filter(id=event_uuid, tenant_id=ctx.tenant_id).first()
    if not event:
        raise HttpError(404, cast(Any, {"code": "NOT_FOUND", "message": "Event not found"}))
    return event


def _empty_rsvp_counts() -> dict[str, int]:
    return {choice.value: 0 for choice in RSVPStatus}


def _to_camel_key(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


def _camelize_keys(payload: dict[str, Any]) -> dict[str, Any]:
    return {_to_camel_key(key): value for key, value in payload.items()}


def _format_event(
    event: Event,
    *,
    rsvp_counts: dict[str, int] | None = None,
    my_rsvp: str | None = None,
) -> dict[str, Any]:
    counts = _empty_rsvp_counts()
    if rsvp_counts:
        counts.update(rsvp_counts)

    event_out = EventOut(
        id=str(event.id),
        tenant_id=str(event.tenant_id),
        scope_type=event.scope_type,
        scope_id=event.scope_id,
        title=event.title,
        description=event.description or None,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        location_text=event.location_text or None,
        location_url=event.location_url,
        game_id=event.game_id,
        visibility=event.visibility,
        created_by=str(event.created_by),
        created_at=event.created_at,
        rsvp_counts=counts,
        my_rsvp=my_rsvp,
    )
    return _camelize_keys(event_out.model_dump())


def _event_visible_for_user(event: Event, *, ctx: InternalContext) -> bool:
    tenant_id = ctx.tenant_id
    tenant_slug = ctx.tenant_slug
    request_id = ctx.request_id
    user_id = ctx.user_id
    master_flags = ctx.master_flags

    if str(event.tenant_id) != str(tenant_id):
        return False

    if event.visibility == "public":
        return True

    if event.visibility == "private":
        return str(event.created_by) == str(user_id)

    if event.visibility == "community" and event.scope_type == "COMMUNITY":
        try:
            if portal_client.is_community_member(ctx, str(event.scope_id)):
                return True
        except PortalServiceUnavailable as exc:
            logger.warning(
                "Portal membership lookup failed",
                extra={
                    "tenant_id": tenant_id,
                    "community_id": str(event.scope_id),
                    "request_id": request_id,
                    "error": str(exc),
                },
            )
        return has_scope_membership(
            tenant_id=tenant_id,
            tenant_slug=tenant_slug,
            user_id=user_id,
            scope_type="COMMUNITY",
            scope_id=event.scope_id,
            request_id=request_id,
        )

    if event.visibility == "team" and event.scope_type == "TEAM":
        try:
            if portal_client.is_team_member(ctx, str(event.scope_id)):
                return True
        except PortalServiceUnavailable as exc:
            logger.warning(
                "Portal membership lookup failed",
                extra={
                    "tenant_id": tenant_id,
                    "team_id": str(event.scope_id),
                    "request_id": request_id,
                    "error": str(exc),
                },
            )
        return has_scope_membership(
            tenant_id=tenant_id,
            tenant_slug=tenant_slug,
            user_id=user_id,
            scope_type="TEAM",
            scope_id=event.scope_id,
            request_id=request_id,
        )

    return has_permission(
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
        user_id=user_id,
        master_flags=master_flags,
        permission_key="events.event.read",
        scope_type=event.scope_type,
        scope_id=event.scope_id,
        request_id=request_id,
    )


def _get_rsvp_counts_map(*, ctx: InternalContext, event_ids: list[str]) -> dict[str, dict[str, int]]:
    if not event_ids:
        return {}

    counts_map: dict[str, dict[str, int]] = {}
    rows = (
        RSVP.objects.filter(tenant_id=ctx.tenant_id, event_id__in=event_ids)
        .values("event_id", "status")
        .annotate(count=Count("id"))
    )
    for row in rows:
        key = str(row["event_id"])
        counts_map.setdefault(key, _empty_rsvp_counts())
        counts_map[key][row["status"]] = row["count"]

    for eid in event_ids:
        counts_map.setdefault(eid, _empty_rsvp_counts())

    return counts_map


def _get_my_rsvp_map(*, ctx: InternalContext, event_ids: list[str]) -> dict[str, str]:
    if not event_ids:
        return {}

    my_rsvp_map: dict[str, str] = {}
    my_rows = (
        RSVP.objects.filter(
            tenant_id=ctx.tenant_id,
            event_id__in=event_ids,
            user_id=ctx.user_id,
        )
        .values("event_id", "status")
    )
    for row in my_rows:
        my_rsvp_map[str(row["event_id"])] = row["status"]
    return my_rsvp_map


# =========================
# ICS helpers (RFC5545)
# =========================
def _ics_escape_text(value: str) -> str:
    """
    RFC5545 TEXT escaping:
      - backslash -> \\,
      - semicolon -> \;,
      - comma -> \,,
      - newline -> \n
    """
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = value.replace("\\", "\\\\")
    value = value.replace(";", "\\;")
    value = value.replace(",", "\\,")
    value = value.replace("\n", "\\n")
    return value


def _ics_sanitize_uri(value: str) -> str:
    """
    URI fields (URL): не применяем TEXT escaping, но убираем CR/LF.
    """
    return value.replace("\r", "").replace("\n", "")


def _ics_fold_line(line: str, *, limit: int = 75) -> list[str]:
    """
    RFC5545 line folding: max 75 octets per line, continuation lines start with a single space.
    Считаем по UTF-8 octets и не режем посередине multibyte символов.
    """
    out: list[str] = []
    cur = ""
    cur_octets = 0

    for ch in line:
        ch_octets = len(ch.encode("utf-8"))
        if cur and (cur_octets + ch_octets) > limit:
            out.append(cur)
            cur = " " + ch
            cur_octets = 1 + ch_octets
        else:
            cur += ch
            cur_octets += ch_octets

    out.append(cur)
    return out


def _ics_render(lines: list[str]) -> str:
    folded: list[str] = []
    for line in lines:
        folded.extend(_ics_fold_line(line))
    return "\r\n".join(folded) + "\r\n"


# =========================
# Routes
# =========================
@router.get("/", response=EventListOut)
def list_events(
    request,
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None, alias="to"),
    scope_type: str | None = Query(None, alias="scope_type"),
    scope_id: str | None = Query(None, alias="scope_id"),
    limit: int = Query(100, ge=1, le=250),
    offset: int = Query(0, ge=0),
):
    ctx = require_internal_context(request)

    perm_scope_type = scope_type or "TENANT"
    perm_scope_id = scope_id or ctx.tenant_id
    _require_perm_ctx(ctx, "events.event.read", perm_scope_type, perm_scope_id)

    qs = Event.objects.filter(tenant_id=ctx.tenant_id)
    if scope_type and scope_id:
        qs = qs.filter(scope_type=scope_type, scope_id=scope_id)

    if from_:
        dt_from = _parse_iso_datetime(from_, code="INVALID_FROM", message="from must be ISO datetime")
        qs = qs.filter(ends_at__gte=dt_from)

    if to:
        dt_to = _parse_iso_datetime(to, code="INVALID_TO", message="to must be ISO datetime")
        qs = qs.filter(starts_at__lte=dt_to)

    total = qs.count()

    events = list(qs.order_by("starts_at", "id")[offset : offset + limit])
    visible = [e for e in events if _event_visible_for_user(e, ctx=ctx)]

    event_ids = [str(e.id) for e in visible]
    counts_map = _get_rsvp_counts_map(ctx=ctx, event_ids=event_ids)
    my_rsvp_map = _get_my_rsvp_map(ctx=ctx, event_ids=event_ids)

    items = [
        _format_event(e, rsvp_counts=counts_map[str(e.id)], my_rsvp=my_rsvp_map.get(str(e.id)))
        for e in visible
    ]

    return JsonResponse(
        {
            "items": items,
            "meta": {"total": total, "limit": limit, "offset": offset},
        }
    )


@router.post("/", response=EventOut)
def create_event_api(request, payload: EventCreateIn):
    ctx = require_internal_context(request)
    _require_perm_ctx(ctx, "events.event.create", payload.scope_type, payload.scope_id)

    if payload.starts_at >= payload.ends_at:
        raise HttpError(
            400,
            cast(
                Any,
                {"code": "INVALID_TIME_RANGE", "message": "starts_at must be before ends_at"},
            ),
        )

    event = create_event(
        tenant_id=uuid.UUID(ctx.tenant_id),
        created_by=uuid.UUID(ctx.user_id),
        data=payload.model_dump(by_alias=False),
    )

    return JsonResponse(_format_event(event, rsvp_counts=_empty_rsvp_counts(), my_rsvp=None))


@router.get("/{event_id}", response=EventOut)
def get_event(request, event_id: str):
    ctx = require_internal_context(request)
    event = _get_event_or_404(ctx, event_id)

    _require_perm_ctx(ctx, "events.event.read", event.scope_type, event.scope_id)

    if not _event_visible_for_user(event, ctx=ctx):
        raise HttpError(404, cast(Any, {"code": "NOT_FOUND", "message": "Event not found"}))

    counts = _empty_rsvp_counts()
    for row in (
        RSVP.objects.filter(tenant_id=ctx.tenant_id, event=event)
        .values("status")
        .annotate(count=Count("id"))
    ):
        counts[row["status"]] = row["count"]

    my_rsvp = (
        RSVP.objects.filter(tenant_id=ctx.tenant_id, event=event, user_id=ctx.user_id)
        .values_list("status", flat=True)
        .first()
    )

    return JsonResponse(_format_event(event, rsvp_counts=counts, my_rsvp=my_rsvp))


@router.patch("/{event_id}", response=EventOut)
def update_event_api(request, event_id: str, payload: EventUpdateIn):
    ctx = require_internal_context(request)
    event = _get_event_or_404(ctx, event_id)

    _require_perm_ctx(ctx, "events.event.manage", event.scope_type, event.scope_id)

    data = payload.model_dump(exclude_unset=True, by_alias=False)
    if not data:
        raise HttpError(
            400,
            cast(Any, {"code": "NO_UPDATES", "message": "Provide at least one editable field"}),
        )

    start = _to_aware(data.get("starts_at", event.starts_at))
    end = _to_aware(data.get("ends_at", event.ends_at))
    if start >= end:
        raise HttpError(
            400,
            cast(Any, {"code": "INVALID_TIME_RANGE", "message": "starts_at must be before ends_at"}),
        )

    if "starts_at" in data:
        data["starts_at"] = start
    if "ends_at" in data:
        data["ends_at"] = end

    updated = update_event(event=event, data=data)

    counts = _empty_rsvp_counts()
    for row in (
        RSVP.objects.filter(tenant_id=ctx.tenant_id, event=updated)
        .values("status")
        .annotate(count=Count("id"))
    ):
        counts[row["status"]] = row["count"]

    my_rsvp = (
        RSVP.objects.filter(tenant_id=ctx.tenant_id, event=updated, user_id=ctx.user_id)
        .values_list("status", flat=True)
        .first()
    )

    return JsonResponse(_format_event(updated, rsvp_counts=counts, my_rsvp=my_rsvp))


@router.post("/{event_id}/rsvp")
def set_event_rsvp(request, event_id: str, payload: RsvpSetIn):
    ctx = require_internal_context(request)
    event = _get_event_or_404(ctx, event_id)

    _require_perm_ctx(ctx, "events.rsvp.set", event.scope_type, event.scope_id)

    set_rsvp(
        tenant_id=uuid.UUID(ctx.tenant_id),
        event=event,
        user_id=uuid.UUID(ctx.user_id),
        status=payload.status,
    )
    return HttpResponse(status=204)


@router.post("/{event_id}/attendance")
def mark_event_attendance(request, event_id: str, payload: AttendanceMarkIn):
    ctx = require_internal_context(request)
    event = _get_event_or_404(ctx, event_id)

    _require_perm_ctx(ctx, "events.attendance.mark", event.scope_type, event.scope_id)

    target_user = _parse_uuid(
        str(payload.user_id),
        code="INVALID_USER_ID",
        message="user_id must be a UUID",
    )

    mark_attendance(
        tenant_id=uuid.UUID(ctx.tenant_id),
        event=event,
        user_id=target_user,
        marked_by=uuid.UUID(ctx.user_id),
    )
    return HttpResponse(status=204)


@router.get("/{event_id}/ics")
def event_ics(request, event_id: str):
    ctx = require_internal_context(request)
    event = _get_event_or_404(ctx, event_id)

    _require_perm_ctx(ctx, "events.event.read", event.scope_type, event.scope_id)

    if not _event_visible_for_user(event, ctx=ctx):
        raise HttpError(404, cast(Any, {"code": "NOT_FOUND", "message": "Event not found"}))

    def fmt(dt: datetime) -> str:
        dt = _to_aware(dt)
        dt = dt.astimezone(dt_timezone.utc)
        return dt.strftime("%Y%m%dT%H%M%SZ")

    uid = f"{event.id}@{ctx.tenant_slug}.updspace"

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//UpdSpace//Events//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{fmt(dj_timezone.now())}",
        f"DTSTART:{fmt(event.starts_at)}",
        f"DTEND:{fmt(event.ends_at)}",
        f"SUMMARY:{_ics_escape_text(event.title)}",
    ]
    if event.description:
        lines.append(f"DESCRIPTION:{_ics_escape_text(event.description)}")
    if event.location_text:
        lines.append(f"LOCATION:{_ics_escape_text(event.location_text)}")
    if event.location_url:
        lines.append(f"URL:{_ics_sanitize_uri(event.location_url)}")

    lines += ["END:VEVENT", "END:VCALENDAR"]

    body = _ics_render(lines)
    resp = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    resp["Content-Disposition"] = f"attachment; filename=event-{event.id}.ics"
    return resp


api.add_router("/events", router)
