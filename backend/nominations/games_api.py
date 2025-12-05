from __future__ import annotations

import logging

from ninja import Router
from ninja.errors import HttpError

from .schemas import GameCreateSchema, GameSchema, GameUpdateSchema
from .services import (
    create_game_from_payload,
    get_game_payload,
    list_games,
    update_game_from_payload,
)

router = Router(tags=["games"])
logger = logging.getLogger(__name__)


def _require_superuser(request) -> None:
    if not request.user.is_authenticated or not getattr(
        request.user, "is_superuser", False
    ):
        logger.warning(
            "Superuser access denied for games API",
            extra={
                "user_id": getattr(getattr(request, "user", None), "id", None),
                "path": getattr(request, "path", None),
            },
        )
        raise HttpError(403, "Требуются права суперпользователя")


@router.get("/", response=list[GameSchema])
def games_list(request, search: str | None = None):
    _require_superuser(request)
    return list_games(search)


@router.post("/", response=GameSchema)
def games_create(request, payload: GameCreateSchema):
    _require_superuser(request)
    try:
        return create_game_from_payload(payload.model_dump())
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc


@router.get("/{game_id}", response=GameSchema)
def games_detail(request, game_id: str):
    _require_superuser(request)
    payload = get_game_payload(game_id)
    if not payload:
        raise HttpError(404, "Игра не найдена")
    return payload


@router.put("/{game_id}", response=GameSchema)
@router.patch("/{game_id}", response=GameSchema)
def games_update(request, game_id: str, payload: GameUpdateSchema):
    _require_superuser(request)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        payload = get_game_payload(game_id)
        if not payload:
            raise HttpError(404, "Игра не найдена")
        return payload
    try:
        return update_game_from_payload(game_id, data)
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    except LookupError as exc:
        raise HttpError(404, "Игра не найдена") from exc
