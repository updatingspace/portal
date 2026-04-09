from __future__ import annotations

import json
import time
import uuid
from datetime import datetime
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db import models, transaction
from django.http import FileResponse, HttpResponse, JsonResponse
from django.utils import timezone
from django.core import signing
from ninja import Body, Router
from ninja.errors import HttpError

from activity import schemas
from activity.connectors import install_connectors
from activity.context import require_activity_context
from activity.dsar import erase_user_data, export_user_data
from activity.enums import NewsStatus, ScopeType, Visibility
from activity.audit import log_audit_event as _log_audit
from activity.models import (
    AccountLink,
    ActivityEvent,
    NewsComment,
    NewsCommentReaction,
    NewsPost,
    NewsPostView,
    NewsReaction,
    Source,
    Subscription,
    uuid_from_str,
)
from activity.permissions import Permissions, has_permission, require_permission
from activity.portal_client import portal_client
from activity.privacy import mask_for_api, mask_identifier
from activity.media import (
    build_news_media_key,
    load_local_media_file,
    parse_local_download_token,
    parse_local_upload_token,
    save_local_media_file,
    generate_download_url,
    generate_upload_url,
    is_news_media_key_allowed,
    normalize_media_payload,
    sanitize_tags,
)
from activity.services import (
    FeedFilters,
    create_account_link,
    create_game,
    list_feed,
    list_feed_paginated,
    list_games,
    list_sources,
    minecraft_webhook_secret,
    parse_csv,
    run_sync,
    upsert_subscription,
    verify_hmac_signature,
    ingest_raw_and_normalize,
    require_not_suspended,
    get_unread_count_cached,
    get_unread_count_fresh,
    publish_outbox_event,
    update_last_seen,
)
from core.schemas import ErrorOut
from core.errors import error_payload

router = Router(tags=["Activity"], auth=None)
REQUIRED_BODY = Body(...)

SYSTEM_USER_ID = uuid.UUID(int=0)
NEWS_CHANGE_UPSERT = "activity.news.changed"
NEWS_CHANGE_DELETE = "activity.news.deleted"

NEWS_ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


def _error_json_response(
    request,
    *,
    status: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JsonResponse:
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


def _synthetic_news_event_id(news_id: UUID) -> int:
    return -int(news_id.hex[:8], 16)


def _news_title(post: NewsPost) -> str:
    title = (post.title or "").strip()
    if title:
        return title
    body = (post.body or "").strip()
    return body[:120].strip() or "Новость"


def _news_source_ref(post: NewsPost) -> str:
    return f"news:{post.id}"


def _find_news_event(post: NewsPost) -> ActivityEvent | None:
    return ActivityEvent.objects.filter(
        tenant_id=post.tenant_id,
        type="news.posted",
        payload_json__news_id=str(post.id),
    ).first()


def _build_news_payload(
    post: NewsPost,
    ctx,
    *,
    include_reactions: bool = True,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "news_id": str(post.id),
        "title": post.title or None,
        "body": post.body,
        "tags": list(post.tags_json or []),
        "media": list(post.media_json or []),
        "comments_count": post.comments_count,
        "reactions_count": post.reactions_count,
        "status": post.status,
        "permalink": {
            "news_id": str(post.id),
            "path": f"/feed/{post.id}",
        },
    }
    payload["views_count"] = NewsPostView.objects.filter(
        tenant_id=ctx.tenant_id,
        post=post,
    ).count()

    if include_reactions:
        reaction_rows = list(
            NewsReaction.objects.filter(tenant_id=ctx.tenant_id, post=post)
            .values("emoji")
            .annotate(count=models.Count("id"))
            .order_by("-count", "emoji")
        )
        payload["reaction_counts"] = [
            {"emoji": row["emoji"], "count": row["count"]}
            for row in reaction_rows
        ]
        if ctx.user_id:
            payload["my_reactions"] = list(
                NewsReaction.objects.filter(
                    tenant_id=ctx.tenant_id,
                    post=post,
                    user_id=ctx.user_id,
                )
                .order_by("emoji")
                .values_list("emoji", flat=True)
            )

    media = payload.get("media")
    if isinstance(media, list):
        hydrated: list[dict[str, Any]] = []
        for entry in media:
            if not isinstance(entry, dict):
                continue
            kind = (entry.get("type") or "").lower()
            if kind == "image":
                key = entry.get("key")
                url = None
                if isinstance(key, str) and key:
                    try:
                        url = generate_download_url(key=key)
                    except Exception:
                        url = None
                hydrated.append({**entry, "url": url})
            else:
                hydrated.append(entry)
        payload["media"] = hydrated

    return payload


def _build_news_activity_event(post: NewsPost) -> ActivityEvent:
    event = _find_news_event(post)
    if event:
        return event
    return ActivityEvent(
        id=_synthetic_news_event_id(post.id),
        tenant_id=post.tenant_id,
        actor_user_id=post.author_user_id,
        target_user_id=None,
        type="news.posted",
        occurred_at=post.created_at,
        title=_news_title(post),
        payload_json={},
        visibility=post.visibility,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
        source_ref=_news_source_ref(post),
    )


def _can_read_news(ctx, post: NewsPost) -> bool:
    if post.status == NewsStatus.DRAFT:
        return bool(ctx.user_id and ctx.user_id == post.author_user_id) or _can_manage_news(ctx, post)
    if post.visibility == Visibility.PRIVATE:
        return bool(ctx.user_id and ctx.user_id == post.author_user_id) or _can_manage_news(ctx, post)
    try:
        require_permission(
            ctx=ctx,
            permission_key=Permissions.FEED_READ,
            scope_type=post.scope_type,
            scope_id=post.scope_id,
        )
    except HttpError:
        return False
    return True


def _ensure_news_readable(ctx, post: NewsPost) -> None:
    if not _can_read_news(ctx, post):
        raise HttpError(403, error_payload("FORBIDDEN", "Insufficient permissions"))


def _serialize_news_post(
    post: NewsPost,
    ctx,
    *,
    actor_profiles: dict[str, dict[str, Any]] | None = None,
) -> schemas.ActivityEventOut:
    actor_profile = None
    if post.author_user_id and actor_profiles:
        actor_profile = _coerce_actor_profile(actor_profiles.get(str(post.author_user_id)))
    payload = _build_news_payload(post, ctx)
    event = _build_news_activity_event(post)
    event.title = _news_title(post)
    event.payload_json = payload
    event.visibility = post.visibility
    event.scope_type = post.scope_type
    event.scope_id = post.scope_id
    event.source_ref = _news_source_ref(post)
    return schemas.ActivityEventOut(
        id=event.id or _synthetic_news_event_id(post.id),
        tenant_id=post.tenant_id,
        actor_user_id=post.author_user_id,
        target_user_id=None,
        type="news.posted",
        occurred_at=post.created_at,
        title=event.title,
        payload_json=payload,
        visibility=post.visibility,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
        source_ref=event.source_ref,
        actor_profile=actor_profile,
    )


def _publish_news_change(
    post: NewsPost,
    *,
    kind: str,
    changed: list[str] | None = None,
) -> None:
    event_type = NEWS_CHANGE_DELETE if kind == "delete" else NEWS_CHANGE_UPSERT
    publish_outbox_event(
        tenant_id=post.tenant_id,
        event_type=event_type,
        aggregate_type="news",
        aggregate_id=str(post.id),
        payload={
            "news_id": str(post.id),
            "kind": kind,
            "status": post.status,
            "visibility": post.visibility,
            "scope_type": post.scope_type,
            "scope_id": post.scope_id,
            "author_user_id": str(post.author_user_id),
            "changed": changed or [],
        },
    )


def _sync_news_activity_event(post: NewsPost) -> ActivityEvent | None:
    event = _find_news_event(post)
    if post.status == NewsStatus.DRAFT:
        if event:
            event.delete()
        return None

    defaults = {
        "tenant_id": post.tenant_id,
        "actor_user_id": post.author_user_id,
        "target_user_id": None,
        "type": "news.posted",
        "occurred_at": post.created_at,
        "title": _news_title(post),
        "payload_json": {
            "news_id": str(post.id),
            "title": post.title or None,
            "body": post.body,
            "tags": list(post.tags_json or []),
            "media": list(post.media_json or []),
            "comments_count": post.comments_count,
            "reactions_count": post.reactions_count,
            "status": post.status,
            "permalink": {
                "news_id": str(post.id),
                "path": f"/feed/{post.id}",
            },
        },
        "visibility": post.visibility,
        "scope_type": post.scope_type,
        "scope_id": post.scope_id,
        "source_ref": _news_source_ref(post),
    }
    if event:
        for field, value in defaults.items():
            setattr(event, field, value)
        event.save(
            update_fields=[
                "tenant_id",
                "actor_user_id",
                "target_user_id",
                "type",
                "occurred_at",
                "title",
                "payload_json",
                "visibility",
                "scope_type",
                "scope_id",
                "source_ref",
            ]
        )
        return event
    return ActivityEvent.objects.create(**defaults)


def _resolve_news_scope(
    *,
    ctx,
    visibility: str,
    scope_type_raw: str | None,
    scope_id_raw: str | None,
) -> tuple[str, str]:
    scope_type = scope_type_raw.upper() if scope_type_raw else None
    scope_id = scope_id_raw
    if not scope_type:
        if visibility == Visibility.COMMUNITY:
            scope_type = ScopeType.COMMUNITY
        elif visibility == Visibility.TEAM:
            scope_type = ScopeType.TEAM
        else:
            scope_type = ScopeType.TENANT
    if scope_type not in {ScopeType.TENANT, ScopeType.COMMUNITY, ScopeType.TEAM}:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Invalid scope_type"))
    if not scope_id:
        if scope_type == ScopeType.TENANT:
            scope_id = str(ctx.tenant_id)
        else:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "scope_id is required"))
    return str(scope_type), str(scope_id)


