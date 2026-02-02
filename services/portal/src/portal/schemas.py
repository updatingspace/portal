import uuid
from datetime import datetime
from typing import Literal

from core.schemas import CamelSchema


class PortalProfileOut(CamelSchema):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    first_name: str
    last_name: str
    bio: str | None = None
    created_at: datetime
    updated_at: datetime


class PortalProfileUpdateIn(CamelSchema):
    first_name: str | None = None
    last_name: str | None = None
    bio: str | None = None


class CommunityOut(CamelSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CommunityCreateIn(CamelSchema):
    name: str
    description: str | None = ""


class MembershipUpsertIn(CamelSchema):
    user_id: uuid.UUID
    action: Literal["add", "remove"] = "add"
    role_hint: str | None = None


class MembershipCheckOut(CamelSchema):
    member: bool
    role_hint: str | None = None


class TeamOut(CamelSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    community_id: uuid.UUID
    name: str
    status: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class TeamCreateIn(CamelSchema):
    community_id: uuid.UUID
    name: str


class PostOut(CamelSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    community_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    title: str
    body: str
    visibility: str
    created_by: uuid.UUID
    created_at: datetime


class PostCreateIn(CamelSchema):
    community_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    title: str
    body: str
    visibility: Literal["public", "community", "team", "private"]


class ModuleItem(CamelSchema):
    key: str
    enabled: bool


class ModulesOut(CamelSchema):
    modules: list[ModuleItem]
