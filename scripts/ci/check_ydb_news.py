"""Run news API lifecycle and atomic rollback scenarios on isolated local YDB."""

import django
from django.conf import settings
from django.db import connections
from django.test import override_settings


def main() -> None:
    django.setup()
    database = settings.DATABASES["default"]
    if (
        database.get("HOST") not in {"localhost", "127.0.0.1"}
        or database.get("DATABASE") != "/local"
    ):
        raise RuntimeError("This check requires the isolated local YDB instance")
    from activity.audit import ActivityAuditEvent
    from activity.models import ActivityEvent, NewsPost, Outbox, Subscription
    from activity.test_news_lifecycle import NewsLifecycleTests
    from activity.tests import TEST_HMAC_SECRET

    try:
        with override_settings(BFF_INTERNAL_HMAC_SECRET=TEST_HMAC_SECRET):
            for name in sorted(
                n for n in dir(NewsLifecycleTests) if n.startswith("test_")
            ):
                case = NewsLifecycleTests(methodName=name)
                case.setUp()
                try:
                    getattr(case, name)()
                    print(f"PASS YDB {name}", flush=True)
                finally:
                    case.doCleanups()
                    for model in [
                        NewsPost,
                        ActivityEvent,
                        ActivityAuditEvent,
                        Outbox,
                        Subscription,
                    ]:
                        model.objects.filter(tenant_id=case.tenant_id).delete()
    finally:
        connections.close_all()


if __name__ == "__main__":
    main()
