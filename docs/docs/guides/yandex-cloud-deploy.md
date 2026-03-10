---
title: Deployment Baseline
---

# Deployment Baseline

Этот раздел не является полным production runbook, но фиксирует то, что важно для deploy-minded чтения репозитория.

## Current reality

- российский контур использует Yandex Cloud и домашний сервер для части окружений;
- планируется отдельный EU deployment path;
- identity provider находится вне этого репозитория.

## Production baseline

- TLS termination и trusted proxy headers должны быть согласованы с BFF security settings;
- каждый сервис должен иметь собственный секрет и БД;
- BFF internal HMAC secret должен поставляться как обязательный secret, а не как fallback;
- privacy/legal requirements для RF и EEA нужно проверять до rollout в соответствующий регион.
