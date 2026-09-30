from django.db import migrations


def forwards(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")
    Permission.objects.update_or_create(
        key="portal.tenant_applications.review",
        defaults={
            "description": "Review tenant creation applications",
            "service": "portal",
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("access_control", "0016_backfill_personalization_member_permissions")
    ]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
