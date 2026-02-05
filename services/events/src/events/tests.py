"""
Events Service Tests

Tests for Events API endpoints without external access_control dependency.
Uses mocks for permission checks.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from unittest import mock
from unittest.mock import patch

from django.conf import settings
from django.test import Client, TestCase, override_settings
from django.utils import timezone


API_PREFIX = "/api/v1"
EVENTS_ROOT = f"{API_PREFIX}/events"
EVENTS_LIST = f"{EVENTS_ROOT}/"


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


def _mock_has_permission_allow_all(**kwargs) -> bool:
    """Mock permission check that allows all requests."""
    master_flags = kwargs.get("master_flags", {})
    # Deny suspended/banned users
    if master_flags.get("suspended") or master_flags.get("banned"):
        return False
    return True


def _mock_has_permission_system_admin_only(**kwargs) -> bool:
    """Mock permission check that only allows system admins."""
    master_flags = kwargs.get("master_flags", {})
    if master_flags.get("suspended") or master_flags.get("banned"):
        return False
    if master_flags.get("system_admin"):
        return True
    return False


def _mock_has_permission_read_only(**kwargs) -> bool:
    """Mock permission check that allows read operations for everyone, write for admins only."""
    master_flags = kwargs.get("master_flags", {})
    if master_flags.get("suspended") or master_flags.get("banned"):
        return False
    if master_flags.get("system_admin"):
        return True
    permission_key = kwargs.get("permission_key", "")
    # Allow read permissions for everyone
    if ".read" in permission_key or ".list" in permission_key:
        return True
    # Allow RSVP for everyone
    if "rsvp" in permission_key:
        return True
    return False


@override_settings(BFF_INTERNAL_HMAC_SECRET="test-secret")
class EventsApiTests(TestCase):
    """Test Events API endpoints."""

    def setUp(self):
        super().setUp()
        self.client = Client()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = "aef"
        self.user_id = str(uuid.uuid4())

        from django.apps import apps
        self.Event = apps.get_model("events", "Event")
        self.RSVP = apps.get_model("events", "RSVP")

    @patch("events.api.has_permission", side_effect=_mock_has_permission_read_only)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_read_only)
    def test_tenant_isolation_in_list(self, mock_perm1, mock_perm2):
        """Test that events from other tenants are not visible."""
        other_tenant_id = str(uuid.uuid4())

        starts = timezone.make_aware(datetime(2026, 1, 10, 10, 0, 0))
        ends = timezone.make_aware(datetime(2026, 1, 10, 11, 0, 0))

        # Create event for our tenant
        self.Event.objects.create(
            tenant_id=self.tenant_id,
            scope_type="TENANT",
            scope_id=self.tenant_id,
            title="E1",
            description="",
            starts_at=starts,
            ends_at=ends,
            visibility="public",
            created_by=self.user_id,
        )
        # Create event for other tenant
        self.Event.objects.create(
            tenant_id=other_tenant_id,
            scope_type="TENANT",
            scope_id=other_tenant_id,
            title="E2",
            description="",
            starts_at=starts,
            ends_at=ends,
            visibility="public",
            created_by=self.user_id,
        )

        request_id = str(uuid.uuid4())
        hdrs = _headers(
            method="GET",
            path=EVENTS_LIST,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=request_id,
        )

        resp = self.client.get(EVENTS_LIST, **hdrs)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("items", data)
        self.assertIn("meta", data)
        self.assertEqual(data["meta"]["total"], 1)
        items = data["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "E1")

    @patch("events.api.has_permission", side_effect=_mock_has_permission_read_only)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_read_only)
    def test_attendance_requires_permission(self, mock_perm1, mock_perm2):
        """Test that marking attendance requires permission."""
        starts = timezone.make_aware(datetime(2026, 1, 10, 10, 0, 0))
        ends = timezone.make_aware(datetime(2026, 1, 10, 11, 0, 0))
        ev = self.Event.objects.create(
            tenant_id=self.tenant_id,
            scope_type="TENANT",
            scope_id=self.tenant_id,
            title="E1",
            description="",
            starts_at=starts,
            ends_at=ends,
            visibility="public",
            created_by=self.user_id,
        )

        request_id = str(uuid.uuid4())
        body = {"userId": str(uuid.uuid4())}
        raw = json.dumps(body).encode("utf-8")
        hdrs = _headers(
            method="POST",
            path=f"{API_PREFIX}/events/{ev.id}/attendance",
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=request_id,
        )

        resp = self.client.post(
            f"{API_PREFIX}/events/{ev.id}/attendance",
            data=raw,
            content_type="application/json",
            **hdrs,
        )
        self.assertEqual(resp.status_code, 403)

    @patch("events.api.has_permission", side_effect=_mock_has_permission_allow_all)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_allow_all)
    def test_system_admin_can_create(self, mock_perm1, mock_perm2):
        """Test that system admin can create events."""
        request_id = str(uuid.uuid4())
        body = {
            "scopeType": "TENANT",
            "scopeId": self.tenant_id,
            "title": "Party",
            "description": "",
            "startsAt": "2026-01-10T10:00:00+00:00",
            "endsAt": "2026-01-10T11:00:00+00:00",
            "visibility": "public",
        }
        raw = json.dumps(body).encode("utf-8")
        hdrs = _headers(
            method="POST",
            path=EVENTS_LIST,
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": True},
            request_id=request_id,
        )
        resp = self.client.post(EVENTS_LIST, data=raw, content_type="application/json", **hdrs)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["title"], "Party")

    @patch("events.api.has_permission", side_effect=_mock_has_permission_allow_all)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_allow_all)
    def test_list_includes_meta_and_rsvp_counts(self, mock_perm1, mock_perm2):
        """Test that list response includes meta and RSVP counts."""
        starts = timezone.make_aware(datetime(2026, 1, 10, 10, 0, 0))
        ends = timezone.make_aware(datetime(2026, 1, 10, 11, 0, 0))

        ev = self.Event.objects.create(
            tenant_id=self.tenant_id,
            scope_type="TENANT",
            scope_id=self.tenant_id,
            title="Game Night",
            description="",
            starts_at=starts,
            ends_at=ends,
            visibility="public",
            created_by=self.user_id,
        )
        self.RSVP.objects.create(
            tenant_id=self.tenant_id,
            event=ev,
            user_id=self.user_id,
            status="going",
        )
        self.RSVP.objects.create(
            tenant_id=self.tenant_id,
            event=ev,
            user_id=str(uuid.uuid4()),
            status="interested",
        )

        request_id = str(uuid.uuid4())
        hdrs = _headers(
            method="GET",
            path=EVENTS_LIST,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": True},
            request_id=request_id,
        )

        resp = self.client.get(EVENTS_LIST, **hdrs)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["meta"]["total"], 1)
        item = data["items"][0]
        self.assertEqual(item["rsvpCounts"]["going"], 1)
        self.assertEqual(item["rsvpCounts"]["interested"], 1)
        self.assertEqual(item["myRsvp"], "going")

    def _get_list_headers(self, request_id: str, path: str) -> dict[str, str]:
        return _headers(
            method="GET",
            path=path,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": False},
            request_id=request_id,
        )

    @patch("events.api.has_permission", side_effect=_mock_has_permission_read_only)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_read_only)
    def test_community_event_requires_membership(self, mock_perm1, mock_perm2):
        """Test that community events require membership to view."""
        community_id = str(uuid.uuid4())
        now = timezone.now()
        self.Event.objects.create(
            tenant_id=self.tenant_id,
            title="Community Event",
            scope_type="COMMUNITY",
            scope_id=community_id,
            visibility="community",
            created_by=self.user_id,
            description="",
            starts_at=now,
            ends_at=now,
        )

        qp = f"?scopeType=COMMUNITY&scopeId={community_id}"
        path_with_qs = f"{EVENTS_LIST}{qp}"
        request_id = str(uuid.uuid4())
        # Sign with path only (no query string) as server uses request.path
        hdrs = self._get_list_headers(request_id=request_id, path=EVENTS_LIST)

        mock_client = mock.Mock()
        mock_client.is_community_member.return_value = False
        mock_client.is_team_member.return_value = False
        with mock.patch("events.api.portal_client", mock_client), \
             mock.patch("events.api.has_scope_membership", return_value=False):
            resp = self.client.get(path_with_qs, **hdrs)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["items"]), 0)

    @patch("events.api.has_permission", side_effect=_mock_has_permission_read_only)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_read_only)
    def test_community_event_visible_for_member(self, mock_perm1, mock_perm2):
        """Test that community events are visible to members."""
        community_id = str(uuid.uuid4())
        now = timezone.now()
        self.Event.objects.create(
            tenant_id=self.tenant_id,
            title="Community Event",
            scope_type="COMMUNITY",
            scope_id=community_id,
            visibility="community",
            created_by=self.user_id,
            description="",
            starts_at=now,
            ends_at=now,
        )

        qp = f"?scopeType=COMMUNITY&scopeId={community_id}"
        path_with_qs = f"{EVENTS_LIST}{qp}"
        request_id = str(uuid.uuid4())
        # Sign with path only (no query string) as server uses request.path
        hdrs = self._get_list_headers(request_id=request_id, path=EVENTS_LIST)

        mock_client = mock.Mock()
        mock_client.is_community_member.return_value = True
        mock_client.is_team_member.return_value = False
        with mock.patch("events.api.portal_client", mock_client):
            resp = self.client.get(path_with_qs, **hdrs)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["items"]), 1)

    @patch("events.api.has_permission", side_effect=_mock_has_permission_read_only)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_read_only)
    def test_team_event_requires_membership(self, mock_perm1, mock_perm2):
        """Test that team events require membership to view."""
        team_id = str(uuid.uuid4())
        now = timezone.now()
        self.Event.objects.create(
            tenant_id=self.tenant_id,
            title="Team Event",
            scope_type="TEAM",
            scope_id=team_id,
            visibility="team",
            created_by=self.user_id,
            description="",
            starts_at=now,
            ends_at=now,
        )

        qp = f"?scopeType=TEAM&scopeId={team_id}"
        path_with_qs = f"{EVENTS_LIST}{qp}"
        request_id = str(uuid.uuid4())
        # Sign with path only (no query string) as server uses request.path
        hdrs = self._get_list_headers(request_id=request_id, path=EVENTS_LIST)

        mock_client = mock.Mock()
        mock_client.is_community_member.return_value = False
        mock_client.is_team_member.return_value = False
        with mock.patch("events.api.portal_client", mock_client), \
             mock.patch("events.api.has_scope_membership", return_value=False):
            resp = self.client.get(path_with_qs, **hdrs)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["items"]), 0)

    @patch("events.api.has_permission", side_effect=_mock_has_permission_read_only)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_read_only)
    def test_team_event_visible_for_member(self, mock_perm1, mock_perm2):
        """Test that team events are visible to members."""
        team_id = str(uuid.uuid4())
        now = timezone.now()
        self.Event.objects.create(
            tenant_id=self.tenant_id,
            title="Team Event",
            scope_type="TEAM",
            scope_id=team_id,
            visibility="team",
            created_by=self.user_id,
            description="",
            starts_at=now,
            ends_at=now,
        )

        qp = f"?scopeType=TEAM&scopeId={team_id}"
        path_with_qs = f"{EVENTS_LIST}{qp}"
        request_id = str(uuid.uuid4())
        # Sign with path only (no query string) as server uses request.path
        hdrs = self._get_list_headers(request_id=request_id, path=EVENTS_LIST)

        mock_client = mock.Mock()
        mock_client.is_community_member.return_value = False
        mock_client.is_team_member.return_value = True
        with mock.patch("events.api.portal_client", mock_client):
            resp = self.client.get(path_with_qs, **hdrs)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["items"]), 1)

    @patch("events.api.has_permission", side_effect=_mock_has_permission_read_only)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_read_only)
    def test_update_event_requires_manage_permission(self, mock_perm1, mock_perm2):
        """Test that updating events requires manage permission."""
        starts = timezone.make_aware(datetime(2026, 1, 10, 10, 0, 0))
        ends = timezone.make_aware(datetime(2026, 1, 10, 11, 0, 0))
        ev = self.Event.objects.create(
            tenant_id=self.tenant_id,
            scope_type="TENANT",
            scope_id=self.tenant_id,
            title="Game Night",
            description="",
            starts_at=starts,
            ends_at=ends,
            visibility="public",
            created_by=self.user_id,
        )

        request_id = str(uuid.uuid4())
        body = {"title": "Updated Title"}
        raw = json.dumps(body).encode("utf-8")
        hdrs = _headers(
            method="PATCH",
            path=f"{API_PREFIX}/events/{ev.id}",
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=request_id,
        )

        resp = self.client.patch(
            f"{API_PREFIX}/events/{ev.id}",
            data=raw,
            content_type="application/json",
            **hdrs,
        )
        self.assertEqual(resp.status_code, 403)

    @patch("events.api.has_permission", side_effect=_mock_has_permission_allow_all)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_allow_all)
    def test_system_admin_can_update_event(self, mock_perm1, mock_perm2):
        """Test that system admin can update events."""
        starts = timezone.make_aware(datetime(2026, 1, 10, 10, 0, 0))
        ends = timezone.make_aware(datetime(2026, 1, 10, 11, 0, 0))
        ev = self.Event.objects.create(
            tenant_id=self.tenant_id,
            scope_type="TENANT",
            scope_id=self.tenant_id,
            title="Game Night",
            description="",
            starts_at=starts,
            ends_at=ends,
            visibility="public",
            created_by=self.user_id,
        )

        request_id = str(uuid.uuid4())
        body = {"title": "Updated Title"}
        raw = json.dumps(body).encode("utf-8")
        hdrs = _headers(
            method="PATCH",
            path=f"{API_PREFIX}/events/{ev.id}",
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={"system_admin": True},
            request_id=request_id,
        )

        resp = self.client.patch(
            f"{API_PREFIX}/events/{ev.id}",
            data=raw,
            content_type="application/json",
            **hdrs,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["title"], "Updated Title")

    @patch("events.api.has_permission", side_effect=_mock_has_permission_read_only)
    @patch("events.permissions.has_permission", side_effect=_mock_has_permission_read_only)
    def test_rsvp_flow(self, mock_perm1, mock_perm2):
        """Test RSVP set and get flow."""
        starts = timezone.make_aware(datetime(2026, 1, 10, 10, 0, 0))
        ends = timezone.make_aware(datetime(2026, 1, 10, 11, 0, 0))
        ev = self.Event.objects.create(
            tenant_id=self.tenant_id,
            scope_type="TENANT",
            scope_id=self.tenant_id,
            title="Party",
            description="",
            starts_at=starts,
            ends_at=ends,
            visibility="public",
            created_by=self.user_id,
        )

        # Set RSVP
        request_id = str(uuid.uuid4())
        body = {"status": "going"}
        raw = json.dumps(body).encode("utf-8")
        path = f"{API_PREFIX}/events/{ev.id}/rsvp"
        hdrs = _headers(
            method="POST",
            path=path,
            body=raw,
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=request_id,
        )

        resp = self.client.post(path, data=raw, content_type="application/json", **hdrs)
        self.assertIn(resp.status_code, [200, 204])  # RSVP can return 200 or 204
        if resp.status_code == 200:
            data = resp.json()
            self.assertEqual(data["status"], "going")

        # Verify RSVP in list
        request_id = str(uuid.uuid4())
        hdrs = _headers(
            method="GET",
            path=EVENTS_LIST,
            body=b"",
            tenant_id=self.tenant_id,
            tenant_slug=self.tenant_slug,
            user_id=self.user_id,
            master_flags={},
            request_id=request_id,
        )
        resp = self.client.get(EVENTS_LIST, **hdrs)
        self.assertEqual(resp.status_code, 200)
        item = resp.json()["items"][0]
        self.assertEqual(item["myRsvp"], "going")


@override_settings(BFF_INTERNAL_HMAC_SECRET="")
class EventsApiMissingSecretTests(TestCase):
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
        resp = client.get(EVENTS_LIST, **hdrs)
        self.assertEqual(resp.status_code, 500)


class EventModelTests(TestCase):
    """Test Event model."""

    def setUp(self):
        from django.apps import apps
        self.Event = apps.get_model("events", "Event")
        self.tenant_id = str(uuid.uuid4())
        self.user_id = str(uuid.uuid4())

    def test_event_creation(self):
        """Test basic event creation."""
        now = timezone.now()
        event = self.Event.objects.create(
            tenant_id=self.tenant_id,
            scope_type="TENANT",
            scope_id=self.tenant_id,
            title="Test Event",
            description="Test description",
            starts_at=now,
            ends_at=now,
            visibility="public",
            created_by=self.user_id,
        )
        self.assertIsNotNone(event.id)
        self.assertEqual(event.title, "Test Event")
        self.assertEqual(event.visibility, "public")

    def test_event_str(self):
        """Test event string representation."""
        now = timezone.now()
        event = self.Event.objects.create(
            tenant_id=self.tenant_id,
            scope_type="TENANT",
            scope_id=self.tenant_id,
            title="Game Night",
            description="",
            starts_at=now,
            ends_at=now,
            visibility="public",
            created_by=self.user_id,
        )
        # Event object has default __str__ which shows model name and pk
        self.assertIn(str(event.id), str(event))
