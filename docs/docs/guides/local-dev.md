---
sidebar_position: 2
title: Локальная разработка
description: Настройка локального окружения
---

# Локальная разработка

Детальное руководство по настройке локального окружения.

## Структура проекта

```
aef-vote/
├── docs/                     # Markdown документация (legacy)
├── documentation/            # Docusaurus документация (эта)
├── infra/                    # Инфраструктура
│   └── docker-compose/       # Docker Compose файлы
├── scripts/                  # Утилиты
├── secrets/                  # Секреты (gitignored)
├── services/                 # Backend сервисы
│   ├── access/
│   ├── activity/
│   ├── bff/
│   ├── events/
│   ├── id/
│   ├── portal/
│   └── voting/
└── web/                      # Frontend приложения
    ├── id-frontend/
    └── portal-frontend/
```

## Вариант 1: Docker Compose (рекомендуется)

### Запуск

```bash
cd infra/docker-compose
docker compose -f docker-compose.dev.yml up -d
```

### Горячая перезагрузка

Все сервисы монтируют исходники через volumes — изменения применяются автоматически.

### Пересборка

```bash
# Один сервис
docker compose -f docker-compose.dev.yml build id

# Все сервисы
docker compose -f docker-compose.dev.yml build
```

### Базы данных

Каждый сервис имеет свою PostgreSQL базу:

| Service | Database | Port |
|---------|----------|------|
| id | updspace_id | 5432 (internal) |
| access | updspace_access | 5433 |
| portal | updspace_portal | 5434 |
| voting | updspace_voting | 5435 |
| events | updspace_events | 5436 |
| activity | updspace_activity | 5437 |

### Redis

```bash
# Доступ к Redis CLI
docker compose exec redis redis-cli
```

---

## Вариант 2: Локальный Python + Docker для БД

Для более быстрого цикла разработки:

### 1. Запуск только инфраструктуры

```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
```

### 2. Создание виртуальных окружений

```bash
cd services/id
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 3. Настройка переменных окружения

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/updspace_id"
export REDIS_URL="redis://localhost:6379/0"
export DJANGO_SECRET_KEY="dev-secret-key"
```

### 4. Запуск сервиса

```bash
cd services/id/src
python manage.py runserver 8001
```

---

## Вариант 3: VS Code Dev Containers

`.devcontainer/devcontainer.json` настроен для полной разработки в контейнере.

1. Установите расширение "Dev Containers"
2. `Cmd+Shift+P` → "Reopen in Container"
3. Все зависимости установлены автоматически

---

## Frontend разработка

### Portal Frontend

```bash
cd web/portal-frontend
npm install
npm run dev
```

Открывается на http://localhost:5173

### ID Frontend

```bash
cd web/id-frontend
npm install
npm run dev
```

Открывается на http://localhost:5174

### Proxy настройка

Vite проксирует `/api/bff` на BFF сервис:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api/bff": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
```

---

## Миграции

### Создание миграции

```bash
docker compose exec id python src/manage.py makemigrations
```

### Применение миграций

```bash
docker compose exec id python src/manage.py migrate
```

### Rollback

```bash
docker compose exec id python src/manage.py migrate <app> <migration_number>
```

---

## Тестирование

### Backend тесты

```bash
# В контейнере
docker compose exec id pytest

# Локально
cd services/id
pytest
```

### Frontend тесты

```bash
cd web/portal-frontend
npm run test
```

### E2E тесты

```bash
cd web/portal-frontend
npm run test:e2e
```

---

## Отладка

### Django Debug

```python
# В коде
import pdb; pdb.set_trace()
```

```bash
# Attach к контейнеру
docker attach <container_id>
```

### VS Code Debugger

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Django: ID",
      "type": "debugpy",
      "request": "attach",
      "connect": {
        "host": "localhost",
        "port": 5678
      },
      "pathMappings": [
        {
          "localRoot": "${workspaceFolder}/services/id/src",
          "remoteRoot": "/app/src"
        }
      ]
    }
  ]
}
```

### Логи

```bash
# Все сервисы
docker compose logs -f

# Конкретный сервис
docker compose logs -f id

# Последние 100 строк
docker compose logs --tail 100 id
```

---

## Полезные alias'ы

```bash
# ~/.zshrc или ~/.bashrc

alias dc="docker compose -f infra/docker-compose/docker-compose.dev.yml"
alias dcup="dc up -d"
alias dcdown="dc down"
alias dclogs="dc logs -f"
alias dcexec="dc exec"

# Пример использования
dcexec id python src/manage.py shell
```

---

## Troubleshooting

### Port already in use

```bash
# Найти процесс
lsof -i :8001

# Убить
kill -9 <PID>
```

### Database connection refused

```bash
# Проверить, что postgres запущен
docker compose ps postgres

# Проверить логи
docker compose logs postgres
```

### Module not found

```bash
# Пересобрать образ
docker compose build <service>
```

### Permission denied (secrets)

```bash
chmod 600 secrets/*
```
