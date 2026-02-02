---
sidebar_position: 3
title: API Reference
description: Полный справочник API Activity сервиса
---

# Activity Service API Reference

Полная спецификация REST API для Activity сервиса.

**Base URL**: `http://activity:8006/api/v1`  
**Via BFF**: `https://{tenant}.updspace.com/api/activity`

## Аутентификация

Все запросы к Activity сервису проходят через BFF с HMAC-подписью.

### Обязательные заголовки

| Header | Description |
|--------|-------------|
| `X-Tenant-Id` | UUID тенанта |
| `X-Tenant-Slug` | Slug тенанта (например, `aef`) |
| `X-Request-Id` | UUID запроса для трассировки |
| `X-User-Id` | UUID пользователя (для авторизованных запросов) |
| `X-Updspace-Timestamp` | Unix timestamp |
| `X-Updspace-Signature` | HMAC-SHA256 подпись |

### Опциональные заголовки

| Header | Description |
|--------|-------------|
| `X-Master-Flags` | Флаги пользователя (`suspended`, `banned`, `platform_admin`) |
| `X-Preferred-Language` | Предпочитаемый язык (`en`, `ru`) |
| `Accept-Language` | Fallback для языка |

---

## Feed Endpoints

### GET /feed

Получить ленту активности пользователя.

**Permissions**: `activity.feed.read`

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | datetime | - | Фильтр: события после этой даты (ISO 8601) |
| `to` | datetime | - | Фильтр: события до этой даты (ISO 8601) |
| `types` | string | - | Фильтр: типы событий через запятую |
| `scope_type` | string | - | Фильтр: тип scope (`tenant`, `COMMUNITY`, `TEAM`) |
| `scope_id` | string | - | Фильтр: ID scope |
| `limit` | integer | 100 | Максимум событий (1-200) |

**Response** `200 OK`:

```json
{
  "items": [
    {
      "id": 123,
      "tenant_id": "uuid",
      "actor_user_id": "uuid",
      "target_user_id": null,
      "type": "vote.cast",
      "occurred_at": "2026-01-15T12:00:00Z",
      "title": "Проголосовал в 'Лучшая игра 2025'",
      "payload_json": {
        "poll_id": 456,
        "poll_title": "Лучшая игра 2025",
        "nomination_title": "Best RPG"
      },
      "visibility": "community",
      "scope_type": "COMMUNITY",
      "scope_id": "community-uuid",
      "source_ref": "voting:poll:456"
    }
  ]
}
```

---

### GET /v2/feed

Получить ленту с курсорной пагинацией.

**Permissions**: `activity.feed.read`

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | datetime | - | Фильтр: события после этой даты |
| `to` | datetime | - | Фильтр: события до этой даты |
| `types` | string | - | Типы событий через запятую |
| `scope_type` | string | - | Тип scope |
| `scope_id` | string | - | ID scope |
| `limit` | integer | 50 | Максимум событий (1-100) |
| `cursor` | string | - | Курсор для следующей страницы |

**Response** `200 OK`:

```json
{
  "items": [...],
  "next_cursor": "MjAyNi0wMS0xNVQxMjowMDowMFo6MTIz",
  "has_more": true
}
```

**Пагинация**:

```javascript
// Первый запрос
const page1 = await fetch('/api/activity/v2/feed?limit=50');
const data1 = await page1.json();

// Следующая страница
if (data1.has_more) {
  const page2 = await fetch(`/api/activity/v2/feed?limit=50&cursor=${data1.next_cursor}`);
}
```

---

### GET /feed/unread-count

Получить количество непрочитанных событий.

**Permissions**: `activity.feed.read`

**Response** `200 OK`:

```json
{
  "count": 5
}
```

**Caching**: Результат кешируется на 30 секунд.

---

### GET /feed/sse

Server-Sent Events для real-time обновлений непрочитанных.

**Permissions**: `activity.admin.sync` (только Platform Admin)