def _ensure_dsar_subject(ctx, target_user_id: UUID) -> None:
    if ctx.user_id == target_user_id:
        return
    if "system_admin" in ctx.master_flags:
        return
    raise HttpError(403, error_payload("FORBIDDEN", "DSAR access denied"))


def _parse_uuid(value: str, *, code: str, message: str) -> UUID:
    try:
        return UUID(str(value))
    except Exception as exc:
        raise HttpError(400, error_payload(code, message)) from exc


def _coerce_actor_profile(profile: dict[str, Any] | None) -> schemas.ActorProfileOut | None:
    if not profile:
        return None
    user_id = profile.get("user_id")
    if not user_id:
        return None
    try:
        parsed_user_id = UUID(str(user_id))
    except Exception:
        return None
    return schemas.ActorProfileOut(
        user_id=parsed_user_id,
        username=profile.get("username"),
        display_name=profile.get("display_name"),
        first_name=str(profile.get("first_name") or ""),
        last_name=str(profile.get("last_name") or ""),
        avatar_url=profile.get("avatar_url"),
    )


def _fetch_actor_profiles(ctx, user_ids: list[str]) -> dict[str, dict[str, Any]]:
    return portal_client.list_profiles(ctx, user_ids)


def _serialize_event(
    item,
    ctx,
    *,
    actor_profiles: dict[str, dict[str, Any]] | None = None,
) -> schemas.ActivityEventOut:
    payload = dict(item.payload_json or {})
    if item.type == "news.posted":
        news_id = payload.get("news_id")
        if news_id:
            post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
            if post:
                return _serialize_news_post(post, ctx, actor_profiles=actor_profiles)
    actor_profile = None
    if item.actor_user_id and actor_profiles:
        actor_profile = _coerce_actor_profile(actor_profiles.get(str(item.actor_user_id)))
    return schemas.ActivityEventOut(
        id=item.id,
        tenant_id=item.tenant_id,
        actor_user_id=item.actor_user_id,
        target_user_id=item.target_user_id,
        type=item.type,
        occurred_at=item.occurred_at,
        title=item.title,
        payload_json=payload,
        visibility=item.visibility,
        scope_type=item.scope_type,
        scope_id=item.scope_id,
        source_ref=item.source_ref,
        actor_profile=actor_profile,
    )


def _serialize_account_link(item: AccountLink) -> schemas.AccountLinkOut:
    settings_json = dict(item.settings_json or {})
    settings_json.pop("_privacy", None)
    return schemas.AccountLinkOut(
        id=item.id,
        tenant_id=item.tenant_id,
        user_id=item.user_id,
        source_id=item.source_id,
        status=item.status,
        settings_json=mask_for_api(
            settings_json,
            key="settings_json",
        ),
        external_identity_ref=mask_identifier(item.external_identity_ref),
    )


def _dsar_audit_target(ctx, target_user_id: UUID) -> tuple[str, str]:
    if str(ctx.user_id) == str(target_user_id):
        return "self", "self"
    return "delegated", str(target_user_id)


