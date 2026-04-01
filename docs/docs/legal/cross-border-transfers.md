---
title: Cross-Border Transfer Policy
description: Политика трансграничной передачи и регионального размещения данных
---

# Cross-Border Transfer Policy

## 1. Purpose

Этот документ фиксирует правила трансграничной передачи и регионального размещения персональных данных для UpdSpace Portal.

## 2. Target model

### Russian users / Russian citizens

- primary databases для данных граждан РФ должны размещаться в РФ;
- сбор и основная обработка таких данных должны учитывать российские требования к локализации.

### EEA users

- целевое состояние: primary hosting и routine processing в ЕЭЗ;
- передача в третьи страны допускается только после отдельной legal/privacy проверки.

## 3. Current-state warning

На момент подготовки этого пакета основная production инфраструктура находится в **России**.

Это означает:

- для данных граждан РФ такая локация может быть совместима с локализационной моделью;
- для данных, подпадающих под GDPR и поступающих из ЕЭЗ, текущая схема требует отдельной оценки transfer compliance.

## 4. Go-live rule for EEA expansion

До активного production launch для пользователей из ЕЭЗ оператор должен выполнить хотя бы одно условие:

1. запустить EEA-hosted environment и держать EEA primary data в ЕЭЗ;
2. либо оформить и задокументировать допустимый Chapter V GDPR transfer mechanism, включая transfer impact assessment и vendor commitments.

Без этого EU go-live я не считаю юридически clean.

## 5. Allowed transfer mechanisms

Для данных, подпадающих под GDPR, использовать один из правомерных механизмов:

- adequacy decision, если страна признана адекватной;
- appropriate safeguards, включая contractual safeguards where applicable;
- narrow derogations for exceptional situations, но не как основную постоянную модель.

Explicit consent на transfer использовать только как исключение, а не как основную архитектурную опору.

## 6. Operational rules

- не смешивать EEA and RU routing без documented reason;
- иметь реестр transfer scenarios;
- проверять фактическое местонахождение storage, logs, backups and support access;
- отражать новые transfer chains в RoPA и processor register;
- обновлять user-facing Privacy Notice при изменении географии обработки.

## 7. Minimum documentation set per transfer scenario

- purpose of transfer;
- exporting entity / controller context;
- importing provider or environment;
- countries involved;
- data categories;
- legal mechanism used;
- risk assessment summary;
- retention and deletion commitments;
- incident notification commitments.
