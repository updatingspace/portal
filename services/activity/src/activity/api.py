from __future__ import annotations

import base64
import json
import time
import uuid
from datetime import datetime
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone
from ninja import Body, Router
from ninja.errors import HttpError

from activity import schemas
from activity.connectors import install_connectors
from activity.context import require_activity_context
from activity.enums import ScopeType, Visibility
from activity.models import (
    AccountLink,
    ActivityEvent,
    NewsComment,
    NewsCommentReaction,
    NewsPost,
    NewsReaction,
    Source,
    Subscription,
    uuid_from_str,
)
from activity.permissions import Permissions, has_permission, require_permission
from activity.media import (
    build_news_media_key,
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
)
from core.schemas import ErrorOut
from core.errors import error_payload

router = Router(tags=["Activity"], auth=None)
REQUIRED_BODY = Body(...)

SYSTEM_USER_ID = uuid.UUID(int=0)

NEWS_ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


def _serialize_event(item, tenant_id: uuid.UUID) -> schemas.ActivityEventOut:
    payload = dict(item.payload_json or {})
    if item.type == "news.posted":
        news_id = payload.get("news_id")
        if news_id:
            post = NewsPost.objects.filter(id=news_id, tenant_id=tenant_id).first()
            if post:
                payload["comments_count"] = post.comments_count
                payload["reactions_count"] = post.reactions_count
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
    )

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
    return {"items": [_serialize_event(item, ctx.tenant_id) for item in items]}


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

    scope_type = payload.scope_type.upper() if payload.scope_type else None
    scope_id = payload.scope_id
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

    require_permission(
        ctx=ctx,
        permission_key=Permissions.NEWS_CREATE,
        scope_type=scope_type,
        scope_id=str(scope_id),
    )

    title = (payload.title or "").strip()
    if not title:
        title = body[:120].strip() or "Новость"

    post = NewsPost.objects.create(
        tenant_id=ctx.tenant_id,
        author_user_id=ctx.user_id,
        title=payload.title or "",
        body=body,
        tags_json=tags,
        media_json=media,
        visibility=visibility,
        scope_type=scope_type,
        scope_id=str(scope_id),
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )

    event = ActivityEvent.objects.create(
        tenant_id=ctx.tenant_id,
        actor_user_id=ctx.user_id,
        target_user_id=None,
        type="news.posted",
        occurred_at=timezone.now(),
        title=title,
        payload_json={
            "news_id": str(post.id),
            "title": payload.title,
            "body": body,
            "tags": tags,
            "media": media,
            "comments_count": post.comments_count,
            "reactions_count": post.reactions_count,
        },
        visibility=visibility,
        scope_type=scope_type,
        scope_id=str(scope_id),
        source_ref=f"news:{uuid.uuid4().hex}",
    )

    return _serialize_event(event, ctx.tenant_id)


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

    require_permission(
        ctx=ctx,
        permission_key=Permissions.FEED_READ,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
    )

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

    rows = (
        NewsReaction.objects.filter(tenant_id=ctx.tenant_id, post=post)
        .values("emoji")
        .order_by("emoji")
        .annotate(count=models.Count("id"))
    )
    return [schemas.NewsReactionOut(emoji=r["emoji"], count=r["count"]) for r in rows]


@router.get(
    "/news/{news_id}/reactions",
    response={200: list[schemas.NewsReactionDetailOut], 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="List reactions",
    operation_id="activity_news_reactions_list",
)
def news_reactions_list(
    request,
    news_id: str,
    limit: int = 200,
):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))

    require_permission(
        ctx=ctx,
        permission_key=Permissions.FEED_READ,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
    )

    limit = min(500, max(1, limit))
    rows = (
        NewsReaction.objects.filter(tenant_id=ctx.tenant_id, post=post)
        .order_by("-created_at")[:limit]
    )

    return [
        schemas.NewsReactionDetailOut(
            id=row.id,
            user_id=row.user_id,
            emoji=row.emoji,
            created_at=row.created_at,
        )
        for row in rows
    ]


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


