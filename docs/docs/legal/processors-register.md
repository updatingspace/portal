---
title: Processor & Subprocessor Register
description: Реестр обработчиков и инфраструктурных получателей персональных данных
---

# Processor & Subprocessor Register

## 1. Как использовать этот документ

Это рабочий реестр провайдеров, которые обрабатывают или потенциально получают доступ к персональным данным в связи с эксплуатацией UpdSpace Portal.

Перед публичным релизом для каждого провайдера нужно подтвердить:

- точное юрнаименование контрагента;
- страну регистрации;
- роль: processor / independent recipient / infrastructure only;
- наличие DPA / processing terms;
- локацию обработки;
- какие категории данных он реально видит.

## 2. Current baseline

| Provider | Role | Region | Data categories | Status / action |
|---|---|---|---|---|
| Yandex Cloud | processor / infrastructure provider | Russia | databases, application logs, object storage and service metadata to the extent actually hosted there | confirm exact contracting entity and DPA terms before publication |
| Self-hosted infrastructure operated by controller | controller-owned infrastructure, not a separate processor | Russia | any data deployed there by the controller | document physical and access controls internally |

## 3. To be confirmed before production sign-off

Добавь сюда каждого реального провайдера, если он используется в проде:

- email delivery;
- CDN;
- object storage;
- uptime/error monitoring;
- customer support tooling;
- analytics;
- anti-bot / security tooling;
- transactional messaging;
- backups managed by third party.

## 4. Minimum diligence for each processor

Для каждого processor нужно проверить:

- подписан ли DPA;
- какие субобработчики используются;
- где именно хранятся данные;
- как реализованы deletion, export and incident notification commitments;
- есть ли международные transfer clauses, если это требуется.