# Register built-in connectors once.
install_connectors()


@router.get(
    "/feed",
    response={200: schemas.FeedOut},
    summary="Get activity feed",
    operation_id="activity_feed",
)
def feed_get(
    request,
    from_: datetime | None = None,
    to: datetime | None = None,
    types: str | None = None,
    scope_type: str | None = None,
    scope_id: str | None = None,
    limit: int = 100,
):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(
        ctx=ctx,
        permission_key=Permissions.FEED_READ,
        scope_type=scope_type or "tenant",
        scope_id=scope_id,
    )

    # Support `from` alias (spec) while keeping typed `from_` argument.
    if from_ is None:
        raw = request.GET.get("from")
        if raw:
            try:
                from_ = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except Exception:
                raise HttpError(
                    400,
                    error_payload("INVALID_FROM", "Invalid 'from' datetime"),
                )

    if to is None:
        raw = request.GET.get("to")
        if raw:
            try:
                to = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except Exception:
                raise HttpError(
                    400,
                    error_payload("INVALID_TO", "Invalid 'to' datetime"),
                )

    flt = FeedFilters(
        from_dt=from_,
        to_dt=to,
        types=parse_csv(types),
        scope_type=scope_type,
        scope_id=scope_id,
    )
    items = list_feed(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        filters=flt,
        limit=min(200, max(1, limit)),
    )
    actor_profiles = _fetch_actor_profiles(
        ctx,
        [str(item.actor_user_id) for item in items if item.actor_user_id],
    )
    return {"items": [_serialize_event(item, ctx, actor_profiles=actor_profiles) for item in items]}


@router.get(
    "/feed/unread-count",
    response={200: schemas.UnreadCountOut},
    summary="Get unread feed count",
    operation_id="activity_feed_unread_count",
)
def feed_unread_count(request):
    """Get count of new feed events since user's last visit."""
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.FEED_READ)
    count = get_unread_count_cached(tenant_id=ctx.tenant_id, user_id=ctx.user_id)
    return {"count": count}


@router.post(
    "/feed/mark-read",
    response={204: None, 401: ErrorOut, 403: ErrorOut},
    summary="Mark feed as read",
    operation_id="activity_feed_mark_read",
)
def feed_mark_read(request):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.FEED_READ)
    update_last_seen(tenant_id=ctx.tenant_id, user_id=ctx.user_id)
    return 204, None


@router.get(
    "/feed/unread-count/long-poll",
    response={200: schemas.UnreadCountLongPollOut},
    summary="Long-poll unread feed count",
    operation_id="activity_feed_unread_count_long_poll",
)
def feed_unread_count_long_poll(
    request,
    last: int | None = None,
    timeout: int = 25,
):
    """
    Long-poll endpoint for unread count updates.

    - If the current count differs from `last`, returns immediately.
    - Otherwise waits up to `timeout` seconds for changes.
    """
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.FEED_READ)

    if timeout < 1:
        raise HttpError(400, error_payload("INVALID_TIMEOUT", "Timeout must be >= 1"))
    timeout = min(30, timeout)

    if last is not None and last < 0:
        raise HttpError(400, error_payload("INVALID_LAST", "Last count must be >= 0"))

    start_time = time.monotonic()
    initial = get_unread_count_fresh(tenant_id=ctx.tenant_id, user_id=ctx.user_id)
    if last is None or initial != last:
        return {
            "count": initial,
            "changed": True,
            "waited_ms": 0,
            "server_time": timezone.now(),
        }

    current = initial
    while time.monotonic() - start_time < timeout:
        time.sleep(1)
        current = get_unread_count_fresh(tenant_id=ctx.tenant_id, user_id=ctx.user_id)
        if current != last:
            waited_ms = int((time.monotonic() - start_time) * 1000)
            return {
                "count": current,
                "changed": True,
                "waited_ms": waited_ms,
                "server_time": timezone.now(),
            }

    waited_ms = int((time.monotonic() - start_time) * 1000)
    return {
        "count": current,
        "changed": False,
        "waited_ms": waited_ms,
        "server_time": timezone.now(),
    }


@router.post(
    "/news/media/upload-url",
    response={200: schemas.NewsMediaUploadOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut},
    summary="Request upload URL for news media",
    operation_id="activity_news_media_upload_url",
)
def news_media_upload_url(request, payload: schemas.NewsMediaUploadIn = REQUIRED_BODY):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(
        ctx=ctx,
        permission_key=Permissions.NEWS_CREATE,
        scope_type=ScopeType.TENANT,
        scope_id=str(ctx.tenant_id),
    )

    if payload.size_bytes <= 0:
        raise HttpError(400, error_payload("INVALID_SIZE", "size_bytes must be > 0"))
    max_size = getattr(settings, "NEWS_MEDIA_MAX_IMAGE_BYTES", 10 * 1024 * 1024)
    if payload.size_bytes > max_size:
        raise HttpError(
            400,
            error_payload("FILE_TOO_LARGE", "Image is слишком большой", details={"max_bytes": max_size}),
        )
    if payload.content_type not in NEWS_ALLOWED_IMAGE_TYPES:
        raise HttpError(
            400,
            error_payload("INVALID_MEDIA_TYPE", "Only images are allowed"),
        )

    key = build_news_media_key(tenant_id=str(ctx.tenant_id), filename=payload.filename)
    upload = generate_upload_url(key=key, content_type=payload.content_type)
    return schemas.NewsMediaUploadOut(
        key=upload.key,
        upload_url=upload.upload_url,
        upload_headers=upload.upload_headers,
        expires_in=upload.expires_in,
    )


def news_media_upload_file(request, token: str):
    if request.method != "PUT":
        return HttpResponse(status=405)

    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(
        ctx=ctx,
        permission_key=Permissions.NEWS_CREATE,
        scope_type=ScopeType.TENANT,
        scope_id=str(ctx.tenant_id),
    )

    try:
        parsed = parse_local_upload_token(token)
    except signing.SignatureExpired:
        return _error_json_response(request, status=403, code="MEDIA_TOKEN_EXPIRED", message="Upload token expired")
    except signing.BadSignature:
        return _error_json_response(request, status=403, code="MEDIA_TOKEN_INVALID", message="Upload token is invalid")

    if not is_news_media_key_allowed(tenant_id=str(ctx.tenant_id), key=parsed.key):
        return _error_json_response(request, status=403, code="FORBIDDEN", message="media key not allowed")

    body = request.body or b""
    if not body:
        return _error_json_response(request, status=400, code="EMPTY_UPLOAD", message="Upload body is empty")
    max_size = getattr(settings, "NEWS_MEDIA_MAX_IMAGE_BYTES", 10 * 1024 * 1024)
    if len(body) > max_size:
        return _error_json_response(
            request,
            status=400,
            code="FILE_TOO_LARGE",
            message="Image is слишком большой",
            details={"max_bytes": max_size},
        )

    if parsed.content_type and parsed.content_type not in NEWS_ALLOWED_IMAGE_TYPES:
        return _error_json_response(request, status=400, code="INVALID_MEDIA_TYPE", message="Only images are allowed")

    save_local_media_file(key=parsed.key, content=body)
    return HttpResponse(status=204)


