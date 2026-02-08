import React, { useMemo } from 'react';
import { Avatar, DropdownMenu, type DropdownMenuItem } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import { requestResult } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useRouteBase } from '../../shared/hooks/useRouteBase';

export const AuthActions: React.FC = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const routeBase = useRouteBase();

  const userMenuItems = useMemo<DropdownMenuItem[]>(
    () =>
      user
        ? [
            { action: () => navigate(`${routeBase}/profile`), text: 'Profile' },
            { action: () => navigate(`${routeBase}/settings`), text: 'Settings' },
            ...(user.isSuperuser
              ? [{ action: () => navigate(`${routeBase}/admin`), text: 'Admin' }]
              : []),
            {
              action: async () => {
                try {
                  await requestResult('/logout', { method: 'POST' });
                } catch (firstError) {
                  try {
                    await requestResult('/session/logout', { method: 'POST' });
                  } catch (secondError) {
                    console.warn('Logout flow failed twice', { firstError, secondError });
                  }
                }
                setUser(null);
                navigate('/');
              },
              text: 'Logout',
            },
          ]
        : [],
    [navigate, setUser, user, routeBase],
  );

  if (!user || !userMenuItems.length) {
    return null;
  }

  const displayName = user.displayName || user.username;

  return (
    <DropdownMenu
      items={userMenuItems}
      renderSwitcher={(props) => (
        <button type="button" className="app-shell__user-button" {...props}>
          <Avatar
            size="s"
            imgUrl={user.avatarUrl ?? undefined}
            text={displayName}
            title={displayName}
          />
          <span className="app-shell__user-name">{displayName}</span>
        </button>
      )}
    />
  );
};
