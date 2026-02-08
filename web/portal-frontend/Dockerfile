# syntax=docker/dockerfile:1.7

FROM node:22.12-alpine AS base

ARG VITE_BUILD_ID=dev
ENV VITE_BUILD_ID=${VITE_BUILD_ID}

RUN npm i -g corepack@0.34.6 \
  && corepack --version \
  && corepack enable \
  && corepack prepare pnpm@10.28.2 --activate \
  && pnpm --version

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store \
  && pnpm install --frozen-lockfile

FROM base AS dev

COPY . ./

EXPOSE 5173
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM base AS builder

COPY . ./

RUN pnpm run build:docker

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY scripts/frontend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
