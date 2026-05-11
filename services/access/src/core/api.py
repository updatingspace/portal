from typing import Any
from uuid import UUID

from django.db.models import Count, Q
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Query, Router
from ninja.errors import HttpError

from .models import (
    ContentWidget,
    DashboardLayout,
    DashboardWidget,
    HomePageModal,
    ModalAnalytics,
    UserPreference,
)
from .schemas import (
    AnalyticsEventIn,
    AnalyticsReportOut,
    ContentWidgetIn,
    ContentWidgetOut,
    DefaultPreferencesOut,
    HomePageModalBulkAction,
    HomePageModalIn,
    HomePageModalListOut,
    HomePageModalOut,
    ModalAnalyticsOut,
    ModalListFilters,
    DashboardLayoutIn,
    DashboardLayoutOut,
    DashboardWidgetIn,
    DashboardWidgetOut,
    UserPreferencesIn,
    UserPreferencesOut,
)

router = Router()


# =============================================================================
# User Preferences Endpoints
# =============================================================================


def _get_user_context(request: HttpRequest) -> tuple[str, str]:
    """Extract user_id and tenant_id from request headers (set by BFF)"""
    user_id = request.headers.get("X-User-Id")
    tenant_id = request.headers.get("X-Tenant-Id")

    if not user_id or not tenant_id:
        raise HttpError(401, "Missing user or tenant context")

    return user_id, tenant_id


def _preferences_to_dict(pref: UserPreference) -> dict[str, Any]:
    """Convert UserPreference model to output dict"""
    return {
        "id": str(pref.id),
        "user_id": str(pref.user_id),
        "tenant_id": str(pref.tenant_id),
        "appearance": {
            "theme": pref.theme,
            "theme_source": pref.theme_source,
            "accent_color": pref.accent_color,
            "font_size": pref.font_size,
            "high_contrast": pref.high_contrast,
            "reduce_motion": pref.reduce_motion,
        },
        "localization": {
            "language": pref.language,
            "timezone": pref.timezone,
        },
        "notifications": pref.notification_settings
        or pref.get_default_notification_settings(),
        "privacy": {
            "profile_visibility": pref.profile_visibility,
            "show_online_status": pref.show_online_status,
            "show_vote_history": pref.show_vote_history,
            "share_activity": pref.share_activity,
            "allow_mentions": pref.allow_mentions,
            "analytics_enabled": pref.analytics_enabled,
            "recommendations_enabled": pref.recommendations_enabled,
        },
        "created_at": pref.created_at,
        "updated_at": pref.updated_at,
    }


def _get_default_preferences() -> dict[str, Any]:
    """Get default preferences structure"""
    return {
        "appearance": {
            "theme": "auto",
            "theme_source": "portal",
            "accent_color": "#007AFF",
            "font_size": "medium",
            "high_contrast": False,
            "reduce_motion": False,
        },
        "localization": {
            "language": "en",
            "timezone": "UTC",
        },
        "notifications": {
            "email": {"enabled": True, "digest": "daily"},
            "in_app": {"enabled": True},
            "push": {"enabled": False},
            "types": {
                "polls": {"enabled": True, "channels": ["email", "in_app"]},
                "events": {"enabled": True, "channels": ["email", "in_app"]},
                "community": {"enabled": True, "channels": ["in_app"]},
                "system": {"enabled": True, "channels": ["email", "in_app"]},
            },
            "quiet_hours": {"enabled": False, "start": "22:00", "end": "08:00"},
        },
        "privacy": {
            "profile_visibility": "members",
            "show_online_status": True,
            "show_vote_history": False,
            "share_activity": True,
            "allow_mentions": True,
            "analytics_enabled": True,
            "recommendations_enabled": True,
        },
    }


