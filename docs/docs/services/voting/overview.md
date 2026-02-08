---
sidebar_position: 1
title: Обзор Voting
description: Сервис голосований
---

# Voting Service

**Voting** — сервис для проведения голосований с номинациями и опциями.

- **Path**: `services/voting`
- **Port**: 8004

## Функционал

| Feature | Статус | Описание |
|---------|--------|----------|
| Polls Read | ✅ MVP | Листинг/детали опросов |
| Polls CRUD (self-service) | ✅ Implemented | Полноценные `POST/PUT/DELETE /polls` для управления опросами |
| Questions/Options CRUD | ✅ Implemented | `POST/PUT/DELETE` для вопросов и вариантов в рамках опроса |
| Voting | ✅ MVP | Подача голоса (анти-дубликат) |
| Multi-vote + revote | ✅ Implemented | `max_votes`, `allow_revoting`, удаление голосов |
| Results | ✅ MVP | Подсчёт результатов |
| Results visibility | ✅ Implemented | `results_visibility` контролирует доступ к `/results` |
| Poll roles | ✅ Implemented | Локальные роли и приглашения (`PollParticipant`, `PollInvite`) |
| Templates | ✅ Implemented | Шаблоны/конструктор задают стартовые вопросы и настройки |
| Outbox events | ✅ MVP | `vote.cast` события |
| Outbox publisher | ✅ Implemented | Management command для публикации событий |
| Rate limiting | ✅ Implemented | In-memory throttling на vote endpoints |
| Structured logging | ✅ Implemented | JSON logging с correlation IDs |
| Health checks | ✅ Implemented | Liveness, readiness, detailed endpoints |
| Security headers | ✅ Implemented | CORS, CSRF, HSTS, X-Frame-Options |
| Legacy (aef-vote) | ✅ Done | Миграция с legacy |
| Portal Voting UX/UI v2 | ✅ Implemented | Единый `/app/voting/*` flow, Gravity-first, adaptive, A11Y |

## Сценарии использования (Portal / Tenant)

### 1. Организатор запускает опрос для всего тенанта

1. В портале открыть **Голосования → Создать опрос**.
2. Выбрать шаблон или пустой опрос.
3. Задать название, видимость `public`, параметры результатов и расписание.
4. Добавить вопросы и варианты ответа.
5. Опубликовать опрос — после этого вопросы блокируются, начинается сбор голосов.

### 2. Приватный опрос для команды или сообщества

1. Создать опрос с `visibility=private` и указать `scope_type` (TEAM/COMMUNITY).
2. Перейти в управление → вкладка **Участники** и добавить нужных пользователей.
3. Опубликовать опрос и уведомить участников ссылкой.

### 3. Пользователь голосует в активном опросе

1. Открыть опрос из списка активных.
2. Выбрать варианты в каждом вопросе (сразу сохраняется).
3. При включённом `allow_revoting` пользователь может снять выбор и переголосовать.

### 4. Подведение итогов и результаты

1. Администратор закрывает опрос вручную или по расписанию.
2. Результаты становятся видимыми согласно `results_visibility`.
3. Участники смотрят результаты через страницу **Результаты**, администратор — через **Аналитику**.

### 5. Быстрый старт по шаблону

1. Открыть раздел **Шаблоны** и выбрать подходящий сценарий.
2. Проверить предустановленные вопросы и настройки.
3. Создать опрос и сразу перейти к добавлению вариантов.

## Архитектура

Два модуля:
- **`voting/`** — Legacy AEF-Vote (single-tenant)
- **`tenant_voting/`** — Новая multi-tenant архитектура

## Реформирование (обязательное ТЗ)

Ниже зафиксированы решения, принятые к реализации. Часть требований ещё не реализована
в коде и должна быть выполнена в обязательном порядке.

### Цели

- Перейти от жёстких номинаций к гибким опросам с шаблонами и настройками.
- Дать пользователям возможность создавать и управлять опросами самостоятельно.
- Ввести роли на уровне опроса и гибкие правила видимости/результатов.
- Обеспечить multi-tenant корректность, безопасность, тесты и прод-готовность.

