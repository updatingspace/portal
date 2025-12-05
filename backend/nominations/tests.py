from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from .data import NOMINATIONS, seed_nominations_from_fixture
from .models import NominationVote, Voting

User = get_user_model()


def post_json(client: Client, path: str, payload: dict[str, Any]):
    return client.post(path, data=json.dumps(payload), content_type="application/json")


class NominationsApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed_nominations_from_fixture(force=True)
        cls.nomination_id = NOMINATIONS[0]["id"]
        cls.option_id = NOMINATIONS[0]["options"][0]["id"]
        cls.voting = Voting.objects.get(code="main")

    def setUp(self):
        self.client = Client()
        self.password = "StrongPass123!"
        self.user = User.objects.create_user(
            username="voter",
            email="voter@example.com",
            password=self.password,
        )

    def _login(self, client: Client | None = None):
        client = client or self.client
        response = post_json(
            client,
            "/api/auth/login",
            {"email": self.user.email, "password": self.password},
        )
        self.assertEqual(response.status_code, 200)
        return client

    def test_list_nominations_returns_all_items_for_anonymous(self):
        response = self.client.get("/api/nominations/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), len(NOMINATIONS))
        first = data[0]
        self.assertIsNone(first["counts"])
        self.assertFalse(first["can_vote"])
        self.assertIsNone(first["user_vote"])
        self.assertTrue(first["is_voting_open"])

    def test_list_nominations_sets_can_vote_for_authenticated_user(self):
        self._login()

        response = self.client.get("/api/nominations/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(all(item["can_vote"] for item in data))
        self.assertTrue(all(item["user_vote"] is None for item in data))

    def test_nomination_detail_returns_payload(self):
        response = self.client.get(f"/api/nominations/{self.nomination_id}")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], self.nomination_id)
        self.assertGreater(len(data["options"]), 0)

    def test_nomination_detail_returns_404_for_unknown_id(self):
        response = self.client.get("/api/nominations/unknown")
        self.assertEqual(response.status_code, 404)

    def test_vote_requires_authentication(self):
        response = post_json(
            self.client,
            f"/api/nominations/{self.nomination_id}/vote",
            {"option_id": self.option_id},
        )
        self.assertEqual(response.status_code, 401)

    def test_vote_returns_404_for_missing_nomination(self):
        self._login()
        response = post_json(
            self.client,
            "/api/nominations/missing/vote",
            {"option_id": self.option_id},
        )
        self.assertEqual(response.status_code, 404)

    def test_vote_returns_400_for_invalid_option(self):
        self._login()
        response = post_json(
            self.client,
            f"/api/nominations/{self.nomination_id}/vote",
            {"option_id": "wrong-option"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Option not found", response.json()["detail"])

    def test_vote_rejects_when_voting_closed(self):
        deadline = timezone.now() - timedelta(hours=1)
        self.voting.deadline_at = deadline
        self.voting.save(update_fields=["deadline_at"])

        self._login()
        response = post_json(
            self.client,
            f"/api/nominations/{self.nomination_id}/vote",
            {"option_id": self.option_id},
        )

        self.assertEqual(response.status_code, 403)
        detail = response.json()["detail"]
        self.assertIn("Голосование завершено", detail)
        self.assertIn(deadline.isoformat(), detail)

    def test_vote_records_choice_and_returns_counts(self):
        self._login()

        response = post_json(
            self.client,
            f"/api/nominations/{self.nomination_id}/vote",
            {"option_id": self.option_id},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["nomination_id"], self.nomination_id)
        self.assertEqual(data["option_id"], self.option_id)
        self.assertEqual(data["user_vote"], self.option_id)
        self.assertTrue(data["is_voting_open"])
        self.assertTrue(data["can_vote"])
        self.assertIsNone(data["counts"])
        vote = NominationVote.objects.get()
        self.assertEqual(vote.user, self.user)
        self.assertEqual(vote.option_id, self.option_id)

    def test_vote_returns_counts_when_visibility_enabled(self):
        self.voting.show_vote_counts = True
        self.voting.save(update_fields=["show_vote_counts"])

        self._login()
        response = post_json(
            self.client,
            f"/api/nominations/{self.nomination_id}/vote",
            {"option_id": self.option_id},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data["counts"], dict)
        self.assertEqual(data["counts"].get(self.option_id), 1)

    def test_nomination_detail_returns_user_vote_when_exists(self):
        self._login()
        post_json(
            self.client,
            f"/api/nominations/{self.nomination_id}/vote",
            {"option_id": self.option_id},
        )

        response = self.client.get(f"/api/nominations/{self.nomination_id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user_vote"], self.option_id)

    def test_list_nominations_includes_user_vote(self):
        self._login()
        post_json(
            self.client,
            f"/api/nominations/{self.nomination_id}/vote",
            {"option_id": self.option_id},
        )

        response = self.client.get("/api/nominations/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        payload = next(item for item in data if item["id"] == self.nomination_id)
        self.assertEqual(payload["user_vote"], self.option_id)
        self.assertTrue(payload["can_vote"])


class VotingModelTests(TestCase):
    def test_code_autogenerated_from_title(self):
        voting = Voting.objects.create(title="New Voting Title")
        self.assertEqual(voting.code, "new-voting-title")

    def test_augments_slug_when_code_conflicts(self):
        Voting.objects.create(code="duplicate", title="Duplicate existing")
        voting = Voting.objects.create(title="Duplicate existing")
        self.assertNotEqual(voting.code, "duplicate")
        self.assertTrue(voting.code.startswith("duplicate-"))


class VotingsApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed_nominations_from_fixture(force=True)

    def test_list_votings_returns_overview(self):
        response = self.client.get("/api/votings/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(len(data), 2)
        ids = {item["id"] for item in data}
        self.assertIn("main", ids)
        self.assertIn("test", ids)

        main_payload = next(item for item in data if item["id"] == "main")
        main_nominations = [item for item in NOMINATIONS if item["voting"] == "main"]
        self.assertEqual(main_payload["nomination_count"], len(main_nominations))
        self.assertEqual(len(main_payload["nominations"]), len(main_nominations))

        first_nomination = main_payload["nominations"][0]
        self.assertEqual(first_nomination["title"], NOMINATIONS[0]["title"])
        self.assertNotIn("options", first_nomination)

        test_payload = next(item for item in data if item["id"] == "test")
        self.assertEqual(test_payload["nomination_count"], 0)
        self.assertEqual(test_payload["nominations"], [])
