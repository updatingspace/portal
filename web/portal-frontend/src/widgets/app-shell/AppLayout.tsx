import React, { useMemo } from 'react';
import { Icon } from '@gravity-ui/uikit';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { buildAsideMenuItems } from '../../features/navigation/menu';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from './AppHeader';
import './app-shell.css';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = useMemo(
    () =>
      buildAsideMenuItems({
        user,
        currentPath: location.pathname,
        onNavigate: (to) => navigate(to),
      }),
    [location.pathname, navigate, user],
  );

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <nav className="app-shell__nav" aria-label="Primary navigation">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="app-shell__nav-button"
              data-active={item.current ? 'true' : 'false'}
              aria-current={item.current ? 'page' : undefined}
              onClick={() => item.link && navigate(item.link)}
            >
              {item.icon && <Icon data={item.icon} size={16} />}
              <span>{item.title}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="app-shell__main">
        <AppHeader />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
