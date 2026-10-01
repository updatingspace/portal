"""Run the poll lifecycle against local YDB; never accepts production databases."""

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
    from tenant_voting.models import (
        Nomination,
        Option,
        OutboxMessage,
        Poll,
        PollInvite,
        PollParticipant,
        Vote,
    )
    from tenant_voting.test_poll_lifecycle import PollLifecycleTests

    try:
        with override_settings(BFF_INTERNAL_HMAC_SECRET="ci-internal-hmac"):
            for name in sorted(
                n for n in dir(PollLifecycleTests) if n.startswith("test_")
            ):
                case = PollLifecycleTests(methodName=name)
                case.setUp()
                try:
                    getattr(case, name)()
                    print(f"PASS YDB {name}", flush=True)
                finally:
                    case.doCleanups()
                    for model in [
                        Vote,
                        Option,
                        Nomination,
                        PollInvite,
                        PollParticipant,
                        Poll,
                        OutboxMessage,
                    ]:
                        model.objects.filter(tenant_id=case.tenant_id).delete()
    finally:
        connections.close_all()


if __name__ == "__main__":
    main()
