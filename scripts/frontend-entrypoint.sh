#!/bin/sh
set -eu

WEB_ROOT="/usr/share/nginx/html"

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\\/&]/\\&/g'
}

replace_placeholder() {
  placeholder="$1"
  value="$2"
  [ -z "$value" ] && return 0
  escaped_value="$(escape_sed "$value")"
  find "$WEB_ROOT" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -print0 |
    xargs -0 sed -i "s|__${placeholder}__|${escaped_value}|g"
}

replace_placeholder "VITE_API_BASE_URL" "${VITE_API_BASE_URL:-}"
replace_placeholder "VITE_TELEGRAM_BOT_NAME" "${VITE_TELEGRAM_BOT_NAME:-}"

# Дополнительно переписываем дефолтный локальный адрес, если плейсхолдер не сработал
if [ -n "${VITE_API_BASE_URL:-}" ]; then
  escaped_api="$(escape_sed "${VITE_API_BASE_URL}")"
  find "$WEB_ROOT" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -print0 |
    xargs -0 sed -i "s|http://localhost:8000/api|${escaped_api}|g"
fi

exec nginx -g "daemon off;"
