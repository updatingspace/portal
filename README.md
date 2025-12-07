# AEF Vote – Docker Compose

ATTENTION: это полностью навайбкодженое веб-приложение.

Два контейнера — React/Vite фронт и Django Ninja бэк. Все параметры (API-path, секреты и порты) прокидываются через `.env` и docker secrets, чтобы запускался одной командой.

## Быстрый старт
- Скопируйте пример переменных: `cp .env.example .env` и при необходимости подправьте значения.
- Подготовьте секрет для Django: `mkdir -p secrets && openssl rand -hex 32 > secrets/django_secret_key`.
- Запустите стэк: `docker compose up --build`.
- Фронт: `http://localhost:${FRONTEND_PORT:-5173}`. Бэк: `http://localhost:${BACKEND_PORT:-8000}/api/health`.
- PostgreSQL поднимается внутри compose с параметрами из `.env` (`POSTGRES_*`), данные сохраняются в volume `pgdata`.

## Важные переменные
- Фронт: `VITE_API_BASE_URL` — базовый путь API (берётся в dev-сервере и при прод-сборке), `VITE_LOG_LEVEL` — порог логирования в консоли (`debug`/`info`/`warn`/`error`/`critical`), `VITE_TELEGRAM_BOT_NAME` — имя бота для кнопки Telegram (проксируется в prod-сборке), `VITE_BUILD_ID` — идентификатор сборки (автоматически генерируется в CI/CD).
- Бэк: `DJANGO_SETTINGS_MODULE` (`aef_backend.settings.dev` по умолчанию), `DJANGO_DEBUG`, `DJANGO_LOG_LEVEL` (уровень логирования), `DJANGO_ALLOWED_HOSTS` / `DJANGO_CSRF_TRUSTED_ORIGINS` / `CORS_ALLOWED_ORIGINS`, `DJANGO_SITE_ID`, `BUILD_ID` — идентификатор сборки (автоматически генерируется в CI/CD).
- MFA/Passkeys: `ALLAUTH_MFA_WEBAUTHN_ALLOW_INSECURE_ORIGIN`, `MFA_WEBAUTHN_ALLOW_INSECURE_ORIGIN`, `MFA_WEBAUTHN_RP_ID`, `MFA_WEBAUTHN_RP_NAME`.
- Секреты: в Compose `DJANGO_SECRET_KEY` берётся из файла `secrets/django_secret_key` (`DJANGO_SECRET_KEY_FILE=/run/secrets/django_secret_key`), в Swarm/stack используются docker secrets `django_secret_key`, `postgres_password`, `telegram_bot_token` (`*_FILE` варианты прописаны в `stack.yml`).
- Порты: `FRONTEND_PORT` и `BACKEND_PORT`.
- База: `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST` / `POSTGRES_PORT` — параметры подключения бэка к Postgres (по умолчанию сервис `db` внутри compose).
- Дев/сборка: `ENABLE_DEBUG_TOOLBAR` включает Debug Toolbar в dev-сборке (нужны dev-зависимости), `INSTALL_DEV` — build-аргумент для их установки.
- Telegram: `TELEGRAM_BOT_TOKEN` (или `TELEGRAM_BOT_TOKEN_FILE`) для проверки подписи Login Widget, `TELEGRAM_LOGIN_MAX_AGE`, `TELEGRAM_REQUIRE_LINK_FOR_VOTING`, `TELEGRAM_ADMIN_IDS` (через запятую).
- Prod-старты: `GUNICORN_WORKERS` / `GUNICORN_THREADS` / `GUNICORN_TIMEOUT` настраивают entrypoint Gunicorn в прод-образе.

## Профили settings
- `aef_backend.settings.dev` — DEBUG=True, SQLite по умолчанию (если `POSTGRES_HOST` пуст), при наличии `POSTGRES_HOST` переключается на Postgres. Опционально Debug Toolbar через `ENABLE_DEBUG_TOOLBAR=true` + dev-зависимости. В compose достаточно задать `POSTGRES_HOST=` (пусто), чтобы форсировать SQLite.
- `aef_backend.settings.prod` — DEBUG=False по умолчанию, требует Postgres (`POSTGRES_HOST` обязателен), собирает статику в `staticfiles`.
- Dev-зависимости можно поставить локально командой `pip install -r backend/requirements-dev.txt` (или оставить `INSTALL_DEV=true` в compose, чтобы они ставились в контейнер).

## Как устроен Compose
- `frontend` — собирается из `Dockerfile.frontend`, пробрасывает `VITE_API_BASE_URL`, крутится Vite dev server на `0.0.0.0:5173` с автообновлением. Код монтируется в контейнер, `node_modules` — в анонимный volume.
- `backend` — собирается из `backend/Dockerfile` (в compose используется таргет `dev`), ставит dev-зависимости при `INSTALL_DEV=true`, запускает миграции и `runserver 0.0.0.0:8000`. Код монтируется, секрет читается из `/run/secrets/django_secret_key`, база — PostgreSQL (или SQLite, если `POSTGRES_HOST` пуст).
- `db` — PostgreSQL 16 с volume `pgdata`.

