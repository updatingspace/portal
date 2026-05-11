from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("activity", "0009_outbox_claim_fields"),
        ("activity", "0010_newspost_status"),
    ]

    operations = []
