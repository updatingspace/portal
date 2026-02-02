---
sidebar_position: 1
title: Quick Start
description: Быстрый старт для новых разработчиков
---

# Quick Start

Начало работы с проектом UpdSpace за 10 минут.

## Предварительные требования

- **Docker Desktop** 24+
- **Python** 3.12+
- **Node.js** 22+
- **Git**

## 1. Клонирование репозитория

```bash
git clone git@github.com:updspace/aef-vote.git
cd aef-vote
```

## 2. Настройка окружения

### Секреты

```bash
# Django secret key
echo "your-secret-key-here" > secrets/django_secret_key
```

### Environment files (опционально)

```bash
# Если нужны кастомные настройки
cp .env.example .env
```

## 3. Запуск через Docker Compose

```bash
# Запуск всех сервисов
./scripts/dev-up.sh

# Или вручную
cd infra/docker-compose
docker compose -f docker-compose.dev.yml up -d
```

## 4. Проверка статуса

```bash
# Все контейнеры должны быть "healthy"
docker compose -f docker-compose.dev.yml ps
```

## 5. Доступ к сервисам

| Service | URL |
|---------|-----|
| Portal Frontend | http://localhost:5173 |
| ID Frontend | http://localhost:5174 |
| UpdSpaceID API | http://localhost:8001 |
| BFF API | http://localhost:8080 |
| Portal API | http://localhost:8003 |
| Voting API | http://localhost:8004 |
| Events API | http://localhost:8005 |
| Activity API | http://localhost:8006 |

## 6. Создание тестового пользователя

```bash
# Войти в контейнер UpdSpaceID
docker compose exec id bash

# Создать superuser
python src/manage.py createsuperuser
```

## 7. Создание tenant

```bash
# В контейнере UpdSpaceID
python src/manage.py shell

>>> from accounts.models import Tenant, TenantMembership
>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> user = User.objects.first()
>>> tenant = Tenant.objects.create(slug="aef", name="AEF Community")
>>> TenantMembership.objects.create(tenant=tenant, user=user)
```

## 8. Вход в систему

1. Откройте http://localhost:5174 (ID Frontend)
2. Войдите с созданными credentials
3. Перейдите на http://aef.localhost:5173 (Portal)

:::tip Subdomain routing
В `/etc/hosts` добавьте:
```
127.0.0.1 aef.localhost
```
:::

## Полезные команды

```bash
# Логи конкретного сервиса
docker compose logs -f id

# Остановка
docker compose down

# Пересборка
docker compose build <service>

# Django shell
docker compose exec <service> python src/manage.py shell

# Миграции
docker compose exec <service> python src/manage.py migrate
```

## Следующие шаги

- [Локальная разработка](./local-dev) — детальная настройка
- [Архитектура](../architecture/overview) — понимание системы
- [Contributing](./contributing) — как вносить изменения
