import React, { useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  const { user, setUser } = useAuth();
  const { openAuthModal, closeAuthModal, isAuthModalOpen, setAuthMode } = useAuthUI();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperuser = Boolean(user?.isSuperuser);
  const isAdminPage = location.pathname.startsWith('/admin');

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
                renderSwitcher={(props) => {
                  const displayName = user.displayName || user.username;
                  return (
                    <div
                      {...props}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    >
                      <Avatar
                        size="m"
                        imgUrl={user.avatarUrl || undefined}
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

      {!isAdminPage && (
        <footer className="app-footer">
          <div className="container">
            AEF Vote © 2025
          </div>
        </footer>
      )}

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
