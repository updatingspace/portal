#!/usr/bin/env bash
set -euo pipefail

TASK_NAME="${1:-${SERVERLESS_TASK_NAME:-}}"
if [[ -z "${TASK_NAME}" ]]; then
  echo "serverless task name is required" >&2
  exit 64
fi
shift || true

manage() {
  python src/manage.py "$@"
}

case "$TASK_NAME" in
  migrate_ydb)
    exec manage migrate_ydb "$@"
    ;;
  purge_retention)
    if manage help purge_retention >/dev/null 2>&1; then
      exec manage purge_retention "$@"
    fi
    if manage help prune_outbox >/dev/null 2>&1; then
      exec manage prune_outbox "$@"
    fi
    echo "purge_retention is not available for this service" >&2
    exit 65
    ;;
  outbox_process)
    if manage help process_outbox >/dev/null 2>&1; then
      exec manage process_outbox "$@"
    fi
    if manage help publish_outbox >/dev/null 2>&1; then
      exec manage publish_outbox "$@"
    fi
    echo "outbox_process is not available for this service" >&2
    exit 66
    ;;
  *)
    exec manage "$TASK_NAME" "$@"
    ;;
 esac
