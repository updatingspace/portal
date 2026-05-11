# Yandex Cloud Terraform

Этот каталог описывает production-подобный YC контур для UpdSpace Portal:

- `Object Storage` для `web/portal-frontend`
- `API Gateway` для same-origin маршрутизации `/api/v1/*` -> BFF и `/` -> frontend bucket
- private `Serverless Containers` для BFF и внутренних Django-сервисов
- `YDB serverless` как общий low-cost primary database
- `YMQ` + `function_trigger` для outbox wake-up
- nightly timer triggers для retention tasks
- `Lockbox` для runtime secrets

## Что создаётся

- `runtime`, `gateway`, `trigger`, `automation`, `ci` service accounts
- VPC network + subnet
- frontend/media buckets
- YDB serverless database
- serverless containers для сервисов
- task containers для `outbox_process` и `purge_retention`
- YMQ queues + triggers для `activity`, `events`, `featureflags`, `gamification`, `voting`
- shared API Gateway
- optional public DNS zone + wildcard record

## Важные допущения

- `Object Storage` buckets по умолчанию не `force_destroy`; удаление непустых bucket'ов нужно включать явно через `object_storage_force_destroy=true`.
- `ci` service account не получает folder-level `editor`, пока не появится реальный use case.
- Terraform всё ещё даёт runtime/gateway/trigger/automation service accounts роль `editor` на каталог. Это baseline для reproducible rollout, но перед production hardening роли нужно сузить.
- Wildcard certificate ожидается как уже выпущенный `certificate_id`. Сертификат можно bootstrap'нуть отдельно в Certificate Manager и затем передать его ID сюда.
- `UpdSpaceID` живёт вне этого репозитория. Для BFF указываются `id_public_base_url` и при необходимости `id_internal_api_url`.
- Один serverless YDB database используется всеми сервисами; разделение идёт по именам таблиц и сервисным migration job'ам.

## Секреты Lockbox

`lockbox_secret_entries` должен как минимум содержать:

- `DJANGO_SECRET_KEY`
- `BFF_INTERNAL_HMAC_SECRET`
- `BFF_UPDSPACEID_CALLBACK_SECRET`
- `BFF_OIDC_CLIENT_SECRET`
- `ACTIVITY_DATA_ENCRYPTION_KEY`

Статические S3/YMQ ключи добавляются автоматически в тот же Lockbox secret как `S3_ACCESS_KEY_ID` и `S3_SECRET_ACCESS_KEY`.

## Порядок применения

1. Скопировать `terraform.tfvars.example` в локальный `.tfvars` файл и заполнить реальные значения.
2. `terraform init`
3. `terraform plan`
4. `terraform apply`
5. Взять значения из `terraform output`:
   - `container_registry_id`
   - `frontend_bucket_name`
   - `runtime_lockbox_secret_id`
   - `service_invoke_urls`
   - `api_gateway_invoke_domain`
6. Настроить GitHub Actions secrets для deploy workflow.
7. Запустить deploy workflow, который загрузит образы в YCR, frontend в Object Storage, применит Terraform и выполнит smoke checks.

## Полезные outputs

- `service_invoke_urls`
- `outbox_queue_arns`
- `ydb_endpoint`
- `ydb_database`
- `api_gateway_invoke_domain`
