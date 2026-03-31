from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path
from unittest.mock import patch

from django.test import Client, TestCase, override_settings

from tenant_voting.models import (
    Nomination,
    Option,
    Poll,
    PollScopeType,
    PollStatus,
    Vote,
)

BFF_SRC = Path(__file__).resolve().parents[4] / "services" / "bff" / "src"
if str(BFF_SRC) not in sys.path:
    sys.path.insert(0, str(BFF_SRC))

from bff.security import sign_internal_request  # noqa: E402


def _headers(
    *,
    method: str,
    path: str,
    body: bytes = b"",
    tenant_id: str,
    tenant_slug: str,
    user_id: str,
    request_id: str | None = None,
):
    request_id = request_id or str(uuid.uuid4())
    signed = sign_internal_request(
        method=method,
        path=path,
        body=body,
        request_id=request_id,
    )
    return {
        "HTTP_HOST": "testserver",
        "HTTP_X_REQUEST_ID": request_id,
        "HTTP_X_TENANT_ID": tenant_id,
        "HTTP_X_TENANT_SLUG": tenant_slug,
        "HTTP_X_USER_ID": user_id,
        "HTTP_X_MASTER_FLAGS": "{}",
        "HTTP_X_UPDSPACE_TIMESTAMP": signed.timestamp,
        "HTTP_X_UPDSPACE_SIGNATURE": signed.signature,
        "CONTENT_TYPE": "application/json",
    }


def _allow_legacy_access(**kwargs) -> bool:
    return kwargs.get("action") != "voting.votings.admin"


@override_settings(BFF_INTERNAL_HMAC_SECRET="test-secret")
class LegacyCompatApiTests(TestCase):
    def setUp(self):
        super().setUp()
        self.client = Client()
        self.tenant_id = str(uuid.uuid4())
        self.other_tenant_id = str(uuid.uuid4())
        self.tenant_slug = "aef"
        self.user_id = str(uuid.uuid4())

    def _create_poll(self, *, tenant_id: str, title: str = "Poll"):
        poll = Poll.objects.create(
            tenant_id=tenant_id,
            title=title,
            description="Legacy compatible poll",
            status=PollStatus.ACTIVE,
            scope_type=PollScopeType.TENANT,
            scope_id=tenant_id,
            visibility="public",
            created_by=self.user_id,
            settings={"legacy_code": title.lower().replace(" ", "-")},
        )
        nomination = Nomination.objects.create(
            tenant_id=tenant_id,
            poll=poll,
            title=f"{title} nomination",
            description="Question",
            kind="custom",
            sort_order=0,
            max_votes=1,
        )
        option = Option.objects.create(
            tenant_id=tenant_id,
            nomination=nomination,
            title=f"{title} option",
            sort_order=0,
        )
        return poll, nomination, option

    def test_votings_feed_blocks_unsigned_direct_access(self):
        response = self.client.get("/api/v1/votings/feed")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["error"]["code"],
            "MISSING_REQUEST_ID",
        )

    @patch(
        "nominations.compat._access_check_allowed",
        side_effect=_allow_legacy_access,
    )
    def test_votings_feed_is_scoped_to_current_tenant(self, _mock_access):
        own_poll, _, _ = self._create_poll(
            tenant_id=self.tenant_id,
            title="Own Poll",
        )
        self._create_poll(tenant_id=self.other_tenant_id, title="Other Poll")

        headers = _headers(
            method="GET",
            path="/api/v1/votings/feed",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
        )
        response = self.client.get("/api/v1/votings/feed", **headers)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], str(own_poll.settings["legacy_code"]))

    @patch(
        "nominations.compat._access_check_allowed",
        side_effect=_allow_legacy_access,
    )
    def test_nomination_detail_does_not_leak_other_tenant_data(
        self,
        _mock_access,
    ):
        _, other_nomination, _ = self._create_poll(
            tenant_id=self.other_tenant_id,
            title="Other Poll",
        )
        headers = _headers(
            method="GET",
            path=f"/api/v1/nominations/{other_nomination.id}",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
        )

        response = self.client.get(
            f"/api/v1/nominations/{other_nomination.id}",
            **headers,
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "NOT_FOUND")

    @patch(
        "nominations.compat._access_check_allowed",
        side_effect=_allow_legacy_access,
    )
    def test_vote_records_uuid_user_vote_in_tenant_voting_table(
        self,
        _mock_access,
    ):
        poll, nomination, option = self._create_poll(
            tenant_id=self.tenant_id,
            title="Vote Poll",
        )
        body = json.dumps({"option_id": str(option.id)}).encode("utf-8")
        headers = _headers(
            method="POST",
            path=f"/api/v1/nominations/{nomination.id}/vote",
            body=body,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
        )

        response = self.client.post(
            f"/api/v1/nominations/{nomination.id}/vote",
            data=body,
            content_type="application/json",
            **headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            Vote.objects.filter(
                tenant_id=self.tenant_id,
                poll=poll,
                nomination=nomination,
                option=option,
                user_id=self.user_id,
            ).exists()
        )

    def test_legacy_admin_routes_return_404(self):
        headers = _headers(
            method="GET",
            path="/api/v1/votings/legacy/export",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
        )

        response = self.client.get("/api/v1/votings/legacy/export", **headers)

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "NOT_FOUND")
