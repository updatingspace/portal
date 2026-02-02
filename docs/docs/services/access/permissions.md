---
sidebar_position: 3
title: Permissions
description: Список всех permissions платформы
---

# Permissions

## Формат

```
{service}.{resource}.{action}
```

Примеры:
- `portal.profile.read_self`
- `voting.vote.cast`
- `events.event.create`

## Portal Permissions

| Permission | Description | Roles |
|------------|-------------|-------|
| `portal.profile.read_self` | Читать свой профиль | member |
| `portal.profile.edit_self` | Редактировать свой профиль | member |
| `portal.applications.review` | Просматривать/одобрять заявки | admin |
| `portal.communities.read` | Читать сообщества | member |
| `portal.communities.members.read` | Проверять членство в сообществе | member |
| `portal.communities.manage` | Управлять сообществами | admin |
| `portal.teams.manage` | Управлять командами | moderator |
| `portal.teams.members.read` | Проверять членство в команде | member |
| `portal.posts.read` | Читать посты | member |
| `portal.posts.create` | Создавать посты | moderator |
| `portal.roles.read` | Просматривать роли | admin |
| `portal.roles.write` | Управлять ролями | admin |
| `portal.role_bindings.write` | Назначать роли | admin |
| `portal.permissions.read` | Читать каталог permissions | admin |

## Voting Permissions

| Permission | Description | Roles |
|------------|-------------|-------|
| `voting.poll.read` | Просматривать голосования | voter |
| `voting.vote.cast` | Голосовать | voter |
| `voting.results.read` | Просматривать результаты | voter |
| `voting.votings.admin` | Администрировать голосования | voting_admin |
| `voting.nominations.admin` | Администрировать номинации | voting_admin |

### Локальные роли опроса (Voting)

Сервис Voting вводит роли на уровне конкретного опроса (Owner/Admin/Moderator/Observer/Participant).
Это не Access permissions: они дополняют глобальные проверки и позволяют управлять
конкретным опросом даже без роли `voting_admin`.

## Events Permissions

| Permission | Description | Roles |
|------------|-------------|-------|
| `events.event.read` | Просматривать события | participant |
| `events.event.create` | Создавать события | organizer |
| `events.event.manage` | Редактировать/удалять события | organizer |
| `events.rsvp.set` | Отмечать участие | participant |
| `events.attendance.mark` | Отмечать посещение | organizer |

## System Administrator RBAC

`system_admin=true` (мастер-флаг из UpdSpaceID) — это единственный identity, который имеет
полный доступ к tenant-порталу без дополнительной проверки.

- Может создавать/редактировать роли и role bindings для любых тенантов через Access API (`POST /api/v1/role-bindings`,
  `PATCH /api/v1/role-bindings/{id}` и т.д.).
- Может назначать `events:organizer` и `events:participant`, а также другие роли, которые разрешают
  создание/управление событиями и RSVP.
- Обновлённое API Events (`PATCH /api/v1/events/{event_id}` + `events.event.manage`) требует именно
  эту permission или системного администратора, поэтому администратор системы всегда может отредактировать
  или отменить событие и сразу увидеть изменения в журнале.

Audit logging все ещё обязателен: Access сохраняет, кто и когда выполнил действие с `system_admin`.

## Activity Permissions

| Permission | Description | Roles |
|------------|-------------|-------|
| `activity.feed.read` | Читать ленту | member |
| `activity.sources.link` | Подключать источники | member |
| `activity.sources.manage` | Управлять источниками | admin |
| `activity.admin.sync` | Запускать синхронизацию | admin |
| `activity.admin.games` | Управлять каталогом игр | admin |

## Role Templates

### Для всех tenant'ов

