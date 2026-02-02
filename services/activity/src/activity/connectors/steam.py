"""
Steam Web API connector for Activity Feed service.

Fetches achievements and playtime data from Steam Web API.
Requires Steam Web API key and user's Steam ID.

Steam API documentation: https://developer.valvesoftware.com/wiki/Steam_Web_API
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx
from django.core.cache import cache

from activity.connectors.base import (
    Connector,
    ConnectorCapabilities,
    RateLimits,
    RawEventIn,
    RetryPolicy,
)
from activity.models import AccountLink, ActivityEvent, RawEvent

logger = logging.getLogger(__name__)

# Steam API base URL
STEAM_API_BASE = "https://api.steampowered.com"

# Cache keys
STEAM_GAMES_CACHE_PREFIX = "steam:games:"
STEAM_CACHE_TTL = 3600  # 1 hour


@dataclass
class SteamAchievement:
    """Parsed Steam achievement."""

    apiname: str
    achieved: bool
    unlocktime: int
    name: str | None = None
    description: str | None = None


@dataclass
class SteamGame:
    """Parsed Steam game info."""

    appid: int
    name: str
    playtime_forever: int  # minutes
    playtime_2weeks: int | None = None
    rtime_last_played: int | None = None
    img_icon_url: str | None = None


class SteamApiClient:
    """
    HTTP client for Steam Web API.

    Handles rate limiting, retries, and response parsing.
    """

    def __init__(self, api_key: str, timeout: float = 10.0):
        self.api_key = api_key
        self.timeout = timeout
        self._client: httpx.Client | None = None

    def _get_client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                base_url=STEAM_API_BASE,
                timeout=self.timeout,
                headers={"Accept": "application/json"},
            )
        return self._client

    def close(self):
        if self._client:
            self._client.close()
            self._client = None

    def _request(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        """Make authenticated request to Steam API."""
        params["key"] = self.api_key
        params["format"] = "json"

        client = self._get_client()
        try:
            resp = client.get(path, params=params)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Steam API HTTP error",
                extra={
                    "path": path,
                    "status_code": exc.response.status_code,
                    "response_text": exc.response.text[:500],
                },
            )
            raise
        except httpx.TimeoutException:
            logger.error("Steam API timeout", extra={"path": path})
            raise
        except Exception as exc:
            logger.error(
                "Steam API error",
                extra={"path": path, "error": str(exc)},
                exc_info=True,
            )
            raise

    def get_player_summary(self, steam_id: str) -> dict[str, Any] | None:
        """
        Get player profile summary.

        Returns None if profile is private or not found.
        """
        data = self._request(
            "/ISteamUser/GetPlayerSummaries/v2/",
            {"steamids": steam_id},
        )
        players = data.get("response", {}).get("players", [])
        if not players:
            return None
        return players[0]

    def get_owned_games(
        self,
        steam_id: str,
        include_appinfo: bool = True,
        include_played_free_games: bool = True,
    ) -> list[SteamGame]:
        """Get list of games owned by player."""
        data = self._request(
            "/IPlayerService/GetOwnedGames/v1/",
            {
                "steamid": steam_id,
                "include_appinfo": int(include_appinfo),
                "include_played_free_games": int(include_played_free_games),
            },
        )
        response = data.get("response", {})
        games_data = response.get("games", [])

        return [
            SteamGame(
                appid=g["appid"],
                name=g.get("name", f"App {g['appid']}"),
                playtime_forever=g.get("playtime_forever", 0),
                playtime_2weeks=g.get("playtime_2weeks"),
                rtime_last_played=g.get("rtime_last_played"),
                img_icon_url=g.get("img_icon_url"),
            )
            for g in games_data
        ]

    def get_player_achievements(
        self,
        steam_id: str,
        appid: int,
    ) -> list[SteamAchievement]:
        """Get achievements for a specific game."""
        try:
            data = self._request(
                "/ISteamUserStats/GetPlayerAchievements/v1/",
                {"steamid": steam_id, "appid": appid},
            )
        except httpx.HTTPStatusError as exc:
            # 400 often means no achievements for game or private profile
            if exc.response.status_code == 400:
                logger.debug(
                    "No achievements available",
                    extra={"steam_id": steam_id, "appid": appid},
                )
                return []
            raise

        playerstats = data.get("playerstats", {})
        achievements_data = playerstats.get("achievements", [])

        return [
            SteamAchievement(
                apiname=a["apiname"],
                achieved=a.get("achieved", 0) == 1,
                unlocktime=a.get("unlocktime", 0),
                name=a.get("name"),
                description=a.get("description"),
            )
            for a in achievements_data
        ]


class SteamConnector(Connector):
    """
    Steam connector for fetching achievements and playtime.

    Configuration (in source.config_json):
        - api_key: Steam Web API key (required, or use STEAM_API_KEY env var)
        - max_games: Maximum games to fetch achievements for (default: 10)
        - min_playtime: Minimum playtime (minutes) to fetch achievements (default: 60)

    Account link (external_identity_ref): Steam ID (64-bit)
    """

    type = "steam"

    def describe(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            can_sync=True,
            can_webhook=False,
            raw_event_types=["steam.achievement", "steam.playtime", "steam.private"],
            activity_event_types=["game.achievement", "game.playtime"],
        )

    def rate_limits(self) -> RateLimits:
        # Steam API allows ~100,000 requests/day
        # We limit per-user sync to 10/minute to be conservative
        return RateLimits(requests_per_minute=10)

    def retry_policy(self) -> RetryPolicy:
        return RetryPolicy(
            max_attempts=3,
            base_delay_seconds=2.0,
            max_delay_seconds=30.0,
        )

    def dedupe_key(self, raw: RawEventIn) -> str:
        """Generate deduplication key for raw event."""
        payload = raw.payload_json
        kind = payload.get("kind")

        if kind == "achievement":
            steam_id = payload.get("steamid")
            appid = payload.get("appid")
            apiname = payload.get("apiname")
            return f"achievement:{steam_id}:{appid}:{apiname}"

        if kind == "playtime":
            steam_id = payload.get("steamid")
            appid = payload.get("appid")
            # Dedupe by day to allow daily snapshots
            date_str = raw.occurred_at.strftime("%Y-%m-%d") if raw.occurred_at else "unknown"
            return f"playtime:{steam_id}:{appid}:{date_str}"

        if kind == "private":
            steam_id = payload.get("steamid")
            date_str = raw.occurred_at.strftime("%Y-%m-%d") if raw.occurred_at else "unknown"
            return f"private:{steam_id}:{date_str}"

        return f"unknown:{raw.occurred_at.isoformat() if raw.occurred_at else 'none'}"

    def sync(self, account_link: AccountLink) -> list[RawEventIn]:
        """
        Fetch achievements and playtime from Steam API.

        Returns list of raw events to be ingested.
        """
        source_config = account_link.source.config_json or {}
        api_key = source_config.get("api_key") or os.getenv("STEAM_API_KEY")
        steam_id = account_link.external_identity_ref

        if not api_key:
            logger.warning(
                "Steam sync skipped: no API key",
                extra={"account_link_id": account_link.id},
            )
            return []

        if not steam_id:
            logger.warning(
                "Steam sync skipped: no Steam ID",
                extra={"account_link_id": account_link.id},
            )
            return []

        max_games = source_config.get("max_games", 10)
        min_playtime = source_config.get("min_playtime", 60)  # minutes

        client = SteamApiClient(api_key)
        results: list[RawEventIn] = []
        now = datetime.now(timezone.utc)

        try:
            # Check profile visibility
            player = client.get_player_summary(steam_id)
            if not player:
                logger.info(
                    "Steam player not found",
                    extra={"steam_id": steam_id},
                )
                return []

            # communityvisibilitystate: 1=private, 3=public
            if player.get("communityvisibilitystate", 1) != 3:
                logger.info(
                    "Steam profile is private",
                    extra={"steam_id": steam_id},
                )
                results.append(
                    RawEventIn(
                        occurred_at=now,
                        payload_json={
                            "kind": "private",
                            "steamid": steam_id,
                            "personaname": player.get("personaname"),
                        },
                    )
                )
                return results

            # Fetch owned games
            games = client.get_owned_games(steam_id)
            logger.info(
                "Fetched Steam games",
                extra={"steam_id": steam_id, "game_count": len(games)},
            )

            # Sort by recent playtime and filter
            games_to_check = sorted(
                [g for g in games if g.playtime_forever >= min_playtime],
                key=lambda g: g.rtime_last_played or 0,
                reverse=True,
            )[:max_games]

            for game in games_to_check:
                # Fetch achievements for each game
                try:
                    achievements = client.get_player_achievements(steam_id, game.appid)
                    unlocked = [a for a in achievements if a.achieved and a.unlocktime > 0]

                    for ach in unlocked:
                        unlock_dt = datetime.fromtimestamp(ach.unlocktime, tz=timezone.utc)
                        results.append(
                            RawEventIn(
                                occurred_at=unlock_dt,
                                payload_json={
                                    "kind": "achievement",
                                    "steamid": steam_id,
                                    "appid": game.appid,
                                    "game_name": game.name,
                                    "apiname": ach.apiname,
                                    "name": ach.name,
                                    "description": ach.description,
                                    "unlocktime": ach.unlocktime,
                                },
                            )
                        )

                except Exception as exc:
                    logger.warning(
                        "Failed to fetch achievements for game",
                        extra={
                            "steam_id": steam_id,
                            "appid": game.appid,
                            "error": str(exc),
                        },
                    )

                # Add playtime event
                if game.rtime_last_played:
                    last_played_dt = datetime.fromtimestamp(
                        game.rtime_last_played, tz=timezone.utc
                    )
                    results.append(
                        RawEventIn(
                            occurred_at=last_played_dt,
                            payload_json={
                                "kind": "playtime",
                                "steamid": steam_id,
                                "appid": game.appid,
                                "game_name": game.name,
                                "playtime_forever": game.playtime_forever,
                                "playtime_2weeks": game.playtime_2weeks,
                                "rtime_last_played": game.rtime_last_played,
                            },
                        )
                    )

            logger.info(
                "Steam sync completed",
                extra={
                    "steam_id": steam_id,
                    "events_count": len(results),
                },
            )

        finally:
            client.close()

        return results

    def normalize(
        self,
        raw: RawEvent,
        account_link: AccountLink,
    ) -> ActivityEvent:
        """Convert raw Steam event to normalized ActivityEvent."""
        payload = raw.payload_json
        kind = payload.get("kind")
        tenant_id = account_link.tenant_id

        if kind == "private":
            return ActivityEvent(
                tenant_id=tenant_id,
                actor_user_id=account_link.user_id,
                type="steam.private",
                title="Steam profile is private",
                occurred_at=raw.fetched_at,
                visibility="private",
                scope_type="tenant",
                scope_id=str(tenant_id),
                source_ref=f"steam:{account_link.id}:private:{raw.fetched_at.date().isoformat()}",
                payload_json=payload,
            )

        if kind == "achievement":
            game_name = payload.get("game_name", "Game")
            ach_name = payload.get("name") or payload.get("apiname", "Achievement")
            unlocktime = payload.get("unlocktime", 0)
            occurred_at = (
                datetime.fromtimestamp(unlocktime, tz=timezone.utc)
                if unlocktime
                else raw.fetched_at
            )

            return ActivityEvent(
                tenant_id=tenant_id,
                actor_user_id=account_link.user_id,
                type="game.achievement",
                title=f"Unlocked '{ach_name}' in {game_name}",
                occurred_at=occurred_at,
                visibility="public",
                scope_type="tenant",
                scope_id=str(tenant_id),
                source_ref=f"steam:{account_link.id}:ach:{payload.get('appid')}:{payload.get('apiname')}",
                payload_json={
                    "game_name": game_name,
                    "game_appid": payload.get("appid"),
                    "achievement_name": ach_name,
                    "achievement_apiname": payload.get("apiname"),
                    "achievement_description": payload.get("description"),
                    "source": "steam",
                },
            )

        if kind == "playtime":
            game_name = payload.get("game_name", "Game")
            playtime_hours = payload.get("playtime_forever", 0) / 60
            last_played = payload.get("rtime_last_played", 0)
            occurred_at = (
                datetime.fromtimestamp(last_played, tz=timezone.utc)
                if last_played
                else raw.fetched_at
            )

            return ActivityEvent(
                tenant_id=tenant_id,
                actor_user_id=account_link.user_id,
                type="game.playtime",
                title=f"Played {game_name} ({playtime_hours:.1f} hours total)",
                occurred_at=occurred_at,
                visibility="public",
                scope_type="tenant",
                scope_id=str(tenant_id),
                source_ref=f"steam:{account_link.id}:playtime:{payload.get('appid')}:{occurred_at.date().isoformat()}",
                payload_json={
                    "game_name": game_name,
                    "game_appid": payload.get("appid"),
                    "playtime_forever_minutes": payload.get("playtime_forever"),
                    "playtime_2weeks_minutes": payload.get("playtime_2weeks"),
                    "source": "steam",
                },
            )

        # Unknown event type
        return ActivityEvent(
            tenant_id=tenant_id,
            actor_user_id=account_link.user_id,
            type="steam.unknown",
            title="Unknown Steam activity",
            occurred_at=raw.fetched_at,
            visibility="private",
            scope_type="tenant",
            scope_id=str(tenant_id),
            source_ref=f"steam:{account_link.id}:unknown:{raw.id}",
            payload_json=payload,
        )
