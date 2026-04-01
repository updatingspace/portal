---
title: DSAR Procedure
description: Внутренний порядок обработки запросов субъектов персональных данных
---

# DSAR Procedure

## 1. Scope

Этот порядок применяется к запросам на:

- access / export;
- rectification;
- erasure;
- restriction;
- objection;
- portability;
- withdrawal of consent;
- clarification of processing.

## 2. Intake channels

Основной канал: **privacy@updspace.com**

Дополнительно:

- self-service endpoint `GET /api/v1/account/me/export`;
- self-service delete `DELETE /api/v1/account/me`;
- support channel, если запрос был переслан в privacy queue без потери контекста.

## 3. Identity verification

До выполнения запроса оператор должен разумно убедиться, что запрос подал сам субъект данных или его надлежащий представитель.

Минимально допустимые способы:

- запрос из already authenticated session;
- подтверждение через контрольный email;
- дополнительное подтверждение владения аккаунтом;
- для представителя: проверка полномочий.

Не запрашивать избыточные документы, если можно верифицировать личность менее intrusive способом.

## 4. Request logging

Для каждого запроса нужно фиксировать:

- request ID / internal ticket ID;
- дату и время получения;
- кто обратился;
- тип запроса;
- применимое право/юрисдикцию;
- статус;
- дату ответа;
- short summary результата;
- основание отказа, если отказ был.

## 5. Operational deadlines

- acknowledgement: в течение `3` рабочих дней;
- простые verified requests: целевой срок `10` рабочих дней;
- GDPR requests: без неоправданной задержки и обычно не позднее `1` месяца;
- если GDPR request сложный, срок может быть продлен, но субъект должен быть уведомлен о продлении и его причине.

Если конкретная категория запроса подпадает под более короткий обязательный срок применимого закона, действует более короткий срок.

## 6. Handling flow

1. принять запрос и присвоить ticket ID;
2. определить юрисдикцию и тип запроса;
3. проверить личность и полномочия;
4. определить, какие сервисы затронуты;
5. собрать данные или применить erase/anonymization;
6. проверить, есть ли lawful reason ограничить объем ответа;
7. подготовить ответ в понятной форме;
8. закрыть ticket и записать outcome.

## 7. Service map for UpdSpace Portal

При обработке запроса учитывать как минимум:

- BFF: sessions, session audit;
- Portal: profiles, memberships, posts;
- Activity: account links, raw events, normalized activity, feed content;
- Access: role bindings, overrides, tenant admin audit;
- Events: created events, RSVP, attendance;
- Voting: polls, invites, votes;
- Gamification: achievements and grants;
- ID layer: identity/account data.

## 8. Grounds to refuse or limit

Оператор может ограничить или отказать в запросе только при наличии законного основания, например:

- запрос невозможно разумно связать с субъектом;
- запрос явно необоснован или чрезмерен;
- выполнение нарушит права и свободы других лиц;
- часть данных подлежит обязательному хранению по закону;
- раскрытие затронет security controls, anti-fraud tooling или ongoing investigation сверх допустимого объема.

Любой отказ должен быть зафиксирован письменно и отправлен субъекту в понятной форме.

## 9. Rectification

Если данные неточны или неполны, оператор:

- исправляет данные, если может это проверить;
- либо помечает их как disputed до проверки;
- либо сообщает субъекту, какие дополнительные сведения нужны.

## 10. Erasure

При verified erasure request оператор:

- удаляет данные, которые можно удалить без нарушения закона;
- обезличивает данные, которые нужно сохранить для integrity/history/security;
- отзывает активные сессии;
- отключает optional integrations, если они связаны с запросом;
- документирует, какие системы были затронуты.

## 11. Portability / export

Экспорт должен предоставляться в структурированном и разумно машиночитаемом формате.

Для self-service baseline сервис использует `GET /api/v1/account/me/export`.

## 12. Minors

Если возникает обоснованное подозрение, что запрос связан с аккаунтом ребенка, оператор должен:

- действовать особенно осторожно при верификации;
- при необходимости запросить подтверждение представителя;
- не раскрывать избыточные данные третьим лицам.

## 13. Escalation

Запрос должен быть эскалирован на manual legal/privacy review, если он касается:

- children data;
- law-enforcement/legal hold;
- cross-border transfer objections;
- third-party account-linking disputes;
- incident-related data.
