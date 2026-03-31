from __future__ import annotations

from ninja import Router
from ninja.errors import HttpError

from nominations.schemas import VotingFeedSchema, VotingSummarySchema
from nominations.compat import (
    is_global_admin,
    list_votings_feed,
    list_votings_overview,
)
from tenant_voting.context import require_internal_context
from votings.schemas import (
    VotingImportPreviewSchema,
    VotingImportResultSchema,
    VotingImportSchema,
)

router = Router(tags=["votings"])


def _not_found() -> HttpError:
    return HttpError(404, {"code": "NOT_FOUND", "message": "Not found"})


@router.get("/", response=list[VotingSummarySchema])
def get_all_votings(request):
    """
    Возвращает список всех голосований вместе с основными
    метаданными и краткими номинациями.
    """
    ctx = require_internal_context(request)
    include_non_public = is_global_admin(ctx)
    return list_votings_overview(ctx, include_non_public=include_non_public)


@router.get("/feed", response=list[VotingFeedSchema], auth=None)
def get_votings_feed(request, limit: int = 20):
    """
    Облегченный список активных голосований для главной страницы:
    только базовые поля и счётчик номинаций, без списка номинаций.
    """
    ctx = require_internal_context(request)
    include_non_public = is_global_admin(ctx)
    safe_limit = max(1, min(limit, 100))
    return list_votings_feed(
        ctx,
        limit=safe_limit,
        include_non_public=include_non_public,
    )


@router.get("/{code}/export", response=VotingImportSchema)
def export_voting(request, code: str):
    raise _not_found()


@router.post("/import/preview", response=VotingImportPreviewSchema)
def import_voting_preview(
    request,
    payload: VotingImportSchema,
    force: bool = False,
):
    raise _not_found()


@router.post("/import", response=VotingImportResultSchema)
def import_voting(request, payload: VotingImportSchema, force: bool = False):
    raise _not_found()


@router.delete("/{code}")
def delete_voting(request, code: str):
    raise _not_found()
