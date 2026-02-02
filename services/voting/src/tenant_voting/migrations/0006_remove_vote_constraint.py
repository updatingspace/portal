from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenant_voting", "0005_expand_schema"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="vote",
            options={
                "db_table": "voting_vote",
                "indexes": [
                    models.Index(fields=["tenant_id", "poll"], name="voting_vote_tenant_poll_idx"),
                    models.Index(fields=["tenant_id", "user_id"], name="voting_vote_tenant_user_idx"),
                ],
            },
        ),
    ]
