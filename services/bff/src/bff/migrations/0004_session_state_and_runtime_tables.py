"""Add path-based session state, OAuth state, and DB-backed rate limit windows."""

from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "bff",
            "0003_bffauditevent",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="bffsession",
            name="active_tenant_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="bffsession",
            name="active_tenant_slug",
            field=models.SlugField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="bffsession",
            name="active_tenant_set_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="bffsession",
            name="last_tenant_slug",
            field=models.SlugField(blank=True, default="", max_length=64),
        ),
        migrations.CreateModel(
            name="BffOauthState",
            fields=[
                (
                    "state",
                    models.CharField(max_length=128, primary_key=True, serialize=False),
                ),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("next_path", models.CharField(max_length=512)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "bff_oauth_state",
                "verbose_name": "BFF OAuth state",
                "verbose_name_plural": "BFF OAuth states",
            },
        ),
        migrations.CreateModel(
            name="BffRateLimitWindow",
            fields=[
                (
                    "bucket_key",
                    models.CharField(max_length=255, primary_key=True, serialize=False),
                ),
                ("count", models.PositiveIntegerField(default=1)),
                ("window_started_at", models.DateTimeField(db_index=True)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "bff_rate_limit_window",
                "verbose_name": "BFF rate limit window",
                "verbose_name_plural": "BFF rate limit windows",
            },
        ),
    ]
