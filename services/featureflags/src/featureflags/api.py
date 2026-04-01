from __future__ import annotations

from datetime import datetime
from typing import Any, cast

from django.http import JsonResponse
from ninja import NinjaAPI, Router
from ninja.errors import HttpError

from .context import InternalContext, require_internal_context
from .models import FeatureFlag
from .schemas import (
    FeatureFlagCreateIn,
    FeatureFlagOut,
    FeatureFlagsEvaluationOut,
    FeatureFlagUpdateIn,
)
from .service import create_or_update_flag, evaluate_flags, patch_flag

api = NinjaAPI(
    title="UpdSpace Feature Flags",
    version="1",
    urls_namespace="featureflags",
)
router = Router(tags=["featureflags"])


def _error_response(
    request: Any,
    *,
    status: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
):
    request_id = request.headers.get("X-Request-Id")
    return JsonResponse(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": request_id,
            }
        },
        status=status,
    )


@api.exception_handler(HttpError)
def on_http_error(request: Any, exc: HttpError):
    status = getattr(exc, "status_code", 500)
    detail = getattr(exc, "message", None)
    if isinstance(detail, dict):
        code = str(detail.get("code") or "HTTP_ERROR")
        msg = str(detail.get("message") or "Request failed")
        raw_details = detail.get("details")
        details = raw_details if isinstance(raw_details, dict) else {}
        return _error_response(
            request,
            status=status,
            code=code,
            message=msg,
            details=details,
        )
    msg = str(detail) if detail else "Request failed"
    return _error_response(
        request,
        status=status,
        code="HTTP_ERROR",
        message=msg,
    )


def _require_system_admin(ctx: InternalContext) -> None:
    if bool(ctx.master_flags.get("system_admin")):
        return
    raise HttpError(
        403,
        cast(Any, {"code": "FORBIDDEN", "message": "System admin required"}),
    )


@router.get("/flags/evaluate", response=FeatureFlagsEvaluationOut)
def evaluate(request: Any):
    require_internal_context(request)
    flags = list(FeatureFlag.objects.all().order_by("key"))
    mapping = evaluate_flags(flags)
    latest_updated_at: datetime | None = (
        flags[-1].updated_at if flags else None
    )
    return FeatureFlagsEvaluationOut(
        feature_flags=mapping,
        updated_at=latest_updated_at,
    )


@router.get("/flags", response=list[FeatureFlagOut])
def list_flags(request: Any):
    ctx = require_internal_context(request)
    _require_system_admin(ctx)

    flags = FeatureFlag.objects.all().order_by("key")
    return [
        FeatureFlagOut(
            key=flag.key,
            description=flag.description or None,
            enabled=flag.enabled,
            rollout=flag.rollout,
            created_by=str(flag.created_by),
            updated_by=str(flag.updated_by),
            created_at=flag.created_at,
            updated_at=flag.updated_at,
        )
        for flag in flags
    ]


@router.post("/flags", response=FeatureFlagOut)
def create_flag(request: Any, payload: FeatureFlagCreateIn):
    ctx = require_internal_context(request)
    _require_system_admin(ctx)

    try:
        flag, _ = create_or_update_flag(
            actor_user_id=ctx.user_id,
            key=payload.key,
            description=payload.description,
            enabled=payload.enabled,
            rollout=payload.rollout,
        )
    except ValueError as exc:
        raise HttpError(
            400,
            cast(Any, {"code": "VALIDATION_ERROR", "message": str(exc)}),
        ) from exc

    return FeatureFlagOut(
        key=flag.key,
        description=flag.description or None,
        enabled=flag.enabled,
        rollout=flag.rollout,
        created_by=str(flag.created_by),
        updated_by=str(flag.updated_by),
        created_at=flag.created_at,
        updated_at=flag.updated_at,
    )


@router.patch("/flags/{key}", response=FeatureFlagOut)
def update_flag(request: Any, key: str, payload: FeatureFlagUpdateIn):
    ctx = require_internal_context(request)
    _require_system_admin(ctx)

    try:
        flag = patch_flag(
            actor_user_id=ctx.user_id,
            key=key,
            description=payload.description,
            enabled=payload.enabled,
            rollout=payload.rollout,
        )
    except FeatureFlag.DoesNotExist as exc:
        raise HttpError(
            404,
            cast(
                Any,
                {"code": "NOT_FOUND", "message": "Feature flag not found"},
            ),
        ) from exc
    except ValueError as exc:
        raise HttpError(
            400,
            cast(Any, {"code": "VALIDATION_ERROR", "message": str(exc)}),
        ) from exc

    return FeatureFlagOut(
        key=flag.key,
        description=flag.description or None,
        enabled=flag.enabled,
        rollout=flag.rollout,
        created_by=str(flag.created_by),
        updated_by=str(flag.updated_by),
        created_at=flag.created_at,
        updated_at=flag.updated_at,
    )


api.add_router("", router)
