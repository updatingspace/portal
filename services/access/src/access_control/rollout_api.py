"""
Rollout API endpoints for feature flags, experiments, kill switches.

Provides:
- CRUD for FeatureFlag, Experiment, KillSwitch
- POST /rollout/evaluate — internal endpoint for BFF to evaluate rollout
"""
from __future__ import annotations

import logging
from uuid import UUID

from django.db import IntegrityError, transaction
from ninja import Router

from access_control.context import require_internal_context
from access_control.models import (
    Experiment,
    FeatureFlag,
    KillSwitch,
    RolloutAuditLog,
)
from access_control.rollout_services import evaluate_rollout
from access_control.schemas import (
    ErrorEnvelope,
    ErrorOut,
    ExperimentIn,
    ExperimentOut,
    ExperimentPatchIn,
    FeatureFlagIn,
    FeatureFlagOut,
    FeatureFlagPatchIn,
    KillSwitchIn,
    KillSwitchOut,
    RolloutAuditLogOut,
    RolloutEvaluateIn,
    RolloutEvaluateOut,
)
from access_control.services import (
    MasterFlags,
    master_flags_from_dict,
)

logger = logging.getLogger(__name__)

rollout_router = Router(tags=["Rollout"], auth=None)


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


def _require_admin(ctx) -> None:
    """Require superuser/system_admin for rollout management."""
    mf = master_flags_from_dict(ctx.master_flags)
    if not mf.system_admin:
        raise PermissionError("Superuser required for rollout management")


def _log_rollout_change(
    tenant_id: UUID | None,
    performed_by: UUID,
    action: str,
    entity_type: str,
    entity_id: UUID,
    changes: dict | None = None,
) -> None:
    RolloutAuditLog.objects.create(
        tenant_id=tenant_id,
        performed_by=performed_by,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=changes or {},
    )


# ---------------------------------------------------------------------------
# Evaluate (internal, called by BFF)
# ---------------------------------------------------------------------------


@rollout_router.post(
    "/evaluate",
    response={200: RolloutEvaluateOut, 401: ErrorOut},
    operation_id="rollout_evaluate",
)
def rollout_evaluate(request, body: RolloutEvaluateIn):
    """Evaluate all feature flags and experiments for user+tenant."""
    require_internal_context(request)

    feature_flags, experiments = evaluate_rollout(
        tenant_id=body.tenant_id,
        user_id=body.user_id,
        user_key_hash=body.user_key_hash,
    )

    return RolloutEvaluateOut(feature_flags=feature_flags, experiments=experiments)


# ---------------------------------------------------------------------------
# Feature Flags CRUD
# ---------------------------------------------------------------------------


@rollout_router.get(
    "/flags",
    response={200: list[FeatureFlagOut], 401: ErrorOut, 403: ErrorOut},
    operation_id="rollout_flags_list",
)
def list_flags(request, tenant_id: UUID | None = None):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    qs = FeatureFlag.objects.all()
    if tenant_id is not None:
        qs = qs.filter(tenant_id=tenant_id)
    qs = qs.order_by("key", "-tenant_id")
    return [
        FeatureFlagOut(
            id=f.id,
            key=f.key,
            tenant_id=f.tenant_id,
            description=f.description,
            enabled=f.enabled,
            target_type=f.target_type,
            target_value=f.target_value,
            created_at=f.created_at,
            updated_at=f.updated_at,
            created_by=f.created_by,
        )
        for f in qs
    ]


@rollout_router.post(
    "/flags",
    response={201: FeatureFlagOut, 401: ErrorOut, 403: ErrorOut, 409: ErrorOut},
    operation_id="rollout_flags_create",
)
@transaction.atomic
def create_flag(request, body: FeatureFlagIn):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    try:
        flag = FeatureFlag.objects.create(
            key=body.key,
            tenant_id=body.tenant_id,
            description=body.description,
            enabled=body.enabled,
            target_type=body.target_type,
            target_value=body.target_value,
            created_by=ctx.user_id,
        )
    except IntegrityError:
        return _error(request, status=409, code="CONFLICT", message=f"Flag '{body.key}' already exists")

    _log_rollout_change(
        tenant_id=body.tenant_id,
        performed_by=ctx.user_id,
        action="flag.created",
        entity_type="feature_flag",
        entity_id=flag.id,
        changes={"key": body.key, "enabled": body.enabled},
    )

    return 201, FeatureFlagOut(
        id=flag.id,
        key=flag.key,
        tenant_id=flag.tenant_id,
        description=flag.description,
        enabled=flag.enabled,
        target_type=flag.target_type,
        target_value=flag.target_value,
        created_at=flag.created_at,
        updated_at=flag.updated_at,
        created_by=flag.created_by,
    )