**Response**: `text/event-stream`

```
event: unread
data: {"count": 5, "timestamp": "2026-01-15T12:00:00Z"}

: heartbeat

event: close
data: {"reason": "max_duration", "message": "Please reconnect"}
```

**События**:

| Event | Description |
|-------|-------------|
| `unread` | Обновление счетчика непрочитанных |
| `heartbeat` | Keep-alive (каждые 30 сек) |
| `close` | Закрытие соединения (переподключитесь) |
| `error` | Ошибка |

**Пример клиента**:

```javascript
const eventSource = new EventSource('/api/activity/feed/sse');

eventSource.addEventListener('unread', (e) => {
  const data = JSON.parse(e.data);
  updateBadge(data.count);
});

eventSource.addEventListener('close', (e) => {
  eventSource.close();
  // Переподключение через 1 сек
  setTimeout(() => connectSSE(), 1000);
});
```

---

## Games Endpoints

### GET /games

Список игр в каталоге тенанта.

**Permissions**: `activity.feed.read`

**Response** `200 OK`:

```json
[
  {
    "id": 1,
    "tenant_id": "uuid",
    "name": "Team Fortress 2",
    "tags_json": {
      "steam_app_id": "440",
      "genres": ["FPS", "Free-to-Play"]
    }
  }
]
```

---

### POST /games

Создать игру в каталоге (admin).

**Permissions**: `activity.admin.games`

**Request Body**:

```json
{
  "name": "Cyberpunk 2077",
  "tags_json": {
    "steam_app_id": "1091500",
    "genres": ["RPG", "Open World"]
  }
}
```

**Response** `200 OK`: Созданная игра

---

## Sources Endpoints

### GET /sources

Список доступных источников данных.

**Permissions**: `activity.feed.read`

**Response** `200 OK`:

```json
[
  {
    "id": 1,
    "tenant_id": "uuid",
    "type": "steam"
  },
  {
    "id": 2,
    "tenant_id": "uuid",
    "type": "minecraft"
  }
]
```

---

## Account Links Endpoints

### POST /account-links

Привязать внешний аккаунт к пользователю.

**Permissions**: `activity.sources.link`

**Request Body**:

```json
{
  "source_id": 1,
  "status": "active",
  "settings_json": {
    "steam_id": "76561198012345678"
  },
  "external_identity_ref": "uuid"
}
```

**Response** `200 OK`:

```json
{
  "id": 123,
  "tenant_id": "uuid",
  "user_id": "uuid",
  "source_id": 1,
  "status": "active",
  "settings_json": {
    "steam_id": "76561198012345678"
  },
  "external_identity_ref": "uuid"
}
```

---

## Subscriptions Endpoints

### POST /subscriptions

Создать/обновить подписки пользователя на события.

**Permissions**: `activity.feed.read`

**Request Body**:

```json
{
  "scopes": [
    {"scope_type": "tenant", "scope_id": "tenant-uuid"},
    {"scope_type": "COMMUNITY", "scope_id": "community-uuid"}
  ]
}
```

**Response** `200 OK`:

```json
{
  "id": 456,
  "tenant_id": "uuid",
  "user_id": "uuid",
  "rules_json": {
    "scopes": [
      {"scope_type": "tenant", "scope_id": "tenant-uuid"},
      {"scope_type": "COMMUNITY", "scope_id": "community-uuid"}
    ]
  }
}
```

---

## Sync Endpoints

### POST /sync/run

Запустить синхронизацию для привязки (admin/debug).

