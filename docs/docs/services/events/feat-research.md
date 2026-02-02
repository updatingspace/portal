# Feat Research: Calendar Invites (iCalendar REQUEST/REPLY) + RSVP Sync
**Component:** UpdSpace Events  
**Status:** Research / Proposal  
**Owner:** (TBD)  
**Related UI:** Events вкладка (Portal / Events Frontend)  
**Target:** “как в больших календарях” — приглашения по email + сбор ответов (Accept/Decline/Tentative) и отражение статусов у нас.

---

## 1) Контекст и текущая ситуация
Сейчас Events сервис отдаёт `.ics` как **статичный экспорт** одного события (MVP).
Это даёт пользователю “добавить в календарь”, но **не даёт**:
- нативных кнопок Accept/Decline в календарях,
- автоматического возврата статуса организатору,
- “живого” списка участников/статусов внутри календаря.

---

## 2) Цель
Добавить режим “инвайтов”:
1) Host/Organizer отправляет участникам email-приглашения (iCalendar `METHOD:REQUEST`).
2) Участник принимает/отклоняет (в календаре) → клиент формирует ответ `METHOD:REPLY` → ответ доставляется на нашу сторону.
3) Events сервис обновляет `RSVP` (accepted/declined/tentative/needs-action) и показывает статусы в **Events вкладке**.

---

## 3) Не-цели (на первом этапе)
- Полная календарная синхронизация через Google/Outlook API (это отдельный большой эпик).
- Мгновенная двусторонняя синхронизация между календарями разных провайдеров.
- Поддержка всех экзотических клиентов/вендорных расширений (начать с наиболее типичных).

---

## 4) Термины
- **Organizer/Host:** пользователь, создавший событие/отвечающий за инвайт.
- **Invitee/Attendee:** приглашённый участник.
- **UID:** глобальный идентификатор события в iCalendar (стабилен).
- **SEQUENCE:** версия события; увеличивается при изменениях.
- **METHOD:REQUEST/REPLY/CANCEL:** тип iCalendar сообщения.
- **PARTSTAT:** статус участия (ACCEPTED/DECLINED/TENTATIVE/NEEDS-ACTION).

---

## 5) Пользовательские сценарии (User Stories)
### US-1: Host приглашает людей
- Host выбирает участников (по user_id/email) и нажимает “Отправить приглашение”.
- Участники получают письмо с календарным приглашением.
- В UI Events Host видит: “Invites sent”, статусы “Needs action”.

### US-2: Участник принимает/отклоняет
- Участник нажимает Accept/Decline в своём календаре.
- Events сервис получает REPLY и обновляет статус в `RSVP`.
- Host видит обновление статуса в Events вкладке.

### US-3: Обновление события
- Host меняет время/описание → система пересылает UPDATE (REQUEST с увеличенным SEQUENCE).
- Участники получают update, их календари обновляют событие (по UID).
- В Events UI отражается факт рассылки апдейта.

### US-4: Отмена события
- Host отменяет → отправляется CANCEL.
- Участники получают отмену и событие исчезает/помечается отменённым.

---

## 6) Варианты реализации (на будущее)
### Вариант B (выбранный): Email-based iCalendar REQUEST/REPLY
**Почему:** максимально близко к “как в больших календарях”, без интеграции календарных API на первом шаге.

### Вариант C (следующий эпик): Интеграции провайдеров календарей
Google Calendar API / Microsoft Graph и т.п. — отдельный слой синхронизации.

---

## 7) Архитектура высокого уровня (Variant B)
### 7.1 Outbound (от нас → участникам)
**Events service**:
- генерирует iCalendar `METHOD:REQUEST` с `ORGANIZER` и `ATTENDEE`.
- отправляет email через почтового провайдера (SMTP/HTTP API).

### 7.2 Inbound (от участника → к нам)
Нужен канал получения входящих писем, где будут `METHOD:REPLY`:
- Mailgun / Postmark / SES inbound / Sendgrid inbound (webhook),
- или IMAP polling (хуже, но допустимо как fallback).

**Inbound Worker**:
- принимает raw email,
- извлекает iCalendar часть (text/calendar),
- парсит `UID`, `ATTENDEE`, `PARTSTAT`, `SEQUENCE`,
- обновляет RSVP в Events.

### 7.3 Визуализация в Events вкладке (UI)
Показывать:
- список invitees,
- текущий PARTSTAT,
- время последнего обновления,
- кнопки “Resend invite”, “Send update”, “Cancel event”.

---

## 8) Изменения в доменной модели (проектно)
### 8.1 Event (добавить поля)
- `ical_uid: str` — стабильный UID (если нет — генерить один раз).
- `ical_sequence: int` — версия, начинается с 0, инкремент при update.
- `organizer_user_id: UUID` (если отличается от created_by или нужно явно).
- `organizer_email: str | null` (опционально, если email важен для Organizer в iCal).

### 8.2 RSVP / Invitation (расширить или новая модель)
Текущий `RSVP` уже существует — но для инвайтов нужно различать:
- “ответ в нашей системе” vs “ответ из календаря”.

Вариант 1 (минимальный): расширить `RSVP`:
- `source: enum('portal','ical_reply','admin')`
- `external_attendee_email: str | null`
- `updated_at` уже есть? (если нет — добавить)
- `ical_last_method: str | null` (REQUEST/REPLY/CANCEL)
- `ical_message_id: str | null` (для дедупа)

