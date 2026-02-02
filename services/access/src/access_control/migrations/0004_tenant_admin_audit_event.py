from __future__ import annotations

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0003_seed_updated_permissions"),
    ]

    operations = [
        migrations.CreateModel(
            name="TenantAdminAuditEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("performed_by", models.UUIDField(db_index=True)),
                ("action", models.CharField(max_length=64)),
                ("target_type", models.CharField(blank=True, max_length=32)),
                ("target_id", models.CharField(blank=True, max_length=128)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Tenant admin audit event",
                "verbose_name_plural": "Tenant admin audit events",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="tenantadminauditevent",
            index=models.Index(fields=["tenant_id", "action"], name="access__tenantadmin_tenant_id_action_idx"),
        ),
        migrations.AddIndex(
            model_name="tenantadminauditevent",
            index=models.Index(fields=["tenant_id", "created_at"], name="access__tenantadmin_tenant_id_created_at_idx"),
        ),
    ]
