---
title: Data Retention Schedule
description: Базовый график хранения и удаления персональных данных
---

# Data Retention Schedule

Этот документ фиксирует базовые сроки хранения персональных данных для UpdSpace Portal.

## 1. Общие правила

- хранить данные не дольше, чем это нужно для заявленной цели;
- где возможно, применять удаление или обезличивание;
- security/audit records могут храниться дольше операционных данных, если это оправдано безопасностью и accountability;
- backup retention должен быть согласован с infra и отдельно зафиксирован до production sign-off.

## 2. Schedule

| Категория данных | Сервисы/системы | Срок | Действие по окончании |
|---|---|---|---|
| Активная пользовательская учетная запись и профиль | ID, Portal | пока аккаунт активен | delete or anonymize on verified deletion request |
| Session records | BFF | до истечения сессии; revoked/expired sessions дополнительно хранятся до `30` дней | purge job |
| BFF audit events | BFF | `365` дней | purge job |
| Portal audit events | Portal | `365` дней | purge job |
| Activity audit events | Activity | `365` дней | purge job |
| Tenant admin audit events | Access | `365` дней | purge job |
| Raw external connector events | Activity | `30` дней | delete |
| Processed outbox rows | Activity | `14` дней после обработки | delete |
| Account-link records и connector settings | Activity | пока интеграция активна или пока аккаунт не удалён | delete on unlink / DSAR erase |
| Нормализованные activity events | Activity | пока нужны для feed/history, но не дольше срока жизни аккаунта и community feature | anonymize or delete on DSAR erase |
| Community posts/comments/reactions | Portal, Activity | пока контент существует и пользователь/администратор его не удалил, либо пока аккаунт не удалён | anonymize/redact on DSAR erase where applicable |
| Events, RSVP, attendance | Events | пока существует соответствующее событие и связанный community history, либо до verified erasure | delete or anonymize on DSAR erase |
| Polls, invites, votes | Voting | пока действует poll lifecycle и/или пока нужно для результатов и auditability | delete or anonymize on DSAR erase |
| Achievements and grants | Gamification | пока нужна история достижений и community feature | delete or anonymize on DSAR erase |
| Security logs / incident records | All services / ops tooling | не менее `365` дней или дольше, если требуется для расследования | archive or delete under security policy |
| Backup copies | Infra | **[УТВЕРДИТЬ ДО PRODUCTION]** | rolling deletion under backup schedule |

## 3. Особые правила

### 3.1 Russian citizens data

Если данные собираются у граждан РФ, оператор должен обеспечивать соблюдение применимых требований по локализации и lifecycle management в российских базах данных.

### 3.2 EEA data

Для данных, подпадающих под GDPR, срок хранения должен быть соразмерен цели и documented in the RoPA.

### 3.3 Litigation / abuse hold

Оператор может временно приостановить удаление отдельных данных, если это необходимо для:

- расследования инцидента;
- anti-abuse review;
- разрешения спора;
- выполнения обязательного требования закона или властей.

Такой hold должен быть документирован и ограничен по сроку.
