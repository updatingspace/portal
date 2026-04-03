import React from 'react';

import App from './App';
import { renderWithProviders, screen } from './test/test-utils';

const AUTH_USER = {
  id: 'user-1',
  username: 'user-1',
  email: 'user-1@example.com',
  isSuperuser: false,
  isStaff: false,
  displayName: 'User One',
  tenant: { id: 'tenant-1', slug: 'aef' },
  capabilities: ['activity.feed.read', 'events.event.read', 'voting.votings.read'],
};

function renderApp({ route = '/', authUser }: { route?: string; authUser?: typeof AUTH_USER } = {}) {
  renderWithProviders(<App />, { route, wrapRouter: false, authUser });
}

describe('App integration', () => {
  test('renders public landing for guest', async () => {
    renderApp({ route: '/' });

    // Hero title and footer both contain 'AEF Portal'
    const portalTitles = await screen.findAllByText('AEF Portal');
    expect(portalTitles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Login')[0]).toBeInTheDocument();
  });

  test('redirects guest from /app to /login', async () => {
    renderApp({ route: '/app' });

    expect(await screen.findByText('Continue with UpdSpaceID')).toBeInTheDocument();
  });

  test('renders app shell for authenticated user', async () => {
    renderApp({ route: '/app', authUser: AUTH_USER });

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Open voting')).toBeInTheDocument();
  });
});
