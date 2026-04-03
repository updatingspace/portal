---
title: Legal & Privacy Pack
description: Набор юридических и privacy-документов для релиза UpdSpace Portal
---

# Legal & Privacy Pack

Этот раздел содержит production drafts для UpdSpace Portal под GDPR и 152-ФЗ.

## Контекст, заложенный в пакет

- **Оператор / controller**: Mihhail Matvejev, физическое лицо, Эстония.
- **Контакт по privacy**: `privacy@updspace.com`.
- **Юрисдикции**: ЕС + РФ.
- **Текущая инфраструктура**: Россия (Yandex Cloud и self-hosted infrastructure под контролем оператора).
- **Планируемое состояние**: отдельный EU deployment для пользователей из ЕЭЗ.
- **Возрастной порог**: сервис рассчитан на пользователей `13+`.

## Что входит в пакет

1. user-facing [Privacy Notice](./privacy-notice.md)
2. [Политика обработки персональных данных по 152-ФЗ](./policy-152fz.md)
3. [Cookie Notice](./cookie-notice.md)
4. [Consent texts](./consents.md)
5. [Data Retention Schedule](./retention-schedule.md)
6. [DSAR Procedure](./dsar-procedure.md)
7. [Incident / Breach Response Policy](./incident-response.md)
8. [Records of Processing Activities](./records-of-processing.md)
9. [Processor / Subprocessor Register](./processors-register.md)
10. [Cross-Border Transfer Policy](./cross-border-transfers.md)

## Обязательные поля на дозаполнение перед публикацией

### 1. Служебный почтовый адрес оператора

Сейчас во всех user-facing документах стоит плейсхолдер:

`[УКАЗАТЬ СЛУЖЕБНЫЙ ПОЧТОВЫЙ АДРЕС ПЕРЕД ПУБЛИКАЦИЕЙ]`

Если домашний адрес публиковать нельзя, используй:

- отдельный mailing address;
- virtual office / registered correspondence address;
- адрес представителя/сервиса, который принимает официальную корреспонденцию.

Полностью скрывать контактный адрес для controller/operator я не рекомендую.

### 2. Реестр обработчиков

Нужно подтвердить договорные реквизиты и DPA/processing terms для:

- Yandex Cloud;
- email-провайдера;
- object storage / CDN;
- error tracking / support tooling;
- любых внешних подрядчиков, которые реально увидят персональные данные.

### 3. EU go-live condition

Пока основной production размещён в РФ, активный онбординг пользователей из ЕЭЗ без оформленного transfer package создаёт отдельный GDPR-риск. Перед EU launch нужно выполнить хотя бы одно из двух:

- поднять EEA-hosted environment и держать EEA primary data в ЕЭЗ;
- либо документировать lawful Chapter V transfer mechanism, transfer impact assessment и vendor commitments.

### 4. Russian operator formalities

Для публичного релиза в РФ я исхожу из презумпции, что проект должен считать себя оператором ПДн и проверить обязанность подачи уведомления в Роскомнадзор до начала production processing.

## Практическая позиция по текущему стеку

- Архитектура BFF/HMAC/cookie-only и DSAR/delete/export flows уже позволяют описывать прозрачный privacy lifecycle.
- Самая важная организационная задача сейчас не в коде, а в **contactability**, **processor paperwork** и **cross-border governance**.

## Что делать дальше

1. заполнить почтовый адрес и список провайдеров;
2. опубликовать user-facing документы на сайте;
3. внедрить consent UX из [consents](./consents.md);
4. утвердить и выполнять [retention schedule](./retention-schedule.md);
5. привязать internal runbooks к [DSAR](./dsar-procedure.md) и [incident response](./incident-response.md).
