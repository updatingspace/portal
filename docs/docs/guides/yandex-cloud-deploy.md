---
title: Yandex Cloud Deploy
---

# Yandex Cloud Deploy

Этот runbook фиксирует production-путь для деплоя `updspace-portal` в Yandex Cloud на low-cost serverless-стеке.

## Целевая topology

- `web/portal-frontend` собирается в статический bundle и публикуется в `Object Storage`.
- `API Gateway` отдаёт frontend из bucket и проксирует `/api/v1/{proxy+}` в `BFF`.
- `BFF` и все внутренние Django-сервисы работают как private `Serverless Containers`.
- межсервисные вызовы идут не по private IP, а по private invoke URL контейнеров с IAM bearer token.
- primary database для всех backend services: `YDB serverless`.
- shared Redis в production не используется; session / oauth state / rate-limit живут в YDB, а локальный cache остаётся только как оптимизация в памяти контейнера.
- outbox wake-up делается через `YMQ` + `function_trigger`.

## Выбранный YDB connector stack

В репозитории зафиксирован следующий Python stack:

- `django-ydb-backend==0.0.1b1`
- `ydb==3.28.0`
- `ydb-dbapi==0.1.20`

Практическое правило:

- `django-ydb-backend` используется как основной Django database backend.
- `ydb` и `ydb-dbapi` остаются доступными для custom migration/bootstrap logic и low-level YDB integrations.
- `ydb-sqlalchemy` сознательно не используется.

## Что уже есть в репозитории

- общий `DB_DRIVER=postgres|ydb` contract во всех Django-сервисах;
- `migrate_ydb` command во всех backend services;
- `serverless-task.sh` entrypoint во всех service images;
- BFF transport для private invoke URL + IAM token из metadata;
- YDB-safe fallback для hot-path, где использовались `select_for_update`;
- Terraform scaffold в [`infra/terraform/yandex-cloud`](/Users/mihhailmatvejev/updspace-portal/portal/infra/terraform/yandex-cloud);
- GitHub Actions workflow для Yandex Cloud deploy;
- smoke script для публичного gateway.

## Environment contract

### Общие backend env

- `DB_DRIVER=postgres|ydb`
- `DATABASE_URL`
- `YDB_ENDPOINT`
- `YDB_DATABASE`
- `YDB_NAME`
- `YDB_CREDENTIALS_MODE=metadata|token|sa_json`
- `YDB_TOKEN`
- `YDB_SERVICE_ACCOUNT_JSON`
- `DJANGO_SECRET_KEY`
- `BFF_INTERNAL_HMAC_SECRET`
- `object_storage_force_destroy=false`

### BFF env

- `BFF_UPSTREAM_ACCESS_INVOKE_URL`
- `BFF_UPSTREAM_PORTAL_INVOKE_URL`
- `BFF_UPSTREAM_VOTING_INVOKE_URL`
- `BFF_UPSTREAM_EVENTS_INVOKE_URL`
- `BFF_UPSTREAM_FEED_INVOKE_URL`
- `BFF_UPSTREAM_GAMIFICATION_INVOKE_URL`
- `BFF_UPSTREAM_FEATUREFLAGS_INVOKE_URL`
- `ID_BASE_URL`
- `ID_PUBLIC_BASE_URL`
- `BFF_OIDC_CLIENT_ID`
- `BFF_OIDC_CLIENT_SECRET`
- `BFF_UPDSPACEID_CALLBACK_SECRET`

### Activity / media env

- `NEWS_MEDIA_BUCKET`
- `NEWS_MEDIA_PREFIX`
- `S3_ENDPOINT_URL=https://storage.yandexcloud.net`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `ACTIVITY_DATA_ENCRYPTION_KEY`

### Queue / deploy metadata env

