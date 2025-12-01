import React from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const isSuperuser = Boolean(user?.isSuperuser);

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
            {isSuperuser && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  'nav-link-secondary' + (isActive ? ' nav-link-secondary-active' : '')
                }
              >
                Админка
              </NavLink>
            )}
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                'nav-link-secondary' + (isActive ? ' nav-link-secondary-active' : '')
              }
            >
              Профиль
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>
    </div>
  );
};
