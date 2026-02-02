from __future__ import annotations

from django.db import migrations


def forwards(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")

    # Keep list inline to make migration stable.
    items = [
        ("portal.roles.read", "List roles for a service", "portal"),
        ("portal.roles.write", "Create/update roles for a service", "portal"),
        ("portal.role_bindings.write", "Create/delete role bindings", "portal"),
        ("portal.permissions.read", "List permission catalog", "portal"),
        ("voting.vote.cast", "Cast a vote", "voting"),
        ("voting.votings.admin", "Manage votings (admin)", "voting"),
        ("voting.nominations.admin", "Manage nominations (admin)", "voting"),
        ("voting.results.read", "Read voting results", "voting"),
        ("events.event.create", "Create an event", "events"),
        ("events.event.manage", "Manage events", "events"),
        ("activity.feed.read", "Read activity feed", "activity"),
    ]

    for key, description, service in items:
        Permission.objects.update_or_create(
            key=key,
            defaults={"description": description, "service": service},
        )


def backwards(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")
    keys = [
        "portal.roles.read",
        "portal.roles.write",
        "portal.role_bindings.write",
        "portal.permissions.read",
        "voting.vote.cast",
        "voting.votings.admin",
        "voting.nominations.admin",
        "voting.results.read",
        "events.event.create",
        "events.event.manage",
        "activity.feed.read",
    ]
    Permission.objects.filter(key__in=keys).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("access_control", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
