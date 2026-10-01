---
title: Testing Strategy
---

# Testing Strategy

## Что считается минимально достаточным

Для backend-сервиса:

- focused unit tests на новую бизнес-логику;
- integration tests на auth/permission critical paths;
- regression tests на tenant isolation, если затрагивается scope logic.

Для frontend:

- Vitest на shared API clients и business hooks;
- integration tests на критические route flows;
- Playwright на основные пользовательские сценарии, если меняется UX path.

## High-risk areas

- BFF auth/session;
- Access permission evaluation;
- Voting compat behavior;
- Activity connectors and feed serialization;
- frontend route guards.

## Documentation requirement

Если меняется contract surface, в PR должны обновляться не только тесты, но и соответствующие docs pages.

## Воспроизводимые команды

### Portal frontend

Используй Node 22.12.0 (версия CI) или совместимую версию из `engines` и pnpm 10.28.2, указанный в `web/portal-frontend/package.json`:

```bash
cd web/portal-frontend
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm exec vitest run
pnpm run build
```

Для выбранных тестов передай пути в `pnpm exec vitest run`. Команда `pnpm run test` без `run` включает watch mode. CI выполняет lint, typecheck, Vitest, build и критические сценарии Playwright.

Для Playwright требуется установленный браузер:

```bash
pnpm exec playwright install chromium
pnpm run test:e2e
```

Набор `e2e` проверяет вход и выбор сообщества, состояния данных, темы, мобильные пользовательские и административные сценарии с контролируемыми ответами BFF. Проверка реальной сессии и внешнего ID выполняется отдельно. `playwright.config.ts` запускает Vite на `127.0.0.1:4173`.

### Backend

Каждый сервис имеет собственные настройки Django и пакеты `app`, поэтому запускай pytest из каталога выбранного сервиса. Пример для BFF с Python 3.12, повторяющий тестовое окружение CI:

```bash
cd services/bff
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e . pytest pytest-django ruff==0.16.1

export DJANGO_SETTINGS_MODULE=app.settings
export PYTHONPATH=src
export DJANGO_DEBUG=True
export DJANGO_SECRET_KEY=ci-test-secret
export DJANGO_ALLOW_INSECURE_DEFAULTS=1
export ALLOWED_HOSTS=.updspace.com,.updating.space,.localhost,testserver,localhost,127.0.0.1,.yandexcloud.net,bff,access,portal,voting,events,gamification,activity,featureflags
export DATABASE_URL=sqlite:///db.sqlite3
export BFF_INTERNAL_HMAC_SECRET=ci-internal-hmac
export BFF_UPDSPACEID_CALLBACK_SECRET=ci-callback-secret
export ACTIVITY_DATA_ENCRYPTION_KEY=ci-activity-encryption-key

ruff check --config ../../ruff.toml src
pytest -q src/bff/tests.py src/bff/tests_tenant_context.py
```

Эти значения предназначены только для изолированного тестового окружения. Точные `test_target` для остальных сервисов сверяй с matrix `python-services-check` в `.github/workflows/ci.yml`; при изменении auth/settings или scope добавляй релевантные regression targets, даже если их нет в matrix.

Изменения схемы дополнительно проверяются через `python src/manage.py migrate_ydb --dry-run` в окружении job `ydb-schema-check` с локальным YDB. SQLite pytest не заменяет эту проверку.

### Документация

У `docs` собственные зависимости и `package-lock.json`. Для воспроизводимого прогона используй этот lockfile:

```bash
cd docs
npm ci
npm run typecheck
npm run build
```

После прогона зафиксируй команду, версию runtime, результат и известные ограничения. Ошибка установки зависимостей или недоступный сервис означает незапущенную проверку, а не успешный тест.

### Регрессия публикаций Activity на YDB

В CI `ydb-schema-check (activity)` выполняется `scripts/ci/check_ydb_news.py`
после `migrate_ydb`. Проверка запускает подписанные HTTP-запросы к Django API:
создание → обе версии ленты → чтение → редактирование → удаление;
черновик → публикация → скрытие; реакции, комментарии и просмотры.
Проверяются отказы в правах, изоляция двух сообществ и полный откат
публикации при сбое внутри транзакции. Access и обогащение профиля
заменены контролируемыми ответами; запросы и записи YDB настоящие.
Скрипт допускает только локальную YDB `/local` и удаляет свои тестовые данные.

SQLite-тесты не заменяют этот прогон: YDB не поддерживает генерируемый
драйвером JSON key lookup и позиционный `GROUP BY 1`. Связь поста с лентой
ищется по `tenant_id` и существующему `source_ref = news:<id>`.
