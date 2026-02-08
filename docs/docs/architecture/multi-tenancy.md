---
sidebar_position: 3
title: Multi-Tenancy
description: Архитектура мультитенантности в UpdSpace
---

# Multi-Tenancy

UpdSpace — мультитенантная платформа. Каждый tenant (например, AEF) полностью изолирован.

## Определение Tenant

### Canonical URL (Path-Based) — НОВЫЙ

Основной способ идентификации tenant — путь в URL:
```
portal.updating.space/t/aef/...   → tenant_slug = "aef"
portal.updating.space/t/gaming/... → tenant_slug = "gaming"
```

Активный tenant хранится в серверной сессии BFF и переключается через API.

### Legacy: По Subdomain
```
aef.updspace.com    → tenant_slug = "aef"
gaming.updspace.com → tenant_slug = "gaming"
```
Subdomain-based подход сохранён для обратной совместимости.

### Резолвинг в BFF

```python
# Новый: path-based через API
POST /api/v1/session/switch-tenant
{"slug": "aef"}

# Legacy: host-based через middleware
def resolve_tenant(request):
    host = request.META.get("HTTP_HOST", "")
    subdomain = host.split(".")[0]
    tenant = Tenant.objects.get(slug=subdomain)
```

## Сессия и активный Tenant

Активный tenant хранится в серверной сессии BFF (Redis):

```python
session = {
    "user_id": "...",
    "active_tenant_id": "uuid",
    "active_tenant_slug": "aef",
    "active_tenant_set_at": "ISO datetime",
    "last_tenant_slug": "aef",  # для redirect после логина
}
```

### Эндпоинты

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/v1/session/switch-tenant` | POST | Переключить tenant |
| `/api/v1/session/tenants` | GET | Список доступных tenants |
| `/api/v1/entry/me` | GET | Tenantless: профиль + pending applications |
| `/api/v1/session/me` | GET | Полный контекст с active_tenant, flags, experiments |

### Frontend маршруты

```
/                     → Landing
/login                → Login
/choose-tenant        → Выбор tenant (auth required)
/t/:tenantSlug/*      → Приложение внутри tenant (TenantGate)
/app/*                → Legacy маршруты (обратная совместимость)
```

## Модель данных Tenant

```python
class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    slug = models.CharField(max_length=50, unique=True)  # aef
    name = models.CharField(max_length=255)              # AEF Community
    settings = models.JSONField(default=dict)           # Feature flags
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = "tenants"
```

## Изоляция данных

### Правило #1: tenant_id в каждой таблице

```python
class Post(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_index=True)  # ОБЯЗАТЕЛЬНО
    title = models.CharField(max_length=255)
    # ...
```

### Правило #2: Фильтрация в каждом запросе

```python
# ✅ Правильно
posts = Post.objects.filter(tenant_id=request.tenant.id)

# ❌ НИКОГДА так
posts = Post.objects.all()  # Утечка данных!
```

### Правило #3: Уникальность с tenant_id

```python
class CommunityMembership(models.Model):
    tenant_id = models.UUIDField()
    community_id = models.UUIDField()
    user_id = models.UUIDField()
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "community_id", "user_id"],
                name="unique_community_membership"
            )
        ]
```

## Таблицы БЕЗ tenant_id

Некоторые таблицы глобальны (в UpdSpaceID):

| Таблица | Причина |
|---------|---------|
| `User` | Пользователь может быть в нескольких tenants |
| `Tenant` | Сама таблица tenants |
| `ExternalIdentity` | OAuth привязки глобальны |

Но даже для глобальных сущностей есть связь:

```python
class TenantMembership(models.Model):
    user_id = models.UUIDField()
    tenant_id = models.UUIDField()
    status = models.CharField()  # active/disabled
    base_role = models.CharField()  # member/admin
```

## Контекст в запросах

### Headers от BFF

```http
GET /api/v1/portal/posts HTTP/1.1
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
X-Tenant-Id: 123e4567-e89b-12d3-a456-426614174000
X-Tenant-Slug: aef
X-User-Id: 987fcdeb-51a2-4bc3-8def-0123456789ab
X-Master-Flags: {"suspended":false,"system_admin":false}
X-Updspace-Timestamp: 1705234567
X-Updspace-Signature: abc123...
```

### Получение в сервисе

```python
def get_posts(request):
    tenant_id = request.headers.get("X-Tenant-Id")
    user_id = request.headers.get("X-User-Id")
    
    # Проверка доступа
    if not Access.check(tenant_id, user_id, "portal.posts.read"):
        raise PermissionDenied()
    
    # Фильтрация по tenant
    return Post.objects.filter(tenant_id=tenant_id)
```

## Тестирование изоляции

### Обязательные тесты

```python
def test_tenant_isolation():
    # Создаём два tenant
    tenant_a = Tenant.objects.create(slug="tenant-a")
    tenant_b = Tenant.objects.create(slug="tenant-b")
    
    # Создаём пост в tenant A
    post = Post.objects.create(
        tenant_id=tenant_a.id,
        title="Secret Post"
    )
    
    # Запрос от tenant B не должен видеть пост
    response = client.get(
        "/api/v1/portal/posts",
        headers={"X-Tenant-Id": str(tenant_b.id)}
    )
    
    assert post.id not in [p["id"] for p in response.json()]
```

## Миграция данных

При импорте данных из legacy системы:

```python
def migrate_legacy_posts(legacy_posts, target_tenant_id):
    for legacy in legacy_posts:
        Post.objects.create(
            tenant_id=target_tenant_id,  # Явно указываем tenant
            title=legacy["title"],
            content=legacy["content"],
            # ...
        )
```

## Threat Model: Утечки Tenant

| Угроза | Митигация |
|--------|-----------|
| Запрос без tenant_id | BFF обязательно добавляет X-Tenant-Id |
| SQL injection для bypass | ORM + параметризованные запросы |
| Прямой доступ к сервису | Только BFF имеет доступ (network policy) |
| Cross-tenant в URL | Валидация tenant_id в каждом endpoint |
| Cache pollution | Tenant-scoped cache keys |

### Пример cache key

```python
# ✅ Правильно
cache_key = f"posts:{tenant_id}:list"

# ❌ Утечка!
cache_key = "posts:list"
```
