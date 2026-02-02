from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TypedDict

from django.utils import timezone

DEFAULT_VOTING_CODE = "main"


class GameFixtureData(TypedDict, total=False):
    title: str
    genre: str | None
    studio: str | None
    release_year: int | None
    image_url: str | None


class NominationOptionData(TypedDict):
    id: str
    title: str
    image_url: str | None
    game: GameFixtureData | None
    payload: dict[str, Any] | None


class NominationData(TypedDict):
    id: str
    title: str
    description: str | None
    options: list[NominationOptionData]
    voting: str | None
    kind: str | None
    config: dict[str, Any] | None


FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "nominations.json"
VOTINGS_FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "votings.json"


class VotingData(TypedDict, total=False):
    code: str
    title: str
    description: str | None
    order: int
    is_active: bool
    show_vote_counts: bool
    rules: dict[str, Any]
    deadline_at: str | None


def _load_fixture() -> list[NominationData]:
    try:
        raw = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"Fixture not found: {FIXTURE_PATH}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in fixture {FIXTURE_PATH}: {exc}") from exc

    nominations: list[NominationData] = []
    for item in raw:
        options: list[NominationOptionData] = []
        for opt in item.get("options", []):
            payload = opt.get("payload")
            normalized_payload = payload if isinstance(payload, dict) else {}
            options.append(
                {
                    "id": str(opt["id"]),
                    "title": opt["title"],
                    "image_url": opt.get("image_url"),
                    "game": opt.get("game"),
                    "payload": normalized_payload,
                }
            )
        config = item.get("config")
        normalized_config = config if isinstance(config, dict) else {}
        nominations.append(
            {
                "id": str(item["id"]),
                "title": item["title"],
                "description": item.get("description"),
                "voting": str(item.get("voting") or DEFAULT_VOTING_CODE).lower(),
                "kind": str(item.get("kind") or "game"),
                "config": normalized_config,
                "options": options,
            }
        )

    return nominations


NOMINATIONS: list[NominationData] = _load_fixture()


def seed_votings_from_fixture(force: bool = False, using: str | None = None) -> bool:
    """
    Populate the database with voting configurations.

    - If force=False (default) and there are already votings, nothing is changed.
    - If force=True, existing votings are wiped before loading.
    - Returns True when anything was created/updated.
    """
    from .models import Voting

    db_alias = using or "default"

    if not force:
        existing_codes = set(
            Voting.objects.using(db_alias).values_list("code", flat=True)
        )
        missing = {
            str(item.get("code", DEFAULT_VOTING_CODE)).lower() for item in VOTINGS
        } - existing_codes
        if not missing:
            return False

    if force:
        Voting.objects.using(db_alias).all().delete()

    created_any = False
    for index, voting_data in enumerate(VOTINGS):
        deadline_value = voting_data.get("deadline_at")
        deadline_at = None
        if deadline_value:
            try:
                deadline_at = timezone.make_aware(
                    timezone.datetime.fromisoformat(deadline_value)
                )
            except Exception:
                deadline_at = None

        rules_data = voting_data.get("rules") or {}
        rules = dict(rules_data) if isinstance(rules_data, dict) else {}
        rules.setdefault("is_public", True)

        code = voting_data.get("code", DEFAULT_VOTING_CODE)
        voting = Voting.objects.using(db_alias).filter(code=code).first()
        desired = {
            "title": voting_data.get("title") or code,
            "description": voting_data.get("description") or "",
            "order": voting_data.get("order", index),
            "is_active": voting_data.get("is_active", True),
            "show_vote_counts": voting_data.get("show_vote_counts", False),
            "rules": rules,
            "deadline_at": deadline_at,
        }
        if voting:
            update_fields: list[str] = []
            for field, value in desired.items():
                if getattr(voting, field) != value:
                    setattr(voting, field, value)
                    update_fields.append(field)
            if update_fields:
                voting.save(update_fields=update_fields)
                created_any = True
        else:
            Voting.objects.using(db_alias).create(code=code, **desired)
            created_any = True

    # Страхуемся: базовое голосование всегда существует.
    if not Voting.objects.using(db_alias).filter(code=DEFAULT_VOTING_CODE).exists():
        Voting.objects.using(db_alias).create(
            code=DEFAULT_VOTING_CODE,
            title="Основное голосование",
            description="Создано автоматически",
            order=0,
            is_active=True,
            show_vote_counts=False,
            rules={"is_public": True},
        )
        created_any = True

    return created_any


def _load_votings_fixture() -> list[VotingData]:
    try:
        raw = json.loads(VOTINGS_FIXTURE_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"Fixture not found: {VOTINGS_FIXTURE_PATH}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Invalid JSON in fixture {VOTINGS_FIXTURE_PATH}: {exc}"
        ) from exc

    votings: list[VotingData] = []
    for index, item in enumerate(raw):
        votings.append(
            {
                "code": str(item["code"]).lower(),
                "title": item["title"],
                "description": item.get("description"),
                "order": item.get("order", index),
                "is_active": bool(item.get("is_active", True)),
                "show_vote_counts": bool(item.get("show_vote_counts", False)),
                "rules": item.get("rules") or {},
                "deadline_at": item.get("deadline_at"),
            }
        )
    return votings


VOTINGS: list[VotingData] = _load_votings_fixture()


