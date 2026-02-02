from __future__ import annotations

from activity.connectors.base import (
    ConnectorCapabilities,
    RateLimits,
    RawEventIn,
    RetryPolicy,
)
from activity.models import AccountLink, ActivityEvent, RawEvent


class CustomConnector:
    type = "custom"

    def describe(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(can_sync=False, can_webhook=False)

    def dedupe_key(self, raw: RawEventIn) -> str:
        return "custom"  # not used

    def sync(self, account_link: AccountLink) -> list[RawEventIn]:
        return []

    def normalize(
        self,
        raw: RawEvent,
        account_link: AccountLink,
    ) -> ActivityEvent:
        raise NotImplementedError(
            "Custom connector has no normalize implementation"
        )

    def rate_limits(self) -> RateLimits:
        return RateLimits(requests_per_minute=None)

    def retry_policy(self) -> RetryPolicy:
        return RetryPolicy(max_attempts=1)
