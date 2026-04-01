from __future__ import annotations

import json
import uuid
from typing import Any

from django.db.models import Count, Q
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Query, Router
from ninja.errors import HttpError

from core import api as core_api
from core.models import ContentWidget, DashboardLayout, DashboardWidget, HomePageModal, ModalAnalytics
from core.schemas import (
    AnalyticsEventIn,
    AnalyticsReportOut,
    ContentWidgetIn,
    ContentWidgetOut,
    HomePageModalBulkAction,
    HomePageModalIn,
    HomePageModalListOut,
    HomePageModalOut,
    ModalAnalyticsOut,
    ModalListFilters,
)
from core.schemas import (
    DashboardLayoutIn,
    DashboardLayoutOut,
    DashboardWidgetIn,
    DashboardWidgetOut,
)
from access_control.models import ScopeType
from access_control.services import compute_effective_access, master_flags_from_dict
from .models import UserPreference
from .schemas import (
    UserPreferenceDefaultsSchema,
    UserPreferenceSchema,
    UserPreferenceUpdateSchema,
)
from .services import UserPreferenceService

router = Router(tags=["Personalization"])


def get_user_and_tenant(request: HttpRequest) -> tuple[uuid.UUID, uuid.UUID]:
    """Extract user_id and tenant_id from request.
    
    In production, these come from authenticated session via BFF.
    For now, we'll use headers or raise error if missing.
    
    Args:
        request: Django HttpRequest
        
    Returns:
        Tuple of (user_id, tenant_id)
        
    Raises:
        HttpError: If user_id or tenant_id missing
    """
    user_id_str = request.headers.get("X-User-Id")
    tenant_id_str = request.headers.get("X-Tenant-Id")
    
    if not user_id_str or not tenant_id_str:
        raise HttpError(401, "Missing user or tenant identification")
    
    try:
        user_id = uuid.UUID(user_id_str)
        tenant_id = uuid.UUID(tenant_id_str)
    except ValueError:
        raise HttpError(400, "Invalid user or tenant ID format")
    
    return user_id, tenant_id


