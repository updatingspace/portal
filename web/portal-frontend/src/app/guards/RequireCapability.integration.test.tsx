import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AuthProvider, type UserInfo } from '../../contexts/AuthContext';
import { AuthInitializer } from '../../test/test-utils';
import { RequireCapability } from './RequireCapability';

const createUser = (overrides: Partial<UserInfo> = {}): UserInfo => ({
  id: 'user-1',
  username: 'user-1',
  email: 'user-1@example.com',
  isSuperuser: false,
  isStaff: false,
  displayName: 'User One',
  tenant: { id: 'tenant-1', slug: 'aef' },
  capabilities: [],
  ...overrides,
});

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
  it.each([
    ['missing capability', ['events.event.read'], true],
    ['present capability', ['activity.feed.read'], false],
  ])(
    'renders access state for %s',
    async (_name, capabilities, shouldBeDenied) => {
      renderWithAuth(createUser({ capabilities }));

      if (shouldBeDenied) {
        expect(await screen.findByRole('heading', { name: 'Доступ ограничен' })).toBeInTheDocument();
        expect(screen.queryByText('Feed Content')).not.toBeInTheDocument();
        return;
      }

      expect(await screen.findByText('Feed Content')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Доступ ограничен' })).not.toBeInTheDocument();
    },
  );
});
