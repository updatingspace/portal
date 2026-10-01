import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.test import RequestFactory, TestCase
from ninja.errors import HttpError

from activity import api, schemas
from activity.audit import ActivityAuditEvent
from activity.models import NewsPost


class PostModerationTests(TestCase):
    def setUp(self):
        self.tenant = uuid.uuid4()
        self.actor = uuid.uuid4()
        self.post = NewsPost.objects.create(
            tenant_id=self.tenant,
            author_user_id=uuid.uuid4(),
            body="Test",
            scope_type="TENANT",
            scope_id=str(self.tenant),
        )
        self.ctx = SimpleNamespace(
            tenant_id=self.tenant,
            user_id=self.actor,
            tenant_slug="alpha",
            master_flags={},
            request_id="test",
        )
        for name, kwargs in [
            ("require_activity_context", {"return_value": self.ctx}),
            ("require_not_suspended", {}),
            ("_can_manage_news", {"return_value": True}),
            ("_publish_news_change", {}),
        ]:
            p = patch.object(api, name, **kwargs)
            p.start()
            self.addCleanup(p.stop)

    def test_moderator_reason_is_required_and_draft_post_survives_failure(self):
        with self.assertRaises(HttpError):
            api.news_delete(
                RequestFactory().delete("/"),
                str(self.post.id),
                schemas.NewsDeleteIn(reason=""),
            )
        self.assertTrue(NewsPost.objects.filter(id=self.post.id).exists())

    def test_removal_records_reason_for_this_post(self):
        post_id = str(self.post.id)
        api.news_delete(
            RequestFactory().delete("/"), post_id, schemas.NewsDeleteIn(reason="Spam")
        )
        entry = ActivityAuditEvent.objects.get(target_id=post_id)
        self.assertEqual(entry.metadata["reason"], "Spam")
        self.assertEqual(entry.actor_user_id, self.actor)
        self.assertEqual(entry.tenant_id, self.tenant)
        self.assertFalse(NewsPost.objects.filter(id=post_id).exists())

    def test_audit_requires_moderator_permission_even_for_author(self):
        with (
            patch.object(
                api, "require_permission", side_effect=HttpError(403, "Forbidden")
            ),
            self.assertRaises(HttpError),
        ):
            api.news_audit(None, str(self.post.id))

    def test_other_tenant_cannot_read_post_history(self):
        self.ctx.tenant_id = uuid.uuid4()
        with (
            patch.object(api, "require_permission"),
            self.assertRaises(HttpError) as result,
        ):
            api.news_audit(None, str(self.post.id))
        self.assertEqual(result.exception.status_code, 404)