def _normalize_layout_config(layout_config: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(layout_config, dict):
        return {"version": 1, "breakpoints": {}}

    normalized = dict(layout_config)
    normalized.setdefault("version", 1)
    if not isinstance(normalized.get("breakpoints"), dict):
        normalized["breakpoints"] = {}
    return normalized


@router.get("/preferences", response=UserPreferencesOut, tags=["preferences"])
def get_preferences(request: HttpRequest):
    """
    Get current user preferences.
    Creates default preferences if they don't exist.
    """
    user_id, tenant_id = _get_user_context(request)

    pref, created = UserPreference.objects.get_or_create(
        user_id=user_id,
        tenant_id=tenant_id,
        defaults={
            "notification_settings": _get_default_preferences()["notifications"],
        },
    )

    return _preferences_to_dict(pref)


@router.put("/preferences", response=UserPreferencesOut, tags=["preferences"])
def update_preferences(request: HttpRequest, payload: UserPreferencesIn):
    """
    Update user preferences (partial update supported).
    Only provided fields are updated.
    """
    user_id, tenant_id = _get_user_context(request)

    pref, _ = UserPreference.objects.get_or_create(
        user_id=user_id,
        tenant_id=tenant_id,
        defaults={
            "notification_settings": _get_default_preferences()["notifications"],
        },
    )

    # Update appearance settings
    if payload.appearance:
        appearance = payload.appearance.model_dump(exclude_none=True)
        if "theme" in appearance:
            pref.theme = appearance["theme"]
        if "theme_source" in appearance:
            pref.theme_source = appearance["theme_source"]
        if "accent_color" in appearance:
            pref.accent_color = appearance["accent_color"]
        if "font_size" in appearance:
            pref.font_size = appearance["font_size"]
        if "high_contrast" in appearance:
            pref.high_contrast = appearance["high_contrast"]
        if "reduce_motion" in appearance:
            pref.reduce_motion = appearance["reduce_motion"]

    # Update localization settings
    if payload.localization:
        localization = payload.localization.model_dump(exclude_none=True)
        if "language" in localization:
            pref.language = localization["language"]
        if "timezone" in localization:
            pref.timezone = localization["timezone"]

    # Update notification settings (merge with existing)
    if payload.notifications:
        existing = pref.notification_settings or _get_default_preferences()[
            "notifications"
        ]
        # Deep merge notifications
        for key, value in payload.notifications.items():
            if isinstance(value, dict) and key in existing:
                existing[key] = {**existing[key], **value}
            else:
                existing[key] = value
        pref.notification_settings = existing

    # Update privacy settings
    if payload.privacy:
        privacy = payload.privacy.model_dump(exclude_none=True)
        if "profile_visibility" in privacy:
            pref.profile_visibility = privacy["profile_visibility"]
        if "show_online_status" in privacy:
            pref.show_online_status = privacy["show_online_status"]
        if "show_vote_history" in privacy:
            pref.show_vote_history = privacy["show_vote_history"]
        if "share_activity" in privacy:
            pref.share_activity = privacy["share_activity"]
        if "allow_mentions" in privacy:
            pref.allow_mentions = privacy["allow_mentions"]
        if "analytics_enabled" in privacy:
            pref.analytics_enabled = privacy["analytics_enabled"]
        if "recommendations_enabled" in privacy:
            pref.recommendations_enabled = privacy["recommendations_enabled"]

    pref.save()
    return _preferences_to_dict(pref)


@router.get("/preferences/defaults", response=DefaultPreferencesOut, tags=["preferences"])
def get_default_preferences(request: HttpRequest):
    """Get default preferences structure (for reset/reference)"""
    return _get_default_preferences()


@router.post("/preferences/reset", response=UserPreferencesOut, tags=["preferences"])
def reset_preferences(request: HttpRequest):
    """Reset user preferences to defaults"""
    user_id, tenant_id = _get_user_context(request)

    defaults = _get_default_preferences()

    pref, _ = UserPreference.objects.update_or_create(
        user_id=user_id,
        tenant_id=tenant_id,
        defaults={
            "theme": defaults["appearance"]["theme"],
            "theme_source": defaults["appearance"]["theme_source"],
            "accent_color": defaults["appearance"]["accent_color"],
            "font_size": defaults["appearance"]["font_size"],
            "high_contrast": defaults["appearance"]["high_contrast"],
            "reduce_motion": defaults["appearance"]["reduce_motion"],
            "language": defaults["localization"]["language"],
            "timezone": defaults["localization"]["timezone"],
            "notification_settings": defaults["notifications"],
            "profile_visibility": defaults["privacy"]["profile_visibility"],
            "show_online_status": defaults["privacy"]["show_online_status"],
            "show_vote_history": defaults["privacy"]["show_vote_history"],
            "share_activity": defaults["privacy"]["share_activity"],
            "allow_mentions": defaults["privacy"]["allow_mentions"],
            "analytics_enabled": defaults["privacy"]["analytics_enabled"],
            "recommendations_enabled": defaults["privacy"]["recommendations_enabled"],
        },
    )

    return _preferences_to_dict(pref)


# =============================================================================
# Homepage Modal Endpoints
# =============================================================================


def _modal_to_out(modal: HomePageModal) -> dict[str, Any]:
    """Convert HomePageModal to output dict"""
    return {
        "id": modal.id,
        "title": modal.title,
        "content": modal.content,
        "content_html": modal.content_html or "",
        "button_text": modal.button_text,
        "button_url": modal.button_url,
        "modal_type": modal.modal_type,
        "is_active": modal.is_active,
        "display_once": modal.display_once,
        "start_date": modal.start_date,
        "end_date": modal.end_date,
        "order": modal.order,
        "translations": modal.translations or {},
        "version": modal.version,
        "deleted_at": modal.deleted_at,
        "created_by": str(modal.created_by) if modal.created_by else None,
        "updated_by": str(modal.updated_by) if modal.updated_by else None,
        "created_at": modal.created_at,
        "updated_at": modal.updated_at,
    }


@router.get(
    "/homepage-modals", response=list[HomePageModalOut], tags=["personalization"]
)
def list_homepage_modals(request: HttpRequest, language: str = "en"):
    """Get active homepage modals for display (user-facing)"""
    user_id, tenant_id = _get_user_context(request)
    now = timezone.now()

    modals = HomePageModal.objects.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        is_active=True,
        deleted_at__isnull=True,
    )

    result = []
    for modal in modals:
        if modal.start_date and modal.start_date > now:
            continue
        if modal.end_date and modal.end_date < now:
            continue

        out = _modal_to_out(modal)
        # Apply translations if available
        if language != "en" and modal.translations:
            translated = modal.get_translated_content(language)
            out.update(translated)
        result.append(out)

    return result


