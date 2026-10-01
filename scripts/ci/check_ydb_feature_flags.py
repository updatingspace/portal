"""Exercise feature writes, audit and outbox on the isolated local YDB."""

import django
from django.conf import settings
from django.db import connections


def main() -> None:
    django.setup()
    database = settings.DATABASES["default"]
    if (
        database.get("HOST") not in {"localhost", "127.0.0.1"}
        or database.get("DATABASE") != "/local"
    ):
        raise RuntimeError("This check requires the isolated local YDB instance")
    from featureflags.models import FeatureFlag, FeatureFlagAuditEvent, OutboxMessage
    from featureflags.test_create_conflict import FeatureFlagCreationTests

    key = "community_calendar"
    case = FeatureFlagCreationTests()
    case.setUp()
    try:
        case.test_duplicate_creation_does_not_replace_existing_flag()
        assert FeatureFlagAuditEvent.objects.filter(flag_key=key).count() == 1
        assert any(
            row.payload.get("flag_key") == key for row in OutboxMessage.objects.all()
        )
        print(
            "PASS feature flag API creation, duplicate conflict, audit and outbox on YDB"
        )
    finally:
        FeatureFlag.objects.filter(key=key).delete()
        FeatureFlagAuditEvent.objects.filter(flag_key=key).delete()
        for row in OutboxMessage.objects.all():
            if row.payload.get("flag_key") == key:
                row.delete()
        connections.close_all()


if __name__ == "__main__":
    main()
