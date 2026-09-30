from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from django.test import RequestFactory, TestCase
from django.utils import timezone

from gamification.api import list_achievements
from gamification.models import Achievement, AchievementCategory, AchievementGrant


class EarnedAchievementsTests(TestCase):
    def test_earned_filter_excludes_catalog_revocations_and_other_users(self):
        tenant, user, other = uuid4(), uuid4(), uuid4()
        category = AchievementCategory.objects.create(tenant_id=tenant, slug="awards")
        achievements = [
            Achievement.objects.create(
                tenant_id=tenant,
                category=category,
                created_by=user,
                status="published",
                name_i18n={"ru": str(i)},
            )
            for i in range(4)
        ]
        AchievementGrant.objects.create(
            tenant_id=tenant,
            achievement=achievements[0],
            recipient_id=user,
            issuer_id=other,
        )
        AchievementGrant.objects.create(
            tenant_id=tenant,
            achievement=achievements[1],
            recipient_id=user,
            issuer_id=other,
            revoked_at=timezone.now(),
        )
        AchievementGrant.objects.create(
            tenant_id=tenant,
            achievement=achievements[2],
            recipient_id=other,
            issuer_id=user,
        )
        ctx = SimpleNamespace(tenant_id=tenant, user_id=user)
        with (
            patch("gamification.api.require_internal_context", return_value=ctx),
            patch("gamification.api._has_perm_ctx", return_value=False),
        ):
            result = list_achievements(
                RequestFactory().get("/"), status=None, category=None, earned=True
            )
        self.assertEqual(
            [item.id for item in result["items"]], [str(achievements[0].id)]
        )