def _serialize_comment(
    comment: NewsComment,
    *,
    likes_count: int = 0,
    my_liked: bool = False,
    replies_count: int = 0,
) -> schemas.NewsCommentOut:
    is_deleted = comment.deleted_at is not None
    return schemas.NewsCommentOut(
        id=comment.id,
        user_id=None if is_deleted else comment.user_id,
        body="Комментарий удалён" if is_deleted else comment.body,
        created_at=comment.created_at,
        parent_id=comment.parent_id,
        deleted=is_deleted,
        likes_count=max(0, likes_count),
        my_liked=my_liked,
        replies_count=max(0, replies_count),
    )


def _can_manage_comment(ctx, post: NewsPost, comment: NewsComment) -> bool:
    if ctx.user_id and comment.user_id == ctx.user_id:
        return True
    return _can_manage_news(ctx, post)


def _encode_comment_cursor(created_at: datetime, comment_id: int) -> str:
    raw = f"{created_at.isoformat()}:{comment_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_comment_cursor(cursor: str) -> tuple[datetime, int] | None:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode()).decode()
        parts = decoded.rsplit(":", 1)
        if len(parts) != 2:
            return None
        created_at = datetime.fromisoformat(parts[0])
        comment_id = int(parts[1])
        return created_at, comment_id
    except Exception:
        return None


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

    post.title = title
    post.body = body
    post.tags_json = tags
    post.media_json = media
    post.visibility = visibility
    post.updated_at = timezone.now()
    post.save(update_fields=["title", "body", "tags_json", "media_json", "visibility", "updated_at"])

    event = ActivityEvent.objects.filter(
        tenant_id=ctx.tenant_id,
        type="news.posted",
        payload_json__news_id=str(post.id),
    ).first()
    if event:
        event.title = title
        event.payload_json = {
            "news_id": str(post.id),
            "title": title,
            "body": body,
            "tags": tags,
            "media": media,
            "comments_count": post.comments_count,
            "reactions_count": post.reactions_count,
        }
        event.visibility = visibility
        event.save(update_fields=["title", "payload_json", "visibility"])
        return _serialize_event(event, ctx.tenant_id)

    fallback = ActivityEvent(
        id=0,
        tenant_id=ctx.tenant_id,
        actor_user_id=ctx.user_id,
        target_user_id=None,
        type="news.posted",
        occurred_at=post.created_at,
        title=title,
        payload_json={
            "news_id": str(post.id),
            "title": title,
            "body": body,
            "tags": tags,
            "media": media,
            "comments_count": post.comments_count,
            "reactions_count": post.reactions_count,
        },
        visibility=visibility,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
        source_ref=f"news:{post.id}",
    )
    return _serialize_event(fallback, ctx.tenant_id)


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

    ActivityEvent.objects.filter(
        tenant_id=ctx.tenant_id,
        type="news.posted",
        payload_json__news_id=str(post.id),
    ).delete()
    post.delete()
    return 204, None


@router.get(
    "/news/{news_id}/comments",
    response={200: list[schemas.NewsCommentOut], 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="List comments",
    operation_id="activity_news_comments_list",
)
def news_comments_list(
    request,
    news_id: str,
    limit: int = 200,
):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))

    require_permission(
        ctx=ctx,
        permission_key=Permissions.FEED_READ,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
    )

    limit = min(500, max(1, limit))
    comments = list(
        NewsComment.objects.filter(tenant_id=ctx.tenant_id, post=post)
        .order_by("created_at")[:limit]
    )
    if not comments:
        return []

    comment_ids = [comment.id for comment in comments]
    like_rows = (
        NewsCommentReaction.objects.filter(tenant_id=ctx.tenant_id, comment_id__in=comment_ids)
        .values("comment_id")
        .annotate(count=models.Count("id"))
    )
    likes_by_comment = {row["comment_id"]: row["count"] for row in like_rows}
    reply_rows = (
        NewsComment.objects.filter(tenant_id=ctx.tenant_id, parent_id__in=comment_ids)
        .values("parent_id")
        .annotate(count=models.Count("id"))
    )
    replies_by_comment = {row["parent_id"]: row["count"] for row in reply_rows}
    my_liked_ids = set(
        NewsCommentReaction.objects.filter(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            comment_id__in=comment_ids,
        ).values_list("comment_id", flat=True)
    )

    return [
        _serialize_comment(
            comment,
            likes_count=likes_by_comment.get(comment.id, 0),
            my_liked=comment.id in my_liked_ids,
            replies_count=replies_by_comment.get(comment.id, 0),
        )
        for comment in comments
    ]


