from __future__ import annotations

import uuid

from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    dependencies = [
        (
            "tenant_voting",
            "0003_rename_voting_nomination_poll_sort_idx_v_nom_poll_sort_idx",
        ),
    ]

    operations = [
        migrations.CreateModel(
            name="OutboxMessage",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("event_type", models.CharField(max_length=128, db_index=True)),
                ("payload", models.JSONField(default=dict)),
                ("occurred_at", models.DateTimeField(default=timezone.now)),
                ("published_at", models.DateTimeField(null=True, blank=True)),
            ],
            options={
                "db_table": "voting_outbox",
                "indexes": [
                    models.Index(fields=["tenant_id", "occurred_at"], name="v_outbox_tenant_occ_idx"),
                    models.Index(fields=["event_type", "occurred_at"], name="v_outbox_type_occ_idx"),
                    models.Index(fields=["published_at"], name="v_outbox_published_idx"),
                ],
            },
        ),
    ]
