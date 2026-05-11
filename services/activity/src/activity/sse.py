"""
Server-Sent Events (SSE) endpoint for real-time feed updates.

Provides real-time unread count notifications for Platform Admins.
Regular users will use polling instead.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from django.http import StreamingHttpResponse

from activity.context import require_activity_context
from activity.models import NewsPost, Outbox, Subscription
from activity.permissions import Permissions, has_permission
from activity.services import get_unread_count, require_not_suspended

logger = logging.getLogger(__name__)

# SSE configuration
SSE_HEARTBEAT_INTERVAL = 10  # seconds (keep under gunicorn worker timeout)
SSE_UPDATE_INTERVAL = 5  # seconds (how often to check for updates)
SSE_MAX_DURATION = 300  # max connection duration (5 minutes)


def _sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event message."""
    lines = []
    lines.append(f"event: {event_type}")
    lines.append(f"data: {json.dumps(data)}")
    lines.append("")  # Empty line marks end of event
    return "\n".join(lines) + "\n"


def _load_subscription_scopes(tenant_id, user_id) -> set[tuple[str, str]]:
    sub = Subscription.objects.filter(tenant_id=tenant_id, user_id=user_id).first()
    scopes: set[tuple[str, str]] = set()
    if sub and isinstance(sub.rules_json, dict):
        for scope in sub.rules_json.get("scopes") or []:
            scope_type = str(scope.get("scope_type") or "").strip().upper()
            scope_id = str(scope.get("scope_id") or "").strip()
            if scope_type and scope_id:
                scopes.add((scope_type, scope_id))
    return scopes


def _scope_visible(scopes: set[tuple[str, str]], *, scope_type: str, scope_id: str) -> bool:
    return (str(scope_type).upper(), str(scope_id)) in scopes


def _can_receive_news_change(ctx, payload: dict[str, Any], subscribed_scopes: set[tuple[str, str]]) -> bool:
    status = str(payload.get("status") or "").strip()
    visibility = str(payload.get("visibility") or "").strip()
    scope_type = str(payload.get("scope_type") or "").strip().upper()
    scope_id = str(payload.get("scope_id") or "").strip()
    author_user_id = str(payload.get("author_user_id") or "").strip()

    if status == "draft":
        return bool(ctx.user_id and author_user_id and str(ctx.user_id) == author_user_id)
    if visibility == "private":
        return bool(ctx.user_id and author_user_id and str(ctx.user_id) == author_user_id)
    if not scope_type or not scope_id:
        return False
    if not _scope_visible(subscribed_scopes, scope_type=scope_type, scope_id=scope_id):
        return False
    return has_permission(
        user_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        master_flags=ctx.master_flags,
        permission_key=Permissions.FEED_READ,
        scope_type=scope_type,
        scope_id=scope_id,
        request_id=ctx.request_id,
    )


