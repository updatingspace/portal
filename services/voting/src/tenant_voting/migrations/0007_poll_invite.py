from __future__ import annotations

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenant_voting", "0006_remove_vote_constraint"),
    ]

    operations = [
        migrations.CreateModel(
            name="PollInvite",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ("tenant_id", models.UUIDField(db_index=True)),
                ("user_id", models.UUIDField(db_index=True)),
                ("role", models.CharField(choices=[("owner", "owner"), ("admin", "admin"), ("moderator", "moderator"), ("observer", "observer"), ("participant", "participant")], max_length=16)),
                ("invited_by", models.UUIDField()),
                ("status", models.CharField(choices=[("pending", "pending"), ("accepted", "accepted"), ("declined", "declined")], default="pending", max_length=16)),
                ("token", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("poll", models.ForeignKey(on_delete=models.CASCADE, related_name="invites", to="tenant_voting.poll")),
            ],
            options={
                "db_table": "voting_poll_invite",
                "constraints": [
                    models.UniqueConstraint(fields=["poll", "user_id"], name="voting_poll_invite_unique"),
                ],
            },
        ),
    ]
