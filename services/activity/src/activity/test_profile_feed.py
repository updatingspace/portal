from uuid import uuid4

from django.test import TestCase
from django.utils import timezone

from activity.models import ActivityEvent
from activity.services import FeedFilters, list_feed


class PersonalFeedTests(TestCase):
    def test_author_filter_precedes_pagination_and_preserves_tenant(self):
        tenant, other_tenant, author, viewer = uuid4(), uuid4(), uuid4(), uuid4()
        own = ActivityEvent.objects.create(
            tenant_id=tenant,
            actor_user_id=author,
            type="news.posted",
            title="Own",
            occurred_at=timezone.now(),
            scope_type="TENANT",
            scope_id=str(tenant),
            source_ref="own",
        )
        ActivityEvent.objects.create(
            tenant_id=tenant,
            actor_user_id=viewer,
            type="news.posted",
            title="Other",
            occurred_at=timezone.now(),
            scope_type="TENANT",
            scope_id=str(tenant),
            source_ref="other",
        )
        ActivityEvent.objects.create(
            tenant_id=other_tenant,
            actor_user_id=author,
            type="news.posted",
            title="Foreign",
            occurred_at=timezone.now(),
            scope_type="TENANT",
            scope_id=str(other_tenant),
            source_ref="foreign",
        )
        result = list_feed(
            tenant_id=tenant,
            user_id=viewer,
            filters=FeedFilters(
                None, None, None, "TENANT", str(tenant), actor_user_id=author
            ),
            limit=1,
            update_last_seen_flag=False,
        )
        self.assertEqual([item.id for item in result], [own.id])
