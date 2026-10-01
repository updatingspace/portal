import { useState } from 'react';
import { Avatar, DropdownMenu, type DropdownMenuItem } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { request } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useRouteBase } from '../../shared/hooks/useRouteBase';
import {
  ConfirmDialog,
  useUITranslation,
} from '../../shared/ui/portal/PortalUI';

export function AuthActions({
  extraItems = [],
}: {
  extraItems?: DropdownMenuItem[];
}) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const base = useRouteBase();
  const client = useQueryClient();
  const t = useUITranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const menu: DropdownMenuItem[] = [
    {
      text: t('Профиль', 'Profile'),
      action: () => navigate(`${base}/profile`),
    },
    {
      text: t('Настройки', 'Settings'),
      action: () => navigate(`${base}/settings`),
    },
    {
      text: t('Сменить сообщество', 'Switch community'),
      action: () => navigate('/choose-tenant'),
    },
    ...(user.isSuperuser
      ? [
          {
            text: t('Администрирование', 'Administration'),
            action: () => navigate(`${base}/admin`),
          },
        ]
      : []),
    ...extraItems,
    {
      text: t('Выйти', 'Sign out'),
      action: () => {
        setError(null);
        setOpen(true);
      },
    },
  ];
  const logout = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await request('/session/logout', { method: 'POST' });
      await client.cancelQueries();
      client.clear();
      try {
        localStorage.removeItem('personalization-preferences-cache-v1');
        for (const key of Object.keys(sessionStorage))
          if (key.startsWith(`portal-draft:${user.id}:`))
            sessionStorage.removeItem(key);
      } catch {
        /* optional browser storage */
      }
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('portal-session');
        channel.postMessage('signed-out');
        channel.close();
      }
      setUser(null);
      navigate('/', { replace: true });
    } catch {
      setError(
        t(
          'Не удалось выйти. Сессия может оставаться активной. Повторите попытку.',
          'Could not sign out. Your session may still be active. Please try again.',
        ),
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <DropdownMenu
        items={menu}
        renderSwitcher={(props) => (
          <button
            type="button"
            className="app-shell__user-button"
            {...props}
            aria-label={`${t('Меню аккаунта', 'Account menu')} ${user.displayName || user.username}`}
          >
            <Avatar
              size="s"
              imgUrl={user.avatarUrl ?? undefined}
              text={user.displayName || user.username}
            />
            <span className="app-shell__user-name">
              {user.displayName || user.username}
            </span>
          </button>
        )}
      />
      <ConfirmDialog
        open={open}
        title={t('Выйти из аккаунта?', 'Sign out?')}
        description={t(
          'Несохранённые изменения и черновики этой вкладки будут удалены после выхода.',
          'Unsaved changes and drafts in this tab will be removed after signing out.',
        )}
        confirmLabel={t('Выйти', 'Sign out')}
        pending={pending}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={() => void logout()}
      />
    </>
  );
}