def news_media_download_file(request, token_or_key: str):
    if request.method != "GET":
        return HttpResponse(status=405)

    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    try:
        parsed = parse_local_download_token(token_or_key)
        key = parsed.key
    except signing.SignatureExpired:
        return _error_json_response(request, status=403, code="MEDIA_TOKEN_EXPIRED", message="Media link expired")
    except signing.BadSignature:
        key = token_or_key

    if not is_news_media_key_allowed(tenant_id=str(ctx.tenant_id), key=key):
        return _error_json_response(request, status=403, code="FORBIDDEN", message="media key not allowed")

    try:
        path, content_type = load_local_media_file(key=key)
    except FileNotFoundError:
        return _error_json_response(request, status=404, code="NOT_FOUND", message="Media file not found")
    except ValueError:
        return _error_json_response(request, status=400, code="INVALID_MEDIA_KEY", message="Invalid media key")

    response = FileResponse(path.open("rb"), content_type=content_type)
    response["Cache-Control"] = "private, max-age=60"
    return response


@router.get(
    "/news/drafts",
    response={200: list[schemas.ActivityEventOut], 401: ErrorOut, 403: ErrorOut},
    summary="List current user's draft news posts",
    operation_id="activity_news_drafts_list",
)
def news_drafts_list(request, limit: int = 20):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    drafts = list(
        NewsPost.objects.filter(
            tenant_id=ctx.tenant_id,
            author_user_id=ctx.user_id,
            status=NewsStatus.DRAFT,
        )
        .order_by("-updated_at", "-created_at")[: min(50, max(1, limit))]
    )
    actor_profiles = _fetch_actor_profiles(ctx, [str(ctx.user_id)])
    return [_serialize_news_post(post, ctx, actor_profiles=actor_profiles) for post in drafts]


@router.get(
    "/news/{news_id}",
    response={200: schemas.ActivityEventOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Get single news post",
    operation_id="activity_news_get",
)
def news_get(request, news_id: str):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))

    _ensure_news_readable(ctx, post)
    actor_profiles = _fetch_actor_profiles(ctx, [str(post.author_user_id)])
    return _serialize_news_post(post, ctx, actor_profiles=actor_profiles)


@router.post(
    "/news",
    response={200: schemas.ActivityEventOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut},
    summary="Create news post",
    operation_id="activity_news_create",
)
def news_create(request, payload: schemas.NewsCreateIn = REQUIRED_BODY):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    body = (payload.body or "").strip()
    if not body:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "body is required"))
    if len(body) > 5000:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "body is too long"))

    tags = sanitize_tags(payload.tags or [])
    if len(tags) > 10:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "too many tags"))

    media = normalize_media_payload([m.dict() for m in payload.media])
    max_media = getattr(settings, "NEWS_MEDIA_MAX_ATTACHMENTS", 8)
    if len(media) > max_media:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "too many media items"))

    for entry in media:
        kind = entry.get("type")
        if kind == "image":
            key = entry.get("key")
            if not isinstance(key, str) or not key:
                raise HttpError(400, error_payload("VALIDATION_ERROR", "media key is required"))
            if not is_news_media_key_allowed(tenant_id=str(ctx.tenant_id), key=key):
                raise HttpError(403, error_payload("FORBIDDEN", "media key not allowed"))
            content_type = entry.get("content_type")
            if content_type not in NEWS_ALLOWED_IMAGE_TYPES:
                raise HttpError(400, error_payload("INVALID_MEDIA_TYPE", "Unsupported image type"))
        elif kind == "youtube":
            url = entry.get("url")
            video_id = entry.get("video_id")
            if not isinstance(url, str) or not url.strip():
                raise HttpError(400, error_payload("VALIDATION_ERROR", "youtube url is required"))
            if not isinstance(video_id, str) or not video_id.strip():
                raise HttpError(400, error_payload("VALIDATION_ERROR", "youtube video_id is required"))

    visibility = payload.visibility
    if visibility not in {v.value for v in Visibility}:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Invalid visibility"))
    status = payload.status
    if status not in {NewsStatus.PUBLISHED, NewsStatus.DRAFT}:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Invalid status"))

    scope_type, scope_id = _resolve_news_scope(
        ctx=ctx,
        visibility=visibility,
        scope_type_raw=payload.scope_type,
        scope_id_raw=payload.scope_id,
    )

    require_permission(
        ctx=ctx,
        permission_key=Permissions.NEWS_CREATE,
        scope_type=scope_type,
        scope_id=str(scope_id),
    )

    post = NewsPost.objects.create(
        tenant_id=ctx.tenant_id,
        author_user_id=ctx.user_id,
        title=payload.title or "",
        body=body,
        tags_json=tags,
        media_json=media,
        visibility=visibility,
        status=status,
        scope_type=scope_type,
        scope_id=str(scope_id),
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )
    _sync_news_activity_event(post)
    _publish_news_change(post, kind="upsert", changed=["body", "status", "visibility", "media", "tags"])

    actor_profiles = _fetch_actor_profiles(ctx, [str(ctx.user_id)])
    return _serialize_news_post(post, ctx, actor_profiles=actor_profiles)