### Принятые решения

- Ядро данных сохраняется: `Poll → Nomination → Option`, но в UI терминология
  «вопрос» вместо «номинации».
- Шаблоны опросов (первые версии): `single`, `multi`, `schedule`, `awards`, `anonymous`.
- Настройки опроса на уровне `Poll`: `allow_revoting`, `anonymous`,
  `results_visibility` (`always|after_closed|admins_only`), `template`.
- `max_votes` на уровне вопроса определяет множественный выбор; лимиты
  контролируются сервисом (без жёсткого уникального ограничения в БД).
- `visibility=private` поддерживает явные приглашения через локальные роли.
- Глобальные Access permissions остаются обязательными; локальные роли
  дополняют их для конкретного опроса.

### Роли опроса (локальные)

- Owner: создатель опроса, полный контроль, назначает роли.
- Admin: управление опросом и вопросами, без удаления опроса.
- Moderator: редактирование текстов и вариантов без изменения правил/статуса.
- Observer: просмотр опроса и результатов до закрытия.
- Participant: голосование, результаты после закрытия (по правилам видимости).

### Статус реализации

- ✅ Реализовано: оператор `GET /polls` + `/polls/{id}`, `POST/PUT/DELETE /polls`, работа с
  шаблонами и локальными ролями, `POST/PUT/DELETE` для вопросов и вариантов, `multi-vote`
  и `revote`, флаги `results_visibility`, расширенные outbox-события.
- ✅ Production-ready: rate limiting, structured logging, health checks, security headers,
  outbox publisher command, pagination на list endpoints.
- ✅ Реализовано: frontend интеграция `modules/voting` с новым API, feature-flag rollout
  (`voting_ui_v2`), удаление legacy voting pages/redirects.

## Frontend Voting UX/UI v2

`web/portal-frontend/src/modules/voting` использует единый state model и канонические маршруты:

- `/app/voting` — список опросов, фильтры, поиск, RBAC CTA.
- `/app/voting/create` — wizard-поток создания (template/blank).
- `/app/voting/:id` — ballot experience для участника.
- `/app/voting/:id/manage` — workspace организатора (settings/questions/participants).
- `/app/voting/:id/results` — результаты с учётом visibility policy.
- `/app/voting/analytics` — агрегированная аналитика закрытых опросов.
- `/app/voting/templates` — каталог шаблонов и handoff в create flow.

Ключевые frontend-правила v2:

- Только `Frontend -> BFF (/api/v1)`, без прямых вызовов сервисов.
- Единые state-компоненты: `loading`, `empty`, `error`, `forbidden`, `rate-limit`.
- Destructive actions только через managed dialogs (`VotingConfirmDialog`).
- Без `window.confirm` и `window.location.reload` в voting flow.
- Theme modes: `light | dark | system` (с `resolvedMode`).
- A11Y baseline: keyboard-first interactions, `aria-live` state cards, focus-visible, meter semantics.
- Legacy voting pages удалены, legacy routes заменены безопасными redirect/fallback.

### Frontend test contour

Интеграционные сценарии v2 находятся в `web/portal-frontend/src/modules/voting/pages/*.integration.test.tsx`:

- `PollsPage` — list states, filters/search, RBAC CTA.
- `PollCreatePage` — template/blank path, create handoff в manage.
- `PollManagePage` — settings/questions workflow, publish checklist, confirm dialogs.
- `PollPage` — vote/revoke/max-limit/rate-limit.
- `PollResultsPage` — hidden/available results, retry without reload.
- `AnalyticsDashboardPage` — metrics, empty/error states.
- `PollTemplatesPage` — template catalog и navigation handoff.
- `VotingA11y` — keyboard-only path + `aria-live` regression checks.

### API расширения

- `POST /api/v1/polls` — создание опросов с описанием, датами и набором вопросов (вложенные
  nominations/options поддерживаются в теле).
- `PUT /api/v1/polls/{id}` и `DELETE /api/v1/polls/{id}` — управление метаданными, перевод
  в активное/закрытое состояние и удаление черновиков (активные опросы нельзя удалить).
