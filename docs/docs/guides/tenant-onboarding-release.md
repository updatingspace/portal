---
title: Tenant onboarding — production release 2026-09-30
---

Заявки, tenant и членства принадлежат Portal; ID предоставляет identity-профиль,
Access выдаёт права. BFF использует авторизованный UUID заявителя. В frontend
нет поля email, клиентские email/user_id/applicant_user_id игнорируются.

## Выпущенные версии

| Сервис | Ревизия | Digest |
| --- | --- | --- |
| id | `bba0s1b9ukeljpecnt9g` | `sha256:737f4f4a1c319514394ee81d8149c873386f46fad705773dc32d0f37b5779eaf` |
| portal | `bban68hhhoht3lq823qr` | `sha256:07a2d6888741b734cd2e39e351938e3bfc63ca9d5e10de58e42e45af3055d036` |
| access | `bbaeeepf6hptqj3n8d3u` | `sha256:d367d1df970c255a3926df58193e8bdef484f8c993faa8d28ca70ad38078b585` |
| bff | `bba8t6sr0l2flpqkgq2m` | `sha256:3f7cf5065939e85af6d594dd285573304f0820d1c90aeb82d84f9ed08f05bc75` |

Frontend build: `2026.09.30-tenant-onboarding`. Загружены новые assets и заменён
index; предыдущие assets сохранены для открытых вкладок и отката.

Созданы 4 таблицы Portal, 12 существовавших таблиц оставлены без изменения.
Перед переключением сверены production ID и два экспорта: старых tenant и
членств было 0. Промежуточный BFF записывал новые одобрения также в Portal.

Контейнерная квота была исчерпана. Команда Portal `process_outbox` работает
в приватной Cloud Function `d4e139a07ahc7jgfdlqu`, версия
`d4eaa1rfjpr99m334cr6`. Timer `a1s30tucfpcid4tsgd2q` запускается
каждые 15 минут. Права invoker выданы существующему trigger SA только на функцию.

## Проверки

- Release-код собран поверх активных образов: production OIDC, private invoke,
  работа с Access и подписанные avatar URL сохранены.
- Portal: 36 тестов; BFF: 128 тестов, включая OIDC и новый timeout;
  Access: 98 тестов; identity endpoint/export ID: 7 тестов; function wrapper: 2 теста.
- Frontend: lint, typecheck, build, 33 Vitest теста и 2 Playwright сценария.
- Пакетная выдача прав проверена на production YDB в полностью откатанной транзакции.
- Публичный smoke: tenantless создание 201, подмена UUID/email игнорируется,
  дубликат 409, review чужим пользователем 403, одобрение 200, owner membership
  active, переключение владельца 200, чужого пользователя 403, retry идемпотентен.
- Отдельно проверено Access: владелец может управлять ролями, другой пользователь
  и другой tenant не получают это право. Worker обработал сохранённое событие.
- Chromium на публичном домене: страницы владельца и системного администратора
  отрисованы, форма открыта, поля email нет, JS ошибок нет; admin review panel видна.
- Terraform validate прошёл в отдельном каталоге без backend/state/apply.

Все временные production tenant, роли и сессии smoke-тестов удалены после проверки;
пользовательские аккаунты ID при тестировании не создавались и не изменялись.

## Воспроизводимость и следующий infrastructure apply

Digest и SHA-256 каждого файла overlay сохранены в
`docs/deployments/tenant-onboarding-20260930.json`. Архив точного release overlay,
worker ZIP и предыдущего frontend index сохранён локально:
`/tmp/portal-tenant-deploy/release-bundle.tar.gz`. Он не содержит runtime credentials.
Снимки предыдущих ревизий для отката находятся в том же приватном каталоге.

Изменения применены адресно через YC CLI: Terraform state в этом checkout отсутствует.
Перед следующим infrastructure apply нужно собрать ZIP из проверенного Portal digest
через `scripts/ci/package-portal-outbox.py`, задать `portal_outbox_function_zip`
и импортировать существующие функцию и timer в настоящий production state:

```sh
terraform import 'yandex_function.portal_outbox[0]' d4e139a07ahc7jgfdlqu
terraform import 'yandex_function_trigger.portal_outbox_sweep[0]' a1s30tucfpcid4tsgd2q
```

Использовать обычные production backend/var-file параметры проекта. Сначала проверить
plan; общий apply на основе устаревшего checkout не выполнялся. Настройки image tags
должны соответствовать опубликованным образам из manifest.

Откат выполняется выпуском предыдущих digest с сохранённой конфигурацией и восстановлением
предыдущего frontend index. Новые таблицы при откате не удалять: в них могут уже быть
настоящие заявки и членства. Откат BFF возвращает чтение старого источника ID, поэтому
после создания настоящих tenant требуется отдельный план сохранения их доступности.

Последующий выпуск: [исправления интерфейса, персонализации и Activity](portal-ui-api-release.md).
