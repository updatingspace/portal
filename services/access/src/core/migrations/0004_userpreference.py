# Generated migration for UserPreference model

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_homepagemodal"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserPreference",
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
                ("user_id", models.UUIDField(db_index=True)),
                ("tenant_id", models.UUIDField(db_index=True)),
                (
                    "theme",
                    models.CharField(
                        choices=[
                            ("light", "Light"),
                            ("dark", "Dark"),
                            ("auto", "Auto"),
                        ],
                        default="auto",
                        max_length=10,
                    ),
                ),
                ("accent_color", models.CharField(default="#007AFF", max_length=7)),
                (
                    "font_size",
                    models.CharField(
                        choices=[
                            ("small", "Small"),
                            ("medium", "Medium"),
                            ("large", "Large"),
                        ],
                        default="medium",
                        max_length=10,
                    ),
                ),
                ("high_contrast", models.BooleanField(default=False)),
                ("reduce_motion", models.BooleanField(default=False)),
                (
                    "language",
                    models.CharField(
                        choices=[("en", "English"), ("ru", "Русский")],
                        default="en",
                        max_length=5,
                    ),
                ),
                ("timezone", models.CharField(default="UTC", max_length=50)),
                ("notification_settings", models.JSONField(default=dict)),
                (
                    "profile_visibility",
                    models.CharField(
                        choices=[
                            ("public", "Public"),
                            ("members", "Members Only"),
                            ("private", "Private"),
                        ],
                        default="members",
                        max_length=10,
                    ),
                ),
                ("show_online_status", models.BooleanField(default=True)),
                ("show_vote_history", models.BooleanField(default=False)),
                ("share_activity", models.BooleanField(default=True)),
                ("allow_mentions", models.BooleanField(default=True)),
                ("analytics_enabled", models.BooleanField(default=True)),
                ("recommendations_enabled", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "User Preference",
                "verbose_name_plural": "User Preferences",
            },
        ),
        migrations.AddIndex(
            model_name="userpreference",
            index=models.Index(
                fields=["user_id", "tenant_id"], name="core_userpr_user_id_a7b123_idx"
            ),
        ),
        migrations.AlterUniqueTogether(
            name="userpreference",
            unique_together={("user_id", "tenant_id")},
        ),
    ]