@router.get(
    "/admin/homepage-modals", response=list[HomePageModalListOut], tags=["admin"]
)
def admin_list_homepage_modals(
    request: HttpRequest,
    filters: ModalListFilters = Query(...),
):
    """
    Get homepage modals for admin with filtering, sorting, search.
    Supports include_deleted, is_active, modal_type, search, date filters.
    """
    user_id, tenant_id = _get_user_context(request)

    queryset = HomePageModal.objects.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True)
    )

    # Apply filters
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

    return list(queryset.order_by("order", "-created_at"))


@router.get("/admin/homepage-modals/{modal_id}", response=HomePageModalOut, tags=["admin"])
def admin_get_homepage_modal(request: HttpRequest, modal_id: int):
    """Get a single homepage modal by ID"""
    user_id, tenant_id = _get_user_context(request)

    modal = get_object_or_404(
        HomePageModal,
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id=modal_id,
    )
    return _modal_to_out(modal)


@router.post("/admin/homepage-modals", response=HomePageModalOut, tags=["admin"])
def admin_create_homepage_modal(request: HttpRequest, payload: HomePageModalIn):
    """Create a new homepage modal"""
    user_id, tenant_id = _get_user_context(request)

    data = payload.model_dump(exclude_none=True)
    data["tenant_id"] = tenant_id
    data["created_by"] = UUID(user_id)

    modal = HomePageModal.objects.create(**data)
    return _modal_to_out(modal)


@router.put(
    "/admin/homepage-modals/{modal_id}", response=HomePageModalOut, tags=["admin"]
)
def admin_update_homepage_modal(
    request: HttpRequest, modal_id: int, payload: HomePageModalIn
):
    """Update a homepage modal (increments version)"""
    user_id, tenant_id = _get_user_context(request)

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
    modal.updated_by = UUID(user_id)
    modal.save()

    return _modal_to_out(modal)


@router.delete("/admin/homepage-modals/{modal_id}", tags=["admin"])
def admin_delete_homepage_modal(request: HttpRequest, modal_id: int, hard: bool = False):
    """
    Soft delete a homepage modal by default.
    Use hard=true for permanent deletion.
    """
    user_id, tenant_id = _get_user_context(request)

    modal = get_object_or_404(
        HomePageModal,
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id=modal_id,
    )

    if hard:
        modal.delete()
    else:
        modal.soft_delete(UUID(user_id))

    return {"success": True}


@router.post("/admin/homepage-modals/{modal_id}/restore", response=HomePageModalOut, tags=["admin"])
def admin_restore_homepage_modal(request: HttpRequest, modal_id: int):
    """Restore a soft-deleted homepage modal"""
    user_id, tenant_id = _get_user_context(request)

    modal = get_object_or_404(
        HomePageModal,
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id=modal_id,
        deleted_at__isnull=False,  # Must be deleted
    )

    modal.restore(UUID(user_id))
    return _modal_to_out(modal)


@router.post("/admin/homepage-modals/bulk", tags=["admin"])
def admin_bulk_action_modals(request: HttpRequest, payload: HomePageModalBulkAction):
    """
    Perform bulk actions on modals.
    Supported actions: activate, deactivate, delete, restore
    """
    user_id, tenant_id = _get_user_context(request)

    queryset = HomePageModal.objects.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id__in=payload.modal_ids,
    )

    count = 0
    if payload.action == "activate":
        count = queryset.filter(deleted_at__isnull=True).update(
            is_active=True, updated_by=UUID(user_id)
        )
    elif payload.action == "deactivate":
        count = queryset.filter(deleted_at__isnull=True).update(
            is_active=False, updated_by=UUID(user_id)
        )
    elif payload.action == "delete":
        for modal in queryset.filter(deleted_at__isnull=True):
            modal.soft_delete(UUID(user_id))
            count += 1
    elif payload.action == "restore":
        for modal in queryset.filter(deleted_at__isnull=False):
            modal.restore(UUID(user_id))
            count += 1

    return {"success": True, "affected": count}


@router.get("/admin/homepage-modals/{modal_id}/preview", response=HomePageModalOut, tags=["admin"])
def admin_preview_homepage_modal(
    request: HttpRequest,
    modal_id: int,
    language: str = "en",
):
    """Preview a modal as it would appear to users"""
    user_id, tenant_id = _get_user_context(request)

    modal = get_object_or_404(
        HomePageModal,
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        id=modal_id,
    )

    out = _modal_to_out(modal)

    # Apply translations for preview
    if language != "en" and modal.translations:
        translated = modal.get_translated_content(language)
        out.update(translated)

    return out


# =============================================================================
# Content Widget Endpoints
# =============================================================================


