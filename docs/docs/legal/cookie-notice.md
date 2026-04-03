---
title: Cookie Notice
description: Notice about cookies and similar technologies used by UpdSpace Portal
---

# Cookie Notice

## 1. Что это за документ

Этот документ объясняет, какие cookies и схожие технологии использует UpdSpace Portal и зачем они нужны.

## 2. Какие cookies используются сейчас

На текущей архитектуре сервис в первую очередь использует **необходимые** cookies:

| Cookie | Назначение | Тип | Срок |
|---|---|---|---|
| `updspace_session` | поддержание аутентифицированной сессии через BFF | strictly necessary | до истечения сессии / logout / revoke |
| `updspace_csrf` | защита от CSRF-атак для browser-origin запросов | strictly necessary | короткий security lifecycle |

## 3. Для чего они нужны

Эти cookies нужны для того, чтобы:

- входить в аккаунт и оставаться авторизованным;
- защищать mutating requests от CSRF;
- безопасно проксировать запросы через BFF;
- предотвращать несанкционированный доступ к tenant-scoped данным.

Без этих cookies основные функции сервиса работать не будут.

## 4. Используем ли мы analytics / marketing cookies

На дату этого драфта сервис **не должен полагаться на marketing cookies** и не должен вводить non-essential tracking без отдельного уведомления и согласия там, где это требуется законом.

Если в будущем будут добавлены:

- analytics;
- A/B testing;
- advertising identifiers;
- third-party embeds, устанавливающие cookies,

то до релиза нужно:

1. обновить этот документ;
2. внедрить consent UX;
3. разделить strictly necessary и optional cookies.

## 5. Управление cookies

Пользователь может:

- очистить cookies в браузере;
- завершить сессию через logout;
- ограничить cookies в настройках браузера.

Обрати внимание: блокировка strictly necessary cookies может сделать сервис недоступным.

## 6. Контакт

По вопросам cookies и privacy можно писать на **privacy@updspace.com**.