## Команды и службы
- Полный стэк: `docker compose up --build`.
- Только бэк или фронт: `docker compose up backend` / `docker compose up frontend`.
- Пересобрать после смены зависимостей: `docker compose build frontend backend`.

## Docker Swarm stack

- Подготовьте `.env` как для Compose (`cp .env.example .env`), а секреты создайте в менеджере Swarm (анонимные secrets вместо ENV):
  ```bash
  openssl rand -hex 32 | docker secret create django_secret_key -
  printf '%s' "${POSTGRES_PASSWORD:-aefpassword}" | docker secret create postgres_password -
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && printf '%s' "$TELEGRAM_BOT_TOKEN" | docker secret create telegram_bot_token -
  ```
  Если секрет уже существует, команду создания можно пропустить. Пароль БД для стека читается только из `postgres_password` (значение `POSTGRES_PASSWORD` в `.env` нужно для локального Compose).
- Стек предполагает доступ к внешней оверлейной сети `net_public` (см. `stack.yml`, при необходимости поменяйте имя). Если сети нет, создайте:
  `docker network create --driver overlay net_public`.
- Разверните стек командой `docker stack deploy -c stack.yml --env-file .env aef-vote`. Файл `stack.yml` монтирует секреты `django_secret_key`, `postgres_password`, `telegram_bot_token`, прокидывает переменные окружения (включая `DJANGO_LOG_LEVEL`/`DJANGO_SITE_ID`) и подключает сервисы к `net_public`, автоматически объединяя приложение с Traefik.
- Фронт в прод-образе теперь собирается внутри Dockerfile и обслуживается через nginx (порт 80). При необходимости сменить API-адрес на этапе сборки используйте `--build-arg VITE_API_BASE_URL=https://example.com/api`.
- Бэк в прод-образе запускает `entrypoint.sh`, который делает `migrate` + `collectstatic` и стартует Gunicorn (`aef_backend.wsgi` на `0.0.0.0:8000`), так что в стеке можно не переопределять команду. Для сборки прод-образа достаточно `docker build -f backend/Dockerfile backend -t ghcr.io/updatingspace/aef-vote-backend:latest`.
- Сервис watchtower развёрнут отдельно в инфра-стеке, поэтому в этом файле его нет — достаточно, что фронт/бэк помечены `com.centurylinklabs.watchtower.enable=true`, и инфра-watchtower с `latest`-тегами подхватит обновление образов.
- После старта фронт доступен по `https://aef-vote.updspace.com`, а API работает под `https://aef-vote.updspace.com/api/` — в routing-правилах Traefik backend захватывает только `Host(...) && PathPrefix(`/api`)`, а frontend обрабатывает остальные пути на этом домене (кроме `/api`) с более низким приоритетом.
- Постгрес сохраняет данные в volume `pgdata`, а backend использует `DJANGO_SETTINGS_MODULE=aef_backend.settings.prod` и строгие хосты/CSRF, чтобы соответствовать рабочему окружению.

## Версионирование сборок (BUILD_ID)

Приложение поддерживает систему версионирования сборок через переменную `BUILD_ID`, которая автоматически генерируется в CI/CD и встраивается в приложение.

### Формат BUILD_ID
`YYYY.MM.DD-RUN-<short_sha>` — например, `2025.12.07-123-abc1234`, где:
- `YYYY.MM.DD` — дата сборки в UTC
- `RUN` — номер запуска workflow в GitHub Actions
- `<short_sha>` — первые 7 символов SHA коммита

### Использование

**Backend:**
- Доступен через переменную окружения `BUILD_ID` (по умолчанию `dev` в dev-режиме)
- Возвращается в эндпоинте `/api/version`:
  ```bash
  curl http://localhost:8000/api/version
  # {"build_id": "2025.12.07-123-abc1234", "api_version": "0.1.0"}
  ```
- Автоматически добавляется в логи приложения

**Frontend:**
- Доступен через переменную `VITE_BUILD_ID` (по умолчанию `dev` в dev-режиме)
- Отображается в футере приложения
- Логируется при запуске приложения в консоли браузера
- Доступен через утилиту `getBuildId()` из `src/utils/version.ts`

**CI/CD:**
- `BUILD_ID` генерируется автоматически в GitHub Actions при сборке образов
- Docker-образы тегируются как `BUILD_ID`, `latest` и `github.sha`
- Передаётся как build argument в Dockerfile для обоих сервисов

### Локальная разработка
В dev-режиме `BUILD_ID` по умолчанию равен `dev`. Для установки кастомного значения:
```bash
# Frontend
VITE_BUILD_ID=my-local-build npm run build

# Backend
BUILD_ID=my-local-build python manage.py runserver
```
