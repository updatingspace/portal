from __future__ import annotations

import json
import importlib.util
from pathlib import Path

from django.core.management.base import BaseCommand
from ninja import NinjaAPI


class Command(BaseCommand):
    help = "Export OpenAPI schema for the service (django-ninja)."
    requires_system_checks: list[str] = []

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="openapi.json",
            help="Output file path (relative to current working directory).",
        )

    def handle(self, *args, **options):
        # Export Portal Core API in isolation to avoid loading unrelated modules.
        # Load portal.api in an isolated module namespace so we get a fresh
        # Router object (django-ninja routers can't be attached to 2 APIs).
        api_path = Path(__file__).resolve().parents[2] / "api.py"
        spec = importlib.util.spec_from_file_location("portal._api_export", api_path)
        if not spec or not spec.loader:
            raise RuntimeError(f"Unable to load portal api module from {api_path}")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        portal_router = getattr(mod, "router")

        api = NinjaAPI(title="Portal Core API", version="1.0.0")
        api.add_router("/api/v1", portal_router)
        schema = api.get_openapi_schema(path_prefix="")

        out_path = Path(options["output"]).expanduser()
        if not out_path.is_absolute():
            out_path = Path.cwd() / out_path
        out_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"OpenAPI exported to {out_path}"))
