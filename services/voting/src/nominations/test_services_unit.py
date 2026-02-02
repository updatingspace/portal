from __future__ import annotations

import datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone
from ninja.errors import HttpError

from nominations import services
from nominations.data import seed_nominations_from_fixture
from nominations.games_api import _require_superuser
from nominations.models import (
    Game,
    Nomination,
    NominationOption,
    NominationVote,
    Voting,
)
from nominations.services import (
    NominationNotFoundError,
    OptionNotFoundError,
    TelegramLinkRequiredError,
    VotingClosedError,
    create_game_from_payload,
    get_game_payload,
    get_nomination_with_status,
    get_vote_counts_map,
    list_games,
    list_nominations,
    record_vote,
    update_game_from_payload,
)

User = get_user_model()


class GameHelpersTests(TestCase):
    def setUp(self):
        self.seed_patch = patch("nominations.services.ensure_nominations_seeded")
        self.seed_patch.start()
        self.addCleanup(self.seed_patch.stop)

    def test_game_slug_uniqueness_adds_suffix(self):
        first = Game.objects.create(title="Space Odyssey")
        # Same slug after normalization; title differs to satisfy uniqueness
        second = Game.objects.create(title="Space Odyssey!")
        self.assertEqual(first.id, "space-odyssey")
        self.assertEqual(second.id, "space-odyssey-1")

    def test_list_games_filters_by_search(self):
        Game.objects.create(title="Alpha")
        Game.objects.create(title="Beta")

        payload = list_games(search="alp")

        self.assertEqual([g["title"] for g in payload], ["Alpha"])

    def test_get_game_payload_handles_missing(self):
        self.assertIsNone(get_game_payload("missing"))

    def test_create_game_requires_title_and_rejects_duplicates(self):
        with self.assertRaises(ValueError):
            create_game_from_payload({})

        Game.objects.create(title="Unique")
        with self.assertRaises(ValueError):
            create_game_from_payload({"title": "Unique"})

    def test_update_game_parses_release_year_and_invalid_values(self):
        game = Game.objects.create(title="G1", release_year=2020)

        updated = update_game_from_payload(
            game.id, {"release_year": "2021", "genre": "Action"}
        )
        self.assertEqual(updated["release_year"], 2021)

        updated_invalid = update_game_from_payload(game.id, {"release_year": "oops"})
        self.assertIsNone(updated_invalid["release_year"])

    def test_update_game_raises_for_missing_or_duplicate_title(self):
        with self.assertRaises(LookupError):
            update_game_from_payload("missing", {"title": "any"})

        base = Game.objects.create(title="Base")
        duplicate = Game.objects.create(title="Duplicate")
        with self.assertRaises(ValueError):
            update_game_from_payload(base.id, {"title": duplicate.title})


class VotingModelTests(TestCase):
    def test_expose_vote_counts_uses_rules_and_show_flag(self):
        voting_rule = Voting.objects.create(
            code="rule",
            title="Rule",
            show_vote_counts=False,
            rules={"show_vote_counts": True},
        )
        voting_flag = Voting.objects.create(
            code="flag", title="Flag", show_vote_counts=True, rules={}
        )
        voting_invalid = Voting.objects.create(
            code="invalid",
            title="Invalid",
            show_vote_counts=False,
            rules="bad",
        )

        self.assertTrue(voting_rule.expose_vote_counts)
        self.assertTrue(voting_flag.expose_vote_counts)
        self.assertFalse(voting_invalid.expose_vote_counts)

    def test_is_open_respects_deadline(self):
        open_voting = Voting.objects.create(code="open", title="Open", deadline_at=None)
        closed_voting = Voting.objects.create(
            code="closed",
            title="Closed",
            deadline_at=timezone.now() - datetime.timedelta(hours=1),
        )

        self.assertTrue(open_voting.is_open)
        self.assertFalse(closed_voting.is_open)


