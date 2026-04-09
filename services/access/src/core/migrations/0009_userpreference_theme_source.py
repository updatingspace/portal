from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0008_rename_core_conten_tenant__widget_idx_core_conten_tenant__95a6f7_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpreference",
            name="theme_source",
            field=models.CharField(
                choices=[("portal", "Portal"), ("id", "ID")],
                default="portal",
                max_length=10,
            ),
        ),
    ]
