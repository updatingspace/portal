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

### GET /feed/unread-count/long-poll

Long-poll для real-time обновлений непрочитанных.

> В текущем UI long-poll не используется. Предпочитаем polling через `GET /feed/unread-count`.

**Permissions**: `activity.feed.read`

**Query**:

- `last` — последний известный счётчик (опционально)
- `timeout` — ожидание в секундах (1..30, по умолчанию 25)

**Response** `200 OK`:

```json
{
  "count": 5,
  "changed": true,
  "waited_ms": 1200,
  "server_time": "2026-01-15T12:00:00Z"
}
```

**Пример клиента**:

```javascript
let last = undefined;

async function pollUnread() {
  const query = new URLSearchParams();
  if (typeof last === 'number') query.set('last', String(last));
  query.set('timeout', '25');

  const resp = await fetch(`/api/activity/feed/unread-count/long-poll?${query.toString()}`);
  const data = await resp.json();

  last = data.count;
  if (data.changed) {
    updateBadge(data.count);
  }

  pollUnread();
}

pollUnread();
```

---

## News Endpoints

### POST /news/media/upload-url

Получить pre-signed URL для загрузки изображения (S3, private bucket).

**Permissions**: `activity.news.create`

**Request**:

```json
{
  "filename": "screenshot.png",
  "content_type": "image/png",
  "size_bytes": 123456
}
```

**Response** `200 OK`:

```json
{
  "key": "news/<tenant>/<uuid>-screenshot.png",
  "upload_url": "https://s3...signed",
  "upload_headers": {
    "Content-Type": "image/png"
  },
  "expires_in": 900
}
```

---

### POST /news

Создание новости, которая попадает в Activity Feed как `news.posted`.

**Permissions**: `activity.news.create`

**Request**:

```json
{
  "title": "Обновление сервера",
  "body": "Мы выкатили патч...",
  "tags": ["patch", "servers"],
  "visibility": "public",
  "scope_type": "TENANT",
  "scope_id": "tenant_uuid",
  "media": [
    {
      "type": "image",
      "key": "news/<tenant>/<uuid>-screenshot.png",
      "content_type": "image/png",
      "size_bytes": 123456,
      "width": 1280,
      "height": 720
    },
    {
      "type": "youtube",
      "url": "https://youtu.be/abc123",
      "video_id": "abc123",
      "title": "Trailer"
    }
  ]
}
```

**Response** `200 OK`:

```json
{
  "id": 100,
  "type": "news.posted",
  "title": "Обновление сервера",
  "payload_json": {
    "title": "Обновление сервера",
    "body": "Мы выкатили патч...",
    "tags": ["patch", "servers"],
    "media": [
      {
        "type": "image",
        "key": "news/<tenant>/<uuid>-screenshot.png",
        "url": "https://s3...signed"
      }
    ]
  }
}
```

---

### PATCH /news/{news_id}

Обновить новость.

**Permissions**: `activity.news.manage` (или автор новости)

**Request**:

```json
{
  "title": "Обновление сервера",
  "body": "Мы обновили сервер.",
  "tags": ["patch"],
  "visibility": "public",
  "media": [
    {
      "type": "image",
      "key": "news/<tenant>/<uuid>-screenshot.png",
      "content_type": "image/png",
      "size_bytes": 123456
    }
  ]
}
```

**Response** `200 OK`: `ActivityEventOut`

---

### DELETE /news/{news_id}

Удалить новость.

**Permissions**: `activity.news.manage` (или автор новости)

**Response** `204 No Content`

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

### POST /news/{news_id}/reactions

Добавить/убрать реакцию (как в Telegram).

**Permissions**: `activity.feed.read`

**Request**:

```json
{
  "emoji": "🔥",
  "action": "add"
}
```

**Response** `200 OK`:

```json
[
  { "emoji": "🔥", "count": 3 },
  { "emoji": "👍", "count": 1 }
]
```

---

### GET /news/{news_id}/comments

Список комментариев.

**Permissions**: `activity.feed.read`

**Query**:

- `limit` (default 50, max 100)

**Response** `200 OK`:

```json
[
  {
    "id": 1,
    "user_id": "uuid",
    "body": "Круто!",
    "created_at": "2026-02-03T12:00:00Z"
  }
]
```

---

### POST /news/{news_id}/comments

Добавить комментарий.

**Permissions**: `activity.feed.read`

**Request**:

```json
{ "body": "Круто!" }
```

**Response** `200 OK`:

```json
{
  "id": 1,
  "user_id": "uuid",
  "body": "Круто!",
  "created_at": "2026-02-03T12:00:00Z"
}
```

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

### GET /subscriptions

Получить подписки пользователя на события.

**Permissions**: `activity.feed.read`

**Response** `200 OK`:

```json
{
  "items": [
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
  ]
}
```

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
| `activity.news.create` | Создание новостей |
| `activity.news.manage` | Управление новостями |
| `activity.admin.sync` | Запуск синхронизации |
| `activity.admin.games` | Управление каталогом игр |