def _ensure_dashboard_customize_permission(request: HttpRequest, user_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
    _ensure_permission(request, user_id, tenant_id, "personalization.dashboards.customize")


def _ensure_content_manage_permission(request: HttpRequest, user_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
    _ensure_permission(request, user_id, tenant_id, "personalization.content.manage")


def _ensure_permission(
    request: HttpRequest,
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    permission_key: str,
) -> None:
    master_flags_raw = request.headers.get("X-Master-Flags") or "{}"
    try:
        master_flags_data = json.loads(master_flags_raw)
    except json.JSONDecodeError:
        master_flags_data = {}
    if not isinstance(master_flags_data, dict):
        master_flags_data = {}

    decision = compute_effective_access(
        tenant_id=tenant_id,
        user_id=user_id,
        permission_key=permission_key,
        scope_type=ScopeType.TENANT,
        scope_id=str(tenant_id),
        master_flags=master_flags_from_dict(master_flags_data),
    )
    if not decision.allowed:
        raise HttpError(403, "Forbidden")


@router.get("/preferences", response=UserPreferenceSchema)
def get_preferences(request: HttpRequest) -> dict[str, Any]:
    """Get current user preferences.
    
    Returns preferences for the authenticated user in the current tenant.
    Creates default preferences if they don't exist.
    
    Returns:
        UserPreference as dictionary
    """
    user_id, tenant_id = get_user_and_tenant(request)
    
    preference = UserPreferenceService.get_preferences(user_id, tenant_id)
    return preference.to_dict()


@router.put("/preferences", response=UserPreferenceSchema)
def update_preferences(
    request: HttpRequest,
    payload: UserPreferenceUpdateSchema,
) -> dict[str, Any]:
    """Update user preferences (partial updates supported).
    
    Args:
        payload: Partial preference updates (appearance, localization, etc.)
        
    Returns:
        Updated UserPreference as dictionary
    """
    user_id, tenant_id = get_user_and_tenant(request)
    
    # Convert Pydantic schema to dict, excluding None values
    updates = payload.dict(exclude_none=True)
    
    # Ensure preferences exist before updating
    UserPreferenceService.get_preferences(user_id, tenant_id)
    
    try:
        preference = UserPreferenceService.update_preferences(
            user_id, tenant_id, updates
        )
        return preference.to_dict()
    except UserPreference.DoesNotExist:
        raise HttpError(404, "User preferences not found")
    except Exception as e:
        raise HttpError(500, f"Failed to update preferences: {str(e)}")


@router.get("/preferences/defaults", response=UserPreferenceDefaultsSchema)
def get_default_preferences(request: HttpRequest) -> dict[str, Any]:
    """Get default preference values.
    
    Useful for:
    - Showing defaults in UI before user customizes
    - Resetting preferences to defaults
    - Understanding what values are available
    
    Returns:
        Default preferences structure
    """
    return UserPreferenceService.get_defaults()


@router.post("/preferences/reset", response=UserPreferenceSchema)
def reset_preferences(request: HttpRequest) -> dict[str, Any]:
    """Reset user preferences to defaults.
    
    Returns:
        UserPreference reset to default values
    """
    user_id, tenant_id = get_user_and_tenant(request)
    
    # Ensure preferences exist
    UserPreferenceService.get_preferences(user_id, tenant_id)
    
    preference = UserPreferenceService.reset_to_defaults(user_id, tenant_id)
    return preference.to_dict()


@router.get("/homepage-modals", response=list[HomePageModalOut])
def list_homepage_modals(request: HttpRequest, language: str = "en"):
    now = core_api.timezone.now()
    modals = HomePageModal.objects.filter(
        is_active=True,
        deleted_at__isnull=True,
    ).order_by("order", "-created_at")

    result: list[dict[str, Any]] = []
    for modal in modals:
        if modal.start_date and modal.start_date > now:
            continue
        if modal.end_date and modal.end_date < now:
            continue
        item = core_api._modal_to_out(modal)
        if language != "en" and modal.translations:
            item.update(modal.get_translated_content(language))
        result.append(item)
    return result


@router.get("/admin/homepage-modals", response=list[HomePageModalListOut])
def admin_list_homepage_modals(
    request: HttpRequest,
    filters: ModalListFilters = Query(...),
    limit: int = 100,
    offset: int = 0,
):
    user = getattr(request, "user", None)
    if user and user.is_authenticated and user.is_superuser:
        queryset = HomePageModal.objects.all()
    elif user and user.is_authenticated:
        raise HttpError(403, "Forbidden")
    else:
        user_id, tenant_id = get_user_and_tenant(request)
        _ensure_content_manage_permission(request, user_id, tenant_id)
        queryset = HomePageModal.objects.filter(
            Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True)
        )

    if not filters.include_deleted:
        queryset = queryset.filter(deleted_at__isnull=True)
    if filters.is_active is not None:
        queryset = queryset.filter(is_active=filters.is_active)
    if filters.modal_type:
        queryset = queryset.filter(modal_type=filters.modal_type)
    if filters.search:
        queryset = queryset.filter(
            Q(title__icontains=filters.search) | Q(content__icontains=filters.search)
        )
    if filters.start_date_from:
        queryset = queryset.filter(start_date__gte=filters.start_date_from)
    if filters.start_date_to:
        queryset = queryset.filter(start_date__lte=filters.start_date_to)

    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)
    return list(queryset.order_by("order", "-created_at")[safe_offset : safe_offset + safe_limit])


@router.get("/admin/homepage-modals/{modal_id}", response=HomePageModalOut)
def admin_get_homepage_modal(request: HttpRequest, modal_id: int):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    modal = get_object_or_404(
        HomePageModal,
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id=modal_id,
    )
    return core_api._modal_to_out(modal)


@router.post("/admin/homepage-modals", response=HomePageModalOut)
def admin_create_homepage_modal(request: HttpRequest, payload: HomePageModalIn):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)

    data = payload.model_dump(exclude_none=True)
    data["tenant_id"] = tenant_id
    data["created_by"] = user_id

    modal = HomePageModal.objects.create(**data)
    return core_api._modal_to_out(modal)


