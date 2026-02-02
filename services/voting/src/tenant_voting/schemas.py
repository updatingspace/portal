from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from ninja import Schema


PollStatus = Literal["draft", "active", "closed"]
PollScopeType = Literal["TENANT", "COMMUNITY", "TEAM", "EVENT", "POST"]
Visibility = Literal["public", "community", "team", "private"]
ResultsVisibility = Literal["always", "after_closed", "admins_only"]


class PollOut(Schema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    description: str | None = None
    status: PollStatus
    scope_type: PollScopeType
    scope_id: str
    visibility: Visibility
    template: str | None = None
    allow_revoting: bool = False
    anonymous: bool = False
    results_visibility: ResultsVisibility = "after_closed"
    settings: dict[str, Any] = {}
    created_by: uuid.UUID
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class NominationOut(Schema):
    id: uuid.UUID
    poll_id: uuid.UUID
    title: str
    description: str | None = None
    kind: str = "custom"
    sort_order: int
    max_votes: int = 1
    is_required: bool = False
    config: dict[str, Any] = {}


class OptionOut(Schema):
    id: uuid.UUID
    nomination_id: uuid.UUID
    title: str
    description: str | None = None
    media_url: str | None = None
    game_id: uuid.UUID | None = None
    sort_order: int = 0


class OptionIn(Schema):
    title: str
    description: str | None = None
    media_url: str | None = None
    game_id: uuid.UUID | None = None
    sort_order: int | None = None


class OptionUpdateIn(Schema):
    title: str | None = None
    description: str | None = None
    media_url: str | None = None
    game_id: uuid.UUID | None = None
    sort_order: int | None = None


class PollTemplateOut(Schema):
    slug: str
    title: str
    description: str
    visibility: Visibility
    settings: dict[str, Any]
    questions: list[dict[str, Any]]


class NominationIn(Schema):
    title: str
    description: str | None = None
    kind: str = "custom"
    sort_order: int | None = None
    max_votes: int = 1
    is_required: bool = False
    config: dict[str, Any] = {}
    options: list[OptionIn] | None = None


class NominationUpdateIn(Schema):
    title: str | None = None
    description: str | None = None
    kind: str | None = None
    sort_order: int | None = None
    max_votes: int | None = None
    is_required: bool | None = None
    config: dict[str, Any] | None = None


class PollCreateIn(Schema):
    title: str
    description: str | None = None
    scope_type: PollScopeType = "TENANT"
    scope_id: str | None = None
    visibility: Visibility = "public"
    status: PollStatus = "draft"
    template: str | None = None
    allow_revoting: bool = False
    anonymous: bool = False
    results_visibility: ResultsVisibility = "after_closed"
    settings: dict[str, Any] = {}
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    nominations: list[NominationIn] | None = None


class PollUpdateIn(Schema):
    title: str | None = None
    description: str | None = None
    visibility: Visibility | None = None
    allow_revoting: bool | None = None
    anonymous: bool | None = None
    results_visibility: ResultsVisibility | None = None
    settings: dict[str, Any] | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    status: PollStatus | None = None


class ParticipantOut(Schema):
    user_id: uuid.UUID
    role: str
    invited_by: uuid.UUID
    status: str


class ParticipantIn(Schema):
    user_id: uuid.UUID
    role: str


class VoteCastIn(Schema):
    poll_id: uuid.UUID
    nomination_id: uuid.UUID
    option_id: uuid.UUID


class VoteOut(Schema):
    id: uuid.UUID
    poll_id: uuid.UUID
    nomination_id: uuid.UUID
    option_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime


class ResultOptionOut(Schema):
    option_id: uuid.UUID
    text: str
    votes: int


class ResultNominationOut(Schema):
    nomination_id: uuid.UUID
    title: str
    options: list[ResultOptionOut]


class PollResultsOut(Schema):
    poll_id: uuid.UUID
    nominations: list[ResultNominationOut]


# Pagination schemas
class PaginationMeta(Schema):
    """Pagination metadata for list responses."""
    total: int
    limit: int
    offset: int
    has_next: bool
    has_prev: bool


class PaginatedPollsOut(Schema):
    """Paginated response for polls list."""
    items: list[PollOut]
    pagination: PaginationMeta
