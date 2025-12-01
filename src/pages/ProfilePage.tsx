import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Loader, TextInput } from '@gravity-ui/uikit';

import type { ProfileResponse, SessionInfo } from '../api/auth';
import {
  authWithTelegram,
  deleteAccount,
  fetchProfile,
  loginUser,
  logoutUser,
  registerUser,
  revokeOtherSessions,
  revokeSession,
} from '../api/auth';
import { isApiError } from '../api/client';
import { notifyApiError } from '../utils/apiErrorHandling';
import { toaster } from '../toaster';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'register';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

const SessionBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="badge bg-primary bg-opacity-10 text-primary border border-primary px-2 py-1 rounded-pill">
    {label}
  </span>
);

type TelegramWidgetPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

type TelegramCallback = (userData: TelegramWidgetPayload) => void;
type TelegramCallbackWindow = Window & Record<string, TelegramCallback | undefined>;

export const ProfilePage: React.FC = () => {
  const { setUser } = useAuth();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<AuthMode | null>(null);
  const [sessionAction, setSessionAction] = useState<string | null>(null);
  const [bulkSessionsAction, setBulkSessionsAction] = useState(false);
  const [telegramAction, setTelegramAction] = useState<'link' | 'login' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });

  const telegramContainerRef = useRef<HTMLDivElement | null>(null);
  const telegramBotNameRaw =
    (import.meta.env.VITE_TELEGRAM_BOT_NAME as string | undefined) ?? '__VITE_TELEGRAM_BOT_NAME__';
  const telegramBotName =
    telegramBotNameRaw === '__VITE_TELEGRAM_BOT_NAME__'
      ? undefined
      : telegramBotNameRaw;
  const telegramCallbackName = 'aefTelegramAuth';

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchProfile();
      setProfile(data);
      setUser(data.user);
    } catch (err) {
      if (isApiError(err) && err.kind === 'unauthorized') {
        setProfile(null);
        setUser(null);
      } else {
        notifyApiError(err, 'Не получилось получить профиль');
      }
    } finally {
      setIsLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleTelegramAuth = useCallback(
    async (payload: TelegramWidgetPayload) => {
      setTelegramAction(profile?.user ? 'link' : 'login');

      try {
        await authWithTelegram({
          id: payload.id,
          firstName: payload.first_name,
          lastName: payload.last_name ?? null,
          username: payload.username ?? null,
          photoUrl: payload.photo_url ?? null,
          authDate: payload.auth_date,
          hash: payload.hash,
        });

        toaster.add({
          name: `telegram-${Date.now()}`,
          title: profile?.user ? 'Telegram привязан' : 'Вход через Telegram',
          content: profile?.user
            ? 'Аккаунт связан с Telegram, можно голосовать и управлять доступом.'
            : 'Сессия создана через Telegram. Теперь можно настроить профиль.',
          theme: 'success',
          autoHiding: 4500,
        });

        await loadProfile();
      } catch (err) {
        notifyApiError(err, 'Не удалось подтвердить Telegram');
      } finally {
        setTelegramAction(null);
      }
    },
    [loadProfile, profile?.user],
  );

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting('login');

    try {
      await loginUser({
        login: loginForm.login.trim(),
        password: loginForm.password,
      });

      toaster.add({
        name: `login-${Date.now()}`,
        title: 'Вы в системе',
        content: 'Сессия создана, можно управлять профилем и голосовать.',
        theme: 'success',
        autoHiding: 4000,
      });

      setLoginForm({ login: '', password: '' });
      await loadProfile();
    } catch (err) {
      notifyApiError(err, 'Не удалось войти');
    } finally {
      setIsSubmitting(null);
    }
  };

  const submitRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    if (registerForm.password !== registerForm.passwordConfirm) {
      toaster.add({
        name: `register-mismatch-${Date.now()}`,
        theme: 'warning',
        title: 'Пароли не совпадают',
        content: 'Убедитесь, что оба поля пароля совпадают.',
        autoHiding: 5000,
      });
      return;
    }

    setIsSubmitting('register');

    try {
      await registerUser({
        username: registerForm.username.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password,
        passwordConfirm: registerForm.passwordConfirm,
      });

      toaster.add({
        name: `register-${Date.now()}`,
        title: 'Готово',
        content: 'Аккаунт создан и сессия активна. Можно настраивать профиль.',
        theme: 'success',
        autoHiding: 4500,
      });

      setRegisterForm({
        username: '',
        email: '',
        password: '',
        passwordConfirm: '',
      });
      await loadProfile();
    } catch (err) {
      notifyApiError(err, 'Не удалось создать аккаунт');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleLogout = async () => {
    setSessionAction('logout');
    try {
      await logoutUser();
      setProfile(null);
      toaster.add({
        name: `logout-${Date.now()}`,
        title: 'Сессия закрыта',
        content: 'Текущая сессия завершена.',
        theme: 'info',
        autoHiding: 3500,
      });
      setUser(null);
    } catch (err) {
      notifyApiError(err, 'Не получилось выйти');
    } finally {
      setSessionAction(null);
    }
  };

  const handleDropSession = async (sessionKey: string) => {
    setSessionAction(sessionKey);
    try {
      await revokeSession(sessionKey);
      if (profile?.sessions.some((session) => session.isCurrent && session.sessionKey === sessionKey)) {
        setProfile(null);
        setUser(null);
      } else {
        await loadProfile();
      }

      toaster.add({
        name: `session-${sessionKey}`,
        title: 'Сессия завершена',
        content: 'Выбранная сессия была деактивирована.',
        theme: 'info',
        autoHiding: 3500,
      });
    } catch (err) {
      notifyApiError(err, 'Не удалось завершить сессию');
    } finally {
      setSessionAction(null);
    }
  };

  const handleDropOthers = async () => {
    setBulkSessionsAction(true);
    try {
      await revokeOtherSessions();
      await loadProfile();
      toaster.add({
        name: `sessions-clear-${Date.now()}`,
        title: 'Сессии обновлены',
        content: 'Все остальные сессии выгружены. Остаётся только текущая.',
        theme: 'success',
        autoHiding: 3500,
      });
    } catch (err) {
      notifyApiError(err, 'Не удалось завершить другие сессии');
    } finally {
      setBulkSessionsAction(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!telegramBotName || !telegramContainerRef.current) return;

    const callbackWindow = window as unknown as TelegramCallbackWindow;
    callbackWindow[telegramCallbackName] = (userData: TelegramWidgetPayload) => {
      handleTelegramAuth(userData);
    };

    telegramContainerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', telegramBotName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', telegramCallbackName);
    script.setAttribute('data-request-access', 'write');
    telegramContainerRef.current.appendChild(script);

    return () => {
      if (callbackWindow[telegramCallbackName]) {
        delete callbackWindow[telegramCallbackName];
      }
    };
  }, [telegramBotName, telegramCallbackName, handleTelegramAuth]);

  const handleDeleteAccount = async () => {
    if (!profile?.user) {
      toaster.add({
        name: `delete-blocked-${Date.now()}`,
        title: 'Сначала войдите',
        content: 'Чтобы удалить аккаунт, нужно войти или восстановить сессию.',
        theme: 'warning',
        autoHiding: 4000,
      });
      return;
    }

    const confirmed = window.confirm(
      'Удалить аккаунт и все ваши голоса? Это действие нельзя отменить.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteAccount();
      setProfile(null);
      setUser(null);
      toaster.add({
        name: `delete-${Date.now()}`,
        title: 'Аккаунт удалён',
        content: 'Профиль, голоса и привязка Telegram удалены.',
        theme: 'success',
        autoHiding: 4500,
      });
    } catch (err) {
      notifyApiError(err, 'Не удалось удалить аккаунт');
    } finally {
      setIsDeleting(false);
    }
  };

  const userChip = useMemo(() => {
    if (!profile?.user) {
      return (
        <SessionBadge label="Гость" />
      );
    }

    return (
      <div className="d-inline-flex align-items-center gap-2">
        <SessionBadge label="В сети" />
        <span className="fw-semibold">{profile.user.username}</span>
        {profile.user.telegramLinked && (
          <SessionBadge
            label={profile.user.telegramUsername ? `@${profile.user.telegramUsername}` : 'TG привязан'}
          />
        )}
        {profile.user.email && (
          <span className="text-muted small">{profile.user.email}</span>
        )}
      </div>
    );
  }, [profile]);

  const hasSessions = (profile?.sessions.length ?? 0) > 0;

  const renderTelegramCard = () => {
    const telegramLinked = profile?.user?.telegramLinked ?? false;
    const telegramUsername = profile?.user?.telegramUsername;
    const telegramId = profile?.user?.telegramId;

    return (
      <Card className="profile-card">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div>
            <div className="profile-card-title mb-1">Telegram</div>
            <div className="text-muted small">
              Авторизация и привязка через Telegram ID с проверкой подписи.
            </div>
          </div>
          <SessionBadge label={telegramLinked ? 'Привязан' : 'Не привязан'} />
        </div>

        {telegramLinked ? (
          <div className="status-block status-block-success">
            <div className="status-title">Связь подтверждена</div>
            <p className="text-muted mb-0">
              {telegramUsername ? `@${telegramUsername}` : 'Без юзернейма'} · ID {telegramId ?? '—'}
            </p>
          </div>
        ) : (
          <div className="status-block status-block-warning">
            <div className="status-title">Telegram не привязан</div>
            <p className="text-muted mb-0">
              Авторизуйтесь через Telegram, чтобы голосовать и назначать права по ID.
            </p>
          </div>
        )}

        {telegramBotName ? (
          <div className="telegram-widget-container">
            <div ref={telegramContainerRef} />
            {telegramAction && (
              <div className="text-muted small mt-2">
                Ждём подтверждения в Telegram...
              </div>
            )}
          </div>
        ) : (
          <div className="status-block status-block-info">
            <div className="status-title">Нужно имя бота</div>
            <p className="text-muted mb-0">
              Укажите VITE_TELEGRAM_BOT_NAME в окружении фронтенда, чтобы отрисовать кнопку Telegram.
            </p>
          </div>
        )}
      </Card>
    );
  };

  const renderSessionCard = () => (
    <Card className="profile-card">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div>
          <div className="profile-card-title mb-1">Активные сессии</div>
          <div className="text-muted small">
            Управляйте устройствами, где выполнен вход через AllAuth.
          </div>
        </div>
        <Button
          view="flat-secondary"
          size="m"
          disabled={!hasSessions || bulkSessionsAction}
          onClick={handleDropOthers}
        >
          {bulkSessionsAction ? 'Отключаем...' : 'Оставить только эту'}
        </Button>
      </div>

      {isLoading && (
        <div className="status-block status-block-info text-center">
          <Loader size="m" />
          <div className="text-muted small mt-2">Обновляем список сессий...</div>
        </div>
      )}

      {!isLoading && !hasSessions && (
        <div className="status-block status-block-warning">
          <div className="status-title">Сессий пока нет</div>
          <p className="text-muted mb-0">
            Войдите или зарегистрируйтесь, чтобы увидеть активные устройства.
          </p>
        </div>
      )}

      {!isLoading && hasSessions && (
        <ul className="session-list list-unstyled">
          {profile?.sessions.map((session: SessionInfo) => (
            <li
              key={session.sessionKey}
              className={'session-item' + (session.isCurrent ? ' session-item-current' : '')}
            >
              <div className="session-item-top">
                <div>
                  <div className="session-label">
                    {session.isCurrent ? 'Текущая сессия' : 'Сторонняя сессия'}
                  </div>
                  <div className="session-meta text-muted small">
                    IP: {session.ipAddress ?? '—'} · {session.userAgent ?? 'Неизвестный клиент'}
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  {session.isCurrent && <SessionBadge label="Используете сейчас" />}
                  <Button
                    size="s"
                    view={session.isCurrent ? 'outlined' : 'flat'}
                    onClick={() => handleDropSession(session.sessionKey)}
                    disabled={!!sessionAction}
                  >
                    {sessionAction === session.sessionKey
                      ? 'Отключаем...'
                      : session.isCurrent
                      ? 'Выйти'
                      : 'Завершить'}
                  </Button>
                </div>
              </div>

              <div className="session-dates text-muted small">
                <span>Создана: {formatDate(session.createdAt)}</span>
                <span>Активность: {formatDate(session.lastSeenAt)}</span>
                <span>Истекает: {formatDate(session.expiresAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const renderDangerCard = () => (
    <Card className="profile-card">
      <div className="profile-card-title text-danger">Удалить аккаунт</div>
      <p className="text-muted small mb-3">
        Удаление стирает профиль, все голоса и привязку Telegram. Вернуть данные будет нельзя.
      </p>
      <Button
        view="outlined"
        className="text-danger border-danger"
        onClick={handleDeleteAccount}
        disabled={isDeleting || !profile?.user}
      >
        {isDeleting ? 'Удаляем...' : 'Удалить аккаунт и голоса'}
      </Button>
    </Card>
  );

  return (
    <div className="page-section profile-page">
      <div className="container">
        <div className="row">
          {/* <aside className="col-md-3 col-lg-2 mb-4 mb-md-0">
            <div className="bg-video-box">
              Фоновое<br />видео<br />от Альжумже
            </div>
          </aside> */}

          <section className="col-12 col-lg-10 mx-auto">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h1 className="page-title">Профиль и сессии</h1>
                <p className="text-muted mb-2">
                  Вход через почту/пароль или Telegram, управление сессиями и удаление аккаунта.
                </p>
              </div>
              {userChip}
            </div>

            <div className="profile-grid">
              <div className="profile-column">
                <Card className="profile-card">
                  <div className="profile-card-title">Вход</div>
                  <p className="text-muted small mb-3">
                    Введите email или ник и пароль, чтобы создать новую сессию в API.
                  </p>

                  <form className="profile-form" onSubmit={submitLogin}>
                    <TextInput
                      label="Email или ник"
                      placeholder="you@example.com"
                      value={loginForm.login}
                      onChange={(event) =>
                        setLoginForm((prev) => ({ ...prev, login: event.target.value }))
                      }
                      controlProps={{ required: true }}
                    />

                    <TextInput
                      label="Пароль"
                      type="password"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      controlProps={{ required: true }}
                    />

                    <div className="d-flex align-items-center gap-2">
                      <Button type="submit" disabled={isSubmitting === 'login'}>
                        {isSubmitting === 'login' ? 'Входим...' : 'Войти'}
                      </Button>
                      {profile?.user && (
                        <Button
                          view="flat-secondary"
                          type="button"
                          onClick={handleLogout}
                          disabled={sessionAction !== null}
                        >
                          Выйти из текущей
                        </Button>
                      )}
                    </div>
                  </form>
                </Card>

                <Card className="profile-card">
                  <div className="profile-card-title">Регистрация</div>
                  <p className="text-muted small mb-3">
                    Новый аккаунт создаётся через Django AllAuth, сразу формируется сессия.
                  </p>

                  <form className="profile-form" onSubmit={submitRegister}>
                    <TextInput
                      label="Ник / имя профиля"
                      placeholder="aef-fan"
                      value={registerForm.username}
                      autoComplete="username"
                      controlProps={{
                        minLength: 3,
                        maxLength: 150,
                        pattern: '\\S+',
                        required: true,
                      }}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({ ...prev, username: event.target.value }))
                      }
                    />

                    <TextInput
                      label="Email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerForm.email}
                      autoComplete="email"
                      onChange={(event) =>
                        setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      controlProps={{ required: true }}
                    />

                    <div className="row g-2">
                      <div className="col-md-6">
                        <TextInput
                          label="Пароль"
                          type="password"
                          value={registerForm.password}
                          autoComplete="new-password"
                          onChange={(event) =>
                            setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                          }
                          controlProps={{
                            required: true,
                            minLength: 8,
                            maxLength: 128,
                          }}
                        />
                      </div>
                      <div className="col-md-6">
                        <TextInput
                          label="Повторите пароль"
                          type="password"
                          value={registerForm.passwordConfirm}
                          autoComplete="new-password"
                          onChange={(event) =>
                            setRegisterForm((prev) => ({
                              ...prev,
                              passwordConfirm: event.target.value,
                            }))
                          }
                          controlProps={{
                            required: true,
                            minLength: 8,
                            maxLength: 128,
                          }}
                        />
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <Button type="submit" view="outlined" disabled={isSubmitting === 'register'}>
                        {isSubmitting === 'register' ? 'Создаём...' : 'Зарегистрироваться'}
                      </Button>
                      <div className="text-muted small">
                        Ник — без пробелов, 3–150 символов. Пароль — минимум 8 символов и не слишком похож на логин или email.
                      </div>
                    </div>
                  </form>
                </Card>

                {renderDangerCard()}
              </div>

              <div className="profile-column">
                {renderTelegramCard()}
                {renderSessionCard()}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