@router.post(
    "/news/{news_id}/reactions",
    response={200: list[schemas.NewsReactionOut], 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Add or remove reaction",
    operation_id="activity_news_reactions",
)
def news_reaction(request, news_id: str, payload: schemas.NewsReactionIn = REQUIRED_BODY):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))
    _ensure_news_readable(ctx, post)

    emoji = payload.emoji.strip()
    if not emoji or len(emoji) > 32:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Invalid emoji"))

    if payload.action == "remove":
        deleted, _ = NewsReaction.objects.filter(
            tenant_id=ctx.tenant_id,
            post=post,
            user_id=ctx.user_id,
            emoji=emoji,
        ).delete()
        if deleted:
            post.reactions_count = max(0, post.reactions_count - 1)
            post.save(update_fields=["reactions_count"])
    else:
        obj, created = NewsReaction.objects.get_or_create(
            tenant_id=ctx.tenant_id,
            post=post,
            user_id=ctx.user_id,
            emoji=emoji,
            defaults={"created_at": timezone.now()},
        )
        if created:
            post.reactions_count += 1
            post.save(update_fields=["reactions_count"])

    post.updated_at = timezone.now()
    post.save(update_fields=["updated_at"])
    _publish_news_change(post, kind="upsert", changed=["reactions"])

    rows = (
        NewsReaction.objects.filter(tenant_id=ctx.tenant_id, post=post)
        .values("emoji")
        .order_by("emoji")
        .annotate(count=models.Count("id"))
    )
    my_reactions = set(
        NewsReaction.objects.filter(
            tenant_id=ctx.tenant_id,
            post=post,
            user_id=ctx.user_id,
        ).values_list("emoji", flat=True)
    )
    return [
        schemas.NewsReactionOut(
            emoji=r["emoji"],
            count=r["count"],
            my_reacted=r["emoji"] in my_reactions,
        )
        for r in rows
    ]


@router.get(
    "/news/{news_id}/reactions",
    response={200: list[schemas.NewsReactionDetailOut], 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="List reactions on a news post",
    operation_id="activity_news_reactions_list",
)
def list_news_reactions(request, news_id: str, limit: int = 50, offset: int = 0):
    """Get detailed list of reactions on a news post."""
    ctx = require_activity_context(request, require_user=False)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))
    _ensure_news_readable(ctx, post)

    reactions = (
        NewsReaction.objects.filter(tenant_id=ctx.tenant_id, post=post)
        .order_by("-created_at")
        [offset:offset + limit]
    )
    actor_profiles = _fetch_actor_profiles(
        ctx,
        [str(reaction.user_id) for reaction in reactions],
    )
    return [
        schemas.NewsReactionDetailOut(
            id=r.id,
            user_id=r.user_id,
            emoji=r.emoji,
            created_at=r.created_at,
            user_profile=_coerce_actor_profile(actor_profiles.get(str(r.user_id))),
        )
        for r in reactions
    ]


@router.post(
    "/news/{news_id}/views",
    response={200: schemas.NewsViewOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Track unique view for a news post",
    operation_id="activity_news_views_track",
)
def news_track_view(request, news_id: str):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))
    _ensure_news_readable(ctx, post)

    counted = False
    if ctx.user_id != post.author_user_id:
        _, counted = NewsPostView.objects.get_or_create(
            tenant_id=ctx.tenant_id,
            post=post,
            user_id=ctx.user_id,
            defaults={
                "first_viewed_at": timezone.now(),
                "last_viewed_at": timezone.now(),
            },
        )
        if not counted:
            NewsPostView.objects.filter(
                tenant_id=ctx.tenant_id,
                post=post,
                user_id=ctx.user_id,
            ).update(last_viewed_at=timezone.now())
        if counted:
            post.updated_at = timezone.now()
            post.save(update_fields=["updated_at"])
            _publish_news_change(post, kind="upsert", changed=["views"])

    views_count = NewsPostView.objects.filter(tenant_id=ctx.tenant_id, post=post).count()
    return schemas.NewsViewOut(views_count=views_count, counted=counted)


def _can_manage_news(ctx, post: NewsPost) -> bool:
    if ctx.user_id and post.author_user_id == ctx.user_id:
        return True
    return has_permission(
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        master_flags=ctx.master_flags,
        permission_key=Permissions.NEWS_MANAGE,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
        request_id=ctx.request_id,
    )


@router.patch(
    "/news/{news_id}",
    response={200: schemas.ActivityEventOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Update news post",
    operation_id="activity_news_update",
)
def news_update(request, news_id: str, payload: schemas.NewsUpdateIn = REQUIRED_BODY):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))

    if not _can_manage_news(ctx, post):
        raise HttpError(403, error_payload("FORBIDDEN", "Permission denied"))

    body = payload.body.strip() if payload.body is not None else post.body
    if not body:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "body is required"))
    if len(body) > 5000:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "body is too long"))

    title = payload.title.strip() if payload.title is not None else post.title
    if not title:
        title = body[:120].strip() or "Новость"

    tags = post.tags_json
    if payload.tags is not None:
        tags = sanitize_tags(payload.tags or [])
        if len(tags) > 10:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "too many tags"))

    media = post.media_json
    if payload.media is not None:
        media = normalize_media_payload([m.dict() for m in payload.media])
        max_media = getattr(settings, "NEWS_MEDIA_MAX_ATTACHMENTS", 8)
        if len(media) > max_media:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "too many media items"))
        for entry in media:
            kind = entry.get("type")
            if kind == "image":
                key = entry.get("key")
                if not isinstance(key, str) or not key:
                    raise HttpError(400, error_payload("VALIDATION_ERROR", "media key is required"))
                if not is_news_media_key_allowed(tenant_id=str(ctx.tenant_id), key=key):
                    raise HttpError(403, error_payload("FORBIDDEN", "media key not allowed"))
                content_type = entry.get("content_type")
                if content_type not in NEWS_ALLOWED_IMAGE_TYPES:
                    raise HttpError(400, error_payload("INVALID_MEDIA_TYPE", "Unsupported image type"))
            elif kind == "youtube":
                url = entry.get("url")
                video_id = entry.get("video_id")
                if not isinstance(url, str) or not url.strip():
                    raise HttpError(400, error_payload("VALIDATION_ERROR", "youtube url is required"))
                if not isinstance(video_id, str) or not video_id.strip():
                    raise HttpError(400, error_payload("VALIDATION_ERROR", "youtube video_id is required"))

    visibility = post.visibility
    if payload.visibility is not None:
        if payload.visibility not in {v.value for v in Visibility}:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "Invalid visibility"))
        visibility = payload.visibility
    status = post.status
    if payload.status is not None:
        if payload.status not in {NewsStatus.PUBLISHED, NewsStatus.DRAFT}:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "Invalid status"))
        status = payload.status

    post.title = title
    post.body = body
    post.tags_json = tags
    post.media_json = media
    post.visibility = visibility
    post.status = status
    post.updated_at = timezone.now()
    post.save(update_fields=["title", "body", "tags_json", "media_json", "visibility", "status", "updated_at"])

    _sync_news_activity_event(post)
    _publish_news_change(post, kind="upsert", changed=["body", "status", "visibility", "media", "tags"])
    actor_profiles = _fetch_actor_profiles(ctx, [str(post.author_user_id)])
    return _serialize_news_post(post, ctx, actor_profiles=actor_profiles)


