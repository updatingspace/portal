from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("portal", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="portalprofile",
            name="username",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="portalprofile",
            name="display_name",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
    ]
