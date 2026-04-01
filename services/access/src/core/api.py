from typing import Any

from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from .models import HomePageModal, UserPreference
from .schemas import (
    DefaultPreferencesOut,
    HomePageModalIn,
    HomePageModalOut,
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


@router.get(
    "/homepage-modals", response=list[HomePageModalOut], tags=["personalization"]
)
def list_homepage_modals(request: HttpRequest):
    """Get active homepage modals for display"""
    now = timezone.now()
    modals = HomePageModal.objects.filter(is_active=True)

    # Filter by date range
    result = []
    for modal in modals:
        # Check if modal should be shown based on dates
        if modal.start_date and modal.start_date > now:
            continue
        if modal.end_date and modal.end_date < now:
            continue
        result.append(modal)

    return result


@router.get("/admin/homepage-modals", response=list[HomePageModalOut], tags=["admin"])
def admin_list_homepage_modals(request: HttpRequest):
    """Get all homepage modals for admin (requires superuser)"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        raise HttpError(403, "Unauthorized")

    return list(HomePageModal.objects.all())


@router.post("/admin/homepage-modals", response=HomePageModalOut, tags=["admin"])
def admin_create_homepage_modal(request: HttpRequest, payload: HomePageModalIn):
    """Create a new homepage modal (requires superuser)"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        raise HttpError(403, "Unauthorized")

    modal = HomePageModal.objects.create(**payload.model_dump())
    return modal


@router.put(
    "/admin/homepage-modals/{modal_id}", response=HomePageModalOut, tags=["admin"]
)
def admin_update_homepage_modal(
    request: HttpRequest, modal_id: int, payload: HomePageModalIn
):
    """Update a homepage modal (requires superuser)"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        raise HttpError(403, "Unauthorized")

    modal = get_object_or_404(HomePageModal, id=modal_id)
    for attr, value in payload.model_dump().items():
        setattr(modal, attr, value)
    modal.save()
    return modal


@router.delete("/admin/homepage-modals/{modal_id}", tags=["admin"])
def admin_delete_homepage_modal(request: HttpRequest, modal_id: int):
    """Delete a homepage modal (requires superuser)"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        raise HttpError(403, "Unauthorized")

    modal = get_object_or_404(HomePageModal, id=modal_id)
    modal.delete()
    return {"success": True}