@router.get(
    "/news/{news_id}/comments/page",
    response={200: schemas.NewsCommentPageOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="List paginated comments by parent",
    operation_id="activity_news_comments_page",
)
def news_comments_page(
    request,
    news_id: str,
    parent_id: int | None = None,
    limit: int = 30,
    cursor: str | None = None,
):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))

    require_permission(
        ctx=ctx,
        permission_key=Permissions.FEED_READ,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
    )

    parent: NewsComment | None = None
    if parent_id is not None:
        parent = NewsComment.objects.filter(
            id=parent_id,
            tenant_id=ctx.tenant_id,
            post=post,
        ).first()
        if not parent:
            raise HttpError(404, error_payload("NOT_FOUND", "Parent comment not found"))

    limit = min(100, max(1, limit))
    queryset = NewsComment.objects.filter(tenant_id=ctx.tenant_id, post=post)
    if parent is None:
        queryset = queryset.filter(parent__isnull=True)
    else:
        queryset = queryset.filter(parent=parent)

    if cursor:
        parsed_cursor = _decode_comment_cursor(cursor)
        if parsed_cursor is None:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "Invalid comment cursor"))
        cursor_created_at, cursor_comment_id = parsed_cursor
        queryset = queryset.filter(
            models.Q(created_at__gt=cursor_created_at)
            | models.Q(created_at=cursor_created_at, id__gt=cursor_comment_id)
        )

    page_rows = list(queryset.order_by("created_at", "id")[: limit + 1])
    has_more = len(page_rows) > limit
    if has_more:
        page_rows = page_rows[:limit]

    if not page_rows:
        return schemas.NewsCommentPageOut(
            items=[],
            next_cursor=None,
            has_more=False,
            parent_id=parent_id,
        )

    page_ids = [comment.id for comment in page_rows]
    like_rows = (
        NewsCommentReaction.objects.filter(tenant_id=ctx.tenant_id, comment_id__in=page_ids)
        .values("comment_id")
        .annotate(count=models.Count("id"))
    )
    likes_by_comment = {row["comment_id"]: row["count"] for row in like_rows}
    reply_rows = (
        NewsComment.objects.filter(tenant_id=ctx.tenant_id, parent_id__in=page_ids)
        .values("parent_id")
        .annotate(count=models.Count("id"))
    )
    replies_by_comment = {row["parent_id"]: row["count"] for row in reply_rows}
    my_liked_ids = set(
        NewsCommentReaction.objects.filter(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            comment_id__in=page_ids,
        ).values_list("comment_id", flat=True)
    )

    items = [
        _serialize_comment(
            comment,
            likes_count=likes_by_comment.get(comment.id, 0),
            my_liked=comment.id in my_liked_ids,
            replies_count=replies_by_comment.get(comment.id, 0),
        )
        for comment in page_rows
    ]
    next_cursor = None
    if has_more:
        last_item = page_rows[-1]
        next_cursor = _encode_comment_cursor(last_item.created_at, last_item.id)

    return schemas.NewsCommentPageOut(
        items=items,
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

    require_permission(
        ctx=ctx,
        permission_key=Permissions.FEED_READ,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
    )

    body = payload.body.strip()
    if not body:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Comment body is required"))
    if len(body) > 2000:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Comment is too long"))

    parent: NewsComment | None = None
    if payload.parent_id is not None:
        parent = NewsComment.objects.filter(
            id=payload.parent_id,
            tenant_id=ctx.tenant_id,
            post=post,
        ).first()
        if not parent:
            raise HttpError(404, error_payload("NOT_FOUND", "Parent comment not found"))

    comment = NewsComment.objects.create(
        tenant_id=ctx.tenant_id,
        post=post,
        parent=parent,
        user_id=ctx.user_id,
        body=body,
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )
    post.comments_count += 1
    post.save(update_fields=["comments_count"])

    return _serialize_comment(comment, likes_count=0, my_liked=False)


@router.post(
    "/news/{news_id}/comments/{comment_id}/likes",
    response={200: schemas.NewsCommentLikeOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Like or unlike comment",
    operation_id="activity_news_comment_likes",
)
def news_comment_likes(
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

    comment = NewsComment.objects.filter(id=comment_id, tenant_id=ctx.tenant_id, post=post).first()
    if not comment:
        raise HttpError(404, error_payload("NOT_FOUND", "Comment not found"))
    if comment.deleted_at is not None:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Comment is deleted"))

    require_permission(
        ctx=ctx,
        permission_key=Permissions.FEED_READ,
        scope_type=post.scope_type,
        scope_id=post.scope_id,
    )

    if payload.action == "remove":
        NewsCommentReaction.objects.filter(
            tenant_id=ctx.tenant_id,
            comment=comment,
            user_id=ctx.user_id,
        ).delete()
    else:
        NewsCommentReaction.objects.get_or_create(
            tenant_id=ctx.tenant_id,
            comment=comment,
            user_id=ctx.user_id,
            defaults={"created_at": timezone.now()},
        )

    likes_count = NewsCommentReaction.objects.filter(
        tenant_id=ctx.tenant_id,
        comment=comment,
    ).count()
    my_liked = NewsCommentReaction.objects.filter(
        tenant_id=ctx.tenant_id,
        comment=comment,
        user_id=ctx.user_id,
    ).exists()
    return schemas.NewsCommentLikeOut(likes_count=likes_count, my_liked=my_liked)


@router.delete(
    "/news/{news_id}/comments/{comment_id}",
    response={200: schemas.NewsCommentOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    summary="Delete comment (soft delete)",
    operation_id="activity_news_comments_delete",
)
def news_comments_delete(request, news_id: str, comment_id: int):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
    if not post:
        raise HttpError(404, error_payload("NOT_FOUND", "News post not found"))

    comment = NewsComment.objects.filter(id=comment_id, tenant_id=ctx.tenant_id, post=post).first()
    if not comment:
        raise HttpError(404, error_payload("NOT_FOUND", "Comment not found"))

    if not _can_manage_comment(ctx, post, comment):
        raise HttpError(403, error_payload("FORBIDDEN", "Permission denied"))

    if comment.deleted_at is None:
        comment.body = ""
        comment.deleted_at = timezone.now()
        comment.updated_at = timezone.now()
        comment.save(update_fields=["body", "deleted_at", "updated_at"])

    likes_count = NewsCommentReaction.objects.filter(
        tenant_id=ctx.tenant_id,
        comment=comment,
    ).count()
    replies_count = NewsComment.objects.filter(
        tenant_id=ctx.tenant_id,
        parent=comment,
    ).count()
    my_liked = NewsCommentReaction.objects.filter(
        tenant_id=ctx.tenant_id,
        comment=comment,
        user_id=ctx.user_id,
    ).exists()
    return _serialize_comment(
        comment,
        likes_count=likes_count,
        my_liked=my_liked,
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
    return {
        "items": [_serialize_event(item, ctx.tenant_id) for item in result.items],
        "next_cursor": result.next_cursor,
        "has_more": result.has_more,
    }


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
    return create_account_link(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        source_id=payload.source_id,
        status=payload.status,
        settings_json=payload.settings_json,
        external_identity_ref=payload.external_identity_ref,
    )


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
