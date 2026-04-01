from __future__ import annotations

import json
import uuid
from typing import Any

from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from core import api as core_api
from core.models import DashboardLayout, DashboardWidget, HomePageModal
from core.schemas import HomePageModalListOut, HomePageModalOut
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
        permission_key="personalization.dashboards.customize",
        scope_type=ScopeType.TENANT,
        scope_id=str(tenant_id),
        master_flags=master_flags_from_dict(master_flags_data),
    )
    if not decision.allowed:
        raise HttpError(403, "Dashboard customization forbidden")


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
def admin_list_homepage_modals(request: HttpRequest):
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated or not user.is_superuser:
        raise HttpError(403, "Forbidden")
    return list(
        HomePageModal.objects.filter(deleted_at__isnull=True).order_by("order", "-created_at")
    )


@router.get("/admin/dashboards/layouts", response=list[DashboardLayoutOut])
def list_dashboard_layouts(request: HttpRequest, include_deleted: bool = False):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    query = DashboardLayout.objects.filter(user_id=user_id, tenant_id=tenant_id)
    if not include_deleted:
        query = query.filter(deleted_at__isnull=True)
    return list(query.order_by("-is_default", "-updated_at"))


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


@router.get("/admin/dashboards/layouts/{layout_id}/widgets", response=list[DashboardWidgetOut])
def list_dashboard_widgets(request: HttpRequest, layout_id: str, include_deleted: bool = False):
    user_id, tenant_id = get_user_and_tenant(request)
    _ensure_dashboard_customize_permission(request, user_id, tenant_id)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        user_id=user_id,
        tenant_id=tenant_id,
    )
    query = DashboardWidget.objects.filter(layout=layout)
    if not include_deleted:
        query = query.filter(deleted_at__isnull=True)
    return list(query.order_by("position_y", "position_x"))


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
