import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase
from ninja.errors import HttpError

from gamification import api
from gamification.models import AchievementCategory
from gamification.schemas import CategoryCreateIn


class CatalogUXTests(TestCase):
    def setUp(self):
        self.ctx = SimpleNamespace(
            tenant_id=str(uuid.uuid4()),
            user_id=str(uuid.uuid4()),
            tenant_slug="alpha",
            request_id="test",
            master_flags={},
        )
        self.context = patch.object(
            api, "require_internal_context", return_value=self.ctx
        )
        self.context.start()
        self.addCleanup(self.context.stop)

    def test_default_fun_is_idempotent_and_tenant_scoped(self):
        api.list_categories(None)
        api.list_categories(None)
        self.assertEqual(
            AchievementCategory.objects.filter(
                tenant_id=self.ctx.tenant_id, slug="fun"
            ).count(),
            1,
        )
        self.ctx.tenant_id = str(uuid.uuid4())
        api.list_categories(None)
        self.assertEqual(AchievementCategory.objects.filter(slug="fun").count(), 2)

    def test_category_requires_separate_permission(self):
        with patch.object(api, "_require_perm_ctx") as permission:
            api.create_category(
                None, CategoryCreateIn(id="sport", name_i18n={"en": "Sport"})
            )
        permission.assert_called_once_with(self.ctx, "gamification.categories.manage")

    def test_image_upload_requires_achievement_permission(self):
        with (
            patch.object(api, "_has_perm_ctx", return_value=False),
            patch.object(
                api, "_require_perm_ctx", side_effect=HttpError(403, "Forbidden")
            ),
            self.assertRaises(HttpError),
        ):
            api.upload_achievement_image(SimpleNamespace(auth=self.ctx), file=None)
