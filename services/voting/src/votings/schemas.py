from __future__ import annotations

from datetime import datetime
from typing import Any

from nominations.schemas import CamelSchema


class GameImportSchema(CamelSchema):
    id: str | None = None
    title: str
    genre: str | None = None
    studio: str | None = None
    release_year: int | None = None
    description: str | None = None
    image_url: str | None = None


class NominationOptionImportSchema(CamelSchema):
    id: str
    title: str
    image_url: str | None = None
    order: int | None = None
    game: GameImportSchema | None = None
    payload: dict[str, Any] | None = None


class NominationImportSchema(CamelSchema):
    id: str
    title: str
    description: str | None = None
    kind: str | None = None
    config: dict[str, Any] | None = None
    order: int | None = None
    options: list[NominationOptionImportSchema]


class VotingImportSchema(CamelSchema):
    code: str
    title: str
    description: str | None = None
    order: int | None = None
    is_active: bool = True
    show_vote_counts: bool = False
    rules: dict[str, Any] | None = None
    deadline_at: datetime | None = None
    nominations: list[NominationImportSchema]


class VotingImportPreviewSchema(CamelSchema):
    voting: VotingImportSchema
    will_replace: bool = False
    totals: dict[str, int]


class VotingImportResultSchema(CamelSchema):
    voting: VotingImportSchema
    replaced_existing: bool = False
    created_games: int = 0
    updated_games: int = 0
    nominations_count: int = 0
    options_count: int = 0