@router.get("/content-widgets", response=list[ContentWidgetOut], tags=["content"])
def list_content_widgets(
    request: HttpRequest,
    placement: str | None = None,
    page: str | None = None,
):
    """Get active content widgets for display (user-facing)"""
    user_id, tenant_id = _get_user_context(request)
    now = timezone.now()

    queryset = ContentWidget.objects.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    )

    if placement:
        queryset = queryset.filter(placement=placement)

    result = []
    for widget in queryset:
        # Check date range
        if widget.start_date and widget.start_date > now:
            continue
        if widget.end_date and widget.end_date < now:
            continue
        # Check target pages
        if widget.target_pages and page and page not in widget.target_pages:
            continue
        result.append(widget)

    return result


@router.get("/admin/content-widgets", response=list[ContentWidgetOut], tags=["admin"])
def admin_list_content_widgets(
    request: HttpRequest,
    include_deleted: bool = False,
    widget_type: str | None = None,
    placement: str | None = None,
):
    """Get all content widgets for admin"""
    user_id, tenant_id = _get_user_context(request)

    queryset = ContentWidget.objects.filter(tenant_id=tenant_id)

    if not include_deleted:
        queryset = queryset.filter(deleted_at__isnull=True)

    if widget_type:
        queryset = queryset.filter(widget_type=widget_type)

    if placement:
        queryset = queryset.filter(placement=placement)

    return list(queryset.order_by("-priority", "-created_at"))


@router.post("/admin/content-widgets", response=ContentWidgetOut, tags=["admin"])
def admin_create_content_widget(request: HttpRequest, payload: ContentWidgetIn):
    """Create a new content widget"""
    user_id, tenant_id = _get_user_context(request)

    data = payload.model_dump()
    data["tenant_id"] = UUID(tenant_id)
    data["created_by"] = UUID(user_id)

    widget = ContentWidget.objects.create(**data)
    return widget


@router.put("/admin/content-widgets/{widget_id}", response=ContentWidgetOut, tags=["admin"])
def admin_update_content_widget(
    request: HttpRequest, widget_id: str, payload: ContentWidgetIn
):
    """Update a content widget"""
    user_id, tenant_id = _get_user_context(request)

    widget = get_object_or_404(
        ContentWidget,
        id=widget_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )

    data = payload.model_dump()
    for attr, value in data.items():
        setattr(widget, attr, value)

    widget.updated_by = UUID(user_id)
    widget.save()

    return widget


@router.delete("/admin/content-widgets/{widget_id}", tags=["admin"])
def admin_delete_content_widget(request: HttpRequest, widget_id: str, hard: bool = False):
    """Soft delete a content widget"""
    user_id, tenant_id = _get_user_context(request)

    widget = get_object_or_404(
        ContentWidget,
        id=widget_id,
        tenant_id=tenant_id,
    )

    if hard:
        widget.delete()
    else:
        widget.soft_delete(UUID(user_id))

    return {"success": True}


# =============================================================================
# Analytics Endpoints
# =============================================================================


@router.post("/analytics/track", tags=["analytics"])
def track_analytics_event(request: HttpRequest, payload: AnalyticsEventIn):
    """Track a modal analytics event (view, click, dismiss)"""
    user_id, tenant_id = _get_user_context(request)

    # Verify modal exists
    modal = get_object_or_404(HomePageModal, id=payload.modal_id)

    ModalAnalytics.objects.create(
        modal=modal,
        tenant_id=UUID(tenant_id),
        user_id=UUID(user_id) if user_id else None,
        session_id=payload.session_id,
        event_type=payload.event_type,
        metadata=payload.metadata,
    )

    return {"success": True}


