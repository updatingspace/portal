from __future__ import annotations

from ninja import Router
from ninja.errors import HttpError

from nominations.data import DEFAULT_VOTING_CODE
from nominations.schemas import VotingFeedSchema, VotingSummarySchema
from nominations.services import list_votings_feed, list_votings_overview
from votings.schemas import (
    VotingImportPreviewSchema,
    VotingImportResultSchema,
    VotingImportSchema,
)
from votings.services import (
    delete_voting_by_code,
    export_voting_payload,
    import_voting_payload,
    preview_voting_import,
)

router = Router(tags=["votings"])


def _require_superuser(request) -> None:
    if not request.user.is_authenticated or not getattr(
        request.user, "is_superuser", False
    ):
        raise HttpError(403, "Требуются права суперпользователя")


@router.get("/", response=list[VotingSummarySchema])
def get_all_votings(request):
    """
    Возвращает список всех голосований вместе с основными метаданными и краткими номинациями.
    """
    include_non_public = bool(getattr(request.user, "is_superuser", False))
    return list_votings_overview(include_non_public=include_non_public)


@router.get("/feed", response=list[VotingFeedSchema], auth=None)
def get_votings_feed(request, limit: int = 20):
    """
    Облегченный список активных голосований для главной страницы:
    только базовые поля и счётчик номинаций, без списка номинаций.
    """
    include_non_public = bool(getattr(request.user, "is_superuser", False))
    safe_limit = max(1, min(limit, 100))
    return list_votings_feed(limit=safe_limit, include_non_public=include_non_public)


@router.get("/{code}/export", response=VotingImportSchema)
def export_voting(request, code: str):
    _require_superuser(request)
    payload = export_voting_payload(code)
    if not payload:
        raise HttpError(404, "Голосование не найдено")
    return payload


@router.post("/import/preview", response=VotingImportPreviewSchema)
def import_voting_preview(request, payload: VotingImportSchema, force: bool = False):
    _require_superuser(request)
    try:
        return preview_voting_import(payload.model_dump(), force=force)
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc


@router.post("/import", response=VotingImportResultSchema)
def import_voting(request, payload: VotingImportSchema, force: bool = False):
    _require_superuser(request)
    try:
        return import_voting_payload(payload.model_dump(), force=force)
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc


@router.delete("/{code}")
def delete_voting(request, code: str):
    _require_superuser(request)
    if code == DEFAULT_VOTING_CODE:
        raise HttpError(400, "Базовое голосование удалить нельзя")
    removed = delete_voting_by_code(code)
    if not removed:
        raise HttpError(404, "Голосование не найдено")
    return {"ok": True}
