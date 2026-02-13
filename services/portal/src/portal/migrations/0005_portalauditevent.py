"""Create PortalAuditEvent table for lifecycle audit trail."""

from django.db import migrations, models
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("portal", "0004_add_profile_username_display_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="PortalAuditEvent",
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
                "db_table": "portal_audit_event",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="portalauditevent",
            index=models.Index(
                fields=["tenant_id", "action"],
                name="p_audit_tnt_action_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="portalauditevent",
            index=models.Index(
                fields=["tenant_id", "created_at"],
                name="p_audit_tnt_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="portalauditevent",
            index=models.Index(
                fields=["tenant_id", "actor_user_id", "-created_at"],
                name="p_audit_tnt_actor_idx",
            ),
        ),
    ]