- `POST/PUT/DELETE /polls/{id}/nominations` и `/polls/{id}/options/{id}` — CRUD вопросов и
  вариантов, доступно только в статусе Draft, пока не зарегистрированы голоса.

## Модели (tenant_voting)

Ниже приведена MVP-структура. Целевая модель реформирования с новыми полями
и ролями описана в `documentation/docs/services/voting/models.md`.

### Poll

```python
class PollStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"


class PollScopeType(str, Enum):
    TENANT = "TENANT"
    COMMUNITY = "COMMUNITY"
    TEAM = "TEAM"
    EVENT = "EVENT"
    POST = "POST"


class PollVisibility(str, Enum):
    PUBLIC = "public"
    COMMUNITY = "community"
    TEAM = "team"
    PRIVATE = "private"


class Poll(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_index=True)
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    status = models.CharField(max_length=20, default=PollStatus.DRAFT)
    
    scope_type = models.CharField(max_length=20, default=PollScopeType.TENANT)
    scope_id = models.UUIDField(null=True)
    
    visibility = models.CharField(max_length=20, default=PollVisibility.PUBLIC)
    
    starts_at = models.DateTimeField(null=True)
    ends_at = models.DateTimeField(null=True)
    
    created_by = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### Nomination

```python
class Nomination(models.Model):
    id = models.UUIDField(primary_key=True)
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE)
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)
    
    # Сколько опций можно выбрать
    max_votes = models.IntegerField(default=1)
```

### Option

```python
class Option(models.Model):
    id = models.UUIDField(primary_key=True)
    nomination = models.ForeignKey(Nomination, on_delete=models.CASCADE)
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    media_url = models.URLField(blank=True)
    sort_order = models.IntegerField(default=0)
```

### Vote

```python
class Vote(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField()
    
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE)
    nomination = models.ForeignKey(Nomination, on_delete=models.CASCADE)
    option = models.ForeignKey(Option, on_delete=models.CASCADE)
    
    user_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "poll_id", "nomination_id", "user_id"],
                name="unique_vote"
            )
        ]
```

## API Endpoints

### Polls

```http
GET /api/v1/polls?scope_type=TENANT&limit=20&offset=0&status=active
```

Query parameters:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `scope_type` | string | `TENANT` | Фильтр по типу scope |
| `scope_id` | string | tenant_id | Фильтр по ID scope |
| `status` | string | - | Фильтр по статусу (`draft`, `active`, `closed`) |
| `limit` | int | 20 | Количество результатов (1-100) |
| `offset` | int | 0 | Смещение для пагинации |

Response (paginated):
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Лучшие игры 2025",
      "status": "active",
      "visibility": "public",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "has_next": true,
    "has_prev": false
  }
}
```

```http
GET /api/v1/polls/{poll_id}
```

Response:
```json
{
  "id": "uuid",
  "title": "Лучшие игры 2025",
  "status": "active",
  "nominations": [
    {
      "id": "uuid",
      "title": "Лучшая игра года",
      "options": [
        {"id": "uuid", "title": "Game A"},
        {"id": "uuid", "title": "Game B"}
      ]
    }
  ],
  "ends_at": "2026-01-31T23:59:59Z"
}
```

### Vote

```http
POST /api/v1/votes
Content-Type: application/json

{
  "poll_id": "uuid",
  "nomination_id": "uuid",
  "option_id": "uuid"
}
```

**Success 201:**
```json
{
  "vote_id": "uuid",
  "created_at": "2026-01-14T12:00:00Z"
}
```

### Revoke vote

```http
DELETE /api/v1/votes/{vote_id}
```

Работает только для опросов с `allow_revoting=true` и пока голосование активно.
Если удаление успешно, возвращается `{"ok": true}` и в outbox пишется
`voting.vote.revoked`.

**Error 409 (ALREADY_VOTED):**
```json
{
  "error": {
    "code": "ALREADY_VOTED",
    "message": "You have already voted in this nomination"
  }
}
```

