---
title: Local Development
---

# Local Development

## Repo shape

```text
services/
web/portal-frontend/
infra/docker-compose/
docs/
scripts/
```

## Working model

- backend services запускаются как отдельные Django apps;
- portal frontend живет отдельно и ходит в BFF;
- identity provider в dev topology приходит как внешний контейнер.

## Useful commands

```bash
./scripts/dev-up.sh
docker compose ps
docker compose logs bff
docker compose exec portal python src/manage.py test
```

## Local dev expectations

- у каждого сервиса своя БД;
- tenant-sensitive сценарии желательно проверять хотя бы на одном tenant slug;
- изменения auth и proxy лучше валидировать одновременно на BFF и frontend.
