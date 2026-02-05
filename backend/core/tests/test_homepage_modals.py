from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from core.models import HomePageModal

User = get_user_model()


class HomePageModalApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="StrongPass123!",
        )
        self.user = User.objects.create_user(
            username="user",
            email="user@example.com",
            password="StrongPass123!",
        )

    def test_list_homepage_modals_filters_by_date_and_active(self):
        now = timezone.now()
        active_modal = HomePageModal.objects.create(
            title="Active",
            content="Active content",
            start_date=now - timedelta(hours=1),
            end_date=now + timedelta(hours=1),
            is_active=True,
            order=1,
        )
        HomePageModal.objects.create(
            title="Future",
            content="Future content",
            start_date=now + timedelta(hours=1),
            end_date=now + timedelta(hours=2),
            is_active=True,
            order=2,
        )
        HomePageModal.objects.create(
            title="Expired",
            content="Expired content",
            start_date=now - timedelta(hours=2),
            end_date=now - timedelta(hours=1),
            is_active=True,
            order=3,
        )
        HomePageModal.objects.create(
            title="Inactive",
            content="Inactive content",
            start_date=now - timedelta(hours=1),
            end_date=now + timedelta(hours=1),
            is_active=False,
            order=4,
        )

        response = self.client.get("/api/personalization/homepage-modals")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], active_modal.id)

    def test_list_homepage_modals_includes_boundary_dates(self):
        fixed_now = timezone.now()
        boundary_modal = HomePageModal.objects.create(
            title="Boundary",
            content="Boundary content",
            start_date=fixed_now,
            end_date=fixed_now,
            is_active=True,
            order=1,
        )

        with patch("core.api.timezone.now", return_value=fixed_now):
            response = self.client.get("/api/personalization/homepage-modals")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual([item["id"] for item in data], [boundary_modal.id])

    def test_admin_homepage_modals_requires_superuser(self):
        self.client.force_login(self.user)
        response = self.client.get("/api/personalization/admin/homepage-modals")
        self.assertEqual(response.status_code, 403)

    def test_admin_homepage_modals_allows_superuser(self):
        HomePageModal.objects.create(title="Admin", content="Admin content")

        self.client.force_login(self.superuser)
        response = self.client.get("/api/personalization/admin/homepage-modals")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
