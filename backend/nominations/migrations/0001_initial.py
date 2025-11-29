from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="VotingSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(default="Основное голосование", max_length=100)),
                (
                    "deadline_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="После этой даты менять выбор нельзя. Оставьте пустым, чтобы не ограничивать.",
                        null=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Настройки голосования",
                "verbose_name_plural": "Настройки голосования",
            },
        ),
        migrations.CreateModel(
            name="NominationVote",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nomination_id", models.CharField(db_index=True, max_length=64)),
                ("option_id", models.CharField(db_index=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="nomination_votes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Голос",
                "verbose_name_plural": "Голоса",
                "unique_together": {("user", "nomination_id")},
            },
        ),
    ]
