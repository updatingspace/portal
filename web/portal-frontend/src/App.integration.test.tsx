import React from 'react';

import App from './App';
import { renderWithProviders, screen } from './test/test-utils';

describe('App integration', () => {
  test('renders public landing for guest', async () => {
    renderWithProviders(<App />, { route: '/', wrapRouter: false });

    // Hero title and footer both contain 'AEF Portal'
    const portalTitles = await screen.findAllByText('AEF Portal');
    expect(portalTitles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Login')[0]).toBeInTheDocument();
  });

  test('redirects guest from /app to /login', async () => {
    renderWithProviders(<App />, { route: '/app', wrapRouter: false });

    expect(await screen.findByText('Continue with UpdSpaceID')).toBeInTheDocument();
  });

  test('renders app shell for authenticated user', async () => {
    renderWithProviders(
      <App />,
      {
        route: '/app',
        wrapRouter: false,
        authUser: {
          id: 'user-1',
          username: 'user-1',
          email: 'user-1@example.com',
          isSuperuser: false,
          isStaff: false,
          displayName: 'User One',
          tenant: { id: 'tenant-1', slug: 'aef' },
          capabilities: ['feed:read', 'events:read', 'voting:read'],
        },
      },
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Open voting')).toBeInTheDocument();
  });
});
