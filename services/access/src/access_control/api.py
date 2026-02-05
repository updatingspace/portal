from __future__ import annotations

import json
import logging
from typing import List
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from ninja import Query, Router, Schema
from pydantic import ValidationError

from access_control.models import (
    Permission,
    PolicyOverride,
    Role,
    RoleBinding,
    RolePermission,
    ScopeType,
    TenantAdminAuditEvent,
)
from access_control.context import require_internal_context
from access_control.schemas import (
    CheckIn,
    CheckOut,
    EffectiveRoleOut,
    ErrorEnvelope,
    ErrorOut,
    PermissionOut,
    PolicyOverrideAction,
    PolicyOverrideCreateIn,
    PolicyOverrideOut,
    RoleBindingIn,
    RoleBindingOut,
    RoleIn,
    RoleOut,
    TenantAdminRoleOut,
    TenantAdminBindingOut,
    TenantAdminAuditEventOut,
)
from access_control.services import (
    MasterFlags,
    compute_effective_access,
    log_tenant_admin_event,
    master_flags_from_dict,
)
TenantAdminRoleOut.model_rebuild(force=True)
TenantAdminBindingOut.model_rebuild(force=True)
TenantAdminAuditEventOut.model_rebuild(force=True)

logger = logging.getLogger(__name__)

router = Router(tags=["Access Control"], auth=None)
admin_router = Router(tags=["Access Control Admin"], auth=None)


def _require_tenant_header_matches(request, tenant_id) -> None:
    header = request.headers.get("X-Tenant-Id")
    if header and str(header) != str(tenant_id):
        raise ValueError("TENANT_MISMATCH")


def _error(request, *, status: int, code: str, message: str, details: dict | None = None):
    request_id = request.headers.get("X-Request-Id")
    return status, ErrorOut(
        error=ErrorEnvelope(
            code=code,
            message=message,
            details=details,
            request_id=request_id,
        )
    )


def _policy_override_to_out(override: PolicyOverride) -> PolicyOverrideOut:
    return PolicyOverrideOut(
        id=override.id,
        tenant_id=override.tenant_id,
        user_id=override.user_id,
        action=override.action,
        permission_key=override.permission_id,
        reason=override.reason,
        expires_at=override.expires_at,
        created_at=override.created_at,
    )


def _ensure_tenant_permission(ctx, permission_key: str) -> None:
    decision = compute_effective_access(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        permission_key=permission_key,
        scope_type=ScopeType.TENANT,
        scope_id=str(ctx.tenant_id),
        master_flags=master_flags_from_dict(ctx.master_flags),
    )
    if not decision.allowed:
        raise PermissionError(f"{permission_key} denied")


def _role_to_admin_out(role: Role) -> TenantAdminRoleOut:
    permission_keys = sorted(
        role.role_permissions.values_list("permission_id", flat=True)
    )
    return TenantAdminRoleOut(
        id=role.id,
        tenant_id=role.tenant_id,
        service=role.service,
        name=role.name,
        permission_keys=permission_keys,
    )


def _binding_to_admin_out(binding: RoleBinding) -> TenantAdminBindingOut:
    return TenantAdminBindingOut(
        id=binding.id,
        tenant_id=binding.tenant_id,
        user_id=binding.user_id,
        scope_type=binding.scope_type,
        scope_id=binding.scope_id,
        role_id=binding.role_id,
        role_name=binding.role.name,
        role_service=binding.role.service,
        created_at=binding.created_at,
    )


class TenantRolePayload(Schema):
    service: str
    name: str
    permission_keys: List[str]


TenantRolePayload.model_rebuild(force=True)