@router.delete(
    "/news/{news_id}",
    response={204: None, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Delete news post",
    operation_id="activity_news_delete",
)
def news_delete(request, news_id: str):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))

    if not _can_manage_news(ctx, post):
        raise HttpError(403, error_payload("FORBIDDEN", "Permission denied"))

    _publish_news_change(post, kind="delete", changed=["deleted"])
    ActivityEvent.objects.filter(
        tenant_id=ctx.tenant_id,
        type="news.posted",
        payload_json__news_id=str(post.id),
    ).delete()
    post.delete()
    return 204, None


def _comment_capabilities(ctx, post: NewsPost, comment: NewsComment) -> tuple[bool, bool, bool]:
    is_author = bool(ctx.user_id and comment.user_id and ctx.user_id == comment.user_id)
    can_manage = _can_manage_news(ctx, post)
    is_deleted = comment.deleted_at is not None
    can_edit = (is_author or can_manage) and not is_deleted
    can_delete = (is_author or can_manage) and not is_deleted
    can_reply = not is_deleted
    return can_edit, can_delete, can_reply


def _serialize_comment(
    ctx,
    post: NewsPost,
    comment: NewsComment,
    *,
    likes_count: int = 0,
    my_liked: bool = False,
    replies_count: int = 0,
    actor_profiles: dict[str, dict[str, Any]] | None = None,
) -> schemas.NewsCommentOut:
    can_edit, can_delete, can_reply = _comment_capabilities(ctx, post, comment)
    user_profile = None
    if comment.user_id and actor_profiles:
        user_profile = _coerce_actor_profile(actor_profiles.get(str(comment.user_id)))
    return schemas.NewsCommentOut(
        id=comment.id,
        user_id=None if comment.deleted_at else comment.user_id,
        body=comment.body,
        created_at=comment.created_at,
        parent_id=comment.parent_id,
        deleted=comment.deleted_at is not None,
        likes_count=likes_count,
        my_liked=my_liked,
        replies_count=replies_count,
        user_profile=None if comment.deleted_at else user_profile,
        can_edit=can_edit,
        can_delete=can_delete,
        can_reply=can_reply,
    )


@router.get(
    "/news/{news_id}/comments",
    response={200: list[schemas.NewsCommentOut], 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="List comments",
    operation_id="activity_news_comments_list",
)
def news_comments_list(
    request,
    news_id: str,
    limit: int = 50,
):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))
    _ensure_news_readable(ctx, post)

    limit = min(100, max(1, limit))
    comments = list(
        NewsComment.objects.filter(tenant_id=ctx.tenant_id, post=post)
        .order_by("created_at", "id")[:limit]
    )
    actor_profiles = _fetch_actor_profiles(
        ctx,
        [str(comment.user_id) for comment in comments if comment.user_id and comment.deleted_at is None],
    )
    return [
        _serialize_comment(
            ctx,
            post,
            comment,
            actor_profiles=actor_profiles,
        )
        for comment in comments
    ]


@router.get(
    "/news/{news_id}/comments/page",
    response={200: schemas.NewsCommentPageOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="List comments with cursor pagination",
    operation_id="activity_news_comments_page",
)
def news_comments_page(
    request,
    news_id: str,
    limit: int = 20,
    cursor: str | None = None,
    parent_id: int | None = None,
):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))
    _ensure_news_readable(ctx, post)

    limit = min(100, max(1, limit))
    qs = NewsComment.objects.filter(
        tenant_id=ctx.tenant_id,
        post=post,
    )
    if parent_id is None:
        qs = qs.filter(parent__isnull=True)
    else:
        qs = qs.filter(parent_id=parent_id)

    if cursor:
        try:
            cursor_id = int(cursor)
        except ValueError as exc:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "Invalid cursor")) from exc
        qs = qs.filter(id__gt=cursor_id)

    rows = list(qs.order_by("id")[: limit + 1])
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = str(items[-1].id) if has_more and items else None

    comment_ids = [c.id for c in items]
    likes_by_comment_id: dict[int, int] = {}
    my_likes: set[int] = set()
    replies_by_comment_id: dict[int, int] = {}
    if comment_ids:
        likes_rows = (
            NewsCommentReaction.objects.filter(tenant_id=ctx.tenant_id, comment_id__in=comment_ids)
            .values("comment_id")
            .annotate(count=models.Count("id"))
        )
        likes_by_comment_id = {r["comment_id"]: r["count"] for r in likes_rows}

        if ctx.user_id:
            my_likes = set(
                NewsCommentReaction.objects.filter(
                    tenant_id=ctx.tenant_id,
                    comment_id__in=comment_ids,
                    user_id=ctx.user_id,
                ).values_list("comment_id", flat=True)
            )

        replies_rows = (
            NewsComment.objects.filter(
                tenant_id=ctx.tenant_id,
                parent_id__in=comment_ids,
            )
            .values("parent_id")
            .annotate(count=models.Count("id"))
        )
        replies_by_comment_id = {r["parent_id"]: r["count"] for r in replies_rows}

    actor_profiles = _fetch_actor_profiles(
        ctx,
        [str(comment.user_id) for comment in items if comment.user_id and comment.deleted_at is None],
    )

    return schemas.NewsCommentPageOut(
        items=[
            _serialize_comment(
                ctx,
                post,
                c,
                likes_count=likes_by_comment_id.get(c.id, 0),
                my_liked=c.id in my_likes,
                replies_count=replies_by_comment_id.get(c.id, 0),
                actor_profiles=actor_profiles,
            )
            for c in items
        ],
        next_cursor=next_cursor,
        has_more=has_more,
        parent_id=parent_id,
    )