- `YMQ_ACTIVITY_QUEUE`
- `YMQ_EVENTS_QUEUE`
- `YMQ_FEATUREFLAGS_QUEUE`
- `YMQ_GAMIFICATION_QUEUE`
- `YMQ_VOTING_QUEUE`
- `YC_API_GATEWAY_DOMAIN`
- `YC_CERTIFICATE_ID`
- `YC_LOCKBOX_SECRET_RUNTIME_ID`
- `YC_LOCKBOX_SECRET_RUNTIME_VERSION_ID`
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` are reused for YMQ publish credentials

## Terraform

Главный source of truth лежит в [`infra/terraform/yandex-cloud`](/Users/mihhailmatvejev/updspace-portal/portal/infra/terraform/yandex-cloud).

### Bootstrap

1. Скопировать [`terraform.tfvars.example`](/Users/mihhailmatvejev/updspace-portal/portal/infra/terraform/yandex-cloud/terraform.tfvars.example) в локальный `.tfvars` файл.
2. Заполнить:
   - `cloud_id`
   - `folder_id`
   - `certificate_id`
   - `id_public_base_url`
   - `id_internal_api_url`
   - `container_image_tags`
   - `service_environment`
   - `lockbox_secret_entries`
   - `object_storage_force_destroy=false`
3. Выполнить:

```bash
terraform -chdir=infra/terraform/yandex-cloud init
terraform -chdir=infra/terraform/yandex-cloud plan
terraform -chdir=infra/terraform/yandex-cloud apply
```

### Важные outputs

- `container_registry_id`
- `frontend_bucket_name`
- `media_bucket_name`
- `service_invoke_urls`
- `outbox_queue_arns`
- `ydb_endpoint`
- `ydb_database`
- `runtime_lockbox_secret_id`
- `runtime_lockbox_secret_version_id`

## CI/CD

Репозиторий использует два workflow'а:

- [`ci.yml`](/Users/mihhailmatvejev/updspace-portal/portal/.github/workflows/ci.yml)
  Что делает:
  - Python lint/tests по сервисам
  - YDB-local smoke и `migrate_ydb --dry-run`
  - frontend build/lint/typecheck
  - `terraform fmt -check` + `terraform validate`
  - docker build validation
- `deploy-yandex-cloud.yml`
  Что делает:
  - build/push service images в `Yandex Container Registry`
  - frontend publish в `Object Storage`
  - `terraform plan` / `terraform apply`
  - one-shot YDB migration bootstrap against target YDB
  - post-deploy smoke against public gateway

### Required GitHub secrets

- `YC_SERVICE_ACCOUNT_KEY_JSON`
- `YC_CLOUD_ID`
- `YC_FOLDER_ID`
- `YC_CONTAINER_REGISTRY_ID`
- `YC_FRONTEND_BUCKET_NAME`
- `YC_TF_VARS_B64`
- `YC_OBJECT_STORAGE_ACCESS_KEY_ID`
- `YC_OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `YC_PUBLIC_BASE_URL`
- `YC_SMOKE_HOST`
- optional: `YC_TERRAFORM_AUTO_APPLY=true`

## Migrations и schema bootstrap

### Почему не обычный `migrate`

Текущая Postgres migration history не переносится в YDB 1:1. Поэтому для `DB_DRIVER=ydb` используется отдельный bootstrap path.

### Что запускать

Для каждого backend image есть entrypoint:

```bash
/app/bin/serverless-task.sh migrate_ydb
/app/bin/serverless-task.sh outbox_process
/app/bin/serverless-task.sh purge_retention
```

Локально или в CI:

```bash
cd services/bff
DB_DRIVER=ydb \
YDB_ENDPOINT=grpcs://... \
YDB_DATABASE=/ru-central1/... \
YDB_NAME=default \
YDB_CREDENTIALS_MODE=metadata \
python src/manage.py migrate_ydb
```

## Rollout order

Переходить на YDB и private serverless containers нужно по сервисам:

1. `featureflags`
2. `access`
3. `portal`
4. `events`
5. `gamification`
6. `voting`
7. `activity`
8. `bff`

## Smoke checks

Публичный smoke script: [`scripts/ci/smoke-yc-gateway.sh`](/Users/mihhailmatvejev/updspace-portal/portal/scripts/ci/smoke-yc-gateway.sh)

Он проверяет:

- `/` отдаётся через API Gateway и Object Storage;
- SPA fallback route возвращает `200`;
- `/api/v1/session/me` отвечает без `5xx`;
- `/api/v1/auth/login` существует и не даёт `404`.
- BFF endpoint возвращает `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`.
- `index.html` отдаётся с `Cache-Control: no-cache`.

Пример:

```bash
SMOKE_BASE_URL=https://aef.updspace.com \
SMOKE_HOST_HEADER=aef.updspace.com \
./scripts/ci/smoke-yc-gateway.sh
```

## Rollback

- frontend rollback: перепубликовать предыдущий build в frontend bucket;
- containers rollback: вернуть предыдущий image tag в `container_image_tags` и повторить `terraform apply`;
- YDB rollback: только через сервисный cutover plan, потому что backward-incompatible schema changes нельзя откатывать без data verification;
- если сломан BFF routing, сначала вернуть старый BFF tag, только потом трогать downstream services.

## Cutover checklist

- Terraform applied без drift.
- frontend bucket содержит актуальный `index.html` и `assets/*`.
- `service_invoke_urls` проброшены в BFF env.
- session state и rate-limit state находятся в DB/YDB, Redis не нужен.
- YMQ triggers в статусе `ACTIVE`.
- nightly retention timers в статусе `ACTIVE`.
- smoke script проходит по tenant domain.

## Security hardening

- `object_storage_force_destroy` должен оставаться `false` в production.
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` должны быть примонтированы только в контейнеры, которые реально публикуют в `YMQ` или пишут в `Object Storage`.
- Перед production cutover нужно сузить folder-level IAM роли service accounts; текущий baseline rollout всё ещё шире, чем целевой least-privilege.
- Все production secrets должны приезжать через `Lockbox`, а не через plain-text `service_environment`.