**Permissions**: `activity.admin.sync`

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_link_id` | integer | Yes | ID привязки аккаунта |

**Response** `200 OK`:

```json
{
  "ok": true,
  "raw_created": 15,
  "raw_deduped": 3,
  "activity_created": 12
}
```

---

## Webhook Endpoints

### POST /ingest/webhook/minecraft

Принять webhook от Minecraft сервера.

**Authentication**: HMAC-SHA256 подпись

**Headers**:

| Header | Description |
|--------|-------------|
| `X-Signature` | `sha256={hmac}` подпись body |

**Request Body**:

```json
{
  "type": "event.created",
  "event_id": "unique-event-id",
  "title": "Player joined",
  "scope_type": "COMMUNITY",
  "scope_id": "community-uuid",
  "occurred_at": "2026-01-15T12:00:00Z",
  "linked_user_id": "user-uuid"
}
```

**Response** `200 OK`:

```json
{
  "ok": true,
  "raw_created": 1,
  "raw_deduped": 0,
  "activity_created": 1
}
```

---

## Health Endpoints

### GET /health

Liveness probe.

**Response** `200 OK`:

```json
{
  "status": "ok",
  "service": "activity",
  "timestamp": "2026-01-15T12:00:00Z"
}
```

---

### GET /readiness

Readiness probe с проверкой зависимостей.

**Response** `200 OK` / `503 Service Unavailable`:

```json
{
  "status": "ok",
  "service": "activity",
  "timestamp": "2026-01-15T12:00:00Z",
  "checks": [
    {
      "name": "database",
      "status": "ok",
      "latency_ms": 2.5,
      "message": "Database connection OK",
      "details": {
        "pending_outbox_events": 0
      }
    },
    {
      "name": "access_service",
      "status": "ok",
      "latency_ms": 15.3,
      "message": "Access service reachable"
    }
  ]
}
```

---

### GET /metrics

Prometheus-style метрики (JSON).

**Response** `200 OK`:

```json
{
  "activity_events_total": 12345,
  "raw_events_total": 15000,
  "account_links_total": 150,
  "outbox_pending": 0,
  "outbox_failed": 0,
  "timestamp": "2026-01-15T12:00:00Z"
}
```

---

## Error Responses

Все ошибки возвращаются в стандартном формате:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "request_id": "uuid"
  }
}
```

### Коды ошибок

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Требуется аутентификация |
| `ACCESS_DENIED` | 403 | Нет прав доступа |
| `SUSPENDED_USER` | 403 | Аккаунт заблокирован |
| `ADMIN_ONLY` | 403 | Только для администраторов |
| `INVALID_CURSOR` | 400 | Некорректный курсор пагинации |
| `INVALID_EVENT_TYPES` | 400 | Неподдерживаемые типы событий |
| `INVALID_FROM` | 400 | Некорректный формат даты `from` |
| `INVALID_TO` | 400 | Некорректный формат даты `to` |
| `SOURCE_NOT_FOUND` | 404 | Источник не найден |
| `INTERNAL_ERROR` | 500 | Внутренняя ошибка |

---

## Event Types

### MVP Event Types

| Type | Source | Description |
|------|--------|-------------|
| `vote.cast` | Voting | Пользователь проголосовал |
| `event.created` | Events | Создано событие |
| `event.rsvp.changed` | Events | Изменен RSVP |
| `post.created` | Portal | Создан пост |

### Connector Event Types (Phase 2)

| Type | Source | Description |
|------|--------|-------------|
| `game.achievement` | Steam | Получено достижение |
| `game.playtime` | Steam | Время игры обновлено |
| `steam.private` | Steam | Профиль приватный |
| `minecraft.session` | Minecraft | Сессия игры |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `GET /feed` | 100 | 1 min |
| `GET /v2/feed` | 100 | 1 min |
| `GET /feed/unread-count` | 60 | 1 min |
| `POST /sync/run` | 10 | 1 min |
| `POST /ingest/webhook/*` | 1000 | 1 min |

---

## Permissions

| Permission | Description |
|------------|-------------|
| `activity.feed.read` | Чтение ленты активности |
| `activity.sources.link` | Привязка внешних аккаунтов |
| `activity.sources.manage` | Управление источниками |
| `activity.admin.sync` | Запуск синхронизации |
| `activity.admin.games` | Управление каталогом игр |
