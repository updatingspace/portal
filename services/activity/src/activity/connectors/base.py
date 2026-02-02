from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from activity.models import AccountLink, ActivityEvent, RawEvent


@dataclass(frozen=True)
class ConnectorCapabilities:
    can_sync: bool
    can_webhook: bool
    raw_event_types: list[str] | None = None
    activity_event_types: list[str] | None = None


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.5
    max_delay_seconds: float = 5.0


@dataclass(frozen=True)
class RateLimits:
    requests_per_minute: int | None = None


@dataclass(frozen=True)
class RawEventIn:
    occurred_at: datetime | None
    payload_json: dict[str, Any]


class Connector(Protocol):
    type: str

    def describe(self) -> ConnectorCapabilities: ...

    def dedupe_key(self, raw: RawEventIn) -> str: ...

    def sync(self, account_link: AccountLink) -> list[RawEventIn]: ...

    def normalize(
        self,
        raw: RawEvent,
        account_link: AccountLink,
    ) -> ActivityEvent: ...

    def rate_limits(self) -> RateLimits: ...

    def retry_policy(self) -> RetryPolicy: ...
