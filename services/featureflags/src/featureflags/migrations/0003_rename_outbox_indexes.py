from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("featureflags", "0002_outbox_claim_fields"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="outboxmessage",
            name="feature_flag_outbox_type_occ_idx",
        ),
        migrations.RemoveIndex(
            model_name="outboxmessage",
            name="feature_flag_outbox_published_idx",
        ),
        migrations.AddIndex(
            model_name="outboxmessage",
            index=models.Index(
                fields=["event_type", "occurred_at"],
                name="ff_outbox_type_occ_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="outboxmessage",
            index=models.Index(
                fields=["published_at"],
                name="ff_outbox_pub_idx",
            ),
        ),
    ]
