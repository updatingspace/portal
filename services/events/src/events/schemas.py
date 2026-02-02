from __future__ import annotations

from datetime import datetime
from typing import Literal

from core.schemas import CamelSchema
from pydantic import Field


ScopeType = Literal["TENANT", "COMMUNITY", "TEAM"]
Visibility = Literal["public", "community", "team", "private"]
RsvpStatus = Literal["interested", "going", "not_going"]


class EventOut(CamelSchema):
    id: str
    tenant_id: str

    scope_type: ScopeType
    scope_id: str

    title: str
    description: str | None = None

    starts_at: datetime
    ends_at: datetime

    location_text: str | None = None
    location_url: str | None = None

    game_id: str | None = None
    visibility: Visibility

    created_by: str
    created_at: datetime

    rsvp_counts: dict[str, int] = Field(default_factory=dict)
    my_rsvp: RsvpStatus | None = None


class EventListMeta(CamelSchema):
    total: int
    limit: int
    offset: int


class EventListOut(CamelSchema):
    items: list[EventOut]
    meta: EventListMeta


class EventCreateIn(CamelSchema):
    scope_type: ScopeType
    scope_id: str

    title: str
    description: str | None = None

    starts_at: datetime
    ends_at: datetime

    location_text: str | None = None
    location_url: str | None = None

    game_id: str | None = None
    visibility: Visibility = "public"


class EventUpdateIn(CamelSchema):
    title: str | None = None
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location_text: str | None = None
    location_url: str | None = None
    game_id: str | None = None
    visibility: Visibility | None = None


class RsvpSetIn(CamelSchema):
    status: RsvpStatus


class AttendanceMarkIn(CamelSchema):
    user_id: str