class NominationServiceTests(TestCase):
    def setUp(self):
        self.seed_patch = patch("nominations.services.ensure_nominations_seeded")
        self.seed_patch.start()
        self.addCleanup(self.seed_patch.stop)

        self.user = User.objects.create_user(
            username="voter",
            email="voter@example.com",
            password="StrongPass123!",
        )
        self.voting = Voting.objects.create(
            code="vote",
            title="Voting",
            is_active=True,
            show_vote_counts=False,
        )
        self.nomination = Nomination.objects.create(
            id="nom-1",
            voting=self.voting,
            title="Best Game",
            is_active=True,
        )
        self.option = NominationOption.objects.create(
            id="opt-1",
            nomination=self.nomination,
            title="Choice A",
        )

    def test_resolve_vote_permissions_branches(self):
        can_vote, requires = services._resolve_vote_permissions(AnonymousUser())
        self.assertFalse(can_vote)
        self.assertFalse(requires)

        with override_settings(TELEGRAM_REQUIRE_LINK_FOR_VOTING=True), patch(
            "nominations.services.user_has_telegram_link", return_value=False
        ):
            can_vote, requires = services._resolve_vote_permissions(self.user)
            self.assertFalse(can_vote)
            self.assertTrue(requires)

        with override_settings(TELEGRAM_REQUIRE_LINK_FOR_VOTING=True), patch(
            "nominations.services.user_has_telegram_link", return_value=True
        ):
            can_vote, requires = services._resolve_vote_permissions(self.user)
            self.assertTrue(can_vote)
            self.assertFalse(requires)

    def test_list_nominations_filters_by_voting_and_flags(self):
        other_voting = Voting.objects.create(code="other", title="Other")
        Nomination.objects.create(
            id="nom-2", voting=other_voting, title="Other nomination"
        )

        payload = list_nominations(None, voting_code=self.voting.code)

        self.assertEqual(len(payload), 1)
        self.assertFalse(payload[0]["can_vote"])
        self.assertIsNone(payload[0]["user_vote"])
        self.assertEqual(payload[0]["id"], self.nomination.id)

    def test_list_nominations_includes_counts_when_exposed(self):
        self.voting.show_vote_counts = True
        self.voting.save(update_fields=["show_vote_counts"])
        NominationVote.objects.create(
            user=self.user, nomination=self.nomination, option=self.option
        )

        payload = list_nominations(self.user)
        target = next(item for item in payload if item["id"] == self.nomination.id)

        self.assertEqual(target["counts"].get(self.option.id), 1)
        self.assertEqual(target["user_vote"], self.option.id)
        self.assertTrue(target["can_vote"])

    def test_get_nomination_with_status_handles_missing(self):
        self.assertIsNone(get_nomination_with_status("missing", self.user))

    def test_record_vote_raises_for_missing_entities(self):
        with self.assertRaises(NominationNotFoundError):
            record_vote("absent", "any", self.user)

        with self.assertRaises(OptionNotFoundError):
            record_vote(self.nomination.id, "wrong", self.user)

    def test_record_vote_raises_when_voting_closed(self):
        deadline = timezone.now() - datetime.timedelta(hours=2)
        self.voting.deadline_at = deadline
        self.voting.save(update_fields=["deadline_at"])

        with self.assertRaises(VotingClosedError) as ctx:
            record_vote(self.nomination.id, self.option.id, self.user)
        self.assertEqual(ctx.exception.deadline_at, deadline)

    def test_record_vote_requires_telegram_link_when_flag_enabled(self):
        with override_settings(TELEGRAM_REQUIRE_LINK_FOR_VOTING=True), patch(
            "nominations.services.user_has_telegram_link", return_value=False
        ):
            with self.assertRaises(TelegramLinkRequiredError):
                record_vote(self.nomination.id, self.option.id, self.user)

    def test_record_vote_saves_choice_without_counts(self):
        counts, nomination = record_vote(self.nomination.id, self.option.id, self.user)

        self.assertIsNone(counts)
        self.assertEqual(nomination.id, self.nomination.id)
        self.assertTrue(
            NominationVote.objects.filter(
                user=self.user, nomination=self.nomination, option=self.option
            ).exists()
        )

    def test_record_vote_returns_counts_when_exposed(self):
        self.voting.show_vote_counts = True
        self.voting.save(update_fields=["show_vote_counts"])

        counts, _ = record_vote(self.nomination.id, self.option.id, self.user)

        self.assertEqual(counts, {self.option.id: 1})

    def test_get_vote_counts_map_filters_ids(self):
        other_nom = Nomination.objects.create(
            id="nom-3", voting=self.voting, title="Another", is_active=True
        )
        other_opt = NominationOption.objects.create(
            id="opt-2", nomination=other_nom, title="Choice B"
        )
        NominationVote.objects.create(
            user=self.user, nomination=other_nom, option=other_opt
        )
        NominationVote.objects.create(
            user=self.user, nomination=self.nomination, option=self.option
        )

        filtered = get_vote_counts_map([self.nomination.id])

        self.assertEqual(set(filtered.keys()), {self.nomination.id})
        self.assertEqual(filtered[self.nomination.id].get(self.option.id), 1)


