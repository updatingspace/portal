from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from django.db.models import Q
from django.utils import timezone

from access_control.models import (
    Permission,
    PolicyAction,
    PolicyOverride,
    Role,
    RoleBinding,
    RolePermission,
    ScopeType,
    TenantAdminAuditEvent,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MasterFlags:
    suspended: bool = False
    banned: bool = False
    system_admin: bool = False
    membership_status: str | None = None


@dataclass(frozen=True)
class CheckDecision:
    allowed: bool
    reason_code: str
    roles: list[Role]
    permissions: list[str]


def _scope_matches(binding: RoleBinding, tenant_id, scope_type: str, scope_id: str) -> bool:
    if binding.scope_type == ScopeType.GLOBAL:
        return True

    if binding.scope_type == ScopeType.TENANT:
        return binding.scope_id == str(tenant_id)

    # Exact match for other scope types
    return binding.scope_type == scope_type and binding.scope_id == scope_id


def compute_effective_access(
    *,
    tenant_id,
    user_id,
    permission_key: str,
    scope_type: str,
    scope_id: str,
    master_flags: MasterFlags | None = None,
    return_effective_permissions: bool = False,
) -> CheckDecision:
    """Compute effective access for a user inside a tenant.

    Priority:
    1) master_flags.suspended/banned -> deny all
    2) master_flags.system_admin -> allow all (audit)
    3) PolicyOverride deny (global or per-permission)
    4) PolicyOverride allow (global or per-permission)
    5) RBAC-derived permissions
    """

    mf = master_flags or MasterFlags()

    # Validate permission exists
    perm = Permission.objects.filter(key=permission_key).first()
    if not perm:
        return CheckDecision(
            allowed=False,
            reason_code="UNKNOWN_PERMISSION",
            roles=[],
            permissions=[],
        )

    if mf.suspended or mf.banned:
        return CheckDecision(
            allowed=False,
            reason_code="MASTER_SUSPENDED",
            roles=[],
            permissions=[],
        )

    if mf.system_admin:
        logger.warning(
            "System admin access allowed",
            extra={
                "tenant_id": str(tenant_id),
                "user_id": str(user_id),
                "permission": permission_key,
                "scope_type": scope_type,
                "scope_id": scope_id,
            },
        )
        return CheckDecision(
            allowed=True,
            reason_code="MASTER_SYSTEM_ADMIN",
            roles=[],
            permissions=[permission_key] if return_effective_permissions else [],
        )

    # Overrides
    now = timezone.now()
    overrides = list(
        PolicyOverride.objects.filter(tenant_id=tenant_id, user_id=user_id)
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .select_related("permission")
        .order_by("-created_at")
    )

    def _matches_override(o: PolicyOverride) -> bool:
        if o.permission_id is None:
            return True
        return o.permission_id == permission_key

    # deny wins over allow
    for o in overrides:
        if o.action == PolicyAction.DENY and _matches_override(o):
            return CheckDecision(
                allowed=False,
                reason_code="POLICY_DENY",
                roles=[],
                permissions=[],
            )

    for o in overrides:
        if o.action == PolicyAction.ALLOW and _matches_override(o):
            return CheckDecision(
                allowed=True,
                reason_code="POLICY_ALLOW",
                roles=[],
                permissions=[permission_key] if return_effective_permissions else [],
            )

    # RBAC
    bindings = (
        RoleBinding.objects.filter(tenant_id=tenant_id, user_id=user_id)
        .select_related("role")
        .filter(role__service=perm.service)
    )

    effective_roles: list[Role] = []
    role_ids: list[int] = []
    seen_role_ids: set[int] = set()
    for b in bindings:
        if _scope_matches(b, tenant_id, scope_type, scope_id):
            if b.role_id in seen_role_ids:
                continue
            seen_role_ids.add(b.role_id)
            effective_roles.append(b.role)
            role_ids.append(b.role_id)

    if not role_ids:
        return CheckDecision(
            allowed=False,
            reason_code="NO_ROLE",
            roles=[],
            permissions=[],
        )

    perms_qs = RolePermission.objects.filter(role_id__in=role_ids).select_related(
        "permission"
    )

    perm_keys = sorted({rp.permission_id for rp in perms_qs})
    allowed = permission_key in perm_keys

    return CheckDecision(
        allowed=bool(allowed),
        reason_code="RBAC_ALLOW" if allowed else "RBAC_DENY",
        roles=effective_roles,
        permissions=perm_keys if return_effective_permissions else [],
    )


def master_flags_from_dict(master_flags: dict | None) -> MasterFlags:
    flags = master_flags if isinstance(master_flags, dict) else {}
    return MasterFlags(
        suspended=bool(flags.get("suspended", False)),
        banned=bool(flags.get("banned", False)),
        system_admin=bool(flags.get("system_admin", False)),
        membership_status=flags.get("membership_status"),
    )


def log_tenant_admin_event(
    *,
    tenant_id: str | uuid.UUID,
    performed_by: str | uuid.UUID,
    action: str,
    target_type: str,
    target_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> TenantAdminAuditEvent:
    return TenantAdminAuditEvent.objects.create(
        tenant_id=tenant_id,
        performed_by=performed_by,
        action=action,
        target_type=target_type,
        target_id=target_id or "",
        metadata=metadata or {},
    )