Вариант 2: отдельная `Invitation`:
- `event_id`, `tenant_id`, `invitee_user_id | invitee_email`,
- `status`, `last_sent_at`, `last_reply_at`, `reply_raw_hash`, `delivery_status`.
И `RSVP` остаётся “бизнес-уровень”, а Invitation — “интеграция/доставка”.

**Рекомендация:** если хотим позже Calendar API — лучше **отдельная Invitation**.

### 8.3 Audit log (опционально, но желательно)
- “Invite sent”, “Reply received”, “Update sent”, “Cancel sent”, “Manual override”.
Полезно для дебага.

---

## 9) Контракты API (предложение)
### 9.1 Manage invites (Host/admin)
- `POST /events/{id}/invites/send`  
  body: `{ invitees: [{userId? , email?}], message? }`  
  result: `202 Accepted` + job id / summary
- `POST /events/{id}/invites/resend`  
  body: `{ inviteeId | email }`
- `POST /events/{id}/invites/cancel`  
  (или использовать update endpoint + event.status=cancelled)

### 9.2 Inbound webhook (почтовый провайдер → internal endpoint)
- `POST /events/inbound/email` (internal only)
  - HMAC signature / allowlist IP / secret
  - raw payload (mime) / attachment
  - возвращаем 200 быстро, обработка async

---

## 10) iCalendar требования (минимум)
### 10.1 REQUEST (invite / update)
- `METHOD:REQUEST`
- `UID:<event.ical_uid>`
- `SEQUENCE:<event.ical_sequence>`
- `DTSTAMP:<now UTC>`
- `DTSTART/DTEND` (UTC или TZ-aware корректно)
- `SUMMARY`, `DESCRIPTION`, `LOCATION`, `URL`
- `ORGANIZER:mailto:<organizer_email>`
- `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:<invitee_email>`

### 10.2 REPLY (from attendee)
- `METHOD:REPLY`
- `UID`, `SEQUENCE` (или RECURRENCE-ID если повторения появятся позже)
- `ATTENDEE...;PARTSTAT=ACCEPTED/DECLINED/TENTATIVE`

### 10.3 CANCEL
- `METHOD:CANCEL`
- `UID`, `SEQUENCE` (увеличенный)
- `STATUS:CANCELLED`

### 10.4 ICS hygiene
- TEXT escaping (\\, \;, \, , \n)
- line folding 75 octets
- CRLF endings

---

## 11) Асинхронность / очереди / дедупликация
### 11.1 Outbound
Отправка email должна быть async:
- queue job: `send_invites(event_id, invitees, tenant_id, request_id)`
- ретраи с backoff
- идемпотентность по `(event_id, invitee, sequence, method)`

### 11.2 Inbound
Inbound webhook также async:
- сохраняем raw email (или его hash + ключевые поля)
- парсим и маппим на tenant/event:
  - по `UID` ищем Event
  - email invitee сопоставляем с user/RSVP
- дедуп:
  - по `Message-ID` письма или hash вложения iCal

---

## 12) Security
- Inbound endpoint: **internal**, защищённый secret/signature.
- Ограничить размер raw email и вложений.
- Проверять, что REPLY относится к существующему UID и invitee из списка.
- Не позволять REPLY менять event content (только RSVP).
- Логирование без утечек PII (email) — маскировать при необходимости.

---

## 13) UI/UX требования (Events вкладка)
### 13.1 Экран события
- Блок “Участники”:
  - имя/ник (если userId), email (если внешние),
  - статус: Needs action / Accepted / Declined / Tentative,
  - источник: “Portal” / “Calendar reply”
  - last updated timestamp
- Экшены (с правами):
  - “Send invites”
  - “Resend”
  - “Send update”
  - “Cancel event”
- Состояния:
  - “Sending…”, “Sent”, “Failed” (с reason)

### 13.2 Список событий
- индикатор: есть приглашения / % accepted
- фильтр: “My invited”, “Awaiting response”

---

## 14) План итераций (Roadmap)
### Phase 0 (уже есть)
- `.ics` export (read-only)

### Phase 1 (MVP invites outbound)
- хранить `ical_uid`, `ical_sequence`
- отправка REQUEST email invite
- UI: “Send invites”, “Delivery status”
- RSVP ставим в NEEDS-ACTION (у нас)

### Phase 2 (Inbound replies)
- inbound webhook + parser REPLY
- обновление RSVP статуса
- UI: статусы реального ответа

### Phase 3 (Updates / Cancel)
- update: REQUEST с SEQUENCE++
- cancel: CANCEL

### Phase 4 (Provider integrations) — отдельный эпик
- OAuth + Google/Microsoft calendar sync
- webhooks/calendar push

---

## 15) Открытые вопросы (нужно решить до имплементации)
1) Откуда брать email пользователя (invitee) и organizer? (Portal? Identity?)
2) Нужна ли поддержка “внешних” email, которых нет в UpdSpaceID?
3) Какой провайдер входящих писем выбираем? (SES/Mailgun/Postmark)
4) Как храним raw email для дебага и соответствия политикам (retention)?
5) Какой приоритет источников статуса: portal vs calendar reply? (merge policy)
6) Нужны ли reminders/alarms (VALARM) в первом приближении?

---

## 16) Acceptance Criteria (для эпика Phase 2)
- Host отправляет инвайты → участник получает письмо → добавляет в календарь.
- Участник жмёт Accept → Events сервис получает REPLY и обновляет RSVP.
- Events UI показывает актуальный статус и время обновления.
- Все операции логируются, есть дедупликация входящих REPLY.

---
