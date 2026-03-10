#!/usr/bin/env bash
set -euo pipefail

: "${YC_BUCKET_NAME:?YC_BUCKET_NAME is required}"

FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-web/portal-frontend/dist}"
YC_OBJECT_STORAGE_ENDPOINT="${YC_OBJECT_STORAGE_ENDPOINT:-https://storage.yandexcloud.net}"

if [[ ! -d "${FRONTEND_DIST_DIR}" ]]; then
  echo "Build directory not found: ${FRONTEND_DIST_DIR}" >&2
  exit 1
fi

if [[ "${YC_OBJECT_STORAGE_ENDPOINT}" != http* ]]; then
  YC_OBJECT_STORAGE_ENDPOINT="https://${YC_OBJECT_STORAGE_ENDPOINT}"
fi

echo "Deploying frontend bundle from ${FRONTEND_DIST_DIR} to s3://${YC_BUCKET_NAME}"

deploy_args=(--endpoint-url "${YC_OBJECT_STORAGE_ENDPOINT}" --only-show-errors)

if [[ -d "${FRONTEND_DIST_DIR}/assets" ]]; then
  aws s3 sync "${FRONTEND_DIST_DIR}/assets/" "s3://${YC_BUCKET_NAME}/assets/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    "${deploy_args[@]}"
fi

aws s3 sync "${FRONTEND_DIST_DIR}/" "s3://${YC_BUCKET_NAME}/" \
  --delete \
  --exclude "assets/*" \
  --exclude "index.html" \
  --cache-control "public, max-age=300" \
  "${deploy_args[@]}"

aws s3 cp "${FRONTEND_DIST_DIR}/index.html" "s3://${YC_BUCKET_NAME}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8" \
  "${deploy_args[@]}"

# Optional SPA fallback object for gateways/static-site setups that map 404 -> /404.html.
aws s3 cp "${FRONTEND_DIST_DIR}/index.html" "s3://${YC_BUCKET_NAME}/404.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8" \
  "${deploy_args[@]}"

echo "Frontend deploy to Object Storage completed."
