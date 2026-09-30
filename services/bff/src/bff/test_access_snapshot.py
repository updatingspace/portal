from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from bff.api import _load_effective_access_snapshot


class AccessSnapshotStatusTests(SimpleTestCase):
    @override_settings(BFF_UPSTREAM_ACCESS_URL="")
    def test_unconfigured_permissions_are_unavailable_not_a_confirmed_empty_set(self):
        self.assertEqual(
            _load_effective_access_snapshot(None, None), ([], [], "unavailable")
        )

    @override_settings(BFF_UPSTREAM_ACCESS_URL="http://access")
    def test_partial_permissions_are_marked_as_partial(self):
        request = SimpleNamespace(request_id="test", headers={})
        context = SimpleNamespace(tenant_id="tenant", user_id="user", master_flags={})
        good = SimpleNamespace(
            status_code=200,
            json=lambda: {
                "effective_permissions": ["events.event.read"],
                "effective_roles": [],
            },
        )
        bad = SimpleNamespace(status_code=503)
        with (
            patch("bff.api._active_context_headers", return_value={}),
            patch(
                "bff.api.SESSION_ME_CAPABILITY_PROBES",
                [("events", "events.event.read"), ("activity", "activity.feed.read")],
            ),
            patch("bff.api.proxy_request", side_effect=[good, bad]),
        ):
            capabilities, roles, status = _load_effective_access_snapshot(
                request, context
            )
        self.assertEqual(capabilities, ["events.event.read"])
        self.assertEqual(roles, [])
        self.assertEqual(status, "partial")
