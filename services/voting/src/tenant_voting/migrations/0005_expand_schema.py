from __future__ import annotations

import uuid

from django.db import migrations, models


def populate_nomination_tenant_id(apps, schema_editor):
    Nomination = apps.get_model("tenant_voting", "Nomination")
    for nomination in Nomination.objects.all():
        if not nomination.tenant_id:
            nomination.tenant_id = nomination.poll.tenant_id
            nomination.save(update_fields=["tenant_id"])


def populate_option_tenant_id(apps, schema_editor):
    Nomination = apps.get_model("tenant_voting", "Nomination")
    Option = apps.get_model("tenant_voting", "Option")
    for option in Option.objects.all():
        if not option.tenant_id:
            option.tenant_id = option.nomination.tenant_id
            option.save(update_fields=["tenant_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("tenant_voting", "0004_outbox_message"),
    ]

    operations = [
        migrations.AddField(
            model_name="poll",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="poll",
            name="template",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="poll",
            name="allow_revoting",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="poll",
            name="anonymous",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="poll",
            name="results_visibility",
            field=models.CharField(
                choices=[
                    ("always", "always"),
                    ("after_closed", "after_closed"),
                    ("admins_only", "admins_only"),
                ],
                default="after_closed",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="poll",
            name="settings",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="nomination",
            name="tenant_id",
            field=models.UUIDField(db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="nomination",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="nomination",
            name="kind",
            field=models.CharField(
                choices=[
                    ("game", "game"),
                    ("review", "review"),
                    ("person", "person"),
                    ("custom", "custom"),
                ],
                default="custom",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="nomination",
            name="max_votes",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="nomination",
            name="is_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="nomination",
            name="config",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RenameField(
            model_name="nomination",
            old_name="sort",
            new_name="sort_order",
        ),
        migrations.AlterModelOptions(
            name="nomination",
            options={
                "db_table": "voting_nomination",
                "indexes": [
                    models.Index(fields=["poll", "sort_order"], name="v_nom_poll_sort_idx"),
                ],
                "ordering": ("sort_order", "id"),
                "constraints": [
                    models.UniqueConstraint(
                        fields=["poll", "sort_order"],
                        name="voting_nomination_unique_sort",
                    ),
                ],
            },
        ),
        migrations.AddField(
            model_name="option",
            name="tenant_id",
            field=models.UUIDField(db_index=True, null=True),
        ),
        migrations.RenameField(
            model_name="option",
            old_name="media_ref",
            new_name="media_url",
        ),
        migrations.AddField(
            model_name="option",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="option",
            name="game_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="option",
            name="sort_order",
            field=models.PositiveIntegerField(default=0, db_index=True),
        ),
        migrations.AlterModelOptions(
            name="option",
            options={
                "db_table": "voting_option",
                "indexes": [
                    models.Index(fields=["nomination"], name="voting_option_nomination_idx"),
                ],
                "ordering": ("sort_order", "id"),
            },
        ),
        migrations.CreateModel(
            name="PollParticipant",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("user_id", models.UUIDField(db_index=True)),
                ("role", models.CharField(choices=[("owner", "owner"), ("admin", "admin"), ("moderator", "moderator"), ("observer", "observer"), ("participant", "participant")], max_length=16)),
                ("added_at", models.DateTimeField(auto_now_add=True)),
                ("poll", models.ForeignKey(on_delete=models.CASCADE, related_name="participants", to="tenant_voting.poll")),
            ],
            options={
                "db_table": "voting_poll_participant",
                "constraints": [
                    models.UniqueConstraint(fields=["poll", "user_id"], name="voting_poll_participant_unique"),
                ],
            },
        ),
        migrations.RunPython(populate_nomination_tenant_id, reverse_code=migrations.RunPython.noop),
        migrations.RunPython(populate_option_tenant_id, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name="nomination",
            name="tenant_id",
            field=models.UUIDField(db_index=True),
        ),
        migrations.AlterField(
            model_name="option",
            name="tenant_id",
            field=models.UUIDField(db_index=True),
        ),
    ]