@router.post(
    "/check",
    response={200: CheckOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut},
    operation_id="access_check",
)
def check_access(request, payload: CheckIn):
    try:
        ctx = require_internal_context(request)
    except Exception:
        # Let the global HttpError handler format errors consistently with the rest of the app.
        raise

    # Enforce tenant/user consistency (anti-confusion)
    if str(payload.tenant_id) != str(ctx.tenant_id):
        return _error(
            request,
            status=400,
            code="TENANT_MISMATCH",
            message="tenant_id does not match X-Tenant-Id",
        )
    if str(payload.user_id) != str(ctx.user_id):
        return _error(
            request,
            status=400,
            code="USER_MISMATCH",
            message="user_id does not match X-User-Id",
        )

    mf_in = payload.master_flags
    mf = MasterFlags(
        suspended=bool(getattr(mf_in, "suspended", False)) if mf_in else bool(ctx.master_flags.get("suspended")),
        banned=bool(getattr(mf_in, "banned", False)) if mf_in else bool(ctx.master_flags.get("banned")),
        system_admin=bool(getattr(mf_in, "system_admin", False)) if mf_in else bool(ctx.master_flags.get("system_admin")),
        membership_status=getattr(mf_in, "membership_status", None) if mf_in else ctx.master_flags.get("membership_status"),
    )

    decision = compute_effective_access(
        tenant_id=payload.tenant_id,
        user_id=payload.user_id,
        permission_key=payload.action,
        scope_type=payload.scope.type,
        scope_id=payload.scope.id,
        master_flags=mf,
        return_effective_permissions=payload.return_effective_permissions,
    )

    return CheckOut(
        allowed=decision.allowed,
        reason_code=decision.reason_code,
        effective_roles=[
            EffectiveRoleOut(id=r.id, name=r.name, service=r.service) for r in decision.roles
        ],
        effective_permissions=decision.permissions if payload.return_effective_permissions else None,
    )


@router.get(
    "/permissions",
    response={200: list[PermissionOut], 401: ErrorOut},
    operation_id="permissions_list",
)
def list_permissions(request, service: str | None = None):
    require_internal_context(request)

    qs = Permission.objects.all().order_by("service", "key")
    if service:
        qs = qs.filter(service=service)
    return [PermissionOut(key=p.key, description=p.description, service=p.service) for p in qs]


@router.get(
    "/roles",
    response={200: list[RoleOut], 401: ErrorOut},
    operation_id="roles_list",
)
def list_roles(request, service: str | None = None):
    require_internal_context(request)

    qs = Role.objects.all().order_by("service", "tenant_id", "name")
    if service:
        qs = qs.filter(service=service)
    return [
        RoleOut(
            id=r.id,
            tenant_id=r.tenant_id,
            service=r.service,
            name=r.name,
            is_system_template=r.is_system_template,
        )
        for r in qs
    ]


def _require_admin(ctx) -> None:
    flags = getattr(ctx, "master_flags", None)
    flags = flags if isinstance(flags, dict) else {}
    if not bool(flags.get("system_admin")):
        raise PermissionError("SYSTEM_ADMIN_REQUIRED")


def _resolve_permissions(permission_keys: list[str]) -> tuple[list[Permission], list[str]]:
    if not permission_keys:
        return [], []
    unique_keys = list(dict.fromkeys(permission_keys))
    permissions = list(Permission.objects.filter(key__in=unique_keys))
    found = {p.key for p in permissions}
    missing = [key for key in unique_keys if key not in found]
    return permissions, missing


def _tenant_permission_denied(request):
    return _error(
        request,
        status=403,
        code="FORBIDDEN",
        message="Tenant admin permissions required",
    )


@router.post(
    "/roles",
    response={201: RoleOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut},
    operation_id="roles_create",
)
@transaction.atomic
def create_role(request, payload: RoleIn):
    ctx = require_internal_context(request)

    try:
        _require_admin(ctx)
    except PermissionError:
        status, body = _error(request, status=403, code="FORBIDDEN", message="Superuser required")
        return status, body

    role = Role.objects.create(
        tenant_id=payload.tenant_id,
        service=payload.service,
        name=payload.name,
        is_system_template=payload.is_system_template,
    )
    out = RoleOut(
        id=role.id,
        tenant_id=role.tenant_id,
        service=role.service,
        name=role.name,
        is_system_template=role.is_system_template,
    )
    return 201, out