### Results

```http
GET /api/v1/polls/{poll_id}/results
```

```json
{
  "poll_id": "uuid",
  "total_votes": 150,
  "nominations": [
    {
      "id": "uuid",
      "title": "Лучшая игра года",
      "total_votes": 150,
      "options": [
        {"id": "uuid", "title": "Game A", "votes": 80},
        {"id": "uuid", "title": "Game B", "votes": 70}
      ]
    }
  ]
}
```

`results_visibility` настраивает, когда результаты становятся доступными:
`always` — всем, `after_closed` — только после статуса `closed`, кроме
`owner`/`admin`/`moderator`/`observer`, а `admins_only` — только
`owner`/`admin`/`moderator`/`observer`.

## Бизнес-правила

### Анти-дубликат

```python
# MVP: один голос на пользователя на номинацию
unique(tenant_id, poll_id, nomination_id, user_id)
```

План реформы: убрать жёсткую уникальность в БД, ограничивать количеством
`max_votes` на уровне сервиса и запрещать повторный выбор одной и той же опции.

### Ограничение вариантов

`max_votes` определяет, сколько опций можно выбрать в одной номинации.
Попытка превысить лимит возвращает `TOO_MANY_VOTES`, повторный выбор той же
опции — `ALREADY_VOTED`.

### Переголосование

Если `allow_revoting=true`, участник может удалить голос и проголосовать заново.
Если флаг выключен — не разрешается удалять голос (код `REVOTE_NOT_ALLOWED`).

### Проверка сроков

```python
def can_vote(poll: Poll) -> bool:
    now = timezone.now()
    
    if poll.status != PollStatus.ACTIVE:
        return False
    
    if poll.starts_at and now < poll.starts_at:
        return False
    
    if poll.ends_at and now > poll.ends_at:
        return False
    
    return True
```

### Visibility

```python
def can_see_poll(user_id, poll: Poll) -> bool:
    if poll.visibility == "public":
        return True
    
    if poll.visibility == "community":
        return is_community_member(user_id, poll.scope_id)
    
    if poll.visibility == "team":
        return is_team_member(user_id, poll.scope_id)
    
    return poll.created_by == user_id
```

## Outbox Events

```python
class VoteOutbox(models.Model):
    id = models.UUIDField(primary_key=True)
    
    event_type = models.CharField(max_length=50)  # vote.cast
    payload = models.JSONField()
    
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True)
```

Event payload:
```json
{
  "event_type": "vote.cast",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "poll_id": "uuid",
  "nomination_id": "uuid",
  "option_id": "uuid",
  "occurred_at": "2026-01-14T12:00:00Z"
}
```

## Permissions

Локальные роли опроса не заменяют Access permissions и работают только внутри сервиса Voting.

| Action | Permission |
|--------|------------|
| Read polls | `voting.poll.read` |
| Cast vote | `voting.vote.cast` |
| View results | `voting.results.read` |
| Admin votings | `voting.votings.admin` |
| Admin nominations | `voting.nominations.admin` |

## Configuration

### Environment Variables

```bash
# Django
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,voting

# Database
DATABASE_URL=postgres://user:pass@host:5432/voting

# Upstream services
ACCESS_BASE_URL=http://access:8002/api/v1
ACTIVITY_SERVICE_URL=http://activity:8006/api/v1

# BFF Communication
BFF_INTERNAL_HMAC_SECRET=shared-secret-with-bff

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080

# CSRF
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://localhost:8080

# Rate Limiting
RATE_LIMIT_ENABLED=True
RATE_LIMIT_VOTE_WINDOW_SECONDS=60
RATE_LIMIT_VOTE_MAX_REQUESTS=10
RATE_LIMIT_POLL_CREATE_WINDOW_SECONDS=300
RATE_LIMIT_POLL_CREATE_MAX_REQUESTS=5

# Logging
LOG_LEVEL=INFO
DJANGO_LOG_LEVEL=WARNING
```

### Security Headers

В production автоматически включаются:

