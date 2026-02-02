---
sidebar_position: 3
title: Docker Setup
description: Настройка Docker для разработки
---

# Docker Setup

Детальная настройка Docker окружения.

## Требования

- Docker Desktop 24+
- Docker Compose v2+
- 8GB RAM минимум
- 20GB свободного места

## Структура Docker Compose

```
infra/docker-compose/
├── docker-compose.yml          # Production-like
├── docker-compose.dev.yml      # Development
└── cookies.txt                  # (для registry auth)
```

## Сервисы

### docker-compose.dev.yml

```yaml
services:
  # === Infrastructure ===
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # === Backend Services ===
  id:
    build:
      context: ../../services/id
    ports:
      - "8001:8001"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/updspace_id
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ../../services/id/src:/app/src
    depends_on:
      - postgres
      - redis

  bff:
    build:
      context: ../../services/bff
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://redis:6379/1
      - ID_SERVICE_URL=http://id:8001
    volumes:
      - ../../services/bff/src:/app/src
    depends_on:
      - redis
      - id

  access:
    build:
      context: ../../services/access
    ports:
      - "8002:8002"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/updspace_access
      - REDIS_URL=redis://redis:6379/2
    volumes:
      - ../../services/access/src:/app/src
    depends_on:
      - postgres
      - redis

  portal:
    build:
      context: ../../services/portal
    ports:
      - "8003:8003"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/updspace_portal
    volumes:
      - ../../services/portal/src:/app/src
    depends_on:
      - postgres

  voting:
    build:
      context: ../../services/voting
    ports:
      - "8004:8004"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/updspace_voting
    volumes:
      - ../../services/voting/src:/app/src
    depends_on:
      - postgres

  events:
    build:
      context: ../../services/events
    ports:
      - "8005:8005"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/updspace_events
    volumes:
      - ../../services/events/src:/app/src
    depends_on:
      - postgres

  activity:
    build:
      context: ../../services/activity
    ports:
      - "8006:8006"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/updspace_activity
    volumes:
      - ../../services/activity/src:/app/src
    depends_on:
      - postgres

volumes:
  postgres_data:
```

## Команды

### Основные

```bash
# Запуск всех сервисов
docker compose -f docker-compose.dev.yml up -d

# Остановка
docker compose -f docker-compose.dev.yml down

# Остановка с удалением volumes
docker compose -f docker-compose.dev.yml down -v

# Перезапуск одного сервиса
docker compose -f docker-compose.dev.yml restart id

# Пересборка
docker compose -f docker-compose.dev.yml build id
```

### Логи

```bash
# Все сервисы
docker compose -f docker-compose.dev.yml logs -f

# Конкретный сервис
docker compose -f docker-compose.dev.yml logs -f id

# Последние N строк
docker compose -f docker-compose.dev.yml logs --tail 100 id
```

### Exec

```bash
# Bash в контейнере
docker compose -f docker-compose.dev.yml exec id bash

# Django shell
docker compose -f docker-compose.dev.yml exec id python src/manage.py shell

# psql
docker compose -f docker-compose.dev.yml exec postgres psql -U postgres
```

## Healthchecks

```yaml
id:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

## Networking

Все сервисы в одной default network:

```bash
# Проверка connectivity
docker compose exec bff curl http://id:8001/health
```

## Volumes

### Development volumes (bind mounts)

```yaml
volumes:
  - ../../services/id/src:/app/src  # Hot reload
```

### Persistent volumes

```yaml
volumes:
  postgres_data:    # Database data
```

### Очистка volumes

```bash
# Удалить неиспользуемые
docker volume prune

# Удалить конкретный
docker volume rm docker-compose_postgres_data
```

## Environment Variables

### Из файла

```yaml
services:
  id:
    env_file:
      - ../../services/id/.env
```

### Inline

```yaml
services:
  id:
    environment:
      - DEBUG=true
      - LOG_LEVEL=DEBUG
```

## Multi-database Setup

Каждый сервис использует свою базу:

```bash
# Создать базы
docker compose exec postgres psql -U postgres -c "CREATE DATABASE updspace_id;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE updspace_access;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE updspace_portal;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE updspace_voting;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE updspace_events;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE updspace_activity;"
```

## Resource Limits

```yaml
services:
  id:
    deploy:
      resources:
        limits:
          cpus: "1"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 256M
```

## Troubleshooting

### Container не запускается

```bash
# Проверить логи
docker compose logs id

# Проверить статус
docker compose ps
```

### Port already in use

```bash
# Найти процесс
lsof -i :8001

# Или изменить порт в compose
ports:
  - "8011:8001"  # host:container
```

### Out of disk space

```bash
# Очистка
docker system prune -a

# Проверка
docker system df
```

### Database connection refused

```bash
# Убедиться, что postgres ready
docker compose logs postgres | grep "ready to accept connections"

# Проверить network
docker compose exec id ping postgres
```
