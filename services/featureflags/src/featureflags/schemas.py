from __future__ import annotations

from datetime import datetime

from core.schemas import CamelSchema


class FeatureFlagOut(CamelSchema):
    key: str
    description: str | None = None
    enabled: bool
    rollout: int
    created_by: str
    updated_by: str
    created_at: datetime
    updated_at: datetime


class FeatureFlagCreateIn(CamelSchema):
    key: str
    description: str | None = None
    enabled: bool = False
    rollout: int = 100


class FeatureFlagUpdateIn(CamelSchema):
    description: str | None = None
    enabled: bool | None = None
    rollout: int | None = None


class FeatureFlagsEvaluationOut(CamelSchema):
    feature_flags: dict[str, bool]
    updated_at: datetime | None = None
