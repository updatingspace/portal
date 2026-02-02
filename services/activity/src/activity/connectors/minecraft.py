from __future__ import annotations

import json
from datetime import datetime

from django.utils import timezone

from activity.connectors.base import (
    ConnectorCapabilities,
    RateLimits,
    RawEventIn,
    RetryPolicy,
)
from activity.enums import ScopeType, Visibility
from activity.models import (
    AccountLink,
    ActivityEvent,
    RawEvent,
    source_ref_for_raw,
)


class MinecraftConnector:
    type = "minecraft"

    def describe(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            can_sync=False,
            can_webhook=True,
            raw_event_types=["minecraft.webhook"],
            activity_event_types=["event.created", "event.rsvp.changed"],
        )

    def dedupe_key(self, raw: RawEventIn) -> str:
        # Prefer explicit event_id; fallback to stable JSON.
        event_id = raw.payload_json.get("event_id")
        if event_id:
            return f"event_id:{event_id}"
        return json.dumps(
            raw.payload_json,
            sort_keys=True,
            separators=(",", ":"),
        )

    def sync(self, account_link: AccountLink) -> list[RawEventIn]:
        return []

    def normalize(
        self,
        raw: RawEvent,
        account_link: AccountLink,
    ) -> ActivityEvent:
        payload = raw.payload_json or {}
        event_type = (
            payload.get("type") or "event.created"
        ).strip() or "event.created"
        occurred = payload.get("occurred_at")
        occurred_at: datetime
        if isinstance(occurred, str):
            try:
                occurred_at = datetime.fromisoformat(
                    occurred.replace("Z", "+00:00")
                )
            except Exception:
                occurred_at = timezone.now()
        else:
            occurred_at = timezone.now()
        title = (payload.get("title") or event_type).strip() or event_type
        scope_type = (
            payload.get("scope_type") or ScopeType.COMMUNITY
        ).strip() or ScopeType.COMMUNITY
        scope_id = str(payload.get("scope_id") or "")
        visibility = (
            payload.get("visibility") or Visibility.COMMUNITY
        ).strip() or Visibility.COMMUNITY
        # Build ActivityEvent model instance (not saved)
        e = ActivityEvent(
            tenant_id=raw.tenant_id,
            actor_user_id=None,
            target_user_id=None,
            type=event_type,
            occurred_at=occurred_at,
            title=title,
            payload_json=payload,
            visibility=visibility,
            scope_type=scope_type,
            scope_id=scope_id,
            source_ref=source_ref_for_raw(
                source=account_link.source,
                raw_event_id=raw.id,
            ),
            raw_event=raw,
        )
        return e

    def rate_limits(self) -> RateLimits:
        return RateLimits(requests_per_minute=60)

    def retry_policy(self) -> RetryPolicy:
        return RetryPolicy(max_attempts=1)
