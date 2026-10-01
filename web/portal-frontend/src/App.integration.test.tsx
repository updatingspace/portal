import React from 'react';

import App from './App';
import { renderWithProviders, screen, waitFor } from './test/test-utils';

vi.mock('./api/tenant', () => ({
  switchTenant: vi.fn(async (slug: string) => ({
    active_tenant: { tenant_id: 'tenant-1', tenant_slug: slug },
  })),
  fetchSessionTenants: vi.fn(async () => []),
}));
vi.mock('./modules/portal/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./modules/portal/api')>()),
  fetchSessionMe: vi.fn(async () => ({
    user: { id: 'user-1' },
    tenant: { id: 'tenant-1', slug: 'aef' },
    capabilities: [],
    portal_profile: { display_name: 'User One' },
  })),
}));
const AUTH_USER = {
  id: 'user-1',
  username: 'user-1',
  email: 'user-1@example.com',
  isSuperuser: false,
  isStaff: false,
  displayName: 'User One',
  tenant: { id: 'tenant-1', slug: 'aef' },
  capabilities: [
    'activity.feed.read',
    'events.event.read',
    'voting.votings.read',
  ],
};

function renderApp({
  route = '/',
  authUser,
}: { route?: string; authUser?: typeof AUTH_USER } = {}) {
  renderWithProviders(<App />, { route, wrapRouter: false, authUser });
}

describe('App integration', () => {
  test('renders public landing for guest', async () => {
    renderApp({ route: '/' });

    // The public brand is independent of community membership.
    const portalTitles = await screen.findAllByText('UpdSpace Portal');
    expect(portalTitles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Login')[0]).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Home · UpdSpace Portal');
    });
  });

  test('redirects guest from /app to /login', async () => {
    renderApp({ route: '/app' });

    expect(
      await screen.findByText('Continue with UpdSpaceID'),
    ).toBeInTheDocument();
  });

  test('renders app shell for authenticated user', async () => {
    renderApp({ route: '/app', authUser: AUTH_USER });

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Overview' },
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('156')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Overview · AEF · UpdSpace Portal');
    });
  });
});
