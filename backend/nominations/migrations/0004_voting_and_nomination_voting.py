from django.db import migrations, models
import django.db.models.deletion


def create_default_voting(apps, schema_editor):
    Voting = apps.get_model("nominations", "Voting")
    Voting.objects.update_or_create(
        code="main",
        defaults={
            "title": "Основное голосование",
            "description": "Создано автоматически миграцией",
            "order": 0,
            "is_active": True,
            "show_vote_counts": False,
            "rules": {},
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("nominations", "0003_alter_nominationvote_nomination_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Voting",
            fields=[
                (
                    "code",
                    models.SlugField(
                        help_text="Стабильный идентификатор голосования; не меняйте после создания.",
                        max_length=64,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "deadline_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="Опциональный дедлайн для голосования. Не влияет на показ результатов.",
                        null=True,
                    ),
                ),
                (
                    "show_vote_counts",
                    models.BooleanField(
                        default=False,
                        help_text="Если отмечено, API может отдавать количество голосов для связанных номинаций.",
                    ),
                ),
                (
                    "rules",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Гибкие правила голосования (показ результатов, доступ, особенности показа).",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ("order", "title"),
                "verbose_name": "Голосование",
                "verbose_name_plural": "Голосования",
            },
        ),
        migrations.RunPython(create_default_voting, migrations.RunPython.noop),
        migrations.AddField(
            model_name="nomination",
            name="voting",
            field=models.ForeignKey(
                default="main",
                help_text="Голосование, к которому относится номинация.",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="nominations",
                to="nominations.voting",
            ),
        ),
    ]
