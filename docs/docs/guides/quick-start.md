---
title: Quick Start
---

# Quick Start

## 1. Поднять локальную topology

Используйте основной bootstrap script:

```bash
./scripts/dev-up.sh
```

Скрипт опирается на docker compose topology из `infra/docker-compose/docker-compose.yml`.

## 2. Проверить ключевые URL

- portal frontend через Traefik
- BFF health
- сервисные `health` endpoints

## 3. Читать документацию в таком порядке

1. `intro`
2. `architecture/*`
3. `services/overview`
4. конкретный сервис
5. `frontend/portal`

## 4. Не делать в локальной разработке

- не обходить BFF для браузерных запросов;
- не добавлять новые модели без tenant story;
- не добавлять capability keys без документации.