def _should_attach_game(
    nomination_kind: str,
    config: dict[str, Any],
    game_metadata: dict[str, Any],
) -> bool:
    """
    Decide whether a nomination option should be linked to a game instance.
    """

    subject = str(config.get("subject") or "").lower()
    has_game_info = any(
        bool(game_metadata.get(key))
        for key in (
            "title",
            "genre",
            "studio",
            "release_year",
            "description",
            "image_url",
        )
    )

    return subject == "game" or nomination_kind == "game" or has_game_info


def seed_nominations_from_fixture(
    force: bool = False, using: str | None = None
) -> bool:
    """
    Populate the database from the JSON fixture.

    - If force=False (default), nominations/options are upserted without
        deleting existing custom data.
    - If force=True, existing nominations/options are wiped before loading.
    - Returns True when anything was created/updated.
    """
    from .models import Game, Nomination, NominationOption, Voting

    db_alias = using or "default"

    # Гарантируем наличие голосований перед созданием номинаций.
    seed_votings_from_fixture(force=False, using=db_alias)

    nominations = _load_fixture()
    default_voting = Voting.objects.using(db_alias).filter(
        code=DEFAULT_VOTING_CODE
    ).first() or Voting.objects.using(db_alias).create(
        code=DEFAULT_VOTING_CODE,
        title="Основное голосование",
        description="Создано автоматически",
        order=0,
        is_active=True,
        show_vote_counts=False,
        rules={"is_public": True},
    )

    if force:
        Nomination.objects.using(db_alias).all().delete()

    created_any = False
    for index, nomination_data in enumerate(nominations):
        voting_code = nomination_data.get("voting") or DEFAULT_VOTING_CODE
        voting = (
            Voting.objects.using(db_alias).filter(code=voting_code).first()
            or default_voting
        )
        kind_value = str(nomination_data.get("kind") or Nomination.NominationKind.GAME)
        if kind_value not in Nomination.NominationKind.values:
            kind_value = Nomination.NominationKind.CUSTOM
        config_value = nomination_data.get("config")
        normalized_config = dict(config_value) if isinstance(config_value, dict) else {}
        nomination = (
            Nomination.objects.using(db_alias).filter(id=nomination_data["id"]).first()
        )
        desired_nomination = {
            "voting": voting,
            "title": nomination_data["title"],
            "description": nomination_data.get("description") or "",
            "kind": kind_value,
            "config": normalized_config,
            "order": index,
            "is_active": True,
        }
        if nomination:
            update_fields: list[str] = []
            for field, value in desired_nomination.items():
                if getattr(nomination, field) != value:
                    setattr(nomination, field, value)
                    update_fields.append(field)
            if update_fields:
                nomination.save(update_fields=update_fields)
                created_any = True
        else:
            nomination = Nomination.objects.using(db_alias).create(
                id=nomination_data["id"], **desired_nomination
            )
            created_any = True

        seen_option_ids: set[str] = set()
        for opt_index, option_data in enumerate(nomination_data.get("options", [])):
            option_title = option_data["title"].strip()
            game_metadata_raw = option_data.get("game")
            game_metadata = (
                dict(game_metadata_raw) if isinstance(game_metadata_raw, dict) else {}
            )
            payload_raw = option_data.get("payload")
            payload_value = dict(payload_raw) if isinstance(payload_raw, dict) else {}

            attach_game = _should_attach_game(
                nomination_kind=kind_value,
                config=normalized_config,
                game_metadata=game_metadata,
            )

            game = None
            if attach_game:
                release_year = game_metadata.get("release_year")
                game_defaults = {
                    "genre": (game_metadata.get("genre") or "").strip(),
                    "studio": (game_metadata.get("studio") or "").strip(),
                    "release_year": (
                        release_year if isinstance(release_year, int) else None
                    ),
                    "description": (game_metadata.get("description") or "").strip(),
                    "image_url": game_metadata.get("image_url")
                    or option_data.get("image_url"),
                }
                game_title = (game_metadata.get("title") or option_title).strip()
                game = (
                    Game.objects.using(db_alias)
                    .filter(title=game_title or option_title)
                    .first()
                )
                if game:
                    update_fields: list[str] = []
                    for field, value in game_defaults.items():
                        if getattr(game, field) != value:
                            setattr(game, field, value)
                            update_fields.append(field)
                    if update_fields:
                        game.save(update_fields=update_fields)
                        created_any = True
                else:
                    game = Game.objects.using(db_alias).create(
                        title=game_title or option_title, **game_defaults
                    )
                    created_any = True

            option = (
                NominationOption.objects.using(db_alias)
                .filter(id=option_data["id"])
                .first()
            )
            desired_option = {
                "nomination": nomination,
                "game": game,
                "title": option_data["title"],
                "image_url": option_data.get("image_url"),
                "payload": payload_value,
                "order": opt_index,
                "is_active": True,
            }
            if option:
                update_fields = []
                for field, value in desired_option.items():
                    if getattr(option, field) != value:
                        setattr(option, field, value)
                        update_fields.append(field)
                if update_fields:
                    option.save(update_fields=update_fields)
                    created_any = True
            else:
                option = NominationOption.objects.using(db_alias).create(
                    id=option_data["id"],
                    **desired_option,
                )
                created_any = True

            seen_option_ids.add(option.id)

        if force:
            NominationOption.objects.using(db_alias).filter(
                nomination=nomination,
            ).exclude(id__in=seen_option_ids).delete()

    return created_any
