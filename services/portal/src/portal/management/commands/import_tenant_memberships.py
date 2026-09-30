from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from portal.models import Tenant, TenantMembership


class Command(BaseCommand):
    help = "Import a trusted ID membership export before switching BFF to Portal."

    def add_arguments(self, parser):
        parser.add_argument("--input", required=True)
        parser.add_argument("--dry-run", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            rows = json.loads(Path(options["input"]).read_text())
            if not isinstance(rows, list):
                raise TypeError("Expected a list")
            for row in rows:
                tenant_id, user_id = UUID(row["tenant_id"]), UUID(row["user_id"])
                slug, status, role = row["tenant_slug"], row["status"], row["base_role"]
                if (
                    not isinstance(slug, str)
                    or not slug
                    or status not in {"active", "disabled"}
                    or role not in {"owner", "admin", "member"}
                ):
                    raise ValueError("Invalid membership")
                tenant, _ = Tenant.objects.get_or_create(
                    id=tenant_id, defaults={"slug": slug, "name": slug}
                )
                if tenant.slug != slug:
                    raise ValueError("Existing tenant ID/slug mismatch")
                TenantMembership.objects.update_or_create(
                    tenant=tenant,
                    user_id=user_id,
                    defaults={"status": status, "base_role": role},
                )
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise CommandError("Invalid membership export; import rolled back") from exc
        if options["dry_run"]:
            transaction.set_rollback(True)
        self.stdout.write(
            f"{'Validated' if options['dry_run'] else 'Imported'} {len(rows)} memberships"
        )
