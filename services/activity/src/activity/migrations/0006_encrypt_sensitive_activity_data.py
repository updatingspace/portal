from __future__ import annotations

from django.db import migrations

import activity.fields


def _encrypt_existing_values(apps, schema_editor):
    Source = apps.get_model("activity", "Source")
    AccountLink = apps.get_model("activity", "AccountLink")
    RawEvent = apps.get_model("activity", "RawEvent")

    for source in Source.objects.all().iterator(chunk_size=200):
        source.save(update_fields=["config_json"])

    for link in AccountLink.objects.all().iterator(chunk_size=200):
        link.save(update_fields=["settings_json", "external_identity_ref"])

    for raw_event in RawEvent.objects.all().iterator(chunk_size=200):
        raw_event.save(update_fields=["payload_json"])


class Migration(migrations.Migration):

    dependencies = [
        ("activity", "0005_alter_newscomment_created_at_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="source",
            name="config_json",
            field=activity.fields.EncryptedJSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="accountlink",
            name="settings_json",
            field=activity.fields.EncryptedJSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="accountlink",
            name="external_identity_ref",
            field=activity.fields.EncryptedTextField(
                blank=True,
                max_length=256,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="rawevent",
            name="payload_json",
            field=activity.fields.EncryptedJSONField(default=dict),
        ),
        migrations.RunPython(
            _encrypt_existing_values,
            migrations.RunPython.noop,
        ),
    ]