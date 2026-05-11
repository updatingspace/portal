from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tenant_voting", "0008_remove_vote_voting_vote_unique_per_nomination_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="outboxmessage",
            name="claimed_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="outboxmessage",
            name="claim_token",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
