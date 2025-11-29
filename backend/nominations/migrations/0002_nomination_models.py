import json
from pathlib import Path

import django.db.models.deletion
from django.db import migrations, models

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "nominations.json"


def seed_nominations(apps, schema_editor):
    Nomination = apps.get_model("nominations", "Nomination")
    NominationOption = apps.get_model("nominations", "NominationOption")
    NominationVote = apps.get_model("nominations", "NominationVote")
    db_alias = schema_editor.connection.alias

    try:
        raw = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return

    # Первичная загрузка номинаций/опций из фикстуры.
    for index, item in enumerate(raw):
        nomination, _ = Nomination.objects.using(db_alias).get_or_create(
            id=str(item.get("id", index + 1)),
            defaults={
                "title": item.get("title", ""),
                "description": item.get("description") or "",
                "order": index,
                "is_active": True,
            },
        )
        for opt_index, option in enumerate(item.get("options", [])):
            NominationOption.objects.using(db_alias).get_or_create(
                id=str(option.get("id", f"{nomination.id}-opt-{opt_index}")),
                defaults={
                    "nomination": nomination,
                    "title": option.get("title", ""),
                    "image_url": option.get("image_url"),
                    "order": opt_index,
                    "is_active": True,
                },
            )

    # Гарантируем, что существующие голоса не нарушат внешние ключи,
    # создавая заглушки для незнакомых номинаций/опций.
    for vote in NominationVote.objects.using(db_alias).all():
        nomination, _ = Nomination.objects.using(db_alias).get_or_create(
            id=vote.nomination_id,
            defaults={
                "title": vote.nomination_id,
                "description": "",
                "order": Nomination.objects.using(db_alias).count(),
                "is_active": True,
            },
        )
        NominationOption.objects.using(db_alias).get_or_create(
            id=vote.option_id,
            defaults={
                "nomination": nomination,
                "title": vote.option_id,
                "order": NominationOption.objects.using(db_alias)
                .filter(nomination=nomination)
                .count(),
                "is_active": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("nominations", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Nomination",
            fields=[
                (
                    "id",
                    models.SlugField(
                        help_text="Используется как стабильный идентификатор в API; не меняйте после создания.",
                        max_length=64,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ("order", "title"),
                "verbose_name": "Номинация",
                "verbose_name_plural": "Номинации",
            },
        ),
        migrations.CreateModel(
            name="NominationOption",
            fields=[
                (
                    "id",
                    models.SlugField(
                        help_text="Используется как стабильный идентификатор в API; не меняйте после создания.",
                        max_length=64,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("image_url", models.URLField(blank=True, null=True)),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "nomination",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="options",
                        to="nominations.nomination",
                    ),
                ),
            ],
            options={
                "ordering": ("order", "title"),
                "verbose_name": "Опция номинации",
                "verbose_name_plural": "Опции номинаций",
            },
        ),
        migrations.RunPython(seed_nominations, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="nominationvote",
            name="nomination_id",
            field=models.CharField(db_column="nomination_id", db_index=True, max_length=64),
        ),
        migrations.AlterField(
            model_name="nominationvote",
            name="option_id",
            field=models.CharField(db_column="option_id", db_index=True, max_length=64),
        ),
        migrations.RenameField(
            model_name="nominationvote",
            old_name="nomination_id",
            new_name="nomination",
        ),
        migrations.RenameField(
            model_name="nominationvote",
            old_name="option_id",
            new_name="option",
        ),
        migrations.AlterField(
            model_name="nominationvote",
            name="nomination",
            field=models.ForeignKey(
                db_column="nomination_id",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="votes",
                to="nominations.nomination",
                to_field="id",
            ),
        ),
        migrations.AlterField(
            model_name="nominationvote",
            name="option",
            field=models.ForeignKey(
                db_column="option_id",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="votes",
                to="nominations.nominationoption",
                to_field="id",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="nominationvote",
            unique_together={("user", "nomination")},
        ),
    ]