@router.put("/admin/homepage-modals/{modal_id}", response=HomePageModalOut)
def admin_update_homepage_modal(
    request: HttpRequest,
    modal_id: int,
    payload: HomePageModalIn,
):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    modal = get_object_or_404(
        HomePageModal,
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id=modal_id,
        deleted_at__isnull=True,
    )

    data = payload.model_dump(exclude_none=True)
    for attr, value in data.items():
        setattr(modal, attr, value)
    modal.version += 1
    modal.updated_by = user_id
    modal.save()
    return core_api._modal_to_out(modal)


@router.delete("/admin/homepage-modals/{modal_id}")
def admin_delete_homepage_modal(request: HttpRequest, modal_id: int, hard: bool = False):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    modal = get_object_or_404(
        HomePageModal,
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id=modal_id,
    )
    if hard:
        modal.delete()
    else:
        modal.soft_delete(user_id)
    return {"success": True}


@router.post("/admin/homepage-modals/{modal_id}/restore", response=HomePageModalOut)
def admin_restore_homepage_modal(request: HttpRequest, modal_id: int):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    modal = get_object_or_404(
        HomePageModal,
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id=modal_id,
        deleted_at__isnull=False,
    )
    modal.restore(user_id)
    return core_api._modal_to_out(modal)


@router.post("/admin/homepage-modals/bulk")
def admin_bulk_action_modals(request: HttpRequest, payload: HomePageModalBulkAction):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    queryset = HomePageModal.objects.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id__in=payload.modal_ids,
    )

    affected = 0
    if payload.action == "activate":
        affected = queryset.filter(deleted_at__isnull=True).update(
            is_active=True, updated_by=user_id
        )
    elif payload.action == "deactivate":
        affected = queryset.filter(deleted_at__isnull=True).update(
            is_active=False, updated_by=user_id
        )
    elif payload.action == "delete":
        for modal in queryset.filter(deleted_at__isnull=True):
            modal.soft_delete(user_id)
            affected += 1
    elif payload.action == "restore":
        for modal in queryset.filter(deleted_at__isnull=False):
            modal.restore(user_id)
            affected += 1

    return {"success": True, "affected": affected}


@router.get("/admin/homepage-modals/{modal_id}/preview", response=HomePageModalOut)
def admin_preview_homepage_modal(request: HttpRequest, modal_id: int, language: str = "en"):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    modal = get_object_or_404(
        HomePageModal,
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id=modal_id,
    )

    out = core_api._modal_to_out(modal)
    if language != "en" and modal.translations:
        out.update(modal.get_translated_content(language))
    return out


@router.get("/admin/content-widgets", response=list[ContentWidgetOut])
def admin_list_content_widgets(
    request: HttpRequest,
    include_deleted: bool = False,
    widget_type: str | None = None,
    placement: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    queryset = ContentWidget.objects.filter(tenant_id=tenant_id)
    if not include_deleted:
        queryset = queryset.filter(deleted_at__isnull=True)
    if widget_type:
        queryset = queryset.filter(widget_type=widget_type)
    if placement:
        queryset = queryset.filter(placement=placement)
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)
    return list(queryset.order_by("-priority", "-created_at")[safe_offset : safe_offset + safe_limit])


@router.post("/admin/content-widgets", response=ContentWidgetOut)
def admin_create_content_widget(request: HttpRequest, payload: ContentWidgetIn):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    data = payload.model_dump()
    data["tenant_id"] = tenant_id
    data["created_by"] = user_id
    return ContentWidget.objects.create(**data)


