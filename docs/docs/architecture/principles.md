---
title: Architecture Principles
---

# Architecture Principles

Ниже зафиксированы правила, которые уже отражены в коде или должны считаться baseline для доработок.

## 1. BFF is mandatory

Frontend не общается напрямую с внутренними сервисами. Канонический путь:

```text
Browser -> BFF -> internal service
```

Зачем это нужно:

- единая cookie session модель;
- единая tenant resolution logic;
- единая нормализация ошибок;
- меньше browser-visible секретов и внутренних URL.

## 2. Tenant context is first-class

Почти любой пользовательский объект должен быть привязан к tenant scope.

Практический baseline:

- доменные таблицы содержат `tenant_id`;
- внутренние запросы несут `X-Tenant-Id` и `X-Tenant-Slug`;
- list/detail endpoints фильтруют по tenant на уровне queryset;
- permission checks выполняются в tenant scope или в более узком scope.

## 3. Authorization lives in Access

Решение "можно или нельзя" не должно дублироваться по сервисам произвольным образом. Доменные сервисы могут знать собственные ownership rules, но capability/role model идет через Access.

## 4. Session authority is not spread across services

Browser session материализуется в BFF. Доменные сервисы не должны ожидать живую browser session или самостоятельно разбирать frontend auth state.

## 5. Internal calls must be explicit

Если сервис вызывает другой сервис, это должно быть видно по коду и документации:

- какой endpoint зовется;
- по какому поводу;
- какие поля считаются обязательными;
- какой fallback и timeout используется.

## 6. Domain ownership beats convenience

Если данные принадлежат одному сервису, другой сервис не должен владеть их копией без причины. Разрешенные исключения:

- денормализованные поля для UX;
- outbox/events;
- кеши и snapshots.

## 7. Observability is part of the contract

Новый модуль без request tracing, health surface и тестов не считается готовым.

Минимум:

- `request_id` propagation;
- health endpoint;
- focused tests для критических веток;
- предсказуемый error envelope.

## 8. Privacy and retention are not optional afterthoughts

Любой модуль, который хранит user-related data, должен иметь понятную историю по:

- lawful purpose;
- export/erase behavior;
- retention;
- auditability.

## 9. Legacy surfaces must be labeled

В репозитории есть переходные слои, особенно в `voting`. Это нормально, но важно явно документировать:

- что legacy;
- что использовать для новой разработки;
- какие compat guarantees поддерживаются.
