"""
Migration for rollout models: FeatureFlag, Experiment, KillSwitch, RolloutAuditLog.
"""
import django.db.models.deletion
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0011_sync_member_role_templates_v2"),
    ]

    operations = [
        # FeatureFlag
        migrations.CreateModel(
            name="FeatureFlag",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("key", models.CharField(db_index=True, max_length=128)),
                ("tenant_id", models.UUIDField(blank=True, db_index=True, null=True)),
                ("description", models.CharField(blank=True, default="", max_length=255)),
                ("enabled", models.BooleanField(default=False)),
                ("target_type", models.CharField(
                    choices=[("all", "All users"), ("percent", "Percentage rollout"), ("user_list", "Explicit user list"), ("tenant_list", "Explicit tenant list")],
                    default="all",
                    max_length=16,
                )),
                ("target_value", models.JSONField(blank=True, default=dict, help_text='Depends on target_type: percent={"pct": 25}, user_list={"user_ids": [...]}, etc.')),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.UUIDField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "Feature flag",
                "verbose_name_plural": "Feature flags",
            },
        ),
        migrations.AddConstraint(
            model_name="featureflag",
            constraint=models.UniqueConstraint(fields=("key", "tenant_id"), name="ac_feature_flag_unique_key_tenant"),
        ),
        migrations.AddConstraint(
            model_name="featureflag",
            constraint=models.UniqueConstraint(
                condition=models.Q(("tenant_id__isnull", True)),
                fields=("key",),
                name="ac_feature_flag_unique_key_global",
            ),
        ),
        migrations.AddIndex(
            model_name="featureflag",
            index=models.Index(fields=["key"], name="access_cont_key_ff_idx"),
        ),
        migrations.AddIndex(
            model_name="featureflag",
            index=models.Index(fields=["tenant_id"], name="access_cont_tenant_ff_idx"),
        ),
        migrations.AddIndex(
            model_name="featureflag",
            index=models.Index(fields=["enabled"], name="access_cont_enabled_ff_idx"),
        ),

        # Experiment
        migrations.CreateModel(
            name="Experiment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("key", models.CharField(db_index=True, max_length=128)),
                ("tenant_id", models.UUIDField(blank=True, db_index=True, null=True)),
                ("description", models.CharField(blank=True, default="", max_length=255)),
                ("enabled", models.BooleanField(default=False)),
                ("variants", models.JSONField(
                    default=list,
                    help_text='List of variant definitions: [{"name": "control", "weight": 50}, {"name": "treatment", "weight": 50}]',
                )),
                ("target_type", models.CharField(
                    choices=[("all", "All users"), ("percent", "Percentage rollout"), ("user_list", "Explicit user list"), ("tenant_list", "Explicit tenant list")],
                    default="all",
                    max_length=16,
                )),
                ("target_value", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.UUIDField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "Experiment",
                "verbose_name_plural": "Experiments",
            },
        ),
        migrations.AddConstraint(
            model_name="experiment",
            constraint=models.UniqueConstraint(fields=("key", "tenant_id"), name="ac_experiment_unique_key_tenant"),
        ),
        migrations.AddConstraint(
            model_name="experiment",
            constraint=models.UniqueConstraint(
                condition=models.Q(("tenant_id__isnull", True)),
                fields=("key",),
                name="ac_experiment_unique_key_global",
            ),
        ),
        migrations.AddIndex(
            model_name="experiment",
            index=models.Index(fields=["key"], name="access_cont_key_exp_idx"),
        ),
        migrations.AddIndex(
            model_name="experiment",
            index=models.Index(fields=["tenant_id"], name="access_cont_tenant_exp_idx"),
        ),
        migrations.AddIndex(
            model_name="experiment",
            index=models.Index(fields=["enabled"], name="access_cont_enabled_exp_idx"),
        ),

        # KillSwitch
        migrations.CreateModel(
            name="KillSwitch",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("feature_key", models.CharField(db_index=True, max_length=128)),
                ("tenant_id", models.UUIDField(blank=True, db_index=True, null=True)),
                ("active", models.BooleanField(default=True)),
                ("reason", models.CharField(blank=True, default="", max_length=255)),
                ("activated_at", models.DateTimeField(auto_now_add=True)),
                ("activated_by", models.UUIDField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "Kill switch",
                "verbose_name_plural": "Kill switches",
            },
        ),
        migrations.AddConstraint(
            model_name="killswitch",
            constraint=models.UniqueConstraint(fields=("feature_key", "tenant_id"), name="ac_kill_switch_unique_key_tenant"),
        ),
        migrations.AddIndex(
            model_name="killswitch",
            index=models.Index(fields=["feature_key"], name="access_cont_fkey_ks_idx"),
        ),
        migrations.AddIndex(
            model_name="killswitch",
            index=models.Index(fields=["active"], name="access_cont_active_ks_idx"),
        ),

        # RolloutAuditLog
        migrations.CreateModel(
            name="RolloutAuditLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(blank=True, db_index=True, null=True)),
                ("performed_by", models.UUIDField(db_index=True)),
                ("action", models.CharField(max_length=64)),
                ("entity_type", models.CharField(help_text="feature_flag | experiment | kill_switch", max_length=32)),
                ("entity_id", models.UUIDField()),
                ("changes", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Rollout audit log",
                "verbose_name_plural": "Rollout audit logs",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="rolloutauditlog",
            index=models.Index(fields=["tenant_id", "entity_type"], name="access_cont_ral_tenant_type_idx"),
        ),
        migrations.AddIndex(
            model_name="rolloutauditlog",
            index=models.Index(fields=["entity_id"], name="access_cont_ral_entity_idx"),
        ),
        migrations.AddIndex(
            model_name="rolloutauditlog",
            index=models.Index(fields=["created_at"], name="access_cont_ral_created_idx"),
        ),
    ]
