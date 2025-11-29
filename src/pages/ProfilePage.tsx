import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Loader, TextInput } from '@gravity-ui/uikit';

import type { ProfileResponse, SessionInfo } from '../api/auth';
import {
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

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<AuthMode | null>(null);
  const [sessionAction, setSessionAction] = useState<string | null>(null);
  const [bulkSessionsAction, setBulkSessionsAction] = useState(false);

  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchProfile();
      setProfile(data);
    } catch (err) {
      if (isApiError(err) && err.kind === 'unauthorized') {
        setProfile(null);
      } else {
        notifyApiError(err, 'Не получилось получить профиль');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
        {profile.user.email && (
          <span className="text-muted small">{profile.user.email}</span>
        )}
      </div>
    );
  }, [profile]);

  const hasSessions = (profile?.sessions.length ?? 0) > 0;

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
                  Логин/регистрация через AllAuth + управление сессионными куками.
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
              </div>

              <div className="profile-column">
                {renderSessionCard()}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
