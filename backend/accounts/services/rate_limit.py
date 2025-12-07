from __future__ import annotations

import logging
import time
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from django.core.cache import cache

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RateLimitDecision:
    blocked: bool
    retry_after: int | None
    remaining: int | None
    limit: int


class RateLimitService:
    """Lightweight, cache-backed rate limiter for auth-sensitive endpoints."""

    LOGIN_LIMIT = 5
    LOGIN_WINDOW_SEC = 5 * 60
    REGISTER_LIMIT = 3
    REGISTER_WINDOW_SEC = 10 * 60

    PREFIX = "rl"

    @classmethod
    def _key(cls, scope: str, identifier: str) -> str:
        safe_id = identifier.replace(" ", "_")
        return f"{cls.PREFIX}:{scope}:{safe_id}"

    @classmethod
    def _increment(cls, key: str, *, limit: int, window_sec: int) -> RateLimitDecision:
        now = int(time.time())
        cached = cache.get(key) or {}
        count = int(cached.get("count", 0)) + 1
        reset_at = int(cached.get("reset_at", now + window_sec))
        if reset_at <= now:
            reset_at = now + window_sec
            count = 1
        ttl = max(reset_at - now, 1)
        cache.set(key, {"count": count, "reset_at": reset_at}, ttl)
        blocked = count > limit
        retry_after = max(reset_at - now, 0) if blocked else None
        remaining = max(limit - count, 0) if not blocked else 0
        return RateLimitDecision(
            blocked=blocked,
            retry_after=retry_after,
            remaining=remaining,
            limit=limit,
        )

    @classmethod
    def _register_attempt(
        cls,
        scope: str,
        identifiers: Sequence[str],
        *,
        limit: int,
        window_sec: int,
    ) -> RateLimitDecision:
        decisions = [
            cls._increment(
                cls._key(scope, ident),
                limit=limit,
                window_sec=window_sec,
            )
            for ident in identifiers
        ]
        blocked = [d for d in decisions if d.blocked]
        if blocked:
            retry_after = max((d.retry_after or 0) for d in blocked) or None
            logger.info(
                "Rate limit triggered",
                extra={
                    "scope": scope,
                    "identifiers": list(identifiers),
                    "retry_after": retry_after,
                },
            )
            return RateLimitDecision(
                blocked=True,
                retry_after=retry_after,
                remaining=0,
                limit=limit,
            )
        remaining_values = [d.remaining for d in decisions if d.remaining is not None]
        remaining = min(remaining_values) if remaining_values else limit
        return RateLimitDecision(
            blocked=False,
            retry_after=None,
            remaining=remaining,
            limit=limit,
        )

    @classmethod
    def reset(cls, scope: str, identifiers: Iterable[str]) -> None:
        for ident in identifiers:
            cache.delete(cls._key(scope, ident))

    @classmethod
    def login_attempt(cls, *, ip: str | None, email: str | None) -> RateLimitDecision:
        identifiers: list[str] = []
        if ip:
            identifiers.append(f"ip:{ip}")
        if email:
            identifiers.append(f"email:{email.lower().strip()}")
        if not identifiers:
            identifiers.append("unknown")
        return cls._register_attempt(
            "login",
            identifiers,
            limit=cls.LOGIN_LIMIT,
            window_sec=cls.LOGIN_WINDOW_SEC,
        )

    @classmethod
    def register_attempt(
        cls, *, ip: str | None, email: str | None
    ) -> RateLimitDecision:
        identifiers: list[str] = []
        if ip:
            identifiers.append(f"ip:{ip}")
        if email:
            identifiers.append(f"email:{email.lower().strip()}")
        if not identifiers:
            identifiers.append("unknown")
        return cls._register_attempt(
            "register",
            identifiers,
            limit=cls.REGISTER_LIMIT,
            window_sec=cls.REGISTER_WINDOW_SEC,
        )
