# Generated manually for initial feature flags schema.

from django.db import migrations, models
import django.utils.timezone
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="FeatureFlag",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("key", models.CharField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True, default="")),
                ("enabled", models.BooleanField(default=False)),
                ("rollout", models.PositiveSmallIntegerField(default=100)),
                ("created_by", models.UUIDField()),
                ("updated_by", models.UUIDField()),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "feature_flags"},
        ),
        migrations.CreateModel(
            name="FeatureFlagAuditEvent",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("actor_user_id", models.UUIDField(db_index=True)),
                ("action", models.CharField(max_length=64, db_index=True)),
                ("flag_key", models.CharField(max_length=120, db_index=True)),
                ("metadata", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now, db_index=True)),
            ],
            options={"db_table": "feature_flag_audit_events"},
        ),
        migrations.CreateModel(
            name="OutboxMessage",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("event_type", models.CharField(max_length=128, db_index=True)),
                ("payload", models.JSONField(default=dict)),
                ("occurred_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={"db_table": "feature_flag_outbox"},
        ),
        migrations.AddIndex(
            model_name="featureflag",
            index=models.Index(fields=["enabled"], name="feature_flags_enabled_idx"),
        ),
        migrations.AddIndex(
            model_name="featureflag",
            index=models.Index(fields=["updated_at"], name="feature_flags_updated_idx"),
        ),
        migrations.AddIndex(
            model_name="outboxmessage",
            index=models.Index(fields=["event_type", "occurred_at"], name="feature_flag_outbox_type_occ_idx"),
        ),
        migrations.AddIndex(
            model_name="outboxmessage",
            index=models.Index(fields=["published_at"], name="feature_flag_outbox_published_idx"),
        ),
    ]
