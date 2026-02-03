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

from django.http import StreamingHttpResponse

from activity.context import require_activity_context
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
