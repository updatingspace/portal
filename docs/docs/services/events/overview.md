---
sidebar_position: 1
title: Обзор Events
description: Сервис событий и календаря
---

# Events Service

**Events** — сервис для управления событиями, RSVP и посещаемостью.

- **Path**: `services/events`
- **Port**: 8005

## Функционал

| Feature | Статус | Описание |
|---------|--------|----------|
| Events CRUD | ✅ Production | Создание, обновление и отмена событий (`events.event.manage`) |
| RSVP | ✅ MVP | Interested/Going/Not Going |
| Attendance | ✅ MVP | Отметка посещения |
| Visibility | ✅ MVP | public/community/team/private |
| Outbox events | ✅ Done | event.created, event.rsvp.changed, event.updated |

## Типовые сценарии использования

### 1. Организатор планирует событие внутри tenant

1. Заполняет форму (title/starts_at/ends_at, описание, локация).
2. Указывает видимость (`public`/`community`/`team`/`private`).
3. Вызывает `POST /api/v1/events` через BFF (`/api/bff/events`).
4. Событие появляется в календаре и в ленте активности (через outbox `event.created`).

### 2. Участник планирует участие и подтверждает RSVP

1. Открывает список событий и фильтрует по дате/RSVP/видимости.
2. Открывает карточку события и выбирает RSVP.
3. Вызывает `POST /api/v1/events/{event_id}/rsvp`.
4. Счетчики RSVP обновляются, активность фиксируется как `event.rsvp.changed`.

### 3. Организатор отмечает посещаемость

1. После завершения события открывает карточку и подтверждает посещаемость.
2. Вызывает `POST /api/v1/events/{event_id}/attendance`.
3. Attendance используется для аналитики и отчетности.

### 4. Командные/комьюнити события

1. Создает событие с `scope_type=TEAM|COMMUNITY` и `scope_id`.
2. Visibility ограничивает аудиторию (team/community/private).
3. Список событий на фронтенде автоматически фильтруется по видимости.

### 5. Экспорт события в календарь

1. Пользователь нажимает «В календарь».
2. Фронтенд вызывает `GET /api/v1/events/{event_id}/ics` через BFF.
3. Генерируется `.ics` файл для Google/Apple/Outlook.

## Модели

### Event

```python
class EventScopeType(str, Enum):
    TENANT = "TENANT"
    COMMUNITY = "COMMUNITY"
    TEAM = "TEAM"


class EventVisibility(str, Enum):
    PUBLIC = "public"
    COMMUNITY = "community"
    TEAM = "team"
    PRIVATE = "private"


class Event(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_index=True)
    
    # Scope
    scope_type = models.CharField(max_length=20, default=EventScopeType.TENANT)
    scope_id = models.UUIDField(null=True)
    
    # Content
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Timing
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True)
    
    # Location
    location_text = models.CharField(max_length=255, blank=True)
    location_url = models.URLField(blank=True)  # Discord voice, etc.
    
    # Game reference
    game_id = models.UUIDField(null=True)
    
    visibility = models.CharField(max_length=20, default=EventVisibility.PUBLIC)
    
    created_by = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### RSVP

```python
class RSVPStatus(str, Enum):
    INTERESTED = "interested"
    GOING = "going"
    NOT_GOING = "not_going"


