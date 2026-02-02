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
            name="Poll",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("title", models.CharField(max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Draft"), ("active", "Active"), ("closed", "Closed")],
                        default="draft",
                        max_length=16,
                    ),
                ),
                (
                    "scope_type",
                    models.CharField(
                        choices=[
                            ("TENANT", "TENANT"),
                            ("COMMUNITY", "COMMUNITY"),
                            ("TEAM", "TEAM"),
                            ("EVENT", "EVENT"),
                            ("POST", "POST"),
                        ],
                        max_length=16,
                    ),
                ),
                ("scope_id", models.CharField(max_length=128)),
                (
                    "visibility",
                    models.CharField(
                        choices=[
                            ("public", "public"),
                            ("community", "community"),
                            ("team", "team"),
                            ("private", "private"),
                        ],
                        default="public",
                        max_length=16,
                    ),
                ),
                ("created_by", models.UUIDField()),
                ("starts_at", models.DateTimeField(blank=True, null=True)),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "voting_poll",
            },
        ),
        migrations.CreateModel(
            name="Nomination",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("sort", models.PositiveIntegerField(db_index=True, default=0)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "poll",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="nominations",
                        to="tenant_voting.poll",
                    ),
                ),
            ],
            options={
                "db_table": "voting_nomination",
                "ordering": ("sort", "id"),
            },
        ),
        migrations.CreateModel(
            name="Option",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("media_ref", models.CharField(blank=True, default="", max_length=512)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "nomination",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="options",
                        to="tenant_voting.nomination",
                    ),
                ),
            ],
            options={
                "db_table": "voting_option",
                "ordering": ("id",),
            },
        ),
        migrations.CreateModel(
            name="Vote",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("user_id", models.UUIDField(db_index=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "nomination",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="votes",
                        to="tenant_voting.nomination",
                    ),
                ),
                (
                    "option",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="votes",
                        to="tenant_voting.option",
                    ),
                ),
                (
                    "poll",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="votes",
                        to="tenant_voting.poll",
                    ),
                ),
            ],
            options={
                "db_table": "voting_vote",
            },
        ),
        migrations.AddIndex(
            model_name="poll",
            index=models.Index(fields=["tenant_id", "scope_type", "scope_id"], name="voting_poll_tenant_scope_idx"),
        ),
        migrations.AddIndex(
            model_name="poll",
            index=models.Index(fields=["tenant_id", "status"], name="voting_poll_tenant_status_idx"),
        ),
        migrations.AddIndex(
            model_name="nomination",
            index=models.Index(fields=["poll", "sort"], name="voting_nomination_poll_sort_idx"),
        ),
        migrations.AddConstraint(
            model_name="nomination",
            constraint=models.UniqueConstraint(fields=("poll", "sort"), name="voting_nomination_unique_sort"),
        ),
        migrations.AddIndex(
            model_name="option",
            index=models.Index(fields=["nomination"], name="voting_option_nomination_idx"),
        ),
        migrations.AddIndex(
            model_name="vote",
            index=models.Index(fields=["tenant_id", "poll"], name="voting_vote_tenant_poll_idx"),
        ),
        migrations.AddIndex(
            model_name="vote",
            index=models.Index(fields=["tenant_id", "user_id"], name="voting_vote_tenant_user_idx"),
        ),
        migrations.AddConstraint(
            model_name="vote",
            constraint=models.UniqueConstraint(
                fields=("tenant_id", "poll", "nomination", "user_id"),
                name="voting_vote_unique_per_nomination",
            ),
        ),
    ]
