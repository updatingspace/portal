from __future__ import annotations

import json
import uuid

from django.core.management.base import BaseCommand, CommandError

from tenant_voting.dsar import erase_user_data, export_user_data


class Command(BaseCommand):
    help = "Export or erase voting personal data for a tenant user"

    def add_arguments(self, parser):
        parser.add_argument("--tenant-id", required=True, help="Tenant UUID")
        parser.add_argument("--user-id", required=True, help="User UUID")
        parser.add_argument(
            "--action",
            required=True,
            choices=["export", "erase"],
            help="DSAR action to execute",
        )

    def handle(self, *args, **options):
        try:
            tenant_id = uuid.UUID(str(options["tenant_id"]))
            user_id = uuid.UUID(str(options["user_id"]))
        except Exception as exc:
            raise CommandError("tenant-id and user-id must be valid UUID values") from exc

        if str(options["action"]) == "export":
            payload = export_user_data(tenant_id=tenant_id, user_id=user_id)
        else:
            payload = erase_user_data(tenant_id=tenant_id, user_id=user_id)

        self.stdout.write(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False))
