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


# ---------------------------------------------------------------------------
# Rollout / Feature Flag / Experiment schemas
# ---------------------------------------------------------------------------

RolloutTargetType = Literal["all", "percent", "user_list", "tenant_list"]


class FeatureFlagIn(Schema):
    key: str
    tenant_id: uuid.UUID | None = None
    description: str = ""
    enabled: bool = False
    target_type: RolloutTargetType = "all"
    target_value: dict = {}


class FeatureFlagOut(Schema):
    id: uuid.UUID
    key: str
    tenant_id: uuid.UUID | None = None
    description: str
    enabled: bool
    target_type: RolloutTargetType
    target_value: dict
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID | None = None


class FeatureFlagPatchIn(Schema):
    description: str | None = None
    enabled: bool | None = None
    target_type: RolloutTargetType | None = None
    target_value: dict | None = None


class ExperimentVariantIn(Schema):
    name: str
    weight: int


class ExperimentIn(Schema):
    key: str
    tenant_id: uuid.UUID | None = None
    description: str = ""
    enabled: bool = False
    variants: list[ExperimentVariantIn] = []
    target_type: RolloutTargetType = "all"
    target_value: dict = {}


class ExperimentOut(Schema):
    id: uuid.UUID
    key: str
    tenant_id: uuid.UUID | None = None
    description: str
    enabled: bool
    variants: list[dict]
    target_type: RolloutTargetType
    target_value: dict
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID | None = None


class ExperimentPatchIn(Schema):
    description: str | None = None
    enabled: bool | None = None
    variants: list[ExperimentVariantIn] | None = None
    target_type: RolloutTargetType | None = None
    target_value: dict | None = None


class KillSwitchIn(Schema):
    feature_key: str
    tenant_id: uuid.UUID | None = None
    reason: str = ""


class KillSwitchOut(Schema):
    id: uuid.UUID
    feature_key: str
    tenant_id: uuid.UUID | None = None
    active: bool
    reason: str
    activated_at: datetime
    activated_by: uuid.UUID | None = None


class RolloutEvaluateIn(Schema):
    """Input for evaluating all feature flags and experiments for a user."""
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    user_key_hash: str = ""


class RolloutEvaluateOut(Schema):
    """Result of evaluating rollout for a user."""
    feature_flags: dict[str, bool]
    experiments: dict[str, str]


class RolloutAuditLogOut(Schema):
    id: uuid.UUID
    tenant_id: uuid.UUID | None = None
    performed_by: uuid.UUID
    action: str
    entity_type: str
    entity_id: uuid.UUID
    changes: dict
    created_at: datetime
