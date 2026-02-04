from __future__ import annotations

import uuid
from typing import Any, cast
from django.http import JsonResponse
from django.utils import timezone
from ninja import NinjaAPI, Query, Router
from ninja.errors import HttpError

from core.errors import error_payload

from .context import InternalContext, require_internal_context
from .models import Achievement, AchievementCategory, AchievementGrant, AchievementStatus, GrantVisibility
from .permissions import has_permission
from .schemas import (
    AchievementCreateIn,
    AchievementListOut,
    AchievementOut,
    AchievementUpdateIn,
    CategoryCreateIn,
    CategoryOut,
    CategoryUpdateIn,
    CategoriesListOut,
    GrantCreateIn,
    GrantListOut,
    GrantOut,
)
from .services import PaginatedResult, create_grant, paginate_queryset, revoke_grant

api = NinjaAPI(title="UpdSpace Gamification", version="1", urls_namespace="gamification")
router = Router(tags=["gamification"])

PERM_CREATE = "gamification.achievements.create"
PERM_EDIT = "gamification.achievements.edit"
PERM_PUBLISH = "gamification.achievements.publish"
PERM_HIDE = "gamification.achievements.hide"
PERM_ASSIGN = "gamification.achievements.assign"
PERM_REVOKE = "gamification.achievements.revoke"
PERM_VIEW_PRIVATE = "gamification.achievements.view_private"