def sse_unread_count(request):
    """
    SSE endpoint for real-time unread count updates.

    This endpoint is restricted to Platform Admins only.
    Regular users should use polling via GET /feed/unread-count.

    The connection will:
    - Send initial unread count immediately
    - Send updates when count changes
    - Send heartbeat every 10 seconds
    - Close after 5 minutes (client should reconnect)

    Example client usage:
    ```javascript
    const eventSource = new EventSource('/api/v1/feed/sse');
    eventSource.addEventListener('unread', (e) => {
        const data = JSON.parse(e.data);
        console.log('Unread count:', data.count);
    });
    eventSource.addEventListener('heartbeat', (e) => {
        console.log('Connection alive');
    });
    ```
    """
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)

    # SSE is admin-only per user requirement
    is_admin = has_permission(
        user_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        master_flags=ctx.master_flags,
        permission_key=Permissions.ADMIN_SYNC,
        request_id=ctx.request_id,
    )
    if not is_admin:
        # Return 403 as regular response, not SSE
        from django.http import JsonResponse

        return JsonResponse(
            {
                "error": {
                    "code": "ADMIN_ONLY",
                    "message": "SSE endpoint is restricted to Platform Admins",
                }
            },
            status=403,
        )

    def event_stream():
        """Generate SSE events."""
        start_time = time.monotonic()
        last_heartbeat = start_time
        last_count_check = start_time
        last_count = None

        # Send initial count
        try:
            count = get_unread_count(tenant_id=ctx.tenant_id, user_id=ctx.user_id)
            last_count = count
            yield _sse_event("unread", {"count": count, "timestamp": datetime.now(timezone.utc).isoformat()})
        except Exception as e:
            logger.error("SSE: Failed to get initial unread count: %s", e)
            yield _sse_event("error", {"message": "Failed to get unread count"})
            return

        while True:
            current_time = time.monotonic()

            # Check max duration
            if current_time - start_time > SSE_MAX_DURATION:
                yield _sse_event("close", {"reason": "max_duration", "message": "Please reconnect"})
                break

            # Send heartbeat frequently to keep gunicorn worker alive
            if current_time - last_heartbeat >= SSE_HEARTBEAT_INTERVAL:
                yield _sse_event("heartbeat", {"timestamp": datetime.now(timezone.utc).isoformat()})
                last_heartbeat = current_time

            # Check for count changes on the configured cadence
            if current_time - last_count_check >= SSE_UPDATE_INTERVAL:
                last_count_check = current_time
                try:
                    count = get_unread_count(tenant_id=ctx.tenant_id, user_id=ctx.user_id)
                    if count != last_count:
                        last_count = count
                        yield _sse_event(
                            "unread",
                            {"count": count, "timestamp": datetime.now(timezone.utc).isoformat()},
                        )
                except Exception as e:
                    logger.warning("SSE: Error checking unread count: %s", e)

            # Short sleep to allow signal handling and avoid long blocking sleeps
            time.sleep(1)

    response = StreamingHttpResponse(
        event_stream(),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # Disable nginx buffering
    return response


def sse_feed_live(request):
    ctx = require_activity_context(request, require_user=True)
    require_not_suspended(ctx)
    subscribed_scopes = _load_subscription_scopes(ctx.tenant_id, ctx.user_id)

    def event_stream():
        start_time = time.monotonic()
        last_heartbeat = start_time
        last_check = start_time
        last_outbox_id = (
            Outbox.objects.filter(tenant_id=ctx.tenant_id, aggregate_type="news")
            .order_by("-id")
            .values_list("id", flat=True)
            .first()
            or 0
        )
        yield _sse_event("ready", {"timestamp": datetime.now(timezone.utc).isoformat()})

        while True:
            current_time = time.monotonic()
            if current_time - start_time > SSE_MAX_DURATION:
                yield _sse_event("close", {"reason": "max_duration", "message": "Please reconnect"})
                break

            if current_time - last_heartbeat >= SSE_HEARTBEAT_INTERVAL:
                yield _sse_event("heartbeat", {"timestamp": datetime.now(timezone.utc).isoformat()})
                last_heartbeat = current_time

            if current_time - last_check >= 1:
                last_check = current_time
                rows = list(
                    Outbox.objects.filter(
                        tenant_id=ctx.tenant_id,
                        aggregate_type="news",
                        id__gt=last_outbox_id,
                    )
                    .order_by("id")[:50]
                )
                for row in rows:
                    last_outbox_id = max(last_outbox_id, row.id)
                    payload = row.payload_json if isinstance(row.payload_json, dict) else {}
                    news_id = str(payload.get("news_id") or row.aggregate_id or "").strip()
                    if not news_id:
                        continue

                    if row.event_type == "activity.news.deleted":
                        if _can_receive_news_change(ctx, payload, subscribed_scopes):
                            yield _sse_event(
                                "news-delete",
                                {"news_id": news_id, "timestamp": datetime.now(timezone.utc).isoformat()},
                            )
                        continue

                    post = NewsPost.objects.filter(id=news_id, tenant_id=ctx.tenant_id).first()
                    if not post:
                        continue
                    current_payload = {
                        **payload,
                        "status": post.status,
                        "visibility": post.visibility,
                        "scope_type": post.scope_type,
                        "scope_id": post.scope_id,
                        "author_user_id": str(post.author_user_id),
                    }
                    if _can_receive_news_change(ctx, current_payload, subscribed_scopes):
                        yield _sse_event(
                            "news-upsert",
                            {
                                "news_id": news_id,
                                "changed": payload.get("changed") or [],
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            },
                        )
                    else:
                        yield _sse_event(
                            "news-delete",
                            {"news_id": news_id, "timestamp": datetime.now(timezone.utc).isoformat()},
                        )

            time.sleep(1)

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
