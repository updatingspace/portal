import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Avatar, Button, DropdownMenu, type DropdownMenuItem } from '@gravity-ui/uikit';

import { useAuth } from '../contexts/AuthContext';
import { useAuthUI } from '../contexts/AuthUIContext';
import AuthModal from './AuthModal';
import { clearSessionToken } from '../api/sessionToken';
import { logout } from '../services/api';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { openAuthModal, closeAuthModal, isAuthModalOpen, setAuthMode } = useAuthUI();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const isSuperuser = Boolean(user?.isSuperuser);

  const userMenuItems = useMemo<DropdownMenuItem[]>(
    () =>
      user
        ? [
            { action: () => navigate('/profile'), text: 'Безопасность' },
            ...(isSuperuser ? [{ action: () => navigate('/admin'), text: 'Админка' }] : []),
            {
              action: async () => {
                try {
                  await logout();
                } catch {
                  /* ignore */
                }
                clearSessionToken();
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

          <nav className="app-header-nav">
            {!user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar size="m" text="?" />
                <Button size="m" view="outlined" onClick={() => openAuthModal('login')}>
                  Войти
                </Button>
              </div>
            )}
            {user && (
              <DropdownMenu
                items={userMenuItems}
                renderSwitcher={(props) => (
                  <div
                    {...props}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    <Avatar size="m" text={user.username} />
                    <span>{user.username}</span>
                  </div>
                )}
              />
            )}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>

      <AuthModal
        open={isAuthModalOpen}
        onClose={() => {
          closeAuthModal();
          setAuthMode('login');
        }}
      />
    </div>
  );
};
