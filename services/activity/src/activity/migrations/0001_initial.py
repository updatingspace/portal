from __future__ import annotations

import django.db.models.deletion
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies: list[tuple[str, str]] = []

    operations = [
        migrations.CreateModel(
            name="Game",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.UUIDField()),
                ("name", models.CharField(max_length=128)),
                ("tags_json", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "act_game",
                "indexes": [models.Index(fields=["tenant_id", "name"], name="act_game_tenant_name_idx")],
            },
        ),
        migrations.CreateModel(
            name="Source",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.UUIDField()),
                ("type", models.CharField(choices=[("steam", "steam"), ("discord", "discord"), ("minecraft", "minecraft"), ("truckersmp", "truckersmp"), ("custom", "custom")], max_length=32)),
                ("config_json", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "act_source",
                "indexes": [models.Index(fields=["tenant_id", "type"], name="act_source_tenant_type_idx")],
            },
        ),
        migrations.CreateModel(
            name="Subscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.UUIDField()),
                ("user_id", models.UUIDField()),
                ("rules_json", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "act_subscription",
                "indexes": [models.Index(fields=["tenant_id", "user_id"], name="act_sub_tenant_user_idx")],
            },
        ),
        migrations.CreateModel(
            name="AccountLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.UUIDField()),
                ("user_id", models.UUIDField()),
                ("status", models.CharField(choices=[("active", "active"), ("pending", "pending"), ("disabled", "disabled"), ("error", "error")], default="active", max_length=16)),
                ("settings_json", models.JSONField(default=dict)),
                ("external_identity_ref", models.CharField(blank=True, max_length=256, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("source", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="account_links", to="activity.source")),
            ],
            options={
                "db_table": "act_account_link",
                "indexes": [
                    models.Index(fields=["tenant_id", "user_id"], name="act_acclink_tenant_user_idx"),
                    models.Index(fields=["tenant_id", "source"], name="act_acclink_tenant_source_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="RawEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.UUIDField()),
                ("payload_json", models.JSONField(default=dict)),
                ("fetched_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("dedupe_hash", models.CharField(max_length=64)),
                ("account_link", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="raw_events", to="activity.accountlink")),
            ],
            options={
                "db_table": "act_raw_event",
                "indexes": [
                    models.Index(fields=["tenant_id", "account_link"], name="act_raw_tenant_acclink_idx"),
                    models.Index(fields=["tenant_id", "fetched_at"], name="act_raw_tenant_fetched_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ActivityEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.UUIDField()),
                ("actor_user_id", models.UUIDField(blank=True, null=True)),
                ("target_user_id", models.UUIDField(blank=True, null=True)),
                ("type", models.CharField(max_length=64)),
                ("occurred_at", models.DateTimeField()),
                ("title", models.CharField(max_length=256)),
                ("payload_json", models.JSONField(default=dict)),
                ("visibility", models.CharField(choices=[("public", "public"), ("community", "community"), ("team", "team"), ("private", "private")], default="public", max_length=16)),
                ("scope_type", models.CharField(choices=[("GLOBAL", "GLOBAL"), ("TENANT", "TENANT"), ("COMMUNITY", "COMMUNITY"), ("TEAM", "TEAM"), ("SERVICE", "SERVICE")], default="TENANT", max_length=16)),
                ("scope_id", models.CharField(max_length=128)),
                ("source_ref", models.CharField(max_length=255)),
                ("raw_event", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="activity_events", to="activity.rawevent")),
            ],
            options={
                "db_table": "act_activity_event",
                "indexes": [
                    models.Index(fields=["tenant_id", "occurred_at"], name="act_event_tenant_occurred_idx"),
                    models.Index(fields=["tenant_id", "type", "occurred_at"], name="act_ev_tnt_type_occ_idx"),
                    models.Index(fields=["tenant_id", "scope_type", "scope_id", "occurred_at"], name="act_event_scope_idx"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="subscription",
            constraint=models.UniqueConstraint(fields=("tenant_id", "user_id"), name="act_sub_tenant_user_uniq"),
        ),
        migrations.AddConstraint(
            model_name="rawevent",
            constraint=models.UniqueConstraint(fields=("tenant_id", "dedupe_hash"), name="act_raw_event_dedupe_uniq"),
        ),
        migrations.AddConstraint(
            model_name="activityevent",
            constraint=models.UniqueConstraint(fields=("tenant_id", "source_ref"), name="act_event_source_ref_uniq"),
        ),
        migrations.AddConstraint(
            model_name="accountlink",
            constraint=models.UniqueConstraint(fields=("tenant_id", "user_id", "source"), name="act_account_link_tenant_user_source_uniq"),
        ),
    ]
