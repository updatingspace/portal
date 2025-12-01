from django.db import migrations, models


def deduplicate_games(apps, schema_editor):
    Game = apps.get_model("nominations", "Game")
    NominationOption = apps.get_model("nominations", "NominationOption")

    seen: dict[str, object] = {}
    for game in Game.objects.all().order_by("created_at", "id"):
        title_norm = (game.title or "").strip()
        if not title_norm:
            # Пустые имена не поддерживаются, помечаем их для удаления.
            NominationOption.objects.filter(game_id=game.id).update(game=None)
            game.delete()
            continue

        title_key = title_norm.lower()
        if game.title != title_norm:
            game.title = title_norm
            game.save(update_fields=["title"])

        canonical = seen.get(title_key)
        if canonical is None:
            seen[title_key] = game
            continue

        # Переназначаем опции на каноничную игру и удаляем дубликат.
        NominationOption.objects.filter(game_id=game.id).update(game=canonical)
        game.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("nominations", "0006_game_model"),
    ]

    operations = [
        migrations.RunPython(deduplicate_games, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="game",
            name="title",
            field=models.CharField(max_length=255, unique=True),
        ),
    ]
