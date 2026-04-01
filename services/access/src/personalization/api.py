from __future__ import annotations

import uuid
from typing import Any

from django.http import HttpRequest
from ninja import Router
from ninja.errors import HttpError

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
