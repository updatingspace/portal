from django.db import migrations


def forwards(apps, schema_editor):
    apps.get_model("access_control", "Permission").objects.update_or_create(
        key="gamification.categories.manage",
        defaults={
            "description": "Manage achievement categories",
            "service": "gamification",
        },
    )


class Migration(migrations.Migration):
    dependencies = [("access_control", "0017_tenant_application_review_permission")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
