from __future__ import annotations

import json
import uuid
from datetime import datetime

from django.utils import timezone
from ninja import Body, Router
from ninja.errors import HttpError

from activity import schemas
from activity.connectors import install_connectors
from activity.context import require_activity_context
from activity.models import AccountLink, Source, uuid_from_str
from activity.permissions import Permissions, require_permission
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
)
from core.errors import error_payload

router = Router(tags=["Activity"], auth=None)
REQUIRED_BODY = Body(...)

SYSTEM_USER_ID = uuid.UUID(int=0)

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
    return {"items": items}


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
        "items": result.items,
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