| Header | Value | Description |
|--------|-------|-------------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | HSTS (1 year) |
| `X-Frame-Options` | `DENY` | Clickjacking protection |
| `X-Content-Type-Options` | `nosniff` | MIME type sniffing prevention |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |

## Health Checks

Сервис предоставляет три уровня health check endpoints:

### Liveness Check

```http
GET /health
```

Базовая проверка что сервис запущен.

```json
{"status": "ok"}
```

### Readiness Check

```http
GET /health/ready
```

Проверка готовности обрабатывать запросы (включает проверку БД).

```json
{
  "status": "ready",
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 1.23
    }
  }
}
```

**HTTP 503** если БД недоступна:

```json
{
  "status": "not_ready",
  "checks": {
    "database": {
      "status": "unhealthy",
      "error": "Connection refused"
    }
  }
}
```

### Detailed Health Check

```http
GET /health/detailed
```

Полная диагностика всех зависимостей (может быть медленной).

```json
{
  "status": "healthy",
  "service": "voting",
  "version": "1.0.0",
  "checks": {
    "database": {"status": "healthy", "latency_ms": 1.5},
    "access_service": {"status": "healthy", "latency_ms": 12.3},
    "activity_service": {"status": "healthy", "latency_ms": 8.7}
  },
  "outbox": {
    "unpublished_count": 5,
    "published_last_hour": 120,
    "oldest_unpublished_age_seconds": 45
  },
  "total_check_time_ms": 25.8
}
```

## Rate Limiting

Защита от злоупотреблений с in-memory sliding window алгоритмом.

### Ограничения

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /votes` | 10 requests | 60 seconds |
| `POST /polls` | 5 requests | 300 seconds |
| `POST /nominations` | 5 requests | 300 seconds |
| `POST /options` | 5 requests | 300 seconds |

### Rate Limit Response

**HTTP 429 Too Many Requests:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 45 seconds.",
    "details": {
      "retry_after": 45,
      "limit": 10,
      "window": 60
    }
  }
}
```

Response headers:
```
Retry-After: 45
```

## Outbox Publisher

Management command для публикации накопленных событий в Activity service.

### Использование

```bash
# Однократный запуск
python manage.py publish_outbox

# Daemon mode с polling
python manage.py publish_outbox --daemon --interval=5

# Увеличенный batch size
python manage.py publish_outbox --batch-size=100

# Retry failed messages (старше 1 часа)
python manage.py publish_outbox --retry-failed --retry-age=3600

# Dry run (без отправки)
python manage.py publish_outbox --dry-run
```

### Опции

| Option | Default | Description |
|--------|---------|-------------|
| `--batch-size` | 50 | Количество сообщений за итерацию |
| `--daemon` | false | Непрерывный режим с polling |
| `--interval` | 5 | Интервал polling в секундах |
| `--retry-failed` | false | Повторить failed сообщения |
| `--retry-age` | 3600 | Возраст сообщений для retry (секунды) |
| `--dry-run` | false | Показать что будет отправлено |

### Event Format

```json
{
  "event_id": "uuid",
  "event_type": "voting.vote.cast",
  "tenant_id": "uuid",
  "occurred_at": "2026-01-14T12:00:00Z",
  "source": "voting",
  "payload": {
    "vote_id": "uuid",
    "poll_id": "uuid",
    "nomination_id": "uuid",
    "option_id": "uuid",
    "user_id": "uuid"
  }
}
```

## Structured Logging

JSON формат логов с correlation IDs для production.

### Log Format

```json
{
  "timestamp": "2026-01-14T12:00:00.123456Z",
  "level": "INFO",
  "logger": "tenant_voting.api",
  "message": "Request completed",
  "service": "voting",
  "request_id": "abc-123-def",
  "user_id": "user-uuid",
  "tenant_id": "tenant-uuid",
  "method": "POST",
  "path": "/api/v1/votes",
  "status_code": 201,
  "duration_ms": 45.67
}
```

### Correlation ID

`X-Request-ID` header автоматически propagates из BFF и включается во все логи.
Response также содержит `X-Request-ID` header для трассировки.