@router.put("/admin/content-widgets/{widget_id}", response=ContentWidgetOut)
def admin_update_content_widget(request: HttpRequest, widget_id: str, payload: ContentWidgetIn):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    widget = get_object_or_404(
        ContentWidget,
        id=widget_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    data = payload.model_dump()
    for attr, value in data.items():
        setattr(widget, attr, value)
    widget.updated_by = user_id
    widget.save()
    return widget


@router.delete("/admin/content-widgets/{widget_id}")
def admin_delete_content_widget(request: HttpRequest, widget_id: str, hard: bool = False):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    widget = get_object_or_404(
        ContentWidget,
        id=widget_id,
        tenant_id=tenant_id,
    )
    if hard:
        widget.delete()
    else:
        widget.soft_delete(user_id)
    return {"success": True}


@router.post("/admin/content-widgets/{widget_id}/restore", response=ContentWidgetOut)
def admin_restore_content_widget(request: HttpRequest, widget_id: str):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    widget = get_object_or_404(
        ContentWidget,
        id=widget_id,
        tenant_id=tenant_id,
        deleted_at__isnull=False,
    )
    widget.restore(user_id)
    return widget


@router.post("/analytics/track")
def track_analytics_event(request: HttpRequest, payload: AnalyticsEventIn):
    user_id, tenant_id = get_user_and_tenant(request)
    modal = get_object_or_404(HomePageModal, id=payload.modal_id)
    ModalAnalytics.objects.create(
        modal=modal,
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=payload.session_id,
        event_type=payload.event_type,
        metadata=payload.metadata,
    )
    return {"success": True}


@router.get("/admin/analytics/modals", response=list[ModalAnalyticsOut])
def admin_get_modal_analytics(request: HttpRequest, days: int = 30):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    start_date = timezone.now() - timezone.timedelta(days=days)
    modals = HomePageModal.objects.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        deleted_at__isnull=True,
    ).annotate(
        total_views=Count(
            "analytics",
            filter=Q(analytics__event_type="view", analytics__timestamp__gte=start_date),
        ),
        total_clicks=Count(
            "analytics",
            filter=Q(analytics__event_type="click", analytics__timestamp__gte=start_date),
        ),
        total_dismissals=Count(
            "analytics",
            filter=Q(analytics__event_type="dismiss", analytics__timestamp__gte=start_date),
        ),
    )
    result = []
    for modal in modals:
        ctr = round((modal.total_clicks / modal.total_views) * 100, 2) if modal.total_views > 0 else 0.0
        result.append(
            {
                "modal_id": modal.id,
                "modal_title": modal.title,
                "total_views": modal.total_views,
                "total_clicks": modal.total_clicks,
                "total_dismissals": modal.total_dismissals,
                "click_through_rate": ctr,
            }
        )
    return result


@router.get("/admin/analytics/report", response=AnalyticsReportOut)
def admin_get_analytics_report(request: HttpRequest, days: int = 30):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_content_manage_permission(request, user_id, tenant_id)
    end_date = timezone.now()
    start_date = end_date - timezone.timedelta(days=days)
    analytics_qs = ModalAnalytics.objects.filter(
        tenant_id=tenant_id,
        timestamp__gte=start_date,
        timestamp__lte=end_date,
    )
    total_views = analytics_qs.filter(event_type="view").count()
    total_clicks = analytics_qs.filter(event_type="click").count()
    total_dismissals = analytics_qs.filter(event_type="dismiss").count()
    average_ctr = round((total_clicks / total_views) * 100, 2) if total_views > 0 else 0.0

    return {
        "period_start": start_date,
        "period_end": end_date,
        "total_modals": HomePageModal.objects.filter(
            Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
            deleted_at__isnull=True,
        ).count(),
        "total_views": total_views,
        "total_clicks": total_clicks,
        "total_dismissals": total_dismissals,
        "average_ctr": average_ctr,
        "modals": admin_get_modal_analytics(request, days=days),
    }


@router.get("/admin/dashboards/layouts", response=list[DashboardLayoutOut])
def list_dashboard_layouts(
    request: HttpRequest,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    query = DashboardLayout.objects.filter(user_id=user_id, tenant_id=tenant_id).prefetch_related("widgets")
    if not include_deleted:
        query = query.filter(deleted_at__isnull=True)
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)
    return list(query.order_by("-is_default", "-updated_at")[safe_offset : safe_offset + safe_limit])


@router.post("/admin/dashboards/layouts", response=DashboardLayoutOut)
def create_dashboard_layout(request: HttpRequest, payload: DashboardLayoutIn):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    data = payload.model_dump()

    if data.get("is_default"):
        DashboardLayout.objects.filter(
            user_id=user_id,
            tenant_id=tenant_id,
            is_default=True,
            deleted_at__isnull=True,
        ).update(is_default=False)

    return DashboardLayout.objects.create(
        user_id=user_id,
        tenant_id=tenant_id,
        layout_name=data["layout_name"],
        layout_config=data.get("layout_config", {}),
        is_default=data.get("is_default", False),
    )


