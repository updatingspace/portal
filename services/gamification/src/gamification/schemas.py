from __future__ import annotations

from datetime import datetime
from typing import Any

from ninja import Schema


class AchievementImageSet(Schema):
    small: str | None = None
    medium: str | None = None
    large: str | None = None


class AchievementBase(Schema):
    name_i18n: dict[str, str]
    description: str | None = None
    category: str
    status: str | None = None
    images: AchievementImageSet | None = None


class AchievementCreateIn(AchievementBase):
    pass


class AchievementUpdateIn(Schema):
    name_i18n: dict[str, str] | None = None
    description: str | None = None
    category: str | None = None
    status: str | None = None
    images: AchievementImageSet | None = None


class AchievementOut(Schema):
    id: str
    name_i18n: dict[str, str]
    description: str | None
    category: str
    status: str
    images: AchievementImageSet | None
    created_by: str
    created_at: datetime
    updated_at: datetime
    can_edit: bool | None = None
    can_publish: bool | None = None
    can_hide: bool | None = None


class AchievementListOut(Schema):
    items: list[AchievementOut]
    next_cursor: str | None


class GrantCreateIn(Schema):
    recipient_id: str
    reason: str | None = None
    visibility: str = "public"


class GrantOut(Schema):
    id: str
    achievement_id: str
    recipient_id: str
    issuer_id: str
    reason: str | None
    visibility: str
    created_at: datetime
    revoked_at: datetime | None = None


class GrantListOut(Schema):
    items: list[GrantOut]
    next_cursor: str | None


class CategoryCreateIn(Schema):
    id: str
    name_i18n: dict[str, str]
    order: int | None = None
    is_active: bool | None = None


class CategoryUpdateIn(Schema):
    name_i18n: dict[str, str] | None = None
    order: int | None = None
    is_active: bool | None = None


class CategoryOut(Schema):
    id: str
    name_i18n: dict[str, str]
    order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CategoriesListOut(Schema):
    items: list[CategoryOut]


class ErrorResponse(Schema):
    error: dict[str, Any]