@router.post(
    "/news/{news_id}/comments",
    response={200: schemas.NewsCommentOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Add comment",
    operation_id="activity_news_comments_create",
)
def news_comments_create(request, news_id: str, payload: schemas.NewsCommentIn = REQUIRED_BODY):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))
    _ensure_news_readable(ctx, post)

    body = payload.body.strip()
    if not body:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Comment body is required"))
    if len(body) > 2000:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Comment is too long"))

    parent = None
    if payload.parent_id:
        parent = NewsComment.objects.filter(
            id=payload.parent_id, tenant_id=ctx.tenant_id, post=post
        ).first()
        if not parent:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "Parent comment not found"))

    comment = NewsComment.objects.create(
        tenant_id=ctx.tenant_id,
        post=post,
        user_id=ctx.user_id,
        body=body,
        parent=parent,
        created_at=timezone.now(),
    )
    post.comments_count += 1
    post.updated_at = timezone.now()
    post.save(update_fields=["comments_count", "updated_at"])
    _publish_news_change(post, kind="upsert", changed=["comments"])
    actor_profiles = _fetch_actor_profiles(ctx, [str(ctx.user_id)])
    return _serialize_comment(ctx, post, comment, actor_profiles=actor_profiles)


@router.post(
    "/news/{news_id}/comments/{comment_id}/likes",
    response={200: schemas.NewsCommentLikeOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Add or remove like on comment",
    operation_id="activity_news_comment_like",
)
def news_comment_like(
    request,
    news_id: str,
    comment_id: int,
    payload: schemas.NewsCommentLikeIn = REQUIRED_BODY,
):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))

    comment = NewsComment.objects.filter(
        id=comment_id,
        tenant_id=ctx.tenant_id,
        post=post,
        deleted_at__isnull=True,
    ).first()
    if not comment:
        raise HttpError(404, error_payload("NOT_FOUND", "Comment not found"))
    _ensure_news_readable(ctx, post)

    if payload.action == "remove":
        NewsCommentReaction.objects.filter(
            tenant_id=ctx.tenant_id,
            comment=comment,
            user_id=ctx.user_id,
        ).delete()
        my_liked = False
    else:
        NewsCommentReaction.objects.get_or_create(
            tenant_id=ctx.tenant_id,
            comment=comment,
            user_id=ctx.user_id,
            defaults={"created_at": timezone.now()},
        )
        my_liked = True

    likes_count = NewsCommentReaction.objects.filter(
        tenant_id=ctx.tenant_id,
        comment=comment,
    ).count()
    post.updated_at = timezone.now()
    post.save(update_fields=["updated_at"])
    _publish_news_change(post, kind="upsert", changed=["comments"])
    return schemas.NewsCommentLikeOut(likes_count=likes_count, my_liked=my_liked)


@router.delete(
    "/news/{news_id}/comments/{comment_id}",
    response={200: schemas.NewsCommentOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Soft-delete comment",
    operation_id="activity_news_comment_delete",
)
def news_comment_delete(request, news_id: str, comment_id: int):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))

    comment = NewsComment.objects.filter(
        id=comment_id,
        tenant_id=ctx.tenant_id,
        post=post,
        deleted_at__isnull=True,
    ).first()
    if not comment:
        raise HttpError(404, error_payload("NOT_FOUND", "Comment not found"))
    _ensure_news_readable(ctx, post)
    if ctx.user_id != comment.user_id and not _can_manage_news(ctx, post):
        raise HttpError(403, error_payload("FORBIDDEN", "Insufficient permissions"))

    comment.deleted_at = timezone.now()
    comment.body = "Комментарий удалён"
    comment.save(update_fields=["deleted_at", "body", "updated_at"])
    post.updated_at = timezone.now()
    post.save(update_fields=["updated_at"])
    _publish_news_change(post, kind="upsert", changed=["comments"])

    likes_count = NewsCommentReaction.objects.filter(
        tenant_id=ctx.tenant_id,
        comment=comment,
    ).count()
    replies_count = NewsComment.objects.filter(
        tenant_id=ctx.tenant_id,
        parent=comment,
        deleted_at__isnull=True,
    ).count()
    return _serialize_comment(
        ctx,
        post,
        comment,
        likes_count=likes_count,
        my_liked=False,
        replies_count=replies_count,
    )


@router.get(
    "/v2/feed",
    response={200: schemas.FeedOutV2},
    summary="Get activity feed with cursor-based pagination",
    operation_id="activity_feed_v2",
)
def feed_get_v2(
    request,
    from_: datetime | None = None,
    to: datetime | None = None,
    types: str | None = None,
    scope_type: str | None = None,
    scope_id: str | None = None,
    limit: int = 50,
    cursor: str | None = None,
):
    """
    Get activity feed with cursor-based pagination.

    Cursor-based pagination provides:
    - Stable results even when new items are added
    - Better performance for large datasets
    - No duplicate items when paginating

    Use `next_cursor` from response to fetch the next page.
    """
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(
        ctx=ctx,
        permission_key=Permissions.FEED_READ,
        scope_type=scope_type or "tenant",
        scope_id=scope_id,
    )

    # Support `from` alias (spec) while keeping typed `from_` argument.
    if from_ is None:
        raw = request.GET.get("from")
        if raw:
            try:
                from_ = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except Exception:
                raise HttpError(
                    400,
                    error_payload("INVALID_FROM", "Invalid 'from' datetime"),
                )

    if to is None:
        raw = request.GET.get("to")
        if raw:
            try:
                to = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except Exception:
                raise HttpError(
                    400,
                    error_payload("INVALID_TO", "Invalid 'to' datetime"),
                )

    flt = FeedFilters(
        from_dt=from_,
        to_dt=to,
        types=parse_csv(types),
        scope_type=scope_type,
        scope_id=scope_id,
    )
    result = list_feed_paginated(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        filters=flt,
        limit=min(100, max(1, limit)),
        cursor=cursor,
    )
    actor_profiles = _fetch_actor_profiles(
        ctx,
        [str(item.actor_user_id) for item in result.items if item.actor_user_id],
    )
    return {
        "items": [_serialize_event(item, ctx, actor_profiles=actor_profiles) for item in result.items],
        "next_cursor": result.next_cursor,
        "has_more": result.has_more,
    }


@router.get(
    "/feed/internal/dsar/users/{target_user_id}/export",
    response={200: dict, 401: ErrorOut, 403: ErrorOut, 400: ErrorOut},
    summary="Export activity personal data",
    operation_id="activity_dsar_export",
)
def dsar_export(request, target_user_id: str):
    ctx = require_activity_context(request, require_user=True)
    parsed_user_id = _parse_uuid(
        target_user_id,
        code="INVALID_USER_ID",
        message="Invalid user id",
    )
    _ensure_dsar_subject(ctx, parsed_user_id)
    subject_scope, audit_target_id = _dsar_audit_target(ctx, parsed_user_id)
    payload = export_user_data(tenant_id=ctx.tenant_id, user_id=parsed_user_id)
    _log_audit(
        tenant_id=ctx.tenant_id,
        actor_user_id=ctx.user_id,
        action="dsar.exported",
        target_type="dsar_request",
        target_id=audit_target_id,
        metadata={"subject_scope": subject_scope},
        request_id=ctx.request_id,
    )
    return payload


