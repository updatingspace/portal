from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, List, Literal

from ninja import Schema


ScopeType = Literal["GLOBAL", "TENANT", "COMMUNITY", "TEAM", "SERVICE"]
Visibility = Literal["public", "community", "team", "private"]


class ErrorEnvelope(Schema):
    code: str
    message: str
    details: dict | None = None
    request_id: str | None = None


class ErrorOut(Schema):
    error: ErrorEnvelope


class MasterFlagsIn(Schema):
    suspended: bool = False
    banned: bool = False
    system_admin: bool = False
    membership_status: str | None = None


class ScopeIn(Schema):
    type: ScopeType
    id: str


class CheckIn(Schema):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    action: str
    scope: ScopeIn
    resource_visibility: Visibility | None = None
    resource_owner_id: uuid.UUID | None = None
    master_flags: MasterFlagsIn | None = None
    return_effective_permissions: bool = False


class EffectiveRoleOut(Schema):
    id: int
    name: str
    service: str


class CheckOut(Schema):
    allowed: bool
    reason_code: str
    effective_roles: list[EffectiveRoleOut]
    effective_permissions: list[str] | None = None


class PermissionOut(Schema):
    key: str
    description: str
    service: str


class RoleOut(Schema):
    id: int
    tenant_id: uuid.UUID | None
    service: str
    name: str
    is_system_template: bool


class RoleIn(Schema):
    tenant_id: uuid.UUID | None = None
    service: str
    name: str
    is_system_template: bool = False


class RoleBindingOut(Schema):
    id: int
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    scope_type: ScopeType
    scope_id: str
    role_id: int
    created_at: datetime


class RoleBindingIn(Schema):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    scope_type: ScopeType
    scope_id: str
    role_id: int


RoleOut.model_rebuild(force=True)
RoleIn.model_rebuild(force=True)
RoleBindingOut.model_rebuild(force=True)
RoleBindingIn.model_rebuild(force=True)


PolicyOverrideAction = Literal["deny", "allow"]


class PolicyOverrideCreateIn(Schema):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    action: PolicyOverrideAction
    permission_key: str | None = None
    reason: str | None = None
    expires_at: datetime | None = None


class PolicyOverrideOut(Schema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    action: PolicyOverrideAction
    permission_key: str | None = None
    reason: str
    expires_at: datetime | None = None
    created_at: datetime


PolicyOverrideCreateIn.model_rebuild()
PolicyOverrideOut.model_rebuild()


class TenantAdminRoleOut(Schema):
    id: int
    tenant_id: uuid.UUID | None
    service: str
    name: str
    permission_keys: List[str]


class TenantAdminBindingOut(Schema):
    id: int
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    scope_type: ScopeType
    scope_id: str
    role_id: int
    role_name: str
    role_service: str
    created_at: datetime


class TenantAdminAuditEventOut(Schema):
    id: uuid.UUID
    action: str
    target_type: str
    target_id: str | None
    metadata: dict[str, Any]
    performed_by: uuid.UUID
    created_at: datetime


TenantAdminRoleOut.model_rebuild()
TenantAdminBindingOut.model_rebuild()
TenantAdminAuditEventOut.model_rebuild()
