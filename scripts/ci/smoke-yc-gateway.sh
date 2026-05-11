#!/usr/bin/env bash
set -euo pipefail

: "${SMOKE_BASE_URL:?SMOKE_BASE_URL is required}"

host_header="${SMOKE_HOST_HEADER:-}"
smoke_body="$(mktemp)"

cleanup() {
  rm -f "${smoke_body}" || true
}
trap cleanup EXIT

curl_status() {
  local path="$1"
  if [[ -n "${host_header}" ]]; then
    curl -sS -o "${smoke_body}" -w "%{http_code}" \
      -H "Host: ${host_header}" \
      "${SMOKE_BASE_URL}${path}"
  else
    curl -sS -o "${smoke_body}" -w "%{http_code}" \
      "${SMOKE_BASE_URL}${path}"
  fi
}

capture_headers() {
  local path="$1"
  local output_file="$2"
  if [[ -n "${host_header}" ]]; then
    curl -sS -D "${output_file}" -o "${smoke_body}" \
      -H "Host: ${host_header}" \
      "${SMOKE_BASE_URL}${path}" >/dev/null
  else
    curl -sS -D "${output_file}" -o "${smoke_body}" \
      "${SMOKE_BASE_URL}${path}" >/dev/null
  fi
}

assert_status_in() {
  local actual="$1"
  shift
  local allowed=("$@")
  local expected
  for expected in "${allowed[@]}"; do
    if [[ "${actual}" == "${expected}" ]]; then
      return 0
    fi
  done
  echo "Unexpected status: ${actual}. Allowed: ${allowed[*]}" >&2
  cat "${smoke_body}" >&2 || true
  return 1
}

assert_header_contains() {
  local header_file="$1"
  local header_name="$2"
  local expected="$3"
  if ! grep -i "^${header_name}:" "${header_file}" | grep -qi "${expected}"; then
    echo "Missing expected header ${header_name}: ${expected}" >&2
    cat "${header_file}" >&2 || true
    return 1
  fi
}

index_status="$(curl_status "/")"
assert_status_in "${index_status}" 200
echo "Frontend OK: ${index_status}"

spa_status="$(curl_status "/app/non-existent-client-route")"
assert_status_in "${spa_status}" 200
echo "SPA fallback OK: ${spa_status}"

session_status="$(curl_status "/api/v1/session/me")"
assert_status_in "${session_status}" 200 401 403
echo "BFF session endpoint OK: ${session_status}"

login_status="$(curl_status "/api/v1/auth/login")"
assert_status_in "${login_status}" 200 302 303 307 308 401 403
echo "Login start endpoint OK: ${login_status}"

api_headers="$(mktemp)"
index_headers="$(mktemp)"
trap 'cleanup; rm -f "${api_headers}" "${index_headers}" || true' EXIT

capture_headers "/api/v1/session/me" "${api_headers}"
assert_header_contains "${api_headers}" "X-Frame-Options" "DENY"
assert_header_contains "${api_headers}" "X-Content-Type-Options" "nosniff"
assert_header_contains "${api_headers}" "Strict-Transport-Security" "max-age="
echo "BFF security headers OK"

capture_headers "/index.html" "${index_headers}"
assert_header_contains "${index_headers}" "Cache-Control" "no-cache"
echo "Frontend cache headers OK"
