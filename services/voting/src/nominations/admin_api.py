from __future__ import annotations

import logging

from ninja import Router
from ninja.errors import HttpError

from .schemas import (
    AdminDashboardStatsSchema,
    VotingAdminDetailSchema,
    VotingAdminUpdateSchema,
    VotingSummarySchema,
)
from .services import (
    get_admin_dashboard_metrics,
    get_admin_voting_detail,
    list_votings_overview,
    update_voting_from_admin_payload,
)

router = Router(tags=["admin"])
logger = logging.getLogger(__name__)


def _require_superuser(request) -> None:
    if not request.user.is_authenticated or not getattr(
        request.user, "is_superuser", False
    ):
        logger.warning(
            "Superuser access denied for admin API",
            extra={
                "user_id": getattr(getattr(request, "user", None), "id", None),
                "path": getattr(request, "path", None),
            },
        )
        raise HttpError(403, "Требуются права суперпользователя")


@router.get("/votings", response=list[VotingSummarySchema])
def admin_votings_list(request):
    _require_superuser(request)
    return list_votings_overview(include_non_public=True)


@router.get("/votings/{voting_code}", response=VotingAdminDetailSchema)
def admin_voting_detail(request, voting_code: str):
    _require_superuser(request)
    payload = get_admin_voting_detail(voting_code)
    if not payload:
        raise HttpError(404, "Голосование не найдено")
    return payload


@router.patch("/votings/{voting_code}", response=VotingAdminDetailSchema)
def admin_voting_update(request, voting_code: str, payload: VotingAdminUpdateSchema):
    _require_superuser(request)
    data = payload.model_dump(exclude_unset=True)
    try:
        return update_voting_from_admin_payload(voting_code, data)
    except LookupError as exc:
        raise HttpError(404, "Голосование не найдено") from exc


@router.get("/stats", response=AdminDashboardStatsSchema)
def admin_stats(request):
    _require_superuser(request)
    return get_admin_dashboard_metrics()
