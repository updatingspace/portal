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
- `VITE_API_BASE_URL` — базовый путь API для фронта (используется Vite dev server при старте контейнера).
- `DJANGO_SETTINGS_MODULE` — `aef_backend.settings.dev` по умолчанию (DEBUG, SQLite при пустом `POSTGRES_HOST`), для продакшена укажите `aef_backend.settings.prod` (требует Postgres).
- `DJANGO_ALLOWED_HOSTS` / `DJANGO_CSRF_TRUSTED_ORIGINS` — домены, с которых можно обращаться к бэку.
- `DJANGO_SECRET_KEY` — задаётся через файл `secrets/django_secret_key` (используется переменная `DJANGO_SECRET_KEY_FILE`).
- Порты: `FRONTEND_PORT` и `BACKEND_PORT`.
- `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST` / `POSTGRES_PORT` — параметры подключения бэка к Postgres (по умолчанию сервис `db` внутри compose).
- `ENABLE_DEBUG_TOOLBAR` — включить Django Debug Toolbar в dev-сборке (требует установленных dev-зависимостей).
- `INSTALL_DEV` — build-аргумент бэкенд-образа для установки dev-зависимостей (в т.ч. Debug Toolbar).

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

- Подготовьте переменные точно так же (`cp .env.example .env`) и не забудьте создать секретный ключ Django:
  `mkdir -p secrets && openssl rand -hex 32 > secrets/django_secret_key`.
- Стек предполагает доступ к внешней оверлейной сети `updspace_proxy` (измените `stack.yml`, если у вас другое имя) для интеграции с прокси/Traefik. Если она ещё не создана:
  `docker network create --driver overlay updspace_proxy`.
- Разверните стек командой `docker stack deploy -c stack.yml --env-file .env aef-vote`. Файл `stack.yml` уже монтирует секрет `django_secret_key`, прокидывает переменные окружения, подключает сервисы к `updspace_proxy` и автоматически объединяет ваше приложение с Traefik.
- Фронт в прод-образе теперь собирается внутри Dockerfile и обслуживается через nginx (порт 80). При необходимости сменить API-адрес на этапе сборки используйте `--build-arg VITE_API_BASE_URL=https://example.com/api`.
- Бэк в прод-образе запускает `entrypoint.sh`, который делает `migrate` + `collectstatic` и стартует Gunicorn (`aef_backend.wsgi` на `0.0.0.0:8000`), так что в стеке можно не переопределять команду. Для сборки прод-образа достаточно `docker build -f backend/Dockerfile backend -t ghcr.io/updatingspace/aef-vote-backend:latest`.
- Сервис watchtower развёрнут отдельно в инфра-стеке, поэтому в этом файле его нет — достаточно, что фронт/бэк помечены `com.centurylinklabs.watchtower.enable=true`, и инфра-watchtower с `latest`-тегами подхватит обновление образов.
- После старта фронт доступен по `https://aef-vote.updspace.com`, а API работает под `https://aef-vote.updspace.com/api/` — в routing-правилах Traefik backend захватывает только `Host(...) && PathPrefix(`/api`)`, а frontend обрабатывает остальные пути на этом домене (кроме `/api`) с более низким приоритетом.
- Постгрес сохраняет данные в volume `pgdata`, а backend использует `DJANGO_SETTINGS_MODULE=aef_backend.settings.prod` и строгие хосты/CSRF, чтобы соответствовать рабочему окружению.