@router.put("/admin/dashboards/layouts/{layout_id}", response=DashboardLayoutOut)
def update_dashboard_layout(request: HttpRequest, layout_id: str, payload: DashboardLayoutIn):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        user_id=user_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    data = payload.model_dump()

    if data.get("is_default"):
        DashboardLayout.objects.filter(
            user_id=user_id,
            tenant_id=tenant_id,
            is_default=True,
            deleted_at__isnull=True,
        ).exclude(id=layout.id).update(is_default=False)

    layout.layout_name = data["layout_name"]
    layout.layout_config = data.get("layout_config", layout.layout_config)
    layout.is_default = data.get("is_default", layout.is_default)
    layout.save()
    return layout


@router.delete("/admin/dashboards/layouts/{layout_id}")
def delete_dashboard_layout(request: HttpRequest, layout_id: str, hard: bool = False):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        user_id=user_id,
        tenant_id=tenant_id,
    )
    if hard:
        layout.delete()
    else:
        layout.soft_delete()
    return {"success": True}


@router.post("/admin/dashboards/layouts/{layout_id}/restore", response=DashboardLayoutOut)
def restore_dashboard_layout(request: HttpRequest, layout_id: str):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        user_id=user_id,
        tenant_id=tenant_id,
        deleted_at__isnull=False,
    )
    layout.restore()
    return layout


@router.get("/admin/dashboards/layouts/{layout_id}/widgets", response=list[DashboardWidgetOut])
def list_dashboard_widgets(
    request: HttpRequest,
    layout_id: str,
    include_deleted: bool = False,
    limit: int = 200,
    offset: int = 0,
):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        user_id=user_id,
        tenant_id=tenant_id,
    )
    query = DashboardWidget.objects.select_related("layout").filter(layout=layout)
    if not include_deleted:
        query = query.filter(deleted_at__isnull=True)
    safe_limit = max(1, min(limit, 500))
    safe_offset = max(0, offset)
    return list(query.order_by("position_y", "position_x")[safe_offset : safe_offset + safe_limit])


@router.post("/admin/dashboards/layouts/{layout_id}/widgets", response=DashboardWidgetOut)
def create_dashboard_widget(request: HttpRequest, layout_id: str, payload: DashboardWidgetIn):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        user_id=user_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    data = payload.model_dump()
    return DashboardWidget.objects.create(
        layout=layout,
        tenant_id=tenant_id,
        widget_key=data["widget_key"],
        position_x=data.get("position_x", 0),
        position_y=data.get("position_y", 0),
        width=data.get("width", 4),
        height=data.get("height", 3),
        settings=data.get("settings", {}),
        is_visible=data.get("is_visible", True),
    )


@router.put("/admin/dashboards/widgets/{widget_id}", response=DashboardWidgetOut)
def update_dashboard_widget(request: HttpRequest, widget_id: str, payload: DashboardWidgetIn):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    widget = get_object_or_404(
        DashboardWidget,
        id=widget_id,
        tenant_id=tenant_id,
        layout__user_id=user_id,
        deleted_at__isnull=True,
    )
    data = payload.model_dump()
    widget.widget_key = data["widget_key"]
    widget.position_x = data.get("position_x", widget.position_x)
    widget.position_y = data.get("position_y", widget.position_y)
    widget.width = data.get("width", widget.width)
    widget.height = data.get("height", widget.height)
    widget.settings = data.get("settings", widget.settings)
    widget.is_visible = data.get("is_visible", widget.is_visible)
    widget.save()
    return widget


@router.delete("/admin/dashboards/widgets/{widget_id}")
def delete_dashboard_widget(request: HttpRequest, widget_id: str, hard: bool = False):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    widget = get_object_or_404(
        DashboardWidget,
        id=widget_id,
        tenant_id=tenant_id,
        layout__user_id=user_id,
    )
    if hard:
        widget.delete()
    else:
        widget.soft_delete()
    return {"success": True}


@router.post("/admin/dashboards/widgets/{widget_id}/restore", response=DashboardWidgetOut)
def restore_dashboard_widget(request: HttpRequest, widget_id: str):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    widget = get_object_or_404(
        DashboardWidget,
        id=widget_id,
        tenant_id=tenant_id,
        layout__user_id=user_id,
        deleted_at__isnull=False,
    )
    widget.restore()
    return widget
