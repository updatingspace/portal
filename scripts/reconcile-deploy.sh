#!/usr/bin/env bash
#
# Разовая reconciliation-раскатка текущего master в прод Yandex Cloud ЛОКАЛЬНО
# (реальный terraform.tfstate + yc-sa-key.json). Нужна, потому что деплой-пайплайн
# работает plan-only (нет remote backend), а state живёт локально.
#
# Делает по шагам, с ревью человеком:
#   1) tofu plan  — показывает дифф (ожидаемо: контейнеры -> текущий master,
#      ОБА домена portal.updspace.com + *.t.updspace.com, IAM editor -> least-priv)
#   2) подтверждение (ввести yes)
#   3) tofu apply
#   4) сборка + публикация фронта в Object Storage (если заданы ключи)
#   5) smoke-проверка публичного gateway
#
# ЗАПУСК:
#   export YC_SERVICE_ACCOUNT_KEY_FILE=~/Documents/Codex/portal/yc-sa-key.json
#   # для публикации фронта (шаг 4) дополнительно:
#   export AWS_ACCESS_KEY_ID=...            # YC static access key (Object Storage)
#   export AWS_SECRET_ACCESS_KEY=...
#   export AWS_DEFAULT_REGION=ru-central1
#   export YC_FRONTEND_BUCKET_NAME=...      # имя бакета фронта
#   # для smoke (шаг 5):
#   export SMOKE_BASE_URL=https://portal.updspace.com
#   bash scripts/reconcile-deploy.sh
#
# ПЕРЕД ЗАПУСКОМ сверь reconcile.tfvars: актуальный build образов и
# portal_certificate_id (сейчас cert *.updspace.com, покрывает portal.updspace.com).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT}/infra/terraform/yandex-cloud"
VAR_FILE="${TF_DIR}/reconcile.tfvars"

export YC_SERVICE_ACCOUNT_KEY_FILE="${YC_SERVICE_ACCOUNT_KEY_FILE:-${ROOT}/yc-sa-key.json}"

command -v tofu >/dev/null 2>&1 || { echo "tofu не найден" >&2; exit 1; }
[[ -f "${YC_SERVICE_ACCOUNT_KEY_FILE}" ]] || { echo "нет SA-ключа: ${YC_SERVICE_ACCOUNT_KEY_FILE}" >&2; exit 1; }
[[ -f "${VAR_FILE}" ]] || { echo "нет ${VAR_FILE}" >&2; exit 1; }

echo "== 1/5 tofu init =="
tofu -chdir="${TF_DIR}" init -input=false >/dev/null

echo "== 2/5 tofu plan (ревью диффа ниже) =="
tofu -chdir="${TF_DIR}" plan -input=false -var-file="${VAR_FILE}"

echo
read -r -p "Применить показанный план в ПРОД? введи 'yes': " answer
if [[ "${answer}" != "yes" ]]; then
  echo "Отменено пользователем."
  exit 1
fi

echo "== 3/5 tofu apply =="
tofu -chdir="${TF_DIR}" apply -input=false -var-file="${VAR_FILE}" -auto-approve

echo "== 4/5 публикация фронта =="
if [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${YC_FRONTEND_BUCKET_NAME:-}" ]]; then
  ( cd "${ROOT}/web/portal-frontend" \
      && corepack enable >/dev/null 2>&1 || true \
      && pnpm install --frozen-lockfile \
      && pnpm run build:docker )
  YC_BUCKET_NAME="${YC_FRONTEND_BUCKET_NAME}" \
  FRONTEND_DIST_DIR="${ROOT}/web/portal-frontend/dist" \
    bash "${ROOT}/scripts/ci/deploy-frontend-object-storage.sh"
else
  echo "SKIP: задай AWS_ACCESS_KEY_ID/SECRET + YC_FRONTEND_BUCKET_NAME для публикации фронта."
fi

echo "== 5/5 smoke =="
if [[ -n "${SMOKE_BASE_URL:-}" ]]; then
  bash "${ROOT}/scripts/ci/smoke-yc-gateway.sh" || echo "smoke упал — проверь вкладки вручную."
else
  echo "SKIP: задай SMOKE_BASE_URL (напр. https://portal.updspace.com) для smoke."
fi

echo "== Готово. Проверь вкладки на портале. =="