@router.post(
    "/feed/internal/dsar/users/{target_user_id}/erase",
    response={200: dict, 401: ErrorOut, 403: ErrorOut, 400: ErrorOut},
    summary="Erase activity personal data",
    operation_id="activity_dsar_erase",
)
def dsar_erase(request, target_user_id: str):
    ctx = require_activity_context(request, require_user=True)
    parsed_user_id = _parse_uuid(
        target_user_id,
        code="INVALID_USER_ID",
        message="Invalid user id",
    )
    _ensure_dsar_subject(ctx, parsed_user_id)
    subject_scope, audit_target_id = _dsar_audit_target(ctx, parsed_user_id)
    with transaction.atomic():
        payload = erase_user_data(tenant_id=ctx.tenant_id, user_id=parsed_user_id)
        _log_audit(
            tenant_id=ctx.tenant_id,
            actor_user_id=ctx.user_id,
            action="dsar.erased",
            target_type="dsar_request",
            target_id=audit_target_id,
            metadata={"subject_scope": subject_scope},
            request_id=ctx.request_id,
        )
        return payload


@router.get(
    "/games",
    response={200: list[schemas.GameOut]},
    summary="List games (tenant catalog)",
    operation_id="activity_games_list",
)
def games_list(request):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.FEED_READ)
    return list_games(tenant_id=ctx.tenant_id)


@router.post(
    "/games",
    response={200: schemas.GameOut},
    summary="Create game (admin)",
    operation_id="activity_games_create",
)
def games_create(request, payload: schemas.GameCreateIn = REQUIRED_BODY):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.ADMIN_GAMES)
    return create_game(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        tags_json=payload.tags_json,
    )


@router.get(
    "/sources",
    response={200: list[schemas.SourceOut]},
    summary="List sources",
    operation_id="activity_sources_list",
)
def sources_list(request):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.FEED_READ)
    return list_sources(tenant_id=ctx.tenant_id)


@router.post(
    "/account-links",
    response={200: schemas.AccountLinkOut},
    summary="Link source to user",
    operation_id="activity_account_links_create",
)
def account_links_create(
    request,
    payload: schemas.AccountLinkCreateIn = REQUIRED_BODY,
):
    # Payload schema is explicit in decorator.
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.SOURCES_LINK)
    link = create_account_link(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        source_id=payload.source_id,
        status=payload.status,
        settings_json=payload.settings_json,
        external_identity_ref=payload.external_identity_ref,
        request_id=ctx.request_id,
    )
    return _serialize_account_link(link)


@router.post(
    "/subscriptions",
    response={200: schemas.SubscriptionOut},
    summary="Upsert subscriptions",
    operation_id="activity_subscriptions_upsert",
)
def subscriptions_post(
    request,
    payload: schemas.SubscriptionIn = REQUIRED_BODY,
):
    # Payload schema is explicit in decorator.
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.FEED_READ)
    scopes = [
        {"scope_type": s.scope_type, "scope_id": s.scope_id}
        for s in payload.scopes
    ]
    return upsert_subscription(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        scopes=scopes,
    )


@router.get(
    "/subscriptions",
    response={200: schemas.SubscriptionsOut},
    summary="List subscriptions",
    operation_id="activity_subscriptions_list",
)
def subscriptions_list(request):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.FEED_READ)
    sub = Subscription.objects.filter(tenant_id=ctx.tenant_id, user_id=ctx.user_id).first()
    items = [sub] if sub else []
    return {"items": items}


@router.post(
    "/sync/run",
    response={200: schemas.SyncRunOut},
    summary="Run sync for account link (admin/debug)",
    operation_id="activity_sync_run",
)
def sync_run(request, account_link_id: int):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    require_permission(ctx=ctx, permission_key=Permissions.ADMIN_SYNC)
    result = run_sync(tenant_id=ctx.tenant_id, account_link_id=account_link_id)
    return {
        "ok": True,
        "raw_created": result["raw_created"],
        "raw_deduped": result["raw_deduped"],
        "activity_created": result["activity_created"],
    }


@router.post(
    "/ingest/webhook/minecraft",
    auth=None,
    response={200: schemas.WebhookIngestOut},
    summary="Minecraft webhook ingest",
    operation_id="activity_ingest_webhook_minecraft",
)
def ingest_webhook_minecraft(request):
    # Called via BFF proxy: requires tenant + request id headers.
    ctx = require_activity_context(request, require_user=False)
    secret = minecraft_webhook_secret()
    body = request.body or b""
    verify_hmac_signature(
        secret=secret,
        body=body,
        header_value=request.headers.get("X-Signature"),
    )

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except Exception as exc:
        raise HttpError(
            400,
            error_payload("INVALID_JSON", "Invalid JSON"),
        ) from exc

    tenant_id = ctx.tenant_id

    # For MVP: use (or auto-create) a single minecraft Source
    # and AccountLink per tenant.
    source, _ = Source.objects.get_or_create(
        tenant_id=tenant_id,
        type="minecraft",
        defaults={"config_json": {}},
    )

    raw_linked_user_id = payload.get("linked_user_id")
    try:
        linked_user_id = (
            uuid_from_str(raw_linked_user_id)
            if raw_linked_user_id
            else SYSTEM_USER_ID
        )
    except Exception:
        raise HttpError(
            400,
            error_payload(
                "INVALID_LINKED_USER_ID",
                "linked_user_id must be a UUID",
            ),
        )
    link, _ = AccountLink.objects.get_or_create(
        tenant_id=tenant_id,
        user_id=linked_user_id,
        source=source,
        defaults={"status": "active", "settings_json": {}},
    )

    from activity.connectors.base import RawEventIn as RawIn

    created_raw, created_act = ingest_raw_and_normalize(
        tenant_id=tenant_id,
        account_link=link,
        raw_in=RawIn(occurred_at=timezone.now(), payload_json=payload),
    )

    return {
        "ok": True,
        "raw_created": 1 if created_raw else 0,
        "raw_deduped": 0 if created_raw else 1,
        "activity_created": 1 if created_act else 0,
    }
