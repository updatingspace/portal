#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tf_file="${root_dir}/infra/terraform/yandex-cloud/main.tf"
smoke_file="${root_dir}/scripts/ci/smoke-yc-gateway.sh"

fail() {
  echo "YC hardening audit failed: $*" >&2
  exit 1
}

extract_container_block() {
  local name="$1"
  awk "
    \$0 ~ \"resource \\\"yandex_serverless_container\\\" \\\"${name}\\\"\" { in_block=1 }
    in_block { print }
    in_block && /^}/ { exit }
  " "${tf_file}"
}

if rg -n 'force_destroy\\s*=\\s*true' "${tf_file}" >/dev/null 2>&1; then
  fail "Object Storage buckets must not hardcode force_destroy=true"
fi

if extract_container_block "access" | rg -n 'S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY' >/dev/null 2>&1; then
  fail "Access container must not receive S3/YMQ static credentials"
fi

if extract_container_block "portal" | rg -n 'S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY' >/dev/null 2>&1; then
  fail "Portal container must not receive S3/YMQ static credentials"
fi

if rg -n 'ci\\s*=\\s*yandex_iam_service_account\\.ci\\.id' "${tf_file}" >/dev/null 2>&1; then
  fail "CI service account must not be granted folder editor by default"
fi

if ! rg -n 'Strict-Transport-Security' "${smoke_file}" >/dev/null 2>&1; then
  fail "Public smoke script must verify Strict-Transport-Security"
fi

if ! rg -n 'X-Frame-Options' "${smoke_file}" >/dev/null 2>&1; then
  fail "Public smoke script must verify X-Frame-Options"
fi

if ! rg -n 'Cache-Control' "${smoke_file}" >/dev/null 2>&1; then
  fail "Public smoke script must verify frontend cache headers"
fi

echo "YC hardening audit passed."