@router.get("/admin/analytics/modals", response=list[ModalAnalyticsOut], tags=["admin"])
def admin_get_modal_analytics(
    request: HttpRequest,
    days: int = 30,
):
    """Get analytics summary for all modals"""
    user_id, tenant_id = _get_user_context(request)

    start_date = timezone.now() - timezone.timedelta(days=days)

    # Get modals with aggregated analytics
    modals = HomePageModal.objects.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True),
        deleted_at__isnull=True,
    ).annotate(
        total_views=Count(
            "analytics",
            filter=Q(
                analytics__event_type="view",
                analytics__timestamp__gte=start_date,
            ),
        ),
        total_clicks=Count(
            "analytics",
            filter=Q(
                analytics__event_type="click",
                analytics__timestamp__gte=start_date,
            ),
        ),
        total_dismissals=Count(
            "analytics",
            filter=Q(
                analytics__event_type="dismiss",
                analytics__timestamp__gte=start_date,
            ),
        ),
    )

    result = []
    for modal in modals:
        ctr = 0.0
        if modal.total_views > 0:
            ctr = round((modal.total_clicks / modal.total_views) * 100, 2)

        result.append({
            "modal_id": modal.id,
            "modal_title": modal.title,
            "total_views": modal.total_views,
            "total_clicks": modal.total_clicks,
            "total_dismissals": modal.total_dismissals,
            "click_through_rate": ctr,
        })

    return result


@router.get("/admin/analytics/report", response=AnalyticsReportOut, tags=["admin"])
def admin_get_analytics_report(
    request: HttpRequest,
    days: int = 30,
):
    """Get aggregated analytics report for dashboard"""
    user_id, tenant_id = _get_user_context(request)

    end_date = timezone.now()
    start_date = end_date - timezone.timedelta(days=days)

    # Get aggregated counts
    analytics_qs = ModalAnalytics.objects.filter(
        tenant_id=tenant_id,
        timestamp__gte=start_date,
        timestamp__lte=end_date,
    )

    total_views = analytics_qs.filter(event_type="view").count()
    total_clicks = analytics_qs.filter(event_type="click").count()
    total_dismissals = analytics_qs.filter(event_type="dismiss").count()

    avg_ctr = 0.0
    if total_views > 0:
        avg_ctr = round((total_clicks / total_views) * 100, 2)

    # Get per-modal stats
    modal_stats = admin_get_modal_analytics(request, days=days)

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
        "average_ctr": avg_ctr,
        "modals": modal_stats,
    }


# =============================================================================
# Dashboard Endpoints
# =============================================================================


@router.get("/admin/dashboards/layouts", response=list[DashboardLayoutOut], tags=["admin"])
def admin_list_dashboard_layouts(
    request: HttpRequest,
    include_deleted: bool = False,
):
    user_id, tenant_id = _get_user_context(request)
    query = DashboardLayout.objects.filter(
        tenant_id=UUID(tenant_id),
        user_id=UUID(user_id),
    )
    if not include_deleted:
        query = query.filter(deleted_at__isnull=True)
    return list(query.order_by("-is_default", "-updated_at"))


@router.post("/admin/dashboards/layouts", response=DashboardLayoutOut, tags=["admin"])
def admin_create_dashboard_layout(
    request: HttpRequest,
    payload: DashboardLayoutIn,
):
    user_id, tenant_id = _get_user_context(request)
    data = payload.model_dump()

    if data.get("is_default"):
        DashboardLayout.objects.filter(
            tenant_id=UUID(tenant_id),
            user_id=UUID(user_id),
            is_default=True,
            deleted_at__isnull=True,
        ).update(is_default=False)

    layout = DashboardLayout.objects.create(
        user_id=UUID(user_id),
        tenant_id=UUID(tenant_id),
        layout_name=data["layout_name"],
        layout_config=_normalize_layout_config(data.get("layout_config", {})),
        is_default=data.get("is_default", False),
    )
    return layout


@router.put("/admin/dashboards/layouts/{layout_id}", response=DashboardLayoutOut, tags=["admin"])
def admin_update_dashboard_layout(
    request: HttpRequest,
    layout_id: str,
    payload: DashboardLayoutIn,
):
    user_id, tenant_id = _get_user_context(request)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        tenant_id=UUID(tenant_id),
        user_id=UUID(user_id),
        deleted_at__isnull=True,
    )
    data = payload.model_dump()

    if data.get("is_default"):
        DashboardLayout.objects.filter(
            tenant_id=UUID(tenant_id),
            user_id=UUID(user_id),
            is_default=True,
            deleted_at__isnull=True,
        ).exclude(id=layout.id).update(is_default=False)

    layout.layout_name = data["layout_name"]
    layout.layout_config = _normalize_layout_config(data.get("layout_config", layout.layout_config))
    layout.is_default = data.get("is_default", layout.is_default)
    layout.save()
    return layout


