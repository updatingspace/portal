---
title: Docker Topology
---

# Docker Topology

Локальная инфраструктура задается в `infra/docker-compose/docker-compose.yml`.

## Main containers

- `traefik`
- `redis`
- `db_*` для каждого сервиса
- `updspaceid`
- `bff`
- `access`
- `portal`
- `voting`
- `events`
- `gamification`
- `activity`

## Why topology matters

Compose-файл - это не просто dev convenience. Он же лучше всего показывает фактическую архитектурную карту репозитория:

- какие сервисы реально существуют;
- какие сервисы внешние;
- какие БД отделены;
- как проходит входной трафик.
