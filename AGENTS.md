# AGENTS.md

Инструкции для AI-ассистентов при работе с проектом UpdSpace Portal.

## Обзор проекта

**UpdSpace Portal** — платформа для геймерских сообществ с голосованиями, событиями и лентой активности.

### Архитектура

- **Microservices** на Python/Django + Django Ninja (REST API)
- **Frontend** на React 19+ / Vite 7 / TypeScript
- **BFF pattern** — все запросы от frontend через BFF
- **Multi-tenant** — изоляция по subdomain (aef.updspace.com → tenant_slug=aef)

### Сервисы

| Service | Port | Purpose |
|---------|------|---------|
| UpdSpaceID | 8001 | Identity Provider (OIDC, MFA, Passkeys) |
| BFF | 8080 | Backend-for-Frontend (session, proxy, HMAC) |
| Access | 8002 | RBAC, permission checks |
| Portal | 8003 | Communities, teams, posts |
| Voting | 8004 | Polls, nominations, votes |
| Events | 8005 | Calendar, RSVP, attendance |
| Activity | 8006 | Feed, connectors (Steam, Minecraft) |

### Frontend

| App | Path | Purpose |
|-----|------|---------|
| Portal Frontend | web/portal-frontend | Main app |
| ID Frontend | web/id-frontend | Identity UI |

---

## Ключевые архитектурные решения

### 1. BFF Mandatory

**НЕ** храним токены в localStorage/sessionStorage.  
**ВСЕ** запросы через BFF с HttpOnly cookies.

```
Frontend → BFF (cookie auth) → Services (HMAC auth)
```

### 2. Multi-tenant

Каждая таблица содержит `tenant_id`:

```python
class Post(models.Model):
    tenant_id = models.UUIDField(db_index=True)  # Обязательно!
    # ...
```

Tenant определяется по subdomain в middleware.

### 3. RBAC через Access Service

Проверка прав:
```http
GET http://access:8002/api/v1/check?user_id=...&tenant_id=...&permission=...
```

Permissions:
- `{service}.{resource}.{action}` — для проверки
- `{service}.{scope}.is_{role}` — master flags

### 4. No Self-Signup

Пользователи создаются только через approval flow:
1. Application → 2. Admin approval → 3. Activation link

### 5. Outbox Pattern

Для cross-service events используем outbox:

```python
class VoteOutbox(models.Model):
    event_type = models.CharField(max_length=50)  # vote.cast
    payload = models.JSONField()
    processed_at = models.DateTimeField(null=True)
```

---

## Правила кодирования

### Python

- Python 3.12+
- Django 5.x
- Django Ninja для API
- Type hints везде
- Ruff для форматирования и линтинга

```python
# Хорошо
def get_user(user_id: UUID) -> User | None:
    return User.objects.filter(id=user_id).first()

# Плохо
def get_user(user_id):
    return User.objects.filter(id=user_id).first()
```

### TypeScript

- React 19+
- Strict mode
- Функциональные компоненты
- TanStack Query для data fetching

```typescript
// Хорошо
export function PollCard({ poll }: { poll: Poll }) {
  return <div>{poll.title}</div>;
}

// Плохо
export function PollCard(props: any) {
  return <div>{props.poll.title}</div>;
}
```

### API Design

- RESTful naming
- Версионирование: `/api/v1/...`
- Consistent error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": {}
  }
}
```

---

## Структура файлов

### Backend Service

```
services/myservice/
├── Dockerfile
├── pyproject.toml
└── src/
    ├── manage.py
    ├── app/
    │   ├── settings.py
    │   ├── urls.py
    │   └── api.py
    └── myservice/
        ├── __init__.py
        ├── api.py          # Django Ninja endpoints
        ├── models.py       # Django models
        ├── schemas.py      # Pydantic schemas
        ├── services.py     # Business logic
        ├── tests/
        └── migrations/
```

### Frontend Feature

```
src/features/voting/
├── api/
│   └── votingApi.ts    # API calls
├── components/
│   ├── PollCard.tsx
│   └── VoteForm.tsx
├── hooks/
│   └── usePoll.ts
├── types/
│   └── poll.ts
└── index.ts            # Public exports
```

---

## Частые задачи

### Добавление нового endpoint

1. Создать schema в `schemas.py`
2. Создать endpoint в `api.py`
3. Добавить permission в Access
4. Обновить BFF routing если нужно

### Добавление новой модели

1. Создать модель с `tenant_id`
2. `python manage.py makemigrations`
3. `python manage.py migrate`
4. Добавить тесты

### Добавление permission

1. Добавить в `access/permissions_mvp.py`
2. Создать seed migration
3. Использовать в сервисе:

```python
if not await check_permission(user_id, tenant_id, "myservice.resource.action"):
    raise HttpError(403, "Forbidden")
```

---

## Чего НЕ делать

❌ Хранить токены в frontend  
❌ Делать прямые запросы к сервисам (минуя BFF)  
❌ Создавать модели без tenant_id  
❌ Хардкодить URLs сервисов  
❌ Использовать `any` в TypeScript  
❌ Коммитить секреты  
❌ Смешивать логику в view-слое  

---

## Документация

Полная документация в `/documentation/` (Docusaurus):

- [Архитектура](documentation/docs/architecture/overview.md)
- [Сервисы](documentation/docs/services/overview.md)
- [API Reference](documentation/docs/api/overview.md)
- [Guides](documentation/docs/guides/quick-start.md)

---

## Команды

```bash
# Запуск всего
./scripts/dev-up.sh

# Тесты
docker compose exec <service> pytest

# Миграции
docker compose exec <service> python src/manage.py migrate

# Shell
docker compose exec <service> python src/manage.py shell

# Frontend dev
cd web/portal-frontend && npm run dev
```

---

## Контекст для AI

При работе с этим проектом учитывай:

1. **Multi-tenant** — всегда думай о tenant_id
2. **BFF pattern** — frontend никогда не общается напрямую с сервисами
3. **RBAC** — проверяй permissions через Access service
4. **Type safety** — используй типы везде
5. **Testing** — пиши тесты для нового кода, обязательно запускай релевантные наборы и фиксируй их прогон как часть завершения задачи (в финальном ответе укажи, что и как тестировалось).
6. **Документация** — обновляй docs при изменениях API