@rollout_router.patch(
    "/flags/{flag_id}",
    response={200: FeatureFlagOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="rollout_flags_update",
)
@transaction.atomic
def update_flag(request, flag_id: UUID, body: FeatureFlagPatchIn):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    flag = FeatureFlag.objects.filter(id=flag_id).first()
    if not flag:
        return _error(request, status=404, code="NOT_FOUND", message="Flag not found")

    changes: dict = {}
    if body.description is not None:
        changes["description"] = [flag.description, body.description]
        flag.description = body.description
    if body.enabled is not None:
        changes["enabled"] = [flag.enabled, body.enabled]
        flag.enabled = body.enabled
    if body.target_type is not None:
        changes["target_type"] = [flag.target_type, body.target_type]
        flag.target_type = body.target_type
    if body.target_value is not None:
        changes["target_value"] = [flag.target_value, body.target_value]
        flag.target_value = body.target_value

    flag.save()
    _log_rollout_change(
        tenant_id=flag.tenant_id,
        performed_by=ctx.user_id,
        action="flag.updated",
        entity_type="feature_flag",
        entity_id=flag.id,
        changes=changes,
    )

    return FeatureFlagOut(
        id=flag.id,
        key=flag.key,
        tenant_id=flag.tenant_id,
        description=flag.description,
        enabled=flag.enabled,
        target_type=flag.target_type,
        target_value=flag.target_value,
        created_at=flag.created_at,
        updated_at=flag.updated_at,
        created_by=flag.created_by,
    )


@rollout_router.delete(
    "/flags/{flag_id}",
    response={200: dict, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="rollout_flags_delete",
)
@transaction.atomic
def delete_flag(request, flag_id: UUID):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    flag = FeatureFlag.objects.filter(id=flag_id).first()
    if not flag:
        return _error(request, status=404, code="NOT_FOUND", message="Flag not found")

    _log_rollout_change(
        tenant_id=flag.tenant_id,
        performed_by=ctx.user_id,
        action="flag.deleted",
        entity_type="feature_flag",
        entity_id=flag.id,
        changes={"key": flag.key},
    )
    flag.delete()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Experiments CRUD
# ---------------------------------------------------------------------------


@rollout_router.get(
    "/experiments",
    response={200: list[ExperimentOut], 401: ErrorOut, 403: ErrorOut},
    operation_id="rollout_experiments_list",
)
def list_experiments(request, tenant_id: UUID | None = None):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    qs = Experiment.objects.all()
    if tenant_id is not None:
        qs = qs.filter(tenant_id=tenant_id)
    qs = qs.order_by("key", "-tenant_id")
    return [
        ExperimentOut(
            id=e.id,
            key=e.key,
            tenant_id=e.tenant_id,
            description=e.description,
            enabled=e.enabled,
            variants=e.variants if isinstance(e.variants, list) else [],
            target_type=e.target_type,
            target_value=e.target_value,
            created_at=e.created_at,
            updated_at=e.updated_at,
            created_by=e.created_by,
        )
        for e in qs
    ]


@rollout_router.post(
    "/experiments",
    response={201: ExperimentOut, 401: ErrorOut, 403: ErrorOut, 409: ErrorOut},
    operation_id="rollout_experiments_create",
)
@transaction.atomic
def create_experiment(request, body: ExperimentIn):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    variants_dicts = [{"name": v.name, "weight": v.weight} for v in body.variants]

    try:
        exp = Experiment.objects.create(
            key=body.key,
            tenant_id=body.tenant_id,
            description=body.description,
            enabled=body.enabled,
            variants=variants_dicts,
            target_type=body.target_type,
            target_value=body.target_value,
            created_by=ctx.user_id,
        )
    except IntegrityError:
        return _error(request, status=409, code="CONFLICT", message=f"Experiment '{body.key}' already exists")

    _log_rollout_change(
        tenant_id=body.tenant_id,
        performed_by=ctx.user_id,
        action="experiment.created",
        entity_type="experiment",
        entity_id=exp.id,
        changes={"key": body.key, "enabled": body.enabled, "variants": variants_dicts},
    )

    return 201, ExperimentOut(
        id=exp.id,
        key=exp.key,
        tenant_id=exp.tenant_id,
        description=exp.description,
        enabled=exp.enabled,
        variants=exp.variants,
        target_type=exp.target_type,
        target_value=exp.target_value,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
        created_by=exp.created_by,
    )


@rollout_router.patch(
    "/experiments/{experiment_id}",
    response={200: ExperimentOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="rollout_experiments_update",
)
@transaction.atomic
def update_experiment(request, experiment_id: UUID, body: ExperimentPatchIn):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    exp = Experiment.objects.filter(id=experiment_id).first()
    if not exp:
        return _error(request, status=404, code="NOT_FOUND", message="Experiment not found")

    changes: dict = {}
    if body.description is not None:
        changes["description"] = [exp.description, body.description]
        exp.description = body.description
    if body.enabled is not None:
        changes["enabled"] = [exp.enabled, body.enabled]
        exp.enabled = body.enabled
    if body.variants is not None:
        old_variants = exp.variants
        new_variants = [{"name": v.name, "weight": v.weight} for v in body.variants]
        changes["variants"] = [old_variants, new_variants]
        exp.variants = new_variants
    if body.target_type is not None:
        changes["target_type"] = [exp.target_type, body.target_type]
        exp.target_type = body.target_type
    if body.target_value is not None:
        changes["target_value"] = [exp.target_value, body.target_value]
        exp.target_value = body.target_value

    exp.save()
    _log_rollout_change(
        tenant_id=exp.tenant_id,
        performed_by=ctx.user_id,
        action="experiment.updated",
        entity_type="experiment",
        entity_id=exp.id,
        changes=changes,
    )

    return ExperimentOut(
        id=exp.id,
        key=exp.key,
        tenant_id=exp.tenant_id,
        description=exp.description,
        enabled=exp.enabled,
        variants=exp.variants if isinstance(exp.variants, list) else [],
        target_type=exp.target_type,
        target_value=exp.target_value,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
        created_by=exp.created_by,
    )


@rollout_router.delete(
    "/experiments/{experiment_id}",
    response={200: dict, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="rollout_experiments_delete",
)
@transaction.atomic
def delete_experiment(request, experiment_id: UUID):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    exp = Experiment.objects.filter(id=experiment_id).first()
    if not exp:
        return _error(request, status=404, code="NOT_FOUND", message="Experiment not found")

    _log_rollout_change(
        tenant_id=exp.tenant_id,
        performed_by=ctx.user_id,
        action="experiment.deleted",
        entity_type="experiment",
        entity_id=exp.id,
        changes={"key": exp.key},
    )
    exp.delete()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Kill Switches
# ---------------------------------------------------------------------------


@rollout_router.get(
    "/kill-switches",
    response={200: list[KillSwitchOut], 401: ErrorOut, 403: ErrorOut},
    operation_id="rollout_kill_switches_list",
)
def list_kill_switches(request, tenant_id: UUID | None = None):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    qs = KillSwitch.objects.all()
    if tenant_id is not None:
        qs = qs.filter(tenant_id=tenant_id)
    qs = qs.order_by("feature_key")
    return [
        KillSwitchOut(
            id=ks.id,
            feature_key=ks.feature_key,
            tenant_id=ks.tenant_id,
            active=ks.active,
            reason=ks.reason,
            activated_at=ks.activated_at,
            activated_by=ks.activated_by,
        )
        for ks in qs
    ]


@rollout_router.post(
    "/kill-switches",
    response={201: KillSwitchOut, 401: ErrorOut, 403: ErrorOut, 409: ErrorOut},
    operation_id="rollout_kill_switches_create",
)
@transaction.atomic
def create_kill_switch(request, body: KillSwitchIn):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    try:
        ks = KillSwitch.objects.create(
            feature_key=body.feature_key,
            tenant_id=body.tenant_id,
            reason=body.reason,
            active=True,
            activated_by=ctx.user_id,
        )
    except IntegrityError:
        return _error(
            request,
            status=409,
            code="CONFLICT",
            message=f"Kill switch for '{body.feature_key}' already exists",
        )

    _log_rollout_change(
        tenant_id=body.tenant_id,
        performed_by=ctx.user_id,
        action="kill_switch.activated",
        entity_type="kill_switch",
        entity_id=ks.id,
        changes={"feature_key": body.feature_key, "reason": body.reason},
    )

    return 201, KillSwitchOut(
        id=ks.id,
        feature_key=ks.feature_key,
        tenant_id=ks.tenant_id,
        active=ks.active,
        reason=ks.reason,
        activated_at=ks.activated_at,
        activated_by=ks.activated_by,
    )


@rollout_router.delete(
    "/kill-switches/{kill_switch_id}",
    response={200: dict, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="rollout_kill_switches_deactivate",
)
@transaction.atomic
def deactivate_kill_switch(request, kill_switch_id: UUID):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    ks = KillSwitch.objects.filter(id=kill_switch_id).first()
    if not ks:
        return _error(request, status=404, code="NOT_FOUND", message="Kill switch not found")

    ks.active = False
    ks.save()

    _log_rollout_change(
        tenant_id=ks.tenant_id,
        performed_by=ctx.user_id,
        action="kill_switch.deactivated",
        entity_type="kill_switch",
        entity_id=ks.id,
        changes={"feature_key": ks.feature_key},
    )

    return {"ok": True}


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------


@rollout_router.get(
    "/audit-log",
    response={200: list[RolloutAuditLogOut], 401: ErrorOut, 403: ErrorOut},
    operation_id="rollout_audit_log_list",
)
def list_rollout_audit_logs(request, tenant_id: UUID | None = None, limit: int = 50):
    ctx = require_internal_context(request)
    try:
        _require_admin(ctx)
    except PermissionError:
        return _error(request, status=403, code="FORBIDDEN", message="Superuser required")

    qs = RolloutAuditLog.objects.all()
    if tenant_id is not None:
        qs = qs.filter(tenant_id=tenant_id)
    qs = qs.order_by("-created_at")[:min(limit, 200)]
    return [
        RolloutAuditLogOut(
            id=entry.id,
            tenant_id=entry.tenant_id,
            performed_by=entry.performed_by,
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            changes=entry.changes,
            created_at=entry.created_at,
        )
        for entry in qs
    ]
