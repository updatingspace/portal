# Generated migration for Outbox and FeedLastSeen models

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('activity', '0002_alter_accountlink_id_alter_activityevent_id_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Outbox',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('tenant_id', models.UUIDField(db_index=True)),
                ('event_type', models.CharField(
                    choices=[
                        ('activity.feed.updated', 'Feed Updated'),
                        ('activity.sync.completed', 'Sync Completed'),
                        ('activity.sync.failed', 'Sync Failed'),
                        ('activity.account.linked', 'Account Linked'),
                        ('activity.account.unlinked', 'Account Unlinked'),
                    ],
                    max_length=64,
                )),
                ('aggregate_type', models.CharField(default='activity_event', max_length=64)),
                ('aggregate_id', models.CharField(max_length=128)),
                ('payload_json', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('processed_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('retry_count', models.PositiveSmallIntegerField(default=0)),
            ],
            options={
                'db_table': 'act_outbox',
                'ordering': ['created_at'],
            },
        ),
        migrations.CreateModel(
            name='FeedLastSeen',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('tenant_id', models.UUIDField()),
                ('user_id', models.UUIDField()),
                ('last_seen_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'act_feed_last_seen',
            },
        ),
        migrations.AddConstraint(
            model_name='feedlastseen',
            constraint=models.UniqueConstraint(
                fields=('tenant_id', 'user_id'),
                name='act_feed_last_seen_uniq',
            ),
        ),
        migrations.AddIndex(
            model_name='feedlastseen',
            index=models.Index(
                fields=['tenant_id', 'user_id'],
                name='act_feed_last_seen_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='outbox',
            index=models.Index(
                fields=['processed_at', 'created_at'],
                name='act_outbox_pending_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='outbox',
            index=models.Index(
                fields=['tenant_id', 'event_type'],
                name='act_outbox_tenant_type_idx',
            ),
        ),
        # Add additional indexes to ActivityEvent for better query performance
        migrations.AddIndex(
            model_name='activityevent',
            index=models.Index(
                fields=['tenant_id', 'actor_user_id', '-occurred_at'],
                name='act_ev_tnt_actor_occ_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='activityevent',
            index=models.Index(
                fields=['tenant_id', 'target_user_id', '-occurred_at'],
                name='act_ev_tnt_target_occ_idx',
            ),
        ),
    ]
