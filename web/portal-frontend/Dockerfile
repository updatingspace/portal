# syntax=docker/dockerfile:1.7

FROM node:22.12-alpine AS builder

ARG VITE_BUILD_ID=dev
ENV VITE_BUILD_ID=${VITE_BUILD_ID}

RUN npm i -g corepack@0.34.6 \
  && corepack --version \
  && corepack enable \
  && corepack prepare pnpm@10.28.2 --activate \
  && pnpm --version

WORKDIR /app

COPY web/portal-frontend/package.json web/portal-frontend/pnpm-lock.yaml ./web/portal-frontend/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm -C web/portal-frontend config set store-dir /pnpm/store \
  && pnpm -C web/portal-frontend install --frozen-lockfile

COPY . .

RUN pnpm -C web/portal-frontend run build:docker

FROM nginx:1.27-alpine AS runner

COPY web/portal-frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/web/portal-frontend/dist /usr/share/nginx/html
COPY web/portal-frontend/scripts/frontend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
