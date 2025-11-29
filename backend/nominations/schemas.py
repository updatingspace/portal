from __future__ import annotations

from datetime import datetime
from typing import Any

from ninja import Schema
from pydantic import ConfigDict


def _to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class CamelSchema(Schema):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel)


class NominationOptionSchema(CamelSchema):
    id: str
    title: str
    image_url: str | None = None


class VotingSchema(CamelSchema):
    id: str
    title: str
    description: str | None = None
    is_active: bool = True
    is_open: bool = True
    deadline_at: datetime | None = None
    show_vote_counts: bool = False
    rules: dict[str, Any] | None = None


class NominationSchema(CamelSchema):
    id: str
    title: str
    description: str | None = None
    options: list[NominationOptionSchema]
    counts: dict[str, int] | None = None
    user_vote: str | None = None
    is_voting_open: bool
    can_vote: bool
    voting_deadline: datetime | None = None
    voting: VotingSchema | None = None


class VoteRequestSchema(CamelSchema):
    option_id: str


class VoteResponseSchema(CamelSchema):
    nomination_id: str
    option_id: str
    counts: dict[str, int] | None = None
    user_vote: str | None = None
    is_voting_open: bool
    can_vote: bool
    voting_deadline: datetime | None = None


class VotingNominationSummarySchema(CamelSchema):
    """
    Lightweight representation of a nomination for listing voting metadata.
    """

    id: str
    title: str
    description: str | None = None
    is_active: bool
    order: int


class VotingSummarySchema(VotingSchema):
    nominations: list[VotingNominationSummarySchema]
    nomination_count: int
