---
sidebar_position: 1
title: Обзор Portal
description: Сервис сообществ, команд и постов
---

# Portal Core Service

**Portal Core** — сервис для управления сообществами, командами, профилями и постами.

- **Path**: `services/portal`
- **Port**: 8003

## Функционал

| Feature | Статус | Описание |
|---------|--------|----------|
| Profiles | ✅ MVP | Профили пользователей в tenant |
| Communities | ✅ MVP | CRUD сообществ |
| Teams | ✅ MVP | Команды внутри сообществ |
| Posts | ✅ MVP | Посты с visibility |
| Modules navigation | ✅ Done | Список доступных модулей |

## Модели

### PortalProfile

```python
class PortalProfile(models.Model):
    tenant_id = models.UUIDField()
    user_id = models.UUIDField()
    
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [["tenant_id", "user_id"]]
```

### Community

```python
class Community(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField()
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    created_by = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### Team

```python
class Team(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField()
    community_id = models.UUIDField()
    
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, default="active")
    # Values: active, archived
    
    created_by = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### Post

```python
class Post(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField()
    
    community_id = models.UUIDField(null=True)
    team_id = models.UUIDField(null=True)
    
    title = models.CharField(max_length=255)
    body = models.TextField()
    
    visibility = models.CharField(max_length=20, default="public")
    # Values: public, community, team, private
    
    created_by = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
```

## API Endpoints

### Profile

```http
GET /api/v1/portal/me
```
Возвращает профиль текущего пользователя.

```http
PATCH /api/v1/portal/me
Content-Type: application/json

{
  "first_name": "Иван",
  "last_name": "Иванов",
  "bio": "Люблю игры"
}
```

```http
GET /api/v1/portal/profiles?q=alex&limit=200
```
Список профилей внутри tenant (используется Tenant Admin UI). Требует `portal.roles.read`.

### Communities

```http
GET /api/v1/communities
```

```http
POST /api/v1/communities
Content-Type: application/json

{
  "name": "Gamers",
  "description": "Сообщество геймеров"
}
```

### Membership Checks

```
GET /api/v1/communities/{community_id}/members/{user_id}
GET /api/v1/teams/{team_id}/members/{user_id}
```

Ответ:

```json
{
  "member": true,
  "roleHint": "member"
}
```

Запросы требуют permissions `portal.communities.members.read` / `portal.teams.members.read` и используются другими сервисами (Events) для проверки доступа к visibility `community` / `team`.

### Teams

```http
GET /api/v1/teams?community_id=xxx
```

```http
POST /api/v1/teams
Content-Type: application/json

{
  "community_id": "uuid",
  "name": "Team Alpha"
}
```

### Posts

```http
GET /api/v1/posts?scope_type=community&scope_id=xxx
```

Фильтрация по visibility происходит автоматически на основе членства.

### Modules

```http
GET /api/v1/modules
```

```json
{
  "modules": [
    {"id": "voting", "enabled": true, "label": "Голосования"},
    {"id": "events", "enabled": true, "label": "События"},
    {"id": "activity", "enabled": true, "label": "Активность"}
  ]
}
```

## Visibility Logic

```python
def filter_by_visibility(queryset, user_id, tenant_id):
    """Фильтрует посты по видимости для пользователя"""
    
    # Получаем членства пользователя
    community_ids = get_user_communities(user_id, tenant_id)
    team_ids = get_user_teams(user_id, tenant_id)
    
    return queryset.filter(
        Q(visibility="public") |
        Q(visibility="community", community_id__in=community_ids) |
        Q(visibility="team", team_id__in=team_ids) |
        Q(visibility="private", created_by=user_id)
    )
```

## Permissions

| Action | Permission |
|--------|------------|
| Read profile | `portal.profile.read_self` |
| Edit profile | `portal.profile.edit_self` |
| Read communities | `portal.communities.read` |
| Manage communities | `portal.communities.manage` |
| Manage teams | `portal.teams.manage` |
| Read posts | `portal.posts.read` |
| Create posts | `portal.posts.create` |