@router.delete("/admin/dashboards/layouts/{layout_id}", tags=["admin"])
def admin_delete_dashboard_layout(
    request: HttpRequest,
    layout_id: str,
    hard: bool = False,
):
    user_id, tenant_id = _get_user_context(request)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        tenant_id=UUID(tenant_id),
        user_id=UUID(user_id),
    )
    if hard:
        layout.delete()
    else:
        layout.soft_delete()
    return {"success": True}


@router.get("/admin/dashboards/layouts/{layout_id}/widgets", response=list[DashboardWidgetOut], tags=["admin"])
def admin_list_dashboard_widgets(
    request: HttpRequest,
    layout_id: str,
    include_deleted: bool = False,
):
    user_id, tenant_id = _get_user_context(request)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        tenant_id=UUID(tenant_id),
        user_id=UUID(user_id),
    )
    query = DashboardWidget.objects.filter(layout=layout)
    if not include_deleted:
        query = query.filter(deleted_at__isnull=True)
    return list(query.order_by("position_y", "position_x"))


@router.post("/admin/dashboards/layouts/{layout_id}/widgets", response=DashboardWidgetOut, tags=["admin"])
def admin_create_dashboard_widget(
    request: HttpRequest,
    layout_id: str,
    payload: DashboardWidgetIn,
):
    user_id, tenant_id = _get_user_context(request)
    layout = get_object_or_404(
        DashboardLayout,
        id=layout_id,
        tenant_id=UUID(tenant_id),
        user_id=UUID(user_id),
        deleted_at__isnull=True,
    )
    data = payload.model_dump()
    defaults = {
        "tenant_id": UUID(tenant_id),
        "position_x": data.get("position_x", 0),
        "position_y": data.get("position_y", 0),
        "width": data.get("width", 4),
        "height": data.get("height", 3),
        "settings": data.get("settings", {}),
        "is_visible": data.get("is_visible", True),
    }
    widget = (
        DashboardWidget.objects.filter(
            layout=layout,
            widget_key=data["widget_key"],
            deleted_at__isnull=True,
        )
        .first()
        or DashboardWidget.objects.filter(layout=layout, widget_key=data["widget_key"]).first()
    )
    if widget is None:
        widget = DashboardWidget.objects.create(
            layout=layout,
            widget_key=data["widget_key"],
            **defaults,
        )
    else:
        for attr, value in defaults.items():
            setattr(widget, attr, value)
        widget.deleted_at = None
        widget.save()
    return widget


@router.put("/admin/dashboards/widgets/{widget_id}", response=DashboardWidgetOut, tags=["admin"])
def admin_update_dashboard_widget(
    request: HttpRequest,
    widget_id: str,
    payload: DashboardWidgetIn,
):
    user_id, tenant_id = _get_user_context(request)
    widget = get_object_or_404(
        DashboardWidget,
        id=widget_id,
        tenant_id=UUID(tenant_id),
        layout__user_id=UUID(user_id),
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


@router.delete("/admin/dashboards/widgets/{widget_id}", tags=["admin"])
def admin_delete_dashboard_widget(
    request: HttpRequest,
    widget_id: str,
    hard: bool = False,
):
    user_id, tenant_id = _get_user_context(request)
    widget = get_object_or_404(
        DashboardWidget,
        id=widget_id,
        tenant_id=UUID(tenant_id),
        layout__user_id=UUID(user_id),
    )
    if hard:
        widget.delete()
    else:
        widget.soft_delete()
    return {"success": True}
