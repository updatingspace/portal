import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from django.test import RequestFactory, TestCase
from django.utils import timezone

from events.api import list_events
from events.models import RSVP, Event


class EventListFilterTests(TestCase):
    def setUp(self):
        self.tenant, self.user = uuid4(), uuid4()
        self.ctx = SimpleNamespace(
            tenant_id=str(self.tenant),
            tenant_slug="alpha",
            user_id=str(self.user),
            master_flags={},
            request_id="test",
        )
        self.base = {
            "tenant_id": self.tenant,
            "scope_type": "TENANT",
            "scope_id": str(self.tenant),
            "created_by": self.user,
            "visibility": "public",
        }
        now = timezone.now()
        self.early = Event.objects.create(
            **self.base,
            title="Other meeting",
            starts_at=now + timedelta(hours=1),
            ends_at=now + timedelta(hours=2),
        )
        self.target = Event.objects.create(
            **self.base,
            title="Raid night",
            starts_at=now + timedelta(hours=3),
            ends_at=now + timedelta(hours=4),
        )

    def read(self, **filters):
        params = {
            "from_": None,
            "to": None,
            "scope_type": None,
            "scope_id": None,
            "q": None,
            "mine": False,
            "rsvp": None,
            "visibility": None,
            "period": None,
            "limit": 1,
            "offset": 0,
        }
        params.update(filters)
        with (
            patch("events.api.require_internal_context", return_value=self.ctx),
            patch("events.api._require_perm_ctx"),
        ):
            return json.loads(list_events(RequestFactory().get("/"), **params).content)

    def test_search_and_response_filters_apply_before_pagination(self):
        RSVP.objects.create(
            tenant_id=self.tenant, event=self.target, user_id=self.user, status="going"
        )
        for filters in ({"q": "Raid"}, {"rsvp": "going"}):
            data = self.read(**filters)
            self.assertEqual(
                [item["id"] for item in data["items"]], [str(self.target.id)]
            )
            self.assertEqual(data["meta"]["total"], 1)

    def test_invisible_events_do_not_consume_a_page_or_inflate_total(self):
        self.early.visibility = "private"
        self.early.created_by = uuid4()
        self.early.save()
        data = self.read()
        self.assertEqual([item["id"] for item in data["items"]], [str(self.target.id)])
        self.assertEqual(data["meta"]["total"], 1)

    def test_mine_period_and_tenant_isolation(self):
        self.early.created_by = uuid4()
        self.early.save()
        self.target.starts_at = timezone.now() - timedelta(days=2)
        self.target.ends_at = timezone.now() - timedelta(days=1)
        self.target.save()
        Event.objects.create(
            **{**self.base, "tenant_id": uuid4()},
            title="Foreign",
            starts_at=self.target.starts_at,
            ends_at=self.target.ends_at,
        )
        data = self.read(mine=True, period="past")
        self.assertEqual([item["id"] for item in data["items"]], [str(self.target.id)])
