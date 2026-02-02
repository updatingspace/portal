FROM node:22-alpine AS dev
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.3.0 --activate

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]

FROM dev AS builder

ARG VITE_API_BASE_URL=__VITE_API_BASE_URL__
ARG VITE_TELEGRAM_BOT_NAME=__VITE_TELEGRAM_BOT_NAME__
ARG VITE_ID_LOGIN_URL=__VITE_ID_LOGIN_URL__
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_TELEGRAM_BOT_NAME=${VITE_TELEGRAM_BOT_NAME}
ENV VITE_ID_LOGIN_URL=${VITE_ID_LOGIN_URL}

RUN pnpm build

FROM nginx:1.27-alpine AS runner

# Minimal nginx config with SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY scripts/frontend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
