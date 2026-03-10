"""Create BffAuditEvent table for session lifecycle audit trail."""

from django.db import migrations, models
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        (
            "bff",
            "0002_rename_bff_bffses_tenant__4ae4f9_idx_bff_bffsess_tenant__82ed8e_idx_and_more",
        ),
    ]

    operations = [
        migrations.CreateModel(
            name="BffAuditEvent",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("actor_user_id", models.UUIDField(db_index=True)),
                ("action", models.CharField(max_length=64)),
                ("target_type", models.CharField(blank=True, max_length=32)),
                ("target_id", models.CharField(blank=True, max_length=128)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("request_id", models.CharField(blank=True, max_length=64)),
                (
                    "created_at",
                    models.DateTimeField(default=django.utils.timezone.now),
                ),
            ],
            options={
                "db_table": "bff_audit_event",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="bffauditevent",
            index=models.Index(
                fields=["tenant_id", "action"],
                name="b_audit_tnt_action_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="bffauditevent",
            index=models.Index(
                fields=["tenant_id", "created_at"],
                name="b_audit_tnt_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="bffauditevent",
            index=models.Index(
                fields=["tenant_id", "actor_user_id", "-created_at"],
                name="b_audit_tnt_actor_idx",
            ),
        ),
    ]
