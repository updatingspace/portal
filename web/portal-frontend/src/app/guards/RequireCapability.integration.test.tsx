import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AuthProvider, type UserInfo, useAuth } from '../../contexts/AuthContext';
import { RequireCapability } from './RequireCapability';

const AuthInitializer: React.FC<{ user: UserInfo | null }> = ({ user }) => {
  const { setUser } = useAuth();

  useEffect(() => {
    setUser(user);
  }, [setUser, user]);

  return null;
};

const renderWithAuth = (user: UserInfo | null) => {
  render(
    <MemoryRouter initialEntries={['/feed']}>
      <AuthProvider bootstrap={false}>
        <AuthInitializer user={user} />
        <Routes>
          <Route
            path="/feed"
            element={(
              <RequireCapability required="activity.feed.read">
                <div>Feed Content</div>
              </RequireCapability>
            )}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
};

describe('RequireCapability integration', () => {
  it('renders AccessDeniedScreen when permission is missing', async () => {
    renderWithAuth({
      id: 'user-1',
      username: 'user-1',
      email: 'user-1@example.com',
      isSuperuser: false,
      isStaff: false,
      displayName: 'User One',
      tenant: { id: 'tenant-1', slug: 'aef' },
      capabilities: ['events.event.read'],
    });

    expect(await screen.findByRole('heading', { name: 'Доступ ограничен' })).toBeInTheDocument();
    expect(screen.queryByText('Feed Content')).not.toBeInTheDocument();
  });

  it('renders content when permission is present', async () => {
    renderWithAuth({
      id: 'user-2',
      username: 'user-2',
      email: 'user-2@example.com',
      isSuperuser: false,
      isStaff: false,
      displayName: 'User Two',
      tenant: { id: 'tenant-1', slug: 'aef' },
      capabilities: ['activity.feed.read'],
    });

    expect(await screen.findByText('Feed Content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Доступ ограничен' })).not.toBeInTheDocument();
  });
});
