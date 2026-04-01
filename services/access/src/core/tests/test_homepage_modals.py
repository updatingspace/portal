from __future__ import annotations

import uuid
from datetime import timedelta
from unittest.mock import patch

from django.db import IntegrityError
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from core.models import (
    ContentWidget,
    DashboardLayout,
    DashboardWidget,
    HomePageModal,
    ModalAnalytics,
)

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
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.headers = {
            "HTTP_X_USER_ID": str(self.user_id),
            "HTTP_X_TENANT_ID": str(self.tenant_id),
        }

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

    def test_homepage_modal_soft_delete_and_restore(self):
        modal = HomePageModal.objects.create(
            title="Soft delete",
            content="Will be deleted",
            is_active=True,
        )

        self.assertIsNone(modal.deleted_at)
        modal.soft_delete()
        modal.refresh_from_db()
        self.assertIsNotNone(modal.deleted_at)

        modal.restore()
        modal.refresh_from_db()
        self.assertIsNone(modal.deleted_at)

    def test_homepage_modal_translation_fallback(self):
        modal = HomePageModal.objects.create(
            title="Default title",
            content="Default content",
            button_text="OK",
            translations={
                "ru": {
                    "title": "Заголовок",
                    "content": "Содержимое",
                }
            },
        )

        translated = modal.get_translated_content("ru")
        self.assertEqual(translated["title"], "Заголовок")
        self.assertEqual(translated["content"], "Содержимое")
        self.assertEqual(translated["button_text"], "OK")

    def test_dashboard_layout_and_widget_crud(self):
        layout_resp = self.client.post(
            "/api/personalization/admin/dashboards/layouts",
            data={
                "layout_name": "main",
                "layout_config": {"cols": 12, "rows": 8},
                "is_default": True,
            },
            content_type="application/json",
            **self.headers,
        )
        self.assertEqual(layout_resp.status_code, 200)
        layout_id = layout_resp.json()["id"]

        list_resp = self.client.get(
            "/api/personalization/admin/dashboards/layouts",
            **self.headers,
        )
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(len(list_resp.json()), 1)

        widget_resp = self.client.post(
            f"/api/personalization/admin/dashboards/layouts/{layout_id}/widgets",
            data={
                "widget_key": "events",
                "position_x": 0,
                "position_y": 0,
                "width": 6,
                "height": 4,
                "settings": {"compact": True},
                "is_visible": True,
            },
            content_type="application/json",
            **self.headers,
        )
        self.assertEqual(widget_resp.status_code, 200)
        widget_id = widget_resp.json()["id"]

        widgets_resp = self.client.get(
            f"/api/personalization/admin/dashboards/layouts/{layout_id}/widgets",
            **self.headers,
        )
        self.assertEqual(widgets_resp.status_code, 200)
        self.assertEqual(len(widgets_resp.json()), 1)

        update_widget_resp = self.client.put(
            f"/api/personalization/admin/dashboards/widgets/{widget_id}",
            data={
                "widget_key": "events",
                "position_x": 1,
                "position_y": 2,
                "width": 5,
                "height": 3,
                "settings": {"compact": False},
                "is_visible": False,
            },
            content_type="application/json",
            **self.headers,
        )
        self.assertEqual(update_widget_resp.status_code, 200)
        self.assertEqual(update_widget_resp.json()["position_x"], 1)

        delete_widget_resp = self.client.delete(
            f"/api/personalization/admin/dashboards/widgets/{widget_id}",
            **self.headers,
        )
        self.assertEqual(delete_widget_resp.status_code, 200)

        delete_layout_resp = self.client.delete(
            f"/api/personalization/admin/dashboards/layouts/{layout_id}",
            **self.headers,
        )
        self.assertEqual(delete_layout_resp.status_code, 200)


class ExtendedContentModelsTests(TestCase):
    def test_content_widget_soft_delete(self):
        widget = ContentWidget.objects.create(
            tenant_id=uuid.uuid4(),
            name="Top banner",
            widget_type="banner",
            placement="top",
            content={"title": "Welcome"},
        )

        self.assertIsNone(widget.deleted_at)
        widget.soft_delete()
        widget.refresh_from_db()
        self.assertIsNotNone(widget.deleted_at)

    def test_modal_analytics_event_persisted(self):
        modal = HomePageModal.objects.create(
            title="Track me",
            content="Analytics content",
            is_active=True,
        )

        event = ModalAnalytics.objects.create(
            modal=modal,
            tenant_id=uuid.uuid4(),
            event_type=ModalAnalytics.EventType.VIEW,
            metadata={"source": "test"},
        )

        self.assertEqual(event.modal_id, modal.id)
        self.assertEqual(event.event_type, ModalAnalytics.EventType.VIEW)
        self.assertEqual(event.metadata["source"], "test")

    def test_dashboard_layout_create_and_soft_delete(self):
        layout = DashboardLayout.objects.create(
            user_id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            layout_name="main",
            layout_config={
                "widgets": [{"id": "events", "x": 0, "y": 0, "w": 6, "h": 4}],
                "breakpoints": {"lg": [12, 8]},
            },
            is_default=True,
        )

        self.assertEqual(layout.layout_name, "main")
        self.assertTrue(layout.is_default)
        self.assertIsNone(layout.deleted_at)

        layout.soft_delete()
        layout.refresh_from_db()
        self.assertIsNotNone(layout.deleted_at)

    def test_dashboard_layout_unique_name_per_user_and_tenant(self):
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        DashboardLayout.objects.create(
            user_id=user_id,
            tenant_id=tenant_id,
            layout_name="main",
            layout_config={},
        )

        with self.assertRaises(IntegrityError):
            DashboardLayout.objects.create(
                user_id=user_id,
                tenant_id=tenant_id,
                layout_name="main",
                layout_config={},
            )

    def test_dashboard_widget_create_and_soft_delete(self):
        layout = DashboardLayout.objects.create(
            user_id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            layout_name="main",
            layout_config={},
        )
        widget = DashboardWidget.objects.create(
            layout=layout,
            tenant_id=layout.tenant_id,
            widget_key="events",
            position_x=0,
            position_y=1,
            width=6,
            height=4,
            settings={"compact": True},
            is_visible=True,
        )

        self.assertEqual(widget.widget_key, "events")
        self.assertIsNone(widget.deleted_at)

        widget.soft_delete()
        widget.refresh_from_db()
        self.assertIsNotNone(widget.deleted_at)
