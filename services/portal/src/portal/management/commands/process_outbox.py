from django.core.management.base import BaseCommand

from portal.models import TenantProvisioningOutbox
from portal.provisioning import process_tenant_event


class Command(BaseCommand):
    help = "Retry approved tenant owner provisioning in Access."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        events = TenantProvisioningOutbox.objects.filter(
            processed_at__isnull=True
        ).order_by("created_at")[: options["limit"]]
        processed = sum(process_tenant_event(event) for event in events)
        self.stdout.write(f"Processed {processed} tenant provisioning events")
