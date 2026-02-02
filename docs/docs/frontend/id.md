---
sidebar_position: 3
title: ID Frontend
description: UI для Identity Provider UpdSpaceID
---

# ID Frontend

Веб-приложение `web/id-frontend` убирает фронтенд-фасад для UpdSpaceID: логин, регистрация, безопасность, консент и разовые OIDC-сессии работают в одном месте.

- **Путь**: `web/id-frontend`
- **Dev порт**: `5174`
- **Команда запуска**: `npm run dev`

## Структура

```
src/
├── App.tsx               # Роутинг + Layout (AppLayout, темы, навигация)
├── main.tsx              # Входная точка (ReactDOM.createRoot, BrowserRouter, провайдеры)
├── lib/                  # Утилиты и контексты
│   ├── api.ts            # HTTP-клиент к ID API / OIDC endpoints
│   ├── auth.tsx          # AuthContext + hooks
│   ├── session.ts        # localStorage обёртка для X-Session-Token
│   ├── i18n.tsx          # Текст, язык, перевод
│   ├── theme.tsx         # Смена темы
│   └── webauthn.ts       # Параметры для WebAuthn API
├── pages/                # Маршруты
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── Account.tsx
│   ├── Authorize.tsx
│   └── ...               # Дополнительно: магическая ссылка, активация, пароль
└── styles.css            # Базовые стили
```

## Ключевые потоки

### Вход и OAuth

`Login.tsx` комбинирует:
- обычный логин (email + пароль) с MFA и recovery-кодами через `useAuth().login`.
- Passkey-вход (`navigator.credentials`) с `api.passkeyLoginBegin`/`api.passkeyLoginComplete`.
- Кнопки OAuth-провайдеров (`api.getOAuthProviders`, `api.getOAuthLoginUrl`).
- Уведомления об ошибках и переключение между TOTP и recovery кодом на месте.

### Панель аккаунта

`Account.tsx` загружает профиль, настройки, MFA/Passkeys, внешние OAuth-приложения, сессии, историю входов, экспорт и удаление аккаунта. Он работает с API-методами:

- Профиль/предпочтения: `api.updateProfile`, `api.getPreferences`, `api.updatePreferences`.
- Email: `api.emailStatus`, `api.changeEmail`, `api.resendEmailVerification`.
- Безопасность: `api.changePassword`, `api.mfaStatus`, `api.totpBegin`, `api.totpConfirm`, `api.totpDisable`, `api.recoveryRegenerate`.
- Passkeys: `api.passkeysList`, `api.passkeysBegin`, `api.passkeysComplete`, `api.passkeysDelete`, `api.passkeysRename`.
- Сессии и приложения: `api.getSessions`, `api.revokeSession`, `api.revokeOtherSessions`, `api.getOAuthApps`, `api.revokeOAuthApp`.
- Данные: `api.dataExport`, `api.deleteAccount`.
- OAuth-связки: `api.getOAuthProviders`, `api.getOAuthLinkUrl`, `api.unlinkOAuthProvider`.

### OIDC authorize

`Authorize.tsx` спрашивает `/oauth/authorize/prepare`, показывает scope preview и вызывает `api.oidcApprove`/`api.oidcDeny`. Благодаря `AuthContext` всегда передаётся `X-Session-Token` из `session.ts`.

## Библиотеки

- **`api.ts`** — центральный HTTP-клиент: собирает заголовки, обрабатывает form token (`/auth/form_token`), направляет запросы к `/auth/*` и `/oauth/*` (authorize/token/userinfo/revoke). Именно здесь тесты проверяют корректное поведение JWT и токенов.
- **`auth.tsx`** — контекст (`AuthContext`) отвечает за `user`, прогон `api.me`, `login`, `signup`, `logout` и обновление `user` после входа/регистрации.
- **`session.ts`** — простой `localStorage` для `X-Session-Token`.
- **`i18n.tsx`** — предоставляет `useI18n()` и набор переводов, применяемых во всех компонентах.
- **`theme.tsx`** / **`webauthn.ts`** — мелкие хелперы, используемые в AppLayout, Login и MFA.

## Тестирование

Финальная фаза добавила Vitest‑пакет и покрытия для самых чувствительных сценариев.

- `web/id-frontend/src/lib/api.test.ts` проверяет, что `api.login` сохраняет `X-Session-Token`, возвращает ошибки от сервера и передаёт токен в запрос `/oauth/authorize/prepare`.
- `web/id-frontend/src/pages/Login.test.tsx` монтирует страницу логина через контексты и `MemoryRouter`, проверяя, что ошибка `INVALID_CREDENTIALS` показывает нужный баннер и вызывается `login`.

```
cd web/id-frontend
npm install
npm run test
```

Vitest использует `jsdom`, `@testing-library/react` и `@testing-library/user-event`, а файл `vitest.config.ts` включает `setupTests.ts` для `jest-dom`.