class NominationFixtureSeedTests(TestCase):
    def setUp(self):
        self.voting = Voting.objects.create(code="main", title="Main")

    def test_seeding_skips_game_for_person_nomination(self):
        fixture = [
            {
                "id": "best-reviewer",
                "title": "Best reviewer",
                "description": "",
                "voting": "main",
                "kind": "person",
                "config": {"module": "reviewer_award", "subject": "person"},
                "options": [
                    {
                        "id": "best-reviewer-r1",
                        "title": "Reviewer One",
                        "image_url": None,
                        "game": None,
                        "payload": {"reviewer": "Reviewer One"},
                    }
                ],
            }
        ]

        with patch("nominations.data._load_fixture", return_value=fixture):
            seed_nominations_from_fixture(force=True)

        option = NominationOption.objects.get(id="best-reviewer-r1")
        self.assertIsNone(option.game)
        self.assertEqual(Game.objects.count(), 0)

    def test_seeding_attaches_game_when_metadata_exists(self):
        fixture = [
            {
                "id": "best-review",
                "title": "Best review",
                "description": "",
                "voting": "main",
                "kind": "review",
                "config": {"module": "review_award", "subject": "review"},
                "options": [
                    {
                        "id": "best-review-1",
                        "title": "Review for DL2",
                        "image_url": None,
                        "game": {"title": "Dying Light 2"},
                        "payload": {"games": ["Dying Light 2"]},
                    }
                ],
            }
        ]

        with patch("nominations.data._load_fixture", return_value=fixture):
            seed_nominations_from_fixture(force=True)

        option = NominationOption.objects.get(id="best-review-1")
        self.assertIsNotNone(option.game)
        self.assertEqual(option.game.title, "Dying Light 2")

    def test_seeding_adds_missing_nomination_without_force(self):
        Nomination.objects.create(id="existing", voting=self.voting, title="Old")
        fixture = [
            {
                "id": "existing",
                "title": "Old",
                "description": "",
                "voting": "main",
                "kind": "game",
                "config": {"module": "game_award", "subject": "game"},
                "options": [],
            },
            {
                "id": "new-nomination",
                "title": "New",
                "description": "",
                "voting": "main",
                "kind": "custom",
                "config": {"module": "custom_award", "subject": "custom"},
                "options": [],
            },
        ]

        with patch("nominations.data._load_fixture", return_value=fixture):
            created = seed_nominations_from_fixture(force=False)

        self.assertTrue(created)
        ids = set(Nomination.objects.values_list("id", flat=True))
        self.assertIn("existing", ids)
        self.assertIn("new-nomination", ids)


class GamesApiGuardTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_require_superuser_blocks_non_superuser(self):
        request = self.factory.get("/")
        request.user = AnonymousUser()
        with self.assertRaises(HttpError):
            _require_superuser(request)

    def test_require_superuser_allows_superuser(self):
        user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="StrongPass123!",
        )
        request = self.factory.get("/")
        request.user = user

        _require_superuser(request)
