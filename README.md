# Updating Space Portal - Microservices

Репозиторий содержит набор Django сервисов (Ninja) и React/Vite фронтенд. Легаси-монолит удален; актуальная структура - `services/` и `infra/`.

## Быстрый старт (dev)
- Запустите dev-стек: `docker compose -f infra/docker-compose/docker-compose.dev.yml up --build`
- Фронт: `http://aef.localhost`
- BFF API: `http://aef.localhost/api/v1`
- IdP: `http://id.localhost`

## Сервисы
- `services/id` (8001) - Identity (auth, users, tenants)
- `services/bff` (8080) - API gateway / session layer
- `services/access` (8002) - RBAC
- `services/portal` (8003) - Portal core
- `services/voting` (8004) - Voting
- `services/events` (8005) - Events
- `services/activity` (8006) - Activity feed
- `web/portal-frontend` (5173) - Frontend

## Инфраструктура и доки
- Dev compose: `infra/docker-compose/docker-compose.dev.yml`
- Convenience wrapper: `infra/docker-compose/docker-compose.yml`
