---
title: Testing Strategy
---

# Testing Strategy

## Что считается минимально достаточным

Для backend-сервиса:

- focused unit tests на новую бизнес-логику;
- integration tests на auth/permission critical paths;
- regression tests на tenant isolation, если затрагивается scope logic.

Для frontend:

- Vitest на shared API clients и business hooks;
- integration tests на критические route flows;
- Playwright на основные пользовательские сценарии, если меняется UX path.

## High-risk areas

- BFF auth/session;
- Access permission evaluation;
- Voting compat behavior;
- Activity connectors and feed serialization;
- frontend route guards.

## Documentation requirement

Если меняется contract surface, в PR должны обновляться не только тесты, но и соответствующие docs pages.
