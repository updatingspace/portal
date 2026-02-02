from datetime import datetime

from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from .models import HomePageModal
from .schemas import HomePageModalIn, HomePageModalOut

router = Router()


@router.get(
    "/homepage-modals", response=list[HomePageModalOut], tags=["personalization"]
)
def list_homepage_modals(request: HttpRequest):
    """Get active homepage modals for display"""
    now = datetime.now()
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

    modal = HomePageModal.objects.create(**payload.dict())
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
    for attr, value in payload.dict().items():
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
