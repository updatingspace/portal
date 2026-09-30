from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from django.test import RequestFactory, TestCase

from portal.entry_api import own_applications
from portal.models import TenantApplication


class OwnApplicationHistoryTests(TestCase):
    def test_history_keeps_decisions_scoped_to_the_applicant(self):
        user = uuid4()
        for status in ["pending", "provisioning", "approved", "rejected"]:
            TenantApplication.objects.create(
                applicant_user_id=user, slug=status, name=status, status=status
            )
        TenantApplication.objects.create(
            applicant_user_id=uuid4(), slug="foreign", name="Foreign", status="rejected"
        )
        with patch(
            "portal.entry_api.entry_context",
            return_value=SimpleNamespace(user_id=str(user)),
        ):
            legacy = own_applications(RequestFactory().get("/"))
            history = own_applications(RequestFactory().get("/"), include_history=True)
        self.assertEqual(
            {item["status"] for item in legacy}, {"pending", "provisioning"}
        )
        self.assertEqual(
            {item["status"] for item in history},
            {"pending", "provisioning", "approved", "rejected"},
        )
        self.assertEqual(len(history), 4)
