from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("activity", "0009_newspostview"),
    ]

    operations = [
        migrations.AddField(
            model_name="newspost",
            name="status",
            field=models.CharField(
                choices=[("published", "published"), ("draft", "draft")],
                default="published",
                max_length=16,
            ),
        ),
        migrations.AddIndex(
            model_name="newspost",
            index=models.Index(
                fields=["tenant_id", "author_user_id", "status"],
                name="act_news_author_status_idx",
            ),
        ),
    ]
