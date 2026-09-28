from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.db import connection
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
from access_control.permissions_mvp import DEFAULT_MEMBER_ROLE_NAME

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

    # Ordinary YDB decisions read one consistent snapshot in a single request.
    # Master denials/admin decisions need only the catalog lookup, as before.
    facts = None
    if (
        connection.vendor == "ydb"
        and settings.ACCESS_YDB_BATCH_CHECKS
        and not (mf.suspended or mf.banned or mf.system_admin)
    ):
        from access_control.ydb_access import load_access_facts

        facts = load_access_facts(
            tenant_id=tenant_id,
            user_id=user_id,
            permission_key=permission_key,
            scope_type=scope_type,
            scope_id=scope_id,
            now=timezone.now(),
            all_permissions=return_effective_permissions,
        )
        perm = facts.permission
    else:
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

    # Deny wins over allow; both loaders apply tenant/user, expiry and key filters.
    if facts is None:
        override_actions = set(
            PolicyOverride.objects.filter(tenant_id=tenant_id, user_id=user_id)
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))
            .filter(Q(permission_id__isnull=True) | Q(permission_id=permission_key))
            .values_list("action", flat=True)
        )
    else:
        override_actions = facts.override_actions
    if PolicyAction.DENY in override_actions:
        return CheckDecision(False, "POLICY_DENY", [], [])
    if PolicyAction.ALLOW in override_actions:
        return CheckDecision(
            True, "POLICY_ALLOW", [],
            [permission_key] if return_effective_permissions else [],
        )

    if facts is not None:
        if not facts.roles:
            return CheckDecision(False, "NO_ROLE", [], [])
        allowed = permission_key in facts.permission_keys
        return CheckDecision(
            allowed=allowed,
            reason_code="RBAC_ALLOW" if allowed else "RBAC_DENY",
            roles=facts.roles,
            permissions=sorted(facts.permission_keys) if return_effective_permissions else [],
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

    # Implicit tenant-wide baseline role for every user.
    # Tenant-specific "member" overrides global system template "member".
    default_role = Role.objects.filter(
        tenant_id=tenant_id,
        service=perm.service,
        name=DEFAULT_MEMBER_ROLE_NAME,
    ).first()
    if default_role is None:
        default_role = Role.objects.filter(
            tenant_id__isnull=True,
            is_system_template=True,
            service=perm.service,
            name=DEFAULT_MEMBER_ROLE_NAME,
        ).first()
    if default_role and default_role.id not in seen_role_ids:
        seen_role_ids.add(default_role.id)
        effective_roles.append(default_role)
        role_ids.append(default_role.id)

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
