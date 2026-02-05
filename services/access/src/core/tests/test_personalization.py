from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from core.models import HomePageModal

User = get_user_model()


class HomePageModalApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username="user",
            email="user@example.com",
            password="StrongPass123!",
        )
        self.superuser = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="StrongPass123!",
        )

    def test_list_homepage_modals_filters_by_date_and_activity(self):
        now = timezone.now()
        HomePageModal.objects.create(
            title="Active",
            content="Visible",
            is_active=True,
            start_date=now - timedelta(seconds=1),
            end_date=now + timedelta(seconds=1),
            order=1,
        )
        HomePageModal.objects.create(
            title="Future",
            content="Hidden",
            is_active=True,
            start_date=now + timedelta(hours=1),
            order=2,
        )
        HomePageModal.objects.create(
            title="Past",
            content="Hidden",
            is_active=True,
            end_date=now - timedelta(hours=1),
            order=3,
        )
        HomePageModal.objects.create(
            title="Inactive",
            content="Hidden",
            is_active=False,
            order=4,
        )

        response = self.client.get("/api/personalization/homepage-modals")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        titles = {item["title"] for item in data}
        self.assertEqual(titles, {"Active"})

    def test_admin_modals_require_superuser(self):
        response = self.client.get("/api/personalization/admin/homepage-modals")
        self.assertEqual(response.status_code, 403)

        self.client.force_login(self.user)
        response = self.client.get("/api/personalization/admin/homepage-modals")
        self.assertEqual(response.status_code, 403)

        self.client.force_login(self.superuser)
        response = self.client.get("/api/personalization/admin/homepage-modals")
        self.assertEqual(response.status_code, 200)
