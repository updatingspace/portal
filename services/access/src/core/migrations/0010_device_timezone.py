from django.db import migrations, models


def use_device_timezone(apps, schema_editor):
    # UTC was the implicit default before device-local display was supported.
    apps.get_model("core", "UserPreference").objects.filter(timezone="UTC").update(
        timezone="system"
    )


def restore_utc(apps, schema_editor):
    apps.get_model("core", "UserPreference").objects.filter(timezone="system").update(
        timezone="UTC"
    )


class Migration(migrations.Migration):
    dependencies = [("core", "0009_userpreference_theme_source")]
    operations = [
        migrations.AlterField(
            model_name="userpreference",
            name="timezone",
            field=models.CharField(default="system", max_length=50),
        ),
        migrations.RunPython(use_device_timezone, restore_utc),
    ]