#### member
```python
MEMBER_PERMISSIONS = [
    "portal.profile.read_self",
    "portal.profile.edit_self",
    "portal.communities.read",
    "portal.communities.members.read",
    "portal.teams.members.read",
    "portal.posts.read",
    "voting.poll.read",
    "voting.vote.cast",
    "voting.results.read",
    "events.event.read",
    "events.rsvp.set",
    "activity.feed.read",
    "activity.sources.link",
]
```

#### moderator
```python
MODERATOR_PERMISSIONS = MEMBER_PERMISSIONS + [
    "portal.teams.manage",
    "portal.posts.create",
]
```

#### admin
```python
ADMIN_PERMISSIONS = MODERATOR_PERMISSIONS + [
    "portal.applications.review",
    "portal.communities.manage",
    "portal.roles.read",
    "portal.roles.write",
    "portal.role_bindings.write",
    "portal.permissions.read",
    "voting.votings.admin",
    "voting.nominations.admin",
    "events.event.create",
    "events.event.manage",
    "events.attendance.mark",
    "activity.sources.manage",
]
```

## Seed Script

```python
# access/management/commands/seed_permissions.py

PERMISSIONS = [
    # Portal
    ("portal.profile.read_self", "Read own profile", "PORTAL"),
    ("portal.profile.edit_self", "Edit own profile", "PORTAL"),
    ("portal.applications.review", "Review applications", "PORTAL"),
    ("portal.communities.read", "Read communities", "PORTAL"),
    ("portal.communities.manage", "Manage communities", "PORTAL"),
    ("portal.teams.manage", "Manage teams", "PORTAL"),
    ("portal.posts.read", "Read posts", "PORTAL"),
    ("portal.posts.create", "Create posts", "PORTAL"),
    ("portal.roles.read", "Read roles", "PORTAL"),
    ("portal.roles.write", "Write roles", "PORTAL"),
    ("portal.role_bindings.write", "Assign roles", "PORTAL"),
    ("portal.permissions.read", "Read permission catalog", "PORTAL"),
    
    # Voting
    ("voting.poll.read", "Read polls", "VOTING"),
    ("voting.vote.cast", "Cast vote", "VOTING"),
    ("voting.results.read", "Read results", "VOTING"),
    ("voting.votings.admin", "Admin votings", "VOTING"),
    ("voting.nominations.admin", "Admin nominations", "VOTING"),
    
    # Events
    ("events.event.read", "Read events", "EVENTS"),
    ("events.event.create", "Create events", "EVENTS"),
    ("events.event.manage", "Manage events", "EVENTS"),
    ("events.rsvp.set", "Set RSVP", "EVENTS"),
    ("events.attendance.mark", "Mark attendance", "EVENTS"),
    
    # Activity
    ("activity.feed.read", "Read feed", "ACTIVITY"),
    ("activity.sources.link", "Link sources", "ACTIVITY"),
    ("activity.sources.manage", "Manage sources", "ACTIVITY"),
]

def seed():
    for key, description, service in PERMISSIONS:
        Permission.objects.update_or_create(
            key=key,
            defaults={"description": description, "service": service}
        )
```

## Проверка в коде

### Декоратор

```python
from access.decorators import require_permission

@require_permission("portal.posts.create")
def create_post(request, data):
    ...
```

### Явная проверка

```python
from access.client import check_permission

if not await check_permission(request, "voting.vote.cast", scope):
    raise PermissionDenied("You cannot vote in this poll")
```

## Расширение

Для добавления нового permission:

1. Добавить в PERMISSIONS list
2. Запустить `python manage.py seed_permissions`
3. Добавить в соответствующую роль
4. Использовать в сервисе

```python
# 1. В permissions_mvp.py
("voting.poll.delete", "Delete polls", "VOTING"),

# 2. Seed
python manage.py seed_permissions

# 3. В роль
Role.objects.get(name="voting_admin").permissions.add(
    Permission.objects.get(key="voting.poll.delete")
)

# 4. В сервисе
@require_permission("voting.poll.delete")
def delete_poll(request, poll_id):
    ...
```
