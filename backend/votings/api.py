from __future__ import annotations

from ninja import Router

from nominations.schemas import VotingSummarySchema
from nominations.services import list_votings_overview

router = Router(tags=["votings"])


@router.get("/", response=list[VotingSummarySchema])
def get_all_votings(request):
    """
    Возвращает список всех голосований вместе с основными метаданными и краткими номинациями.
    """
    return list_votings_overview()