class RSVP(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    tenant_id = models.UUIDField()
    user_id = models.UUIDField()
    
    status = models.CharField(max_length=20)
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [["event", "user_id"]]
```

### Attendance

```python
class Attendance(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    tenant_id = models.UUIDField()
    user_id = models.UUIDField()
    
    marked_by = models.UUIDField()  # Кто отметил
    marked_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = [["event", "user_id"]]
```

## API Endpoints

### List Events

```http
GET /api/v1/events?from=2026-01-01&to=2026-01-31&scope_type=COMMUNITY&scope_id=xxx&limit=50&offset=0
```

Ответ возвращает `items` с событиями и `meta` с пагинацией.

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Game Night",
      "startsAt": "2026-01-15T19:00:00Z",
      "endsAt": "2026-01-15T22:00:00Z",
      "locationText": "Discord",
      "rsvpCounts": {
        "interested": 5,
        "going": 10,
        "notGoing": 2
      },
      "myRsvp": "going"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

`limit` / `offset` регулируют оконный вывод (максимум 250 записей за вызов). `rsvpCounts`
всегда содержит все три статуса, даже если их ноль, а `myRsvp` — текущий статус пользователя.

### Get Event

```http
GET /api/v1/events/{event_id}
```

### Create Event

```http
POST /api/v1/events
Content-Type: application/json

{
  "title": "Game Night",
  "description": "Играем в Minecraft",
  "starts_at": "2026-01-15T19:00:00Z",
  "ends_at": "2026-01-15T22:00:00Z",
  "scope_type": "COMMUNITY",
  "scope_id": "community-uuid",
  "visibility": "community",
  "location_text": "Discord Voice"
}
```

### Update Event

```http
PATCH /api/v1/events/{event_id}
Content-Type: application/json

{
  "title": "Game Night - Afterparty",
  "visibility": "community",
  "locationText": "Updated Discord Room",
  "locationUrl": "https://discord.gg/updspace"
}
```

Требуется `events.event.manage` (или системный администратор). Можно менять `title`, `description`, `starts_at`, `ends_at`,
`locationText`, `locationUrl`, `gameId` и `visibility`. Сервер возвращает обновлённый event c `rsvpCounts`/`myRsvp`.

### Set RSVP

```http
POST /api/v1/events/{event_id}/rsvp
Content-Type: application/json

{
  "status": "going"
}
```

### Mark Attendance (Admin)

```http
POST /api/v1/events/{event_id}/attendance
Content-Type: application/json

{
  "user_id": "uuid"
}
```

## Visibility Logic

```python
def filter_events_by_visibility(queryset, user_id, tenant_id):
    community_ids = get_user_communities(user_id, tenant_id)
    team_ids = get_user_teams(user_id, tenant_id)
    
    return queryset.filter(
        Q(visibility="public") |
        Q(visibility="community", scope_id__in=community_ids) |
        Q(visibility="team", scope_id__in=team_ids) |
        Q(visibility="private", created_by=user_id)
    )
```

## Outbox Events

### event.created

```json
{
  "event_type": "event.created",
  "tenant_id": "uuid",
  "event_id": "uuid",
  "title": "Game Night",
  "created_by": "uuid",
  "occurred_at": "2026-01-14T12:00:00Z"
}
```

### event.rsvp.changed

```json
{
  "event_type": "event.rsvp.changed",
  "tenant_id": "uuid",
  "event_id": "uuid",
  "user_id": "uuid",
  "status": "going",
  "occurred_at": "2026-01-14T12:00:00Z"
}
```

### event.updated

```json
{
  "event_type": "event.updated",
  "tenant_id": "uuid",
  "event_id": "uuid",
  "scope_type": "COMMUNITY",
  "scope_id": "community-uuid",
  "updated_fields": ["title", "visibility"],
  "updated_at": "2026-01-14T13:00:00Z"
}
```

## Permissions

| Action | Permission |
|--------|------------|
| Read events | `events.event.read` |
| Create events | `events.event.create` |
| Manage events | `events.event.manage` |
| Set RSVP | `events.rsvp.set` |
| Mark attendance | `events.attendance.mark` |

## Интеграции

### Portal (membership check)

Для проверки visibility Events вызывает Portal:

```python
async def is_community_member(user_id: UUID, community_id: UUID) -> bool:
    response = await portal_client.get(
        f"/communities/{community_id}/members/{user_id}"
    )
    return response.status_code == 200
```

### Activity (outbox)

Activity сервис полит outbox-таблицу Events для создания activity feed items.
