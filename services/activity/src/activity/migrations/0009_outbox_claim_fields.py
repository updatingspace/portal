from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("activity", "0008_activityauditevent"),
    ]

    operations = [
        migrations.AddField(
            model_name="outbox",
            name="claimed_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="outbox",
            name="claim_token",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
