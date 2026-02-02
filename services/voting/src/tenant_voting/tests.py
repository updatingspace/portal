"""
Voting Service Tests

Tests for Voting API endpoints without external access_control dependency.
Uses mocks for permission checks.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass
from unittest.mock import patch, MagicMock

from django.conf import settings
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from tenant_voting.models import (
    Nomination,
    Option,
    Poll,
    PollScopeType,
    PollStatus,
    PollVisibility,
    Vote,
    PollParticipant,
    PollRole,
)


API_PREFIX = "/api/v1"
POLLS_ROOT = f"{API_PREFIX}/polls"
POLLS_LIST = POLLS_ROOT
VOTES_ROOT = f"{API_PREFIX}/votes"


@dataclass(frozen=True)
class SignedHeaders:
    timestamp: str
    signature: str


def _body_sha256(body: bytes) -> str:
    return hashlib.sha256(body or b"").hexdigest()


def sign_internal_request(
    *,
    method: str,
    path: str,
    body: bytes,
    request_id: str,
) -> SignedHeaders:
    secret = getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "")
    if not secret:
        raise RuntimeError("BFF_INTERNAL_HMAC_SECRET is not configured")

    ts = str(int(time.time()))
    msg = "\n".join(
        [
            method.upper(),
            path,
            _body_sha256(body),
            request_id,
            ts,
        ]
    ).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), msg, digestmod=hashlib.sha256).hexdigest()
    return SignedHeaders(timestamp=ts, signature=sig)


def _headers(
    *,
    method: str,
    path: str,
    body: bytes,
    tenant_id: str,
    tenant_slug: str,
    user_id: str,
    master_flags: dict,
    request_id: str,
):
    signed = sign_internal_request(method=method, path=path, body=body, request_id=request_id)
    return {
        "HTTP_X_REQUEST_ID": request_id,
        "HTTP_X_TENANT_ID": tenant_id,
        "HTTP_X_TENANT_SLUG": tenant_slug,
        "HTTP_X_USER_ID": user_id,
        "HTTP_X_MASTER_FLAGS": json.dumps(master_flags, separators=(",", ":")),
        "HTTP_X_UPDSPACE_TIMESTAMP": signed.timestamp,
        "HTTP_X_UPDSPACE_SIGNATURE": signed.signature,
        "CONTENT_TYPE": "application/json",
    }


class VotingModelTests(TestCase):
    """Test Voting models."""

    def setUp(self):
        self.tenant_id = str(uuid.uuid4())
        self.user_id = str(uuid.uuid4())

    def test_poll_creation(self):
        """Test basic poll creation."""
        poll = Poll.objects.create(
            tenant_id=self.tenant_id,
            title="Test Poll",
            description="Test description",
            status=PollStatus.DRAFT,
            scope_type=PollScopeType.TENANT,
            scope_id=self.tenant_id,
            visibility=PollVisibility.PUBLIC,
            created_by=self.user_id,
        )
        self.assertIsNotNone(poll.id)
        self.assertEqual(poll.title, "Test Poll")
        self.assertEqual(poll.status, PollStatus.DRAFT)

    def test_nomination_creation(self):
        """Test nomination creation linked to poll."""
        poll = Poll.objects.create(
            tenant_id=self.tenant_id,
            title="Test Poll",
            status=PollStatus.DRAFT,
            scope_type=PollScopeType.TENANT,
            scope_id=self.tenant_id,
            created_by=self.user_id,
        )
        nomination = Nomination.objects.create(
            poll=poll,
            tenant_id=self.tenant_id,
            title="Best Game",
            sort_order=0,
        )
        self.assertIsNotNone(nomination.id)
        self.assertEqual(nomination.poll, poll)
        self.assertEqual(nomination.title, "Best Game")

    def test_option_creation(self):
        """Test option creation linked to nomination."""
        poll = Poll.objects.create(
            tenant_id=self.tenant_id,
            title="Test Poll",
            status=PollStatus.DRAFT,
            scope_type=PollScopeType.TENANT,
            scope_id=self.tenant_id,
            created_by=self.user_id,
        )
        nomination = Nomination.objects.create(
            poll=poll,
            tenant_id=self.tenant_id,
            title="Best Game",
            sort_order=0,
        )
        option = Option.objects.create(
            nomination=nomination,
            tenant_id=self.tenant_id,
            title="Game A",
            sort_order=0,
        )
        self.assertIsNotNone(option.id)
        self.assertEqual(option.nomination, nomination)
        self.assertEqual(option.title, "Game A")

    def test_vote_creation(self):
        """Test vote creation."""
        poll = Poll.objects.create(
            tenant_id=self.tenant_id,
            title="Test Poll",
            status=PollStatus.ACTIVE,
            scope_type=PollScopeType.TENANT,
            scope_id=self.tenant_id,
            created_by=self.user_id,
        )
        nomination = Nomination.objects.create(
            poll=poll,
            tenant_id=self.tenant_id,
            title="Best Game",
            sort_order=0,
        )
        option = Option.objects.create(
            nomination=nomination,
            tenant_id=self.tenant_id,
            title="Game A",
            sort_order=0,
        )
        vote = Vote.objects.create(
            tenant_id=self.tenant_id,
            poll=poll,
            nomination=nomination,
            option=option,
            user_id=self.user_id,
        )
        self.assertIsNotNone(vote.id)
        self.assertEqual(vote.poll, poll)
        self.assertEqual(vote.option, option)

    def test_tenant_isolation(self):
        """Test that polls are isolated by tenant."""
        other_tenant_id = str(uuid.uuid4())
        
        Poll.objects.create(
            tenant_id=self.tenant_id,
            title="Poll 1",
            status=PollStatus.ACTIVE,
            scope_type=PollScopeType.TENANT,
            scope_id=self.tenant_id,
            created_by=self.user_id,
        )
        Poll.objects.create(
            tenant_id=other_tenant_id,
            title="Poll 2",
            status=PollStatus.ACTIVE,
            scope_type=PollScopeType.TENANT,
            scope_id=other_tenant_id,
            created_by=self.user_id,
        )

        polls_tenant1 = Poll.objects.filter(tenant_id=self.tenant_id)
        polls_tenant2 = Poll.objects.filter(tenant_id=other_tenant_id)

        self.assertEqual(polls_tenant1.count(), 1)
        self.assertEqual(polls_tenant2.count(), 1)
        self.assertEqual(polls_tenant1.first().title, "Poll 1")
        self.assertEqual(polls_tenant2.first().title, "Poll 2")


def _mock_access_check_allowed(**kwargs) -> bool:
    """Mock access check that allows all requests."""
    return True


def _mock_access_check_denied(**kwargs) -> bool:
    """Mock access check that denies all requests."""
    return False


@override_settings(BFF_INTERNAL_HMAC_SECRET="test-secret")
class VotingApiTests(TestCase):
    """Test Voting API endpoints."""

    def setUp(self):
        super().setUp()
        self.client = Client()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = "aef"
        self.user_id = str(uuid.uuid4())

    def _create_poll_with_nomination(self, *, status: str = PollStatus.ACTIVE, visibility: str = PollVisibility.PUBLIC):
        """Helper to create a poll with nomination and options."""
        poll = Poll.objects.create(
            tenant_id=self.tenant_id,
            title="Test Poll",
            status=status,
            scope_type=PollScopeType.TENANT,
            scope_id=self.tenant_id,
            visibility=visibility,
            created_by=self.user_id,
        )
        nomination = Nomination.objects.create(
            poll=poll,
            tenant_id=self.tenant_id,
            title="Best Game",
            sort_order=0,
        )
        option_a = Option.objects.create(
            nomination=nomination,
            tenant_id=self.tenant_id,
            title="Game A",
            sort_order=0,
        )
        option_b = Option.objects.create(
            nomination=nomination,
            tenant_id=self.tenant_id,
            title="Game B",
            sort_order=1,
        )
        return poll, nomination, option_a, option_b

    @patch("tenant_voting.api._access_check_allowed", new=_mock_access_check_allowed)
    def test_list_polls_empty(self):
        """Test listing polls when none exist."""
        request_id = str(uuid.uuid4())
        hdrs = _headers(
            method="GET",
            path=POLLS_LIST,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": True},
            request_id=request_id,
        )
        
        resp = self.client.get(POLLS_LIST, **hdrs)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("items", data)
        self.assertEqual(len(data["items"]), 0)

    @patch("tenant_voting.api._access_check_allowed", new=_mock_access_check_allowed)
    def test_list_polls_with_data(self):
        """Test listing polls with existing data."""
        poll, _, _, _ = self._create_poll_with_nomination()

        request_id = str(uuid.uuid4())
        hdrs = _headers(
            method="GET",
            path=POLLS_LIST,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": True},
            request_id=request_id,
        )

        resp = self.client.get(POLLS_LIST, **hdrs)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["title"], "Test Poll")

    @patch("tenant_voting.api._access_check_allowed", new=_mock_access_check_allowed)
    def test_get_single_poll(self):
        """Test getting a single poll by ID."""
        poll, _, _, _ = self._create_poll_with_nomination()

        request_id = str(uuid.uuid4())
        path = f"{POLLS_ROOT}/{poll.id}"
        hdrs = _headers(
            method="GET",
            path=path,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": True},
            request_id=request_id,
        )

        resp = self.client.get(path, **hdrs)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["title"], "Test Poll")
        self.assertEqual(str(data["id"]), str(poll.id))

    @patch("tenant_voting.api._access_check_allowed", new=_mock_access_check_allowed)
    def test_create_poll(self):
        """Test creating a new poll."""
        request_id = str(uuid.uuid4())
        body = {
            "title": "New Poll",
            "description": "A new test poll",
            "scopeType": "TENANT",
            "scopeId": self.tenant_id,
            "visibility": "public",
        }
        raw = json.dumps(body).encode("utf-8")
        hdrs = _headers(
            method="POST",
            path=POLLS_LIST,
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": True},
            request_id=request_id,
        )

        resp = self.client.post(POLLS_LIST, data=raw, content_type="application/json", **hdrs)
        self.assertEqual(resp.status_code, 201)  # POST returns 201 Created
        data = resp.json()
        self.assertEqual(data["title"], "New Poll")
        self.assertEqual(data["status"], "draft")

    @patch("tenant_voting.api._access_check_allowed", new=_mock_access_check_allowed)
    def test_cast_vote(self):
        """Test casting a vote."""
        poll, nomination, option_a, _ = self._create_poll_with_nomination()

        request_id = str(uuid.uuid4())
        body = {
            "poll_id": str(poll.id),
            "nomination_id": str(nomination.id),
            "option_id": str(option_a.id),
        }
        raw = json.dumps(body).encode("utf-8")
        hdrs = _headers(
            method="POST",
            path=VOTES_ROOT,
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=request_id,
        )

        resp = self.client.post(VOTES_ROOT, data=raw, content_type="application/json", **hdrs)
        self.assertEqual(resp.status_code, 201)
        
        # Verify vote was created
        votes = Vote.objects.filter(poll=poll, user_id=self.user_id)
        self.assertEqual(votes.count(), 1)
        self.assertEqual(votes.first().option, option_a)

    @patch("tenant_voting.api._access_check_allowed", new=_mock_access_check_allowed)
    def test_duplicate_vote_rejected(self):
        """Test that duplicate votes are rejected."""
        poll, nomination, option_a, _ = self._create_poll_with_nomination()

        # First vote
        Vote.objects.create(
            tenant_id=self.tenant_id,
            poll=poll,
            nomination=nomination,
            option=option_a,
            user_id=self.user_id,
        )

        # Try to vote again
        request_id = str(uuid.uuid4())
        body = {
            "poll_id": str(poll.id),
            "nomination_id": str(nomination.id),
            "option_id": str(option_a.id),
        }
        raw = json.dumps(body).encode("utf-8")
        hdrs = _headers(
            method="POST",
            path=VOTES_ROOT,
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=request_id,
        )

        resp = self.client.post(VOTES_ROOT, data=raw, content_type="application/json", **hdrs)
        self.assertEqual(resp.status_code, 409)

    @patch("tenant_voting.api._access_check_allowed", new=_mock_access_check_allowed)
    def test_vote_on_draft_poll_rejected(self):
        """Test that voting on draft polls is rejected."""
        poll, nomination, option_a, _ = self._create_poll_with_nomination(status=PollStatus.DRAFT)

        request_id = str(uuid.uuid4())
        body = {
            "poll_id": str(poll.id),
            "nomination_id": str(nomination.id),
            "option_id": str(option_a.id),
        }
        raw = json.dumps(body).encode("utf-8")
        hdrs = _headers(
            method="POST",
            path=VOTES_ROOT,
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=request_id,
        )

        resp = self.client.post(VOTES_ROOT, data=raw, content_type="application/json", **hdrs)
        self.assertEqual(resp.status_code, 409)  # 409 Conflict for non-active poll

    @patch("tenant_voting.api._access_check_allowed", new=_mock_access_check_allowed)
    def test_vote_on_closed_poll_rejected(self):
        """Test that voting on closed polls is rejected."""
        poll, nomination, option_a, _ = self._create_poll_with_nomination(status=PollStatus.CLOSED)

        request_id = str(uuid.uuid4())
        body = {
            "poll_id": str(poll.id),
            "nomination_id": str(nomination.id),
            "option_id": str(option_a.id),
        }
        raw = json.dumps(body).encode("utf-8")
        hdrs = _headers(
            method="POST",
            path=VOTES_ROOT,
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=request_id,
        )

        resp = self.client.post(VOTES_ROOT, data=raw, content_type="application/json", **hdrs)
        self.assertEqual(resp.status_code, 409)  # 409 Conflict for non-active poll

    @patch("tenant_voting.api._access_check_allowed", new=_mock_access_check_allowed)
    def test_tenant_isolation_in_polls_list(self):
        """Test that polls from other tenants are not visible."""
        other_tenant_id = str(uuid.uuid4())

        # Create poll for our tenant
        Poll.objects.create(
            tenant_id=self.tenant_id,
            title="Poll 1",
            status=PollStatus.ACTIVE,
            scope_type=PollScopeType.TENANT,
            scope_id=self.tenant_id,
            created_by=self.user_id,
        )

        # Create poll for other tenant
        Poll.objects.create(
            tenant_id=other_tenant_id,
            title="Poll 2",
            status=PollStatus.ACTIVE,
            scope_type=PollScopeType.TENANT,
            scope_id=other_tenant_id,
            created_by=self.user_id,
        )

        request_id = str(uuid.uuid4())
        hdrs = _headers(
            method="GET",
            path=POLLS_LIST,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": True},
            request_id=request_id,
        )

        resp = self.client.get(POLLS_LIST, **hdrs)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["title"], "Poll 1")


@override_settings(BFF_INTERNAL_HMAC_SECRET="")
class VotingApiMissingSecretTests(TestCase):
    """Test error handling when HMAC secret is missing."""

    def test_missing_hmac_secret_500(self):
        """Test that missing HMAC secret returns 500."""
        client = Client()
        request_id = str(uuid.uuid4())
        tenant_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        hdrs = {
            "HTTP_X_REQUEST_ID": request_id,
            "HTTP_X_TENANT_ID": tenant_id,
            "HTTP_X_TENANT_SLUG": "aef",
            "HTTP_X_USER_ID": user_id,
            "HTTP_X_MASTER_FLAGS": "{}",
            "HTTP_X_UPDSPACE_TIMESTAMP": str(int(time.time())),
            "HTTP_X_UPDSPACE_SIGNATURE": "deadbeef",
        }
        resp = client.get(POLLS_LIST, **hdrs)
        self.assertEqual(resp.status_code, 500)
