"""Exercise UI filters on the disposable CI YDB, including writes and aggregates."""
import os

import django
from django.conf import settings
from django.db import connections


def main() -> None:
    django.setup()
    database = settings.DATABASES["default"]
    if database.get("HOST") not in {"localhost", "127.0.0.1"} or database.get("DATABASE") != "/local":
        raise RuntimeError("This fixture-writing check requires the isolated local YDB")
    service = os.environ["UI_FILTER_SERVICE"]
    if service == "events":
        from events.test_list_filters import EventListFilterTests

        for method in (
            "test_search_and_response_filters_apply_before_pagination",
            "test_invisible_events_do_not_consume_a_page_or_inflate_total",
            "test_mine_period_and_tenant_isolation",
        ):
            case = EventListFilterTests()
            case.setUp()
            getattr(case, method)()
            print(f"PASS events.{method}")
    elif service == "gamification":
        from gamification.test_earned_achievements import EarnedAchievementsTests

        EarnedAchievementsTests().test_earned_filter_excludes_catalog_revocations_and_other_users()
        print("PASS gamification.earned_filter")
    else:
        raise RuntimeError("Unknown filter service")
    connections.close_all()


if __name__ == "__main__":
    main()
