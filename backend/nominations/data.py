from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TypedDict

from django.utils import timezone
from django.utils.text import slugify

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


class NominationData(TypedDict):
    id: str
    title: str
    description: str | None
    options: list[NominationOptionData]
    voting: str | None


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
            options.append(
                {
                    "id": str(opt["id"]),
                    "title": opt["title"],
                    "image_url": opt.get("image_url"),
                    "game": opt.get("game"),
                }
            )
        nominations.append(
            {
                "id": str(item["id"]),
                "title": item["title"],
                "description": item.get("description"),
                "voting": str(item.get("voting") or DEFAULT_VOTING_CODE).lower(),
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

    if not force and Voting.objects.using(db_alias).exists():
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

        voting, created = Voting.objects.using(db_alias).update_or_create(
            code=voting_data.get("code", DEFAULT_VOTING_CODE),
            defaults={
                "title": voting_data.get("title")
                or voting_data.get("code", DEFAULT_VOTING_CODE),
                "description": voting_data.get("description") or "",
                "order": voting_data.get("order", index),
                "is_active": voting_data.get("is_active", True),
                "show_vote_counts": voting_data.get("show_vote_counts", False),
                "rules": voting_data.get("rules") or {},
                "deadline_at": deadline_at,
            },
        )
        created_any = created_any or created

    # Страхуемся: базовое голосование всегда существует.
    if not Voting.objects.using(db_alias).filter(code=DEFAULT_VOTING_CODE).exists():
        Voting.objects.using(db_alias).create(
            code=DEFAULT_VOTING_CODE,
            title="Основное голосование",
            description="Создано автоматически",
            order=0,
            is_active=True,
            show_vote_counts=False,
            rules={},
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


def seed_nominations_from_fixture(
    force: bool = False, using: str | None = None
) -> bool:
    """
    Populate the database from the JSON fixture.

    - If force=False (default) and there are already nominations, nothing is changed.
    - If force=True, existing nominations/options are wiped before loading.
    - Returns True when anything was created/updated.
    """
    from .models import Game, Nomination, NominationOption, Voting

    db_alias = using or "default"

    # Гарантируем наличие голосований перед созданием номинаций.
    seed_votings_from_fixture(force=False, using=db_alias)

    nominations = _load_fixture()
    default_voting = (
        Voting.objects.using(db_alias).filter(code=DEFAULT_VOTING_CODE).first()
    )
    if default_voting is None:
        default_voting = Voting.objects.using(db_alias).create(
            code=DEFAULT_VOTING_CODE,
            title="Основное голосование",
            description="Создано автоматически",
            order=0,
            is_active=True,
            show_vote_counts=False,
            rules={},
        )

    if not force and Nomination.objects.using(db_alias).exists():
        return False

    if force:
        Nomination.objects.using(db_alias).all().delete()

    created_any = False
    for index, nomination_data in enumerate(nominations):
        voting_code = nomination_data.get("voting") or DEFAULT_VOTING_CODE
        voting = (
            Voting.objects.using(db_alias).filter(code=voting_code).first()
            or default_voting
        )
        nomination, created = Nomination.objects.using(db_alias).update_or_create(
            id=nomination_data["id"],
            defaults={
                "voting": voting,
                "title": nomination_data["title"],
                "description": nomination_data.get("description") or "",
                "order": index,
                "is_active": True,
            },
        )
        created_any = created_any or created

        seen_option_ids: set[str] = set()
        for opt_index, option_data in enumerate(nomination_data.get("options", [])):
            option_title = option_data["title"].strip()
            game_metadata = option_data.get("game") or {}
            release_year = game_metadata.get("release_year")
            game_defaults = {
                "genre": (game_metadata.get("genre") or "").strip(),
                "studio": (game_metadata.get("studio") or "").strip(),
                "release_year": release_year if isinstance(release_year, int) else None,
                "description": (game_metadata.get("description") or "").strip(),
                "image_url": game_metadata.get("image_url") or option_data.get("image_url"),
            }
            game_title = (game_metadata.get("title") or option_title).strip()
            game, _ = Game.objects.using(db_alias).update_or_create(
                title=game_title or option_title,
                defaults=game_defaults,
            )

            option, opt_created = NominationOption.objects.using(
                db_alias
            ).update_or_create(
                id=option_data["id"],
                defaults={
                    "nomination": nomination,
                    "game": game,
                    "title": option_data["title"],
                    "image_url": option_data.get("image_url"),
                    "order": opt_index,
                    "is_active": True,
                },
            )
            # Safety: align nomination in case the option already existed.
            update_fields: list[str] = []
            if option.nomination_id != nomination.id:
                option.nomination = nomination
                update_fields.append("nomination")
            if option.game_id != game.id:
                option.game = game
                update_fields.append("game")
            if update_fields:
                option.save(update_fields=update_fields)
            seen_option_ids.add(option.id)
            created_any = created_any or opt_created

        if force:
            NominationOption.objects.using(db_alias).filter(
                nomination=nomination,
            ).exclude(id__in=seen_option_ids).delete()

    return created_any
