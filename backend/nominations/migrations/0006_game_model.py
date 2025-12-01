from django.db import migrations, models
import django.db.models.deletion


def link_options_to_games(apps, schema_editor):
    Game = apps.get_model("nominations", "Game")
    NominationOption = apps.get_model("nominations", "NominationOption")

    for option in NominationOption.objects.all():
        game, _ = Game.objects.get_or_create(
            id=option.id,
            defaults={
                "title": option.title,
                "image_url": option.image_url,
            },
        )
        if option.game_id != game.id:
            option.game = game
            option.save(update_fields=["game"])


class Migration(migrations.Migration):

    dependencies = [
        ("nominations", "0005_alter_voting_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="Game",
            fields=[
                (
                    "id",
                    models.SlugField(
                        blank=True,
                        help_text="Стабильный идентификатор игры; не меняйте после создания.",
                        max_length=128,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("genre", models.CharField(blank=True, default="", max_length=255)),
                ("studio", models.CharField(blank=True, default="", max_length=255)),
                ("release_year", models.PositiveIntegerField(blank=True, null=True)),
                ("description", models.TextField(blank=True)),
                ("image_url", models.URLField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Игра",
                "verbose_name_plural": "Игры",
                "ordering": ("title", "id"),
            },
        ),
        migrations.AddField(
            model_name="nominationoption",
            name="game",
            field=models.ForeignKey(
                blank=True,
                help_text="Связанная игра с расширенными метаданными.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="options",
                to="nominations.game",
            ),
        ),
        migrations.RunPython(link_options_to_games, migrations.RunPython.noop),
    ]