@router.post(
    "/role-bindings",
    response={201: RoleBindingOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut},
    operation_id="role_bindings_create",
)
@transaction.atomic
def create_role_binding(request, payload: RoleBindingIn):
    ctx = require_internal_context(request)

    try:
        _require_admin(ctx)
    except PermissionError:
        status, body = _error(request, status=403, code="FORBIDDEN", message="Superuser required")
        return status, body

    role = Role.objects.filter(id=payload.role_id).first()
    if not role:
        status, body = _error(request, status=400, code="ROLE_NOT_FOUND", message="Role not found")
        return status, body

    rb = RoleBinding.objects.create(
        tenant_id=payload.tenant_id,
        user_id=payload.user_id,
        scope_type=payload.scope_type,
        scope_id=payload.scope_id,
        role=role,
    )

    out = RoleBindingOut(
        id=rb.id,
        tenant_id=rb.tenant_id,
        user_id=rb.user_id,
        scope_type=rb.scope_type,
        scope_id=rb.scope_id,
        role_id=rb.role_id,
        created_at=rb.created_at,
    )
    return 201, out


@router.delete(
    "/role-bindings/{binding_id}",
    response={200: dict, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="role_bindings_delete",
)
@transaction.atomic
def delete_role_binding(request, binding_id: int):
    ctx = require_internal_context(request)

    try:
        _require_admin(ctx)
    except PermissionError:
        status, body = _error(request, status=403, code="FORBIDDEN", message="Superuser required")
        return status, body

    rb = RoleBinding.objects.filter(id=binding_id).first()
    if not rb:
        status, body = _error(request, status=404, code="NOT_FOUND", message="Role binding not found")
        return status, body

    rb.delete()
    return {"ok": True}


@admin_router.get(
    "/roles",
    response={200: list[TenantAdminRoleOut], 401: ErrorOut, 403: ErrorOut},
    operation_id="tenant_admin_roles_list",
)
def list_tenant_roles(
    request,
    service: str | None = Query(None),
    query: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
):
    ctx = require_internal_context(request)
    try:
        _ensure_tenant_permission(ctx, "portal.roles.read")
    except PermissionError:
        return _tenant_permission_denied(request)

    qs = Role.objects.filter(Q(tenant_id=ctx.tenant_id) | Q(tenant_id__isnull=True))
    if service:
        qs = qs.filter(service=service)
    if query:
        qs = qs.filter(name__icontains=query)
    qs = qs.order_by("service", "name").prefetch_related("role_permissions")

    roles = list(qs[:limit])
    return [_role_to_admin_out(role) for role in roles]


@admin_router.post(
    "/roles",
    response={201: TenantAdminRoleOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut},
    operation_id="tenant_admin_roles_create",
)
@transaction.atomic
def create_tenant_role(request):
    ctx = require_internal_context(request)
    try:
        _ensure_tenant_permission(ctx, "portal.roles.write")
    except PermissionError:
        return _tenant_permission_denied(request)

    try:
        payload_data = json.loads(request.body or b"{}")
    except ValueError:
        return _error(
            request,
            status=400,
            code="INVALID_JSON",
            message="Invalid JSON body",
        )

    try:
        payload = TenantRolePayload.model_validate(payload_data)
    except ValidationError as exc:
        return _error(
            request,
            status=400,
            code="VALIDATION_ERROR",
            message="Invalid payload",
            details={"errors": exc.errors()},
        )

    permissions, missing = _resolve_permissions(payload.permission_keys)
    if missing:
        return _error(
            request,
            status=400,
            code="PERMISSION_NOT_FOUND",
            message="Permissions not found",
            details={"missing": missing},
        )

    try:
        role = Role.objects.create(
            tenant_id=ctx.tenant_id,
            service=payload.service,
            name=payload.name,
            is_system_template=False,
        )
    except IntegrityError:
        return _error(
            request,
            status=400,
            code="ROLE_EXISTS",
            message="Role with this name already exists",
        )

    if permissions:
        RolePermission.objects.bulk_create(
            [RolePermission(role=role, permission=perm) for perm in permissions]
        )

    log_tenant_admin_event(
        tenant_id=ctx.tenant_id,
        performed_by=ctx.user_id,
        action="role_created",
        target_type="role",
        target_id=str(role.id),
        metadata={
            "service": role.service,
            "name": role.name,
            "permission_keys": [perm.key for perm in permissions],
        },
    )

    return 201, _role_to_admin_out(role)


@admin_router.patch(
    "/roles/{role_id}",
    response={200: TenantAdminRoleOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="tenant_admin_roles_update",
)
@transaction.atomic
def update_tenant_role(request, role_id: int):
    ctx = require_internal_context(request)
    try:
        _ensure_tenant_permission(ctx, "portal.roles.write")
    except PermissionError:
        return _tenant_permission_denied(request)

    try:
        payload_data = json.loads(request.body or b"{}")
    except ValueError:
        return _error(
            request,
            status=400,
            code="INVALID_JSON",
            message="Invalid JSON body",
        )

    try:
        payload = TenantRolePayload.model_validate(payload_data)
    except ValidationError as exc:
        return _error(
            request,
            status=400,
            code="VALIDATION_ERROR",
            message="Invalid payload",
            details={"errors": exc.errors()},
        )

    role = Role.objects.filter(id=role_id, tenant_id=ctx.tenant_id).first()
    if not role:
        return _error(
            request,
            status=404,
            code="ROLE_NOT_FOUND",
            message="Role not found",
        )

    permissions, missing = _resolve_permissions(payload.permission_keys)
    if missing:
        return _error(
            request,
            status=400,
            code="PERMISSION_NOT_FOUND",
            message="Permissions not found",
            details={"missing": missing},
        )

    role.service = payload.service
    role.name = payload.name
    try:
        role.save(update_fields=["service", "name", "updated_at"])
    except IntegrityError:
        return _error(
            request,
            status=400,
            code="ROLE_EXISTS",
            message="Role with this name already exists",
        )

    RolePermission.objects.filter(role=role).delete()
    if permissions:
        RolePermission.objects.bulk_create(
            [RolePermission(role=role, permission=perm) for perm in permissions]
        )

    log_tenant_admin_event(
        tenant_id=ctx.tenant_id,
        performed_by=ctx.user_id,
        action="role_updated",
        target_type="role",
        target_id=str(role.id),
        metadata={
            "service": role.service,
            "name": role.name,
            "permission_keys": [perm.key for perm in permissions],
        },
    )

    return _role_to_admin_out(role)


@admin_router.delete(
    "/roles/{role_id}",
    response={200: dict, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="tenant_admin_roles_delete",
)
@transaction.atomic
def delete_tenant_role(request, role_id: int):
    ctx = require_internal_context(request)
    try:
        _ensure_tenant_permission(ctx, "portal.roles.write")
    except PermissionError:
        return _tenant_permission_denied(request)

    role = Role.objects.filter(id=role_id, tenant_id=ctx.tenant_id).first()
    if not role:
        return _error(
            request,
            status=404,
            code="ROLE_NOT_FOUND",
            message="Role not found",
        )

    log_tenant_admin_event(
        tenant_id=ctx.tenant_id,
        performed_by=ctx.user_id,
        action="role_deleted",
        target_type="role",
        target_id=str(role.id),
        metadata={"service": role.service, "name": role.name},
    )
    role.delete()
    return {"ok": True}


@admin_router.get(
    "/role-bindings/search",
    response={200: list[TenantAdminBindingOut], 401: ErrorOut, 403: ErrorOut},
    operation_id="tenant_admin_role_bindings_search",
)
def search_role_bindings(
    request,
    *,
    q: str | None = Query(None),
    scope_type: ScopeType | None = Query(None),
    scope_id: str | None = Query(None),
    user_id: UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    ctx = require_internal_context(request)
    try:
        _ensure_tenant_permission(ctx, "portal.roles.read")
    except PermissionError:
        return _tenant_permission_denied(request)

    qs = RoleBinding.objects.filter(tenant_id=ctx.tenant_id).select_related("role")
    if q:
        q = q.strip()
        if q:
            name_filter = Q(role__name__icontains=q) | Q(role__service__icontains=q)
            try:
                parsed_user_id = UUID(str(q))
            except ValueError:
                parsed_user_id = None
            if parsed_user_id:
                name_filter = name_filter | Q(user_id=parsed_user_id)
            qs = qs.filter(name_filter)
    if scope_type:
        qs = qs.filter(scope_type=scope_type)
    if scope_id:
        qs = qs.filter(scope_id=scope_id)
    if user_id:
        qs = qs.filter(user_id=user_id)
    qs = qs.order_by("-created_at")

    bindings = list(qs[:limit])
    return [_binding_to_admin_out(binding) for binding in bindings]


@admin_router.post(
    "/role-bindings",
    response={201: TenantAdminBindingOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut},
    operation_id="tenant_admin_role_bindings_create",
)
@transaction.atomic
def create_tenant_role_binding(request):
    ctx = require_internal_context(request)
    try:
        _ensure_tenant_permission(ctx, "portal.role_bindings.write")
    except PermissionError:
        return _tenant_permission_denied(request)

    try:
        payload_data = json.loads(request.body or b"{}")
    except ValueError:
        return _error(
            request,
            status=400,
            code="INVALID_JSON",
            message="Invalid JSON body",
        )

    try:
        payload = RoleBindingIn.model_validate(payload_data)
    except ValidationError as exc:
        return _error(
            request,
            status=400,
            code="VALIDATION_ERROR",
            message="Invalid payload",
            details={"errors": exc.errors()},
        )

    if str(payload.tenant_id) != str(ctx.tenant_id):
        return _error(
            request,
            status=400,
            code="TENANT_MISMATCH",
            message="tenant_id does not match X-Tenant-Id",
        )

    role = Role.objects.filter(id=payload.role_id).filter(
        Q(tenant_id=ctx.tenant_id) | Q(tenant_id__isnull=True)
    ).first()
    if not role:
        return _error(
            request,
            status=400,
            code="ROLE_NOT_FOUND",
            message="Role not found",
        )

    binding = RoleBinding.objects.create(
        tenant_id=ctx.tenant_id,
        user_id=payload.user_id,
        scope_type=payload.scope_type,
        scope_id=payload.scope_id,
        role=role,
    )

    log_tenant_admin_event(
        tenant_id=ctx.tenant_id,
        performed_by=ctx.user_id,
        action="binding_created",
        target_type="binding",
        target_id=str(binding.id),
        metadata={
            "user_id": str(binding.user_id),
            "role_id": str(binding.role_id),
            "scope_type": binding.scope_type,
            "scope_id": binding.scope_id,
        },
    )

    return 201, _binding_to_admin_out(binding)


@admin_router.delete(
    "/role-bindings/{binding_id}",
    response={200: dict, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="tenant_admin_role_bindings_delete",
)
@transaction.atomic
def delete_tenant_role_binding(request, binding_id: int):
    ctx = require_internal_context(request)
    try:
        _ensure_tenant_permission(ctx, "portal.role_bindings.write")
    except PermissionError:
        return _tenant_permission_denied(request)

    binding = RoleBinding.objects.filter(id=binding_id, tenant_id=ctx.tenant_id).select_related("role").first()
    if not binding:
        return _error(
            request,
            status=404,
            code="NOT_FOUND",
            message="Role binding not found",
        )

    log_tenant_admin_event(
        tenant_id=ctx.tenant_id,
        performed_by=ctx.user_id,
        action="binding_deleted",
        target_type="binding",
        target_id=str(binding.id),
        metadata={
            "role_id": str(binding.role_id),
            "user_id": str(binding.user_id),
        },
    )

    binding.delete()
    return {"ok": True}


@admin_router.get(
    "/events",
    response={200: list[TenantAdminAuditEventOut], 401: ErrorOut, 403: ErrorOut},
    operation_id="tenant_admin_events_list",
)
def list_tenant_admin_events(
    request,
    limit: int = Query(50, ge=1, le=200),
):
    ctx = require_internal_context(request)
    try:
        _ensure_tenant_permission(ctx, "portal.roles.read")
    except PermissionError:
        return _tenant_permission_denied(request)

    events = TenantAdminAuditEvent.objects.filter(tenant_id=ctx.tenant_id).order_by("-created_at")[:limit]
    return [
        TenantAdminAuditEventOut(
            id=event.id,
            action=event.action,
            target_type=event.target_type,
            target_id=event.target_id or None,
            metadata=event.metadata or {},
            performed_by=event.performed_by,
            created_at=event.created_at,
        )
        for event in events
    ]


router.add_router("/admin", admin_router)


@router.post(
    "/policy-overrides",
    response={201: PolicyOverrideOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut},
    operation_id="policy_overrides_create",
)
@transaction.atomic
def create_policy_override(request):
    ctx = require_internal_context(request)

    try:
        _require_admin(ctx)
    except PermissionError:
        status, body = _error(request, status=403, code="FORBIDDEN", message="Superuser required")
        return status, body

    try:
        payload_data = json.loads(request.body or b"{}")
    except ValueError:
        return _error(
            request,
            status=400,
            code="INVALID_JSON",
            message="Invalid JSON body",
        )

    try:
        payload = PolicyOverrideCreateIn.model_validate(payload_data)
    except ValidationError as exc:
        return _error(
            request,
            status=400,
            code="VALIDATION_ERROR",
            message="Invalid payload",
            details={"errors": exc.errors()},
        )

    try:
        _require_tenant_header_matches(request, payload.tenant_id)
    except ValueError:
        return _error(
            request,
            status=400,
            code="TENANT_MISMATCH",
            message="tenant_id does not match X-Tenant-Id",
        )

    permission = None
    if payload.permission_key:
        permission = Permission.objects.filter(key=payload.permission_key).first()
        if not permission:
            return _error(
                request,
                status=400,
                code="PERMISSION_NOT_FOUND",
                message="Permission not found",
            )

    override = PolicyOverride.objects.create(
        tenant_id=payload.tenant_id,
        user_id=payload.user_id,
        action=payload.action,
        permission=permission,
        reason=(payload.reason or ""),
        expires_at=payload.expires_at,
    )

    return 201, _policy_override_to_out(override)


@router.get(
    "/policy-overrides",
    response={200: list[PolicyOverrideOut], 401: ErrorOut, 403: ErrorOut},
    operation_id="policy_overrides_list",
)
def list_policy_overrides(
    request,
    *,
    action: PolicyOverrideAction | None = Query(None),
    user_id: UUID | None = Query(None),
    permission_key: str | None = Query(None),
    active: bool | None = Query(None),
):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        status, body = _error(request, status=403, code="FORBIDDEN", message="Superuser required")
        return status, body

    tenant_id = ctx.tenant_id
    qs = PolicyOverride.objects.filter(tenant_id=tenant_id)

    if action:
        qs = qs.filter(action=action)
    if user_id:
        qs = qs.filter(user_id=user_id)
    if permission_key:
        qs = qs.filter(permission_id=permission_key)

    now = timezone.now()
    if active is True:
        qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
    elif active is False:
        qs = qs.filter(expires_at__isnull=False, expires_at__lte=now)

    qs = qs.order_by("-created_at")

    return [_policy_override_to_out(o) for o in qs]


@router.delete(
    "/policy-overrides/{override_id}",
    response={200: dict, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="policy_overrides_delete",
)
@transaction.atomic
def delete_policy_override(request, override_id: str):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        status, body = _error(request, status=403, code="FORBIDDEN", message="Superuser required")
        return status, body

    override = PolicyOverride.objects.filter(id=override_id, tenant_id=ctx.tenant_id).first()
    if not override:
        return _error(
            request,
            status=404,
            code="NOT_FOUND",
            message="Policy override not found",
        )

    override.delete()
    return {"ok": True}
