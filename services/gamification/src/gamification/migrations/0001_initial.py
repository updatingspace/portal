from __future__ import annotations

import uuid

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="AchievementCategory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("slug", models.SlugField(max_length=64)),
                ("name_i18n", models.JSONField(default=dict)),
                ("order", models.IntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "gamification_category",
                "indexes": [
                    models.Index(fields=["tenant_id", "order"], name="g_category_tenant_order_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=["tenant_id", "slug"], name="g_category_tenant_slug_unique"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Achievement",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("name_i18n", models.JSONField(default=dict)),
                ("description", models.TextField(blank=True, default="")),
                ("status", models.CharField(choices=[("draft", "draft"), ("published", "published"), ("hidden", "hidden"), ("active", "active")], db_index=True, default="draft", max_length=16)),
                ("images", models.JSONField(default=dict)),
                ("created_by", models.UUIDField()),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="achievements", to="gamification.achievementcategory")),
            ],
            options={
                "db_table": "gamification_achievement",
                "indexes": [
                    models.Index(fields=["tenant_id", "created_at"], name="g_ach_tenant_created_idx"),
                    models.Index(fields=["tenant_id", "status"], name="g_ach_tenant_status_idx"),
                    models.Index(fields=["tenant_id", "category"], name="g_ach_tenant_category_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="AchievementGrant",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("recipient_id", models.UUIDField(db_index=True)),
                ("issuer_id", models.UUIDField(db_index=True)),
                ("reason", models.TextField(blank=True, default="")),
                ("visibility", models.CharField(choices=[("public", "public"), ("private", "private")], db_index=True, default="public", max_length=16)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("revoked_by", models.UUIDField(blank=True, null=True)),
                ("achievement", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="grants", to="gamification.achievement")),
            ],
            options={
                "db_table": "gamification_grant",
                "indexes": [
                    models.Index(fields=["tenant_id", "recipient_id"], name="g_grant_tenant_recipient_idx"),
                    models.Index(fields=["tenant_id", "achievement"], name="g_grant_tenant_ach_idx"),
                    models.Index(fields=["tenant_id", "created_at"], name="g_grant_tenant_created_idx"),
                    models.Index(fields=["tenant_id", "visibility"], name="g_grant_tenant_vis_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(condition=models.Q(revoked_at__isnull=True), fields=["tenant_id", "achievement", "recipient_id"], name="g_grant_unique_achievement_recipient"),
                ],
            },
        ),
        migrations.CreateModel(
            name="OutboxMessage",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("event_type", models.CharField(db_index=True, max_length=128)),
                ("payload", models.JSONField(default=dict)),
                ("occurred_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "db_table": "gamification_outbox",
                "indexes": [
                    models.Index(fields=["tenant_id", "occurred_at"], name="g_outbox_tenant_occ_idx"),
                    models.Index(fields=["event_type", "occurred_at"], name="g_outbox_type_occ_idx"),
                    models.Index(fields=["published_at"], name="g_outbox_published_idx"),
                ],
            },
        ),
    ]
