from __future__ import annotations

import logging
from typing import Any

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone

from nominations.data import DEFAULT_VOTING_CODE
from nominations.models import Game, Nomination, NominationOption, Voting

logger = logging.getLogger(__name__)


def _clean_str(value: Any) -> str:
    if value is None:
        return ""
    return value.strip() if isinstance(value, str) else str(value).strip()


def _normalize_kind(value: str | None) -> str:
    candidate = (value or "").strip().lower() or Nomination.NominationKind.GAME
    if candidate in Nomination.NominationKind.values:
        return candidate
    return Nomination.NominationKind.CUSTOM


def _normalize_game_data(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    if raw is None:
        return None

    release_year_value = raw.get("release_year")
    release_year = None
    if isinstance(release_year_value, int):
        release_year = release_year_value
    elif isinstance(release_year_value, str):
        try:
            release_year = int(release_year_value)
        except (TypeError, ValueError):
            release_year = None

    return {
        "id": _clean_str(raw.get("id")) or None,
        "title": _clean_str(raw.get("title") or raw.get("name") or ""),
        "genre": _clean_str(raw.get("genre") or "") or None,
        "studio": _clean_str(raw.get("studio") or "") or None,
        "release_year": release_year,
        "description": _clean_str(raw.get("description") or "") or None,
        "image_url": _clean_str(raw.get("image_url") or raw.get("imageUrl") or "")
        or None,
    }


def _normalize_option(raw: dict[str, Any], fallback_order: int) -> dict[str, Any]:
    game_data = _normalize_game_data(raw.get("game"))
    payload_raw = raw.get("payload") or raw.get("meta") or {}
    payload = payload_raw if isinstance(payload_raw, dict) else {}
    return {
        "id": _clean_str(raw.get("id")),
        "title": _clean_str(raw.get("title") or ""),
        "image_url": _clean_str(raw.get("image_url") or raw.get("imageUrl") or "")
        or None,
        "order": raw.get("order", fallback_order),
        "game": (
            game_data if game_data and (game_data["id"] or game_data["title"]) else None
        ),
        "payload": payload,
    }


def _normalize_nomination(raw: dict[str, Any], fallback_order: int) -> dict[str, Any]:
    options = raw.get("options") or []
    raw_config = raw.get("config") or {}
    config = raw_config if isinstance(raw_config, dict) else {}
    kind_value = _normalize_kind(raw.get("kind") or raw.get("type"))
    return {
        "id": _clean_str(raw.get("id")),
        "title": _clean_str(raw.get("title") or ""),
        "description": _clean_str(raw.get("description") or "") or None,
        "order": raw.get("order", fallback_order),
        "kind": kind_value,
        "config": config,
        "options": [
            _normalize_option(option, opt_index)
            for opt_index, option in enumerate(options)
        ],
    }


def normalize_voting_import_payload(payload: dict[str, Any]) -> dict[str, Any]:
    nominations = payload.get("nominations") or []
    deadline_at = payload.get("deadline_at") or payload.get("deadlineAt")
    if deadline_at and timezone.is_naive(deadline_at):
        deadline_at = timezone.make_aware(deadline_at)

    normalized = {
        "code": _clean_str(payload.get("code") or DEFAULT_VOTING_CODE).lower(),
        "title": _clean_str(payload.get("title") or payload.get("name") or ""),
        "description": _clean_str(payload.get("description") or "") or None,
        "order": payload.get("order", 0),
        "is_active": bool(payload.get("is_active", payload.get("isActive", True))),
        "show_vote_counts": bool(
            payload.get("show_vote_counts", payload.get("showVoteCounts", False))
        ),
        "rules": payload.get("rules") or {},
        "deadline_at": deadline_at,
        "nominations": [
            _normalize_nomination(raw_nom, index)
            for index, raw_nom in enumerate(nominations)
        ],
    }
    if not normalized["code"]:
        raise ValueError("Код голосования обязателен")
    if not normalized["title"]:
        normalized["title"] = normalized["code"]
    return normalized


def _validate_duplicates(nominations: list[dict[str, Any]]) -> None:
    nomination_ids: set[str] = set()
    option_ids: set[str] = set()
    for nomination in nominations:
        nomination_id = nomination["id"]
        if not nomination_id:
            raise ValueError("У каждой номинации должен быть id")
        if nomination_id in nomination_ids:
            raise ValueError(f"Дублируется id номинации: {nomination_id}")
        nomination_ids.add(nomination_id)
        for option in nomination.get("options", []):
            option_id = option["id"]
            if not option_id:
                raise ValueError("У каждой карточки должен быть id")
            if option_id in option_ids:
                raise ValueError(f"Дублируется id карточки: {option_id}")
            option_ids.add(option_id)


def _check_external_conflicts(
    nominations: list[dict[str, Any]], voting_code: str, *, db_alias: str
) -> None:
    nomination_ids = [nom["id"] for nom in nominations]
    option_ids = [
        option["id"]
        for nomination in nominations
        for option in nomination.get("options", [])
    ]

    conflicting_nominations = (
        Nomination.objects.using(db_alias)
        .filter(id__in=nomination_ids)
        .exclude(voting__code=voting_code)
    )
    if conflicting_nominations.exists():
        example = conflicting_nominations.first()
        raise ValueError(f"Номинация {example.id} уже существует в другом голосовании")

    conflicting_options = (
        NominationOption.objects.using(db_alias)
        .filter(id__in=option_ids)
        .exclude(nomination__voting__code=voting_code)
    )
    if conflicting_options.exists():
        example = conflicting_options.first()
        raise ValueError(f"Карточка {example.id} уже используется в другом голосовании")


def _apply_game_updates(game: Game, defaults: dict[str, Any]) -> bool:
    updated_fields: list[str] = []
    for field, value in defaults.items():
        if getattr(game, field) != value:
            setattr(game, field, value)
            updated_fields.append(field)
    if updated_fields:
        game.save(update_fields=updated_fields)
        return True
    return False


def _upsert_game(data: dict[str, Any], *, db_alias: str) -> tuple[Game, bool, bool]:
    defaults = {
        "title": data.get("title") or "Без названия",
        "genre": data.get("genre") or "",
        "studio": data.get("studio") or "",
        "release_year": data.get("release_year"),
        "description": data.get("description") or "",
        "image_url": data.get("image_url"),
    }
    game: Game | None = None
    created = False
    updated = False

    game_id = data.get("id")
    if game_id:
        game = Game.objects.using(db_alias).filter(id=game_id).first()
    if not game:
        # Fall back to title-based lookup to reuse existing game metadata.
        game = Game.objects.using(db_alias).filter(title=defaults["title"]).first()

    if game:
        updated = _apply_game_updates(game, defaults)
    else:
        game = Game.objects.using(db_alias).create(**defaults)
        created = True

    return game, created, updated


def _serialize_game(game: Game | None) -> dict[str, Any] | None:
    if not game:
        return None
    return {
        "id": game.id,
        "title": game.title,
        "genre": game.genre or None,
        "studio": game.studio or None,
        "release_year": game.release_year,
        "description": game.description or None,
        "image_url": game.image_url,
    }


def _serialize_option(option: NominationOption) -> dict[str, Any]:
    return {
        "id": option.id,
        "title": option.title,
        "image_url": option.image_url,
        "order": option.order,
        "game": _serialize_game(option.game),
        "payload": option.payload if isinstance(option.payload, dict) else {},
    }


def _serialize_nomination(nomination: Nomination) -> dict[str, Any]:
    return {
        "id": nomination.id,
        "title": nomination.title,
        "description": nomination.description or None,
        "kind": nomination.kind,
        "config": nomination.config if isinstance(nomination.config, dict) else {},
        "order": nomination.order,
        "options": [_serialize_option(option) for option in nomination.options.all()],
    }


def build_voting_export_payload(
    voting: Voting, *, nominations: list[Nomination] | None = None
) -> dict[str, Any]:
    if nominations is None:
        nominations = []
    return {
        "code": voting.code,
        "title": voting.title,
        "description": voting.description or None,
        "order": voting.order,
        "is_active": voting.is_active,
        "show_vote_counts": voting.show_vote_counts,
        "rules": voting.rules or {},
        "deadline_at": voting.deadline_at,
        "nominations": [
            _serialize_nomination(nomination) for nomination in nominations
        ],
    }


def export_voting_payload(
    code: str, *, using: str | None = None
) -> dict[str, Any] | None:
    db_alias = using or "default"
    voting = Voting.objects.using(db_alias).filter(code=code).first()
    if not voting:
        return None
    nominations = list(
        Nomination.objects.using(db_alias)
        .filter(voting=voting)
        .prefetch_related(
            Prefetch(
                "options",
                queryset=NominationOption.objects.order_by(
                    "order", "title"
                ).select_related("game"),
            )
        )
        .order_by("order", "title")
    )
    return build_voting_export_payload(voting, nominations=nominations)


def preview_voting_import(
    payload: dict[str, Any], *, using: str | None = None, force: bool = False
) -> dict[str, Any]:
    db_alias = using or "default"
    normalized = normalize_voting_import_payload(payload)
    _validate_duplicates(normalized["nominations"])

    existing = Voting.objects.using(db_alias).filter(code=normalized["code"]).first()
    if existing and not force:
        raise ValueError(
            f"Голосование с кодом «{normalized['code']}» уже существует. "
            "Укажите force=true для замены."
        )
    _check_external_conflicts(
        normalized["nominations"], normalized["code"], db_alias=db_alias
    )

    unique_games = set()
    for nomination in normalized["nominations"]:
        for option in nomination.get("options", []):
            game = option.get("game") or {}
            identifier = game.get("id") or game.get("title") or option["title"]
            if identifier:
                unique_games.add(str(identifier))

    option_count = sum(len(nom.get("options", [])) for nom in normalized["nominations"])
    return {
        "voting": normalized,
        "will_replace": bool(existing),
        "totals": {
            "nominations": len(normalized["nominations"]),
            "options": option_count,
            "games": len(unique_games),
        },
    }


def import_voting_payload(
    payload: dict[str, Any], *, using: str | None = None, force: bool = False
) -> dict[str, Any]:
    db_alias = using or "default"
    normalized = normalize_voting_import_payload(payload)
    _validate_duplicates(normalized["nominations"])

    existing = Voting.objects.using(db_alias).filter(code=normalized["code"]).first()
    replaced_existing = bool(existing)
    if existing and not force:
        raise ValueError(
            f"Голосование с кодом «{normalized['code']}» уже существует. "
            "Укажите force=true для замены."
        )

    _check_external_conflicts(
        normalized["nominations"], normalized["code"], db_alias=db_alias
    )

    if existing and force:
        logger.info(
            "Replacing existing voting via import",
            extra={"voting_code": normalized["code"]},
        )
        existing.delete()

    with transaction.atomic(using=db_alias):
        voting = Voting.objects.using(db_alias).create(
            code=normalized["code"],
            title=normalized["title"] or normalized["code"],
            description=normalized["description"] or "",
            order=normalized["order"],
            is_active=normalized["is_active"],
            show_vote_counts=normalized["show_vote_counts"],
            rules=normalized["rules"] or {},
            deadline_at=normalized["deadline_at"],
        )

        created_games = 0
        updated_games = 0
        option_count = 0

        for nomination in normalized["nominations"]:
            kind_value = _normalize_kind(nomination.get("kind"))
            config_value = (
                nomination.get("config")
                if isinstance(nomination.get("config"), dict)
                else {}
            )
            nomination_obj = Nomination.objects.using(db_alias).create(
                id=nomination["id"],
                voting=voting,
                title=nomination["title"],
                description=nomination.get("description") or "",
                kind=kind_value,
                config=config_value,
                order=nomination.get("order", 0),
                is_active=True,
            )
            for option in nomination.get("options", []):
                game = None
                if option.get("game"):
                    game, created, updated = _upsert_game(
                        option["game"], db_alias=db_alias
                    )
                    created_games += int(created)
                    updated_games += int(updated)
                NominationOption.objects.using(db_alias).create(
                    id=option["id"],
                    nomination=nomination_obj,
                    game=game,
                    title=option["title"],
                    image_url=option.get("image_url"),
                    payload=option.get("payload") or {},
                    order=option.get("order", 0),
                    is_active=True,
                )
                option_count += 1

    export_nominations = list(
        Nomination.objects.using(db_alias)
        .filter(voting=voting)
        .prefetch_related(
            Prefetch(
                "options",
                queryset=NominationOption.objects.order_by(
                    "order", "title"
                ).select_related("game"),
            )
        )
        .order_by("order", "title")
    )

    return {
        "voting": build_voting_export_payload(voting, nominations=export_nominations),
        "replaced_existing": replaced_existing,
        "created_games": created_games,
        "updated_games": updated_games,
        "nominations_count": len(normalized["nominations"]),
        "options_count": option_count,
    }


def delete_voting_by_code(code: str, *, using: str | None = None) -> bool:
    db_alias = using or "default"
    deleted, _ = Voting.objects.using(db_alias).filter(code=code).delete()
    return bool(deleted)
