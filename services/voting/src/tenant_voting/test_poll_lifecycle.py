"""Real HTTP/database regressions, also executed against isolated YDB in CI."""

import json
import uuid
from unittest.mock import patch

from django.test import Client, TestCase, override_settings

from core.middleware import RateLimitMiddleware
from tenant_voting.models import Nomination, Option, Poll, PollInvite, PollParticipant
from tenant_voting.tests import _headers


@override_settings(BFF_INTERNAL_HMAC_SECRET="ci-internal-hmac")
class PollLifecycleTests(TestCase):
    def setUp(self):
        self.tenant_id = str(uuid.uuid4())
        self.user_id = str(uuid.uuid4())
        self.client = Client()
        access_patch = patch(
            "tenant_voting.api._access_check_allowed", return_value=True
        )
        self.access = access_patch.start()
        self.addCleanup(access_patch.stop)
        RateLimitMiddleware.clear_counters()

    def request(self, method, path, payload=None, *, tenant_id=None, status=200):
        raw = json.dumps(payload).encode() if payload is not None else b""
        headers = _headers(
            method=method,
            path=path,
            body=raw,
            tenant_id=tenant_id or self.tenant_id,
            tenant_slug="test-community",
            user_id=self.user_id,
            master_flags={},
            request_id=str(uuid.uuid4()),
        )
        response = self.client.generic(method, path, raw, "application/json", **headers)
        self.assertEqual(response.status_code, status, response.content.decode())
        return response.json()

    def create(self, **extra):
        return self.request(
            "POST",
            "/api/v1/polls",
            {
                "title": "Choose a date",
                "scope_type": "TENANT",
                "visibility": "public",
                "results_visibility": "always",
                **extra,
            },
            status=201,
        )

    def test_schedule_template_and_settings_round_trip(self):
        poll = self.create(
            template="schedule", allow_revoting=True, settings={"label": "Дата"}
        )
        path = f"/api/v1/polls/{poll['id']}"
        info = self.request("GET", path + "/info")
        self.assertEqual(info["poll"]["template"], "schedule")
        self.assertEqual(info["poll"]["settings"]["label"], "Дата")
        self.assertTrue(info["poll"]["allow_revoting"])
        self.assertEqual(len(info["nominations"]), 1)
        self.assertEqual(info["nominations"][0]["max_votes"], 5)
        self.assertEqual(info["nominations"][0]["config"], {})
        self.assertEqual(PollParticipant.objects.get(poll_id=poll["id"]).role, "owner")
        self.assertEqual(PollInvite.objects.get(poll_id=poll["id"]).status, "accepted")
        listing = self.request("GET", "/api/v1/polls")
        self.assertEqual([row["id"] for row in listing["items"]], [poll["id"]])
        self.request(
            "PUT", path, {"title": "Updated date", "settings": {"label": "Time"}}
        )
        self.assertEqual(
            self.request("GET", path + "/info")["poll"]["settings"], {"label": "Time"}
        )
        self.request("DELETE", path)
        self.request("GET", path, status=404)
        self.assertEqual(
            PollParticipant.objects.filter(tenant_id=self.tenant_id).count(), 0
        )
        self.assertEqual(PollInvite.objects.filter(tenant_id=self.tenant_id).count(), 0)

    def test_every_template_and_blank_poll_can_be_created(self):
        templates = self.request("GET", "/api/v1/polls/templates")
        for template in [None, *templates]:
            with self.subTest(template=template and template["slug"]):
                RateLimitMiddleware.clear_counters()
                poll = self.create(template=template["slug"] if template else None)
                questions = Nomination.objects.filter(poll_id=poll["id"])
                self.assertEqual(
                    questions.count(), len(template["questions"]) if template else 0
                )
                self.request("DELETE", f"/api/v1/polls/{poll['id']}")

    def test_creation_rolls_back_all_rows_after_late_failure(self):
        payload = {
            "title": "Atomic poll",
            "template": "schedule",
            "nominations": [
                {
                    "title": "Extra question",
                    "options": [{"title": "Valid"}, {"title": ""}],
                },
            ],
        }
        error = self.request("POST", "/api/v1/polls", payload, status=400)
        self.assertEqual(error["error"]["code"], "OPTION_TITLE_REQUIRED")
        for model in [Poll, PollParticipant, PollInvite, Nomination, Option]:
            self.assertEqual(
                model.objects.filter(tenant_id=self.tenant_id).count(),
                0,
                model.__name__,
            )

    def test_access_denied_and_other_tenant_cannot_change_poll(self):
        self.access.return_value = False
        self.request("POST", "/api/v1/polls", {"title": "Not allowed"}, status=403)
        self.assertEqual(Poll.objects.filter(tenant_id=self.tenant_id).count(), 0)
        self.access.return_value = True
        poll = self.create(template="schedule")
        path = f"/api/v1/polls/{poll['id']}"
        other = str(uuid.uuid4())
        for method, suffix, payload in [
            ("GET", "", None),
            ("GET", "/info", None),
            ("PUT", "", {"title": "Wrong community"}),
            ("DELETE", "", None),
            ("POST", "/nominations", {"title": "Wrong community"}),
        ]:
            self.request(method, path + suffix, payload, tenant_id=other, status=404)
        self.assertEqual(
            self.request("GET", "/api/v1/polls", tenant_id=other)["items"], []
        )
        self.assertEqual(self.request("GET", path)["title"], "Choose a date")

    def test_draft_questions_publish_vote_results_and_close(self):
        poll = self.create(allow_revoting=True)
        path = f"/api/v1/polls/{poll['id']}"
        question = self.request(
            "POST",
            path + "/nominations",
            {
                "title": "Which day?",
                "config": {"hint": "Your local time"},
            },
            status=201,
        )
        question_path = path + f"/nominations/{question['id']}"
        option = self.request(
            "POST", question_path + "/options", {"title": "Friday"}, status=201
        )
        option_path = path + f"/options/{option['id']}"
        self.request("PUT", question_path, {"title": "Choose a day"})
        self.request("PUT", option_path, {"title": "Saturday"})
        self.request("PUT", path, {"status": "active"})
        ballot = {
            "poll_id": poll["id"],
            "nomination_id": question["id"],
            "option_id": option["id"],
        }
        self.request("POST", "/api/v1/votes", ballot, status=201)
        self.request("POST", "/api/v1/votes", ballot, status=409)
        votes = self.request("GET", path + "/votes/me")
        self.assertEqual(len(votes), 1)
        results = self.request("GET", path + "/results")
        self.assertEqual(results["nominations"][0]["options"][0]["votes"], 1)
        self.request("DELETE", f"/api/v1/votes/{votes[0]['id']}")
        self.assertEqual(self.request("GET", path + "/votes/me"), [])
        self.request("PUT", path, {"status": "closed"})
        self.request("POST", "/api/v1/votes", ballot, status=409)
