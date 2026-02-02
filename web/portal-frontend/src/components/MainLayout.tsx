import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Avatar, Button, DropdownMenu, type DropdownMenuItem } from '@gravity-ui/uikit';

import { useAuth } from '../contexts/AuthContext';
import { requestResult } from '../api/client';
import { redirectToLogin } from '../modules/portal/auth';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const isSuperuser = Boolean(user?.isSuperuser);

  const userMenuItems = useMemo<DropdownMenuItem[]>(
    () =>
      user
        ? [
            { action: () => navigate('/profile'), text: 'Безопасность' },
            { action: () => navigate('/me'), text: 'Профиль' },
            ...(isSuperuser ? [{ action: () => navigate('/admin/applications'), text: 'Заявки' }] : []),
            {
              action: async () => {
                try {
                  await requestResult('/session/logout', { method: 'POST' });
                } catch {
                  /* ignore */
                }
                setUser(null);
                navigate('/');
              },
              text: 'Выйти',
            },
          ]
        : [],
    [isSuperuser, navigate, setUser, user],
  );

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="container d-flex align-items-center justify-content-between">
          <NavLink to="/" end className="logo-link">
            <div className="logo-box">
              Логотип<br />от Альжумже
            </div>
          </NavLink>

          <div className="d-flex align-items-center gap-3">
            <NavLink to="/nominations" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Голосование
            </NavLink>
            <NavLink to="/events" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              События
            </NavLink>
            <NavLink to="/feed" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Лента
            </NavLink>
          </div>

          <nav className="app-header-nav">
            {!user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar size="m" text="?" />
                <Button size="m" view="outlined" onClick={() => redirectToLogin()}>
                  Войти
                </Button>
              </div>
            )}
            {user && (
              <DropdownMenu
                items={userMenuItems}
                renderSwitcher={(props) => {
                  const displayName = user.displayName || user.username;
                  return (
                    <div
                      {...props}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    >
                      <Avatar
                        size="m"
                        imgUrl={user.avatarUrl ?? undefined}
                        text={displayName}
                        title={displayName}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                        <span>{displayName}</span>
                        {user.email && (
                          <small style={{ opacity: 0.7 }}>{user.email}</small>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>
    </div>
  );
};
