"""Run self-service membership exit against isolated local YDB only."""
import os

import django
from django.conf import settings
from django.db import connections


def main() -> None:
    django.setup()
    db = settings.DATABASES["default"]
    if db.get("HOST") not in {"localhost", "127.0.0.1"} or db.get("DATABASE") != "/local":
        raise RuntimeError("Requires isolated local YDB")
    service = os.environ["MEMBERSHIP_SERVICE"]
    if service == "portal":
        from portal.models import Tenant
        from portal.test_tenant_onboarding import LeaveMembershipTests
    elif service == "bff":
        from bff.models import Tenant
        from bff.test_leave_membership import LeaveMembershipTests
    else:
        raise RuntimeError("Unknown service")
    from django.test import Client, override_settings
    with override_settings(ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1", ".updspace.com"], BFF_ENFORCE_ACTIVE_MEMBERSHIP=True, BFF_TENANT_HOST_SUFFIX="updspace.com", BFF_UPSTREAM_PORTAL_URL="http://portal/api/v1"):
        try:
            for name in sorted(n for n in dir(LeaveMembershipTests) if n.startswith("test_")):
                case = LeaveMembershipTests(methodName=name)
                case.client = Client()
                case.setUp()
                try:
                    getattr(case, name)()
                    print(f"PASS {service} YDB {name}", flush=True)
                finally:
                    case.doCleanups()
                    if service == "portal":
                        from portal.audit import PortalAuditEvent
                        PortalAuditEvent.objects.filter(tenant_id=case.tenant.id).delete()
                    Tenant.objects.filter(id__in=[case.tenant.id, (case.second if service == "portal" else case.other).id]).delete()
        finally:
            connections.close_all()


if __name__ == "__main__":
    main()