def _error_response(
    request,
    *,
    status: int,
    code: str,
    message: str,
    details: dict | None = None,
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
def on_http_error(request, exc: HttpError):
    status = getattr(exc, "status_code", 500)
    detail = getattr(exc, "message", None)
    if isinstance(detail, dict):
        code = str(detail.get("code") or "HTTP_ERROR")
        msg = str(detail.get("message") or "Request failed")
        raw_details = detail.get("details")
        details = raw_details if isinstance(raw_details, dict) else {}
        return _error_response(request, status=status, code=code, message=msg, details=details)
    msg = str(detail) if detail else "Request failed"
    return _error_response(request, status=status, code="HTTP_ERROR", message=msg)


def _parse_uuid(value: str, *, code: str, message: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except Exception as exc:
        raise HttpError(400, cast(Any, {"code": code, "message": message})) from exc


def _require_perm_ctx(ctx: InternalContext, permission_key: str) -> None:
    if not has_permission(
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        master_flags=ctx.master_flags,
        permission_key=permission_key,
        scope_type="TENANT",
        scope_id=str(ctx.tenant_id),
        request_id=ctx.request_id,
    ):
        raise HttpError(403, cast(Any, error_payload("FORBIDDEN", "Permission denied")))


def _has_perm_ctx(ctx: InternalContext, permission_key: str) -> bool:
    return has_permission(
        tenant_id=ctx.tenant_id,
        tenant_slug=ctx.tenant_slug,
        user_id=ctx.user_id,
        master_flags=ctx.master_flags,
        permission_key=permission_key,
        scope_type="TENANT",
        scope_id=str(ctx.tenant_id),
        request_id=ctx.request_id,
    )


def _achievement_to_out(
    achievement: Achievement,
    *,
    ctx: InternalContext,
    perm_edit: bool,
    perm_publish: bool,
    perm_hide: bool,
) -> AchievementOut:
    can_manage_any = perm_publish or perm_hide
    can_edit = perm_edit and (
        (achievement.status == AchievementStatus.DRAFT and str(achievement.created_by) == ctx.user_id)
        or can_manage_any
    )
    can_publish = perm_publish and achievement.status in {
        AchievementStatus.DRAFT,
        AchievementStatus.HIDDEN,
    }
    can_hide = perm_hide and achievement.status in {
        AchievementStatus.PUBLISHED,
        AchievementStatus.ACTIVE,
    }
    return AchievementOut(
        id=str(achievement.id),
        name_i18n=achievement.name_i18n or {},
        description=achievement.description or None,
        category=achievement.category.slug,
        status=str(achievement.status),
        images=achievement.images or None,
        created_by=str(achievement.created_by),
        created_at=achievement.created_at,
        updated_at=achievement.updated_at,
        can_edit=can_edit,
        can_publish=can_publish,
        can_hide=can_hide,
    )


def _grant_to_out(grant: AchievementGrant) -> GrantOut:
    return GrantOut(
        id=str(grant.id),
        achievement_id=str(grant.achievement_id),
        recipient_id=str(grant.recipient_id),
        issuer_id=str(grant.issuer_id),
        reason=grant.reason or None,
        visibility=str(grant.visibility),
        created_at=grant.created_at,
        revoked_at=grant.revoked_at,
    )


@router.get("/gamification/achievements", response=AchievementListOut)
def list_achievements(
    request,
    status: list[str] | None = Query(default=None),
    category: list[str] | None = Query(default=None),
    q: str | None = None,
    created_by: str | None = None,
    limit: int = 20,
    cursor: str | None = None,
):
    ctx = require_internal_context(request)
    can_view_private = _has_perm_ctx(ctx, PERM_VIEW_PRIVATE)
    perm_edit = _has_perm_ctx(ctx, PERM_EDIT)
    perm_publish = _has_perm_ctx(ctx, PERM_PUBLISH)
    perm_hide = _has_perm_ctx(ctx, PERM_HIDE)

    statuses = status or []
    if statuses:
        allowed = {choice.value for choice in AchievementStatus}
        invalid = [s for s in statuses if s not in allowed]
        if invalid:
            raise HttpError(422, cast(Any, {"code": "INVALID_STATUS", "message": "Invalid status"}))
        if not can_view_private and any(s in {"draft", "hidden"} for s in statuses):
            raise HttpError(403, cast(Any, {"code": "FORBIDDEN", "message": "Permission denied"}))
    elif not can_view_private:
        statuses = [AchievementStatus.PUBLISHED, AchievementStatus.ACTIVE]

    qs = Achievement.objects.select_related("category").filter(tenant_id=ctx.tenant_id)
    if statuses:
        qs = qs.filter(status__in=list(statuses))
    if category:
        qs = qs.filter(category__slug__in=category)
    if q:
        qs = qs.filter(name_i18n__icontains=q)
    if created_by == "me":
        qs = qs.filter(created_by=ctx.user_id)

    page: PaginatedResult = paginate_queryset(
        qs=qs,
        limit=limit,
        cursor=cursor,
        order_by=("created_at", "id"),
    )
    items = [
        _achievement_to_out(
            achievement,
            ctx=ctx,
            perm_edit=perm_edit,
            perm_publish=perm_publish,
            perm_hide=perm_hide,
        )
        for achievement in page.items
    ]
    return {"items": items, "next_cursor": page.next_cursor}


@router.post("/gamification/achievements", response=AchievementOut)
def create_achievement(request, payload: AchievementCreateIn):
    ctx = require_internal_context(request)
    _require_perm_ctx(ctx, PERM_CREATE)

    if not payload.name_i18n:
        raise HttpError(422, cast(Any, {"code": "VALIDATION_ERROR", "message": "name_i18n is required"}))

    category = AchievementCategory.objects.filter(
        tenant_id=ctx.tenant_id, slug=payload.category
    ).first()
    if not category:
        raise HttpError(422, cast(Any, {"code": "INVALID_CATEGORY", "message": "Category not found"}))

    status = payload.status or AchievementStatus.DRAFT
    if status not in {choice.value for choice in AchievementStatus}:
        raise HttpError(422, cast(Any, {"code": "INVALID_STATUS", "message": "Invalid status"}))

    if status in {AchievementStatus.PUBLISHED, AchievementStatus.ACTIVE}:
        images = payload.images
        if not images or not (images.small or images.medium or images.large):
            raise HttpError(
                422,
                cast(Any, {"code": "IMAGES_REQUIRED", "message": "Images are required for published achievements"}),
            )

    achievement = Achievement.objects.create(
        tenant_id=ctx.tenant_id,
        name_i18n=payload.name_i18n,
        description=payload.description or "",
        category=category,
        status=status,
        images=(payload.images.model_dump() if payload.images else {}),
        created_by=ctx.user_id,
    )

    return _achievement_to_out(
        achievement,
        ctx=ctx,
        perm_edit=True,
        perm_publish=_has_perm_ctx(ctx, PERM_PUBLISH),
        perm_hide=_has_perm_ctx(ctx, PERM_HIDE),
    )


@router.get("/gamification/achievements/{achievement_id}", response=AchievementOut)
def get_achievement(request, achievement_id: str):
    ctx = require_internal_context(request)
    achievement_uuid = _parse_uuid(
        achievement_id, code="INVALID_ACHIEVEMENT_ID", message="Invalid achievement id"
    )
    achievement = Achievement.objects.select_related("category").filter(
        id=achievement_uuid, tenant_id=ctx.tenant_id
    ).first()
    if not achievement:
        raise HttpError(404, cast(Any, {"code": "NOT_FOUND", "message": "Achievement not found"}))

    can_view_private = _has_perm_ctx(ctx, PERM_VIEW_PRIVATE)
    if achievement.status in {AchievementStatus.DRAFT, AchievementStatus.HIDDEN} and not can_view_private:
        raise HttpError(403, cast(Any, {"code": "FORBIDDEN", "message": "Permission denied"}))

    perm_edit = _has_perm_ctx(ctx, PERM_EDIT)
    perm_publish = _has_perm_ctx(ctx, PERM_PUBLISH)
    perm_hide = _has_perm_ctx(ctx, PERM_HIDE)

    return _achievement_to_out(
        achievement,
        ctx=ctx,
        perm_edit=perm_edit,
        perm_publish=perm_publish,
        perm_hide=perm_hide,
    )


@router.patch("/gamification/achievements/{achievement_id}", response=AchievementOut)
def update_achievement(request, achievement_id: str, payload: AchievementUpdateIn):
    ctx = require_internal_context(request)
    achievement_uuid = _parse_uuid(
        achievement_id, code="INVALID_ACHIEVEMENT_ID", message="Invalid achievement id"
    )
    achievement = Achievement.objects.select_related("category").filter(
        id=achievement_uuid, tenant_id=ctx.tenant_id
    ).first()
    if not achievement:
        raise HttpError(404, cast(Any, {"code": "NOT_FOUND", "message": "Achievement not found"}))

    perm_edit = _has_perm_ctx(ctx, PERM_EDIT)
    perm_publish = _has_perm_ctx(ctx, PERM_PUBLISH)
    perm_hide = _has_perm_ctx(ctx, PERM_HIDE)
    can_manage_any = perm_publish or perm_hide
    if not perm_edit:
        raise HttpError(403, cast(Any, {"code": "FORBIDDEN", "message": "Permission denied"}))

    if not can_manage_any and not (
        achievement.status == AchievementStatus.DRAFT and str(achievement.created_by) == ctx.user_id
    ):
        raise HttpError(403, cast(Any, {"code": "FORBIDDEN", "message": "Permission denied"}))

    if payload.status:
        if payload.status not in {choice.value for choice in AchievementStatus}:
            raise HttpError(422, cast(Any, {"code": "INVALID_STATUS", "message": "Invalid status"}))
        if payload.status in {AchievementStatus.PUBLISHED, AchievementStatus.ACTIVE} and not perm_publish:
            raise HttpError(403, cast(Any, {"code": "FORBIDDEN", "message": "Permission denied"}))
        if payload.status == AchievementStatus.HIDDEN and not perm_hide:
            raise HttpError(403, cast(Any, {"code": "FORBIDDEN", "message": "Permission denied"}))
        if payload.status in {AchievementStatus.PUBLISHED, AchievementStatus.ACTIVE}:
            images_payload = payload.images.model_dump() if payload.images else achievement.images
            if not images_payload or not (
                images_payload.get("small") or images_payload.get("medium") or images_payload.get("large")
            ):
                raise HttpError(
                    422,
                    cast(
                        Any,
                        {
                            "code": "IMAGES_REQUIRED",
                            "message": "Images are required for published achievements",
                        },
                    ),
                )

    if payload.category:
        category = AchievementCategory.objects.filter(
            tenant_id=ctx.tenant_id, slug=payload.category
        ).first()
        if not category:
            raise HttpError(422, cast(Any, {"code": "INVALID_CATEGORY", "message": "Category not found"}))
        achievement.category = category

    if payload.name_i18n is not None:
        if not payload.name_i18n:
            raise HttpError(
                422,
                cast(Any, {"code": "VALIDATION_ERROR", "message": "name_i18n cannot be empty"}),
            )
        achievement.name_i18n = payload.name_i18n

    if payload.description is not None:
        achievement.description = payload.description or ""

    if payload.images is not None:
        achievement.images = payload.images.model_dump()

    if payload.status is not None:
        achievement.status = payload.status

    achievement.updated_at = timezone.now()
    achievement.save()

    return _achievement_to_out(
        achievement,
        ctx=ctx,
        perm_edit=perm_edit,
        perm_publish=perm_publish,
        perm_hide=perm_hide,
    )


@router.post("/gamification/achievements/{achievement_id}/grants", response=GrantOut)
def create_achievement_grant(request, achievement_id: str, payload: GrantCreateIn):
    ctx = require_internal_context(request)
    _require_perm_ctx(ctx, PERM_ASSIGN)

    achievement_uuid = _parse_uuid(
        achievement_id, code="INVALID_ACHIEVEMENT_ID", message="Invalid achievement id"
    )
    achievement = Achievement.objects.filter(id=achievement_uuid, tenant_id=ctx.tenant_id).first()
    if not achievement:
        raise HttpError(404, cast(Any, {"code": "NOT_FOUND", "message": "Achievement not found"}))

    if achievement.status not in {AchievementStatus.PUBLISHED, AchievementStatus.ACTIVE}:
        raise HttpError(
            409,
            cast(Any, {"code": "ACHIEVEMENT_NOT_PUBLISHED", "message": "Achievement is not publishable"}),
        )

    recipient_id = _parse_uuid(payload.recipient_id, code="INVALID_USER_ID", message="Invalid recipient id")
    visibility = payload.visibility or GrantVisibility.PUBLIC
    if visibility not in {choice.value for choice in GrantVisibility}:
        raise HttpError(422, cast(Any, {"code": "INVALID_VISIBILITY", "message": "Invalid visibility"}))

    grant = create_grant(
        achievement=achievement,
        recipient_id=recipient_id,
        issuer_id=_parse_uuid(ctx.user_id, code="INVALID_USER_ID", message="Invalid issuer id"),
        reason=payload.reason,
        visibility=visibility,
    )
    return _grant_to_out(grant)


@router.get("/gamification/achievements/{achievement_id}/grants", response=GrantListOut)
def list_achievement_grants(
    request,
    achievement_id: str,
    visibility: str | None = None,
    limit: int = 20,
    cursor: str | None = None,
):
    ctx = require_internal_context(request)
    achievement_uuid = _parse_uuid(
        achievement_id, code="INVALID_ACHIEVEMENT_ID", message="Invalid achievement id"
    )
    achievement = Achievement.objects.filter(id=achievement_uuid, tenant_id=ctx.tenant_id).first()
    if not achievement:
        raise HttpError(404, cast(Any, {"code": "NOT_FOUND", "message": "Achievement not found"}))

    can_view_private = _has_perm_ctx(ctx, PERM_VIEW_PRIVATE)
    if achievement.status in {AchievementStatus.DRAFT, AchievementStatus.HIDDEN} and not can_view_private:
        raise HttpError(403, cast(Any, {"code": "FORBIDDEN", "message": "Permission denied"}))

    if visibility and visibility not in {choice.value for choice in GrantVisibility}:
        raise HttpError(422, cast(Any, {"code": "INVALID_VISIBILITY", "message": "Invalid visibility"}))

    if visibility == GrantVisibility.PRIVATE and not can_view_private:
        raise HttpError(403, cast(Any, {"code": "FORBIDDEN", "message": "Permission denied"}))

    qs = AchievementGrant.objects.filter(
        tenant_id=ctx.tenant_id,
        achievement_id=achievement_uuid,
        revoked_at__isnull=True,
    )
    if visibility:
        qs = qs.filter(visibility=visibility)
    elif not can_view_private:
        qs = qs.filter(visibility=GrantVisibility.PUBLIC)

    page: PaginatedResult = paginate_queryset(
        qs=qs,
        limit=limit,
        cursor=cursor,
        order_by=("created_at", "id"),
    )
    return {
        "items": [_grant_to_out(grant) for grant in page.items],
        "next_cursor": page.next_cursor,
    }


@router.post("/gamification/grants/{grant_id}/revoke", response=GrantOut)
def revoke_achievement_grant(request, grant_id: str):
    ctx = require_internal_context(request)
    _require_perm_ctx(ctx, PERM_REVOKE)

    grant_uuid = _parse_uuid(grant_id, code="INVALID_GRANT_ID", message="Invalid grant id")
    grant = AchievementGrant.objects.filter(id=grant_uuid, tenant_id=ctx.tenant_id).first()
    if not grant:
        raise HttpError(404, cast(Any, {"code": "NOT_FOUND", "message": "Grant not found"}))

    grant = revoke_grant(
        grant=grant,
        revoked_by=_parse_uuid(ctx.user_id, code="INVALID_USER_ID", message="Invalid issuer id"),
    )
    return _grant_to_out(grant)


@router.get("/gamification/categories", response=CategoriesListOut)
def list_categories(request):
    ctx = require_internal_context(request)
    categories = list(
        AchievementCategory.objects.filter(tenant_id=ctx.tenant_id).order_by("order", "slug", "id")
    )
    return {"items": [_category_to_out(category) for category in categories]}


@router.post("/gamification/categories", response=CategoryOut)
def create_category(request, payload: CategoryCreateIn):
    ctx = require_internal_context(request)
    _require_perm_ctx(ctx, PERM_EDIT)

    if not payload.id:
        raise HttpError(422, cast(Any, {"code": "VALIDATION_ERROR", "message": "id is required"}))
    if not payload.name_i18n:
        raise HttpError(422, cast(Any, {"code": "VALIDATION_ERROR", "message": "name_i18n is required"}))

    existing = AchievementCategory.objects.filter(
        tenant_id=ctx.tenant_id, slug=payload.id
    ).first()
    if existing:
        raise HttpError(409, cast(Any, {"code": "ALREADY_EXISTS", "message": "Category already exists"}))

    category = AchievementCategory.objects.create(
        tenant_id=ctx.tenant_id,
        slug=payload.id,
        name_i18n=payload.name_i18n,
        order=payload.order or 0,
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    return _category_to_out(category)


@router.patch("/gamification/categories/{category_id}", response=CategoryOut)
def update_category(request, category_id: str, payload: CategoryUpdateIn):
    ctx = require_internal_context(request)
    _require_perm_ctx(ctx, PERM_EDIT)

    category = AchievementCategory.objects.filter(
        tenant_id=ctx.tenant_id, slug=category_id
    ).first()
    if not category:
        raise HttpError(404, cast(Any, {"code": "NOT_FOUND", "message": "Category not found"}))

    if payload.name_i18n is not None:
        if not payload.name_i18n:
            raise HttpError(
                422,
                cast(Any, {"code": "VALIDATION_ERROR", "message": "name_i18n cannot be empty"}),
            )
        category.name_i18n = payload.name_i18n
    if payload.order is not None:
        category.order = payload.order
    if payload.is_active is not None:
        category.is_active = payload.is_active

    category.updated_at = timezone.now()
    category.save()
    return _category_to_out(category)


def _category_to_out(category: AchievementCategory) -> CategoryOut:
    return CategoryOut(
        id=category.slug,
        name_i18n=category.name_i18n or {},
        order=category.order,
        is_active=category.is_active,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )


api.add_router("", router)
