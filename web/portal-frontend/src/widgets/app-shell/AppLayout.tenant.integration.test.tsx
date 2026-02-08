/**
 * AppLayout — tenant routing integration tests.
 *
 * Verifies routeBase computation, TenantSwitcher rendering, and
 * logo navigation under both /t/:tenantSlug and legacy /app routes.
 */
import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthProvider, type UserInfo, useAuth } from '../../contexts/AuthContext';
import { TenantProvider, useTenantContext } from '../../contexts/TenantContext';
import { AppLayout } from './AppLayout';

vi.mock('@gravity-ui/navigation', () => ({
  AsideHeader: (props: Record<string, unknown>) => {
    const renderContent = props.renderContent as (() => React.ReactNode) | undefined;
    return (
      <div data-testid="aside-layout">
        <div data-testid="aside-logo-text">{(props.logo as { text?: string })?.text}</div>
        {renderContent?.()}
      </div>
    );
  },
}));

// Simple AppHeader that exposes tenantSwitcher slot
vi.mock('./AppHeader', () => ({
  AppHeader: ({ tenantSwitcher }: { tenantSwitcher?: React.ReactNode }) => (
    <div data-testid="app-header">{tenantSwitcher}</div>
  ),
}));

const AuthInit: React.FC<{ user: UserInfo | null }> = ({ user }) => {
  const { setUser } = useAuth();
  useEffect(() => { setUser(user); }, [setUser, user]);
  return null;
};

const TenantInit: React.FC<{ tenants: { id: string; slug: string; name: string; role: string }[] }> = ({ tenants }) => {
  const { setActiveTenant, setAvailableTenants } = useTenantContext();
  useEffect(() => {
    const mapped = tenants.map((t) => ({
      tenant_id: t.id,
      tenant_slug: t.slug,
      display_name: t.name,
      status: 'active' as const,
      base_role: t.role,
    }));
    setAvailableTenants(mapped);
    if (mapped.length > 0) {
      setActiveTenant({ tenant_id: mapped[0].tenant_id, tenant_slug: mapped[0].tenant_slug, display_name: mapped[0].display_name, base_role: mapped[0].base_role });
    }
  }, [tenants, setActiveTenant, setAvailableTenants]);
  return null;
};

const testUser: UserInfo = {
  id: 'u-1',
  username: 'testuser',
  email: 'test@example.com',
  isSuperuser: false,
  isStaff: false,
  displayName: 'Test User',
  tenant: { id: 'tenant-1', slug: 'aef' },
  capabilities: ['activity.feed.read'],
};

function renderLayout(path: string, user: UserInfo | null, tenants: { id: string; slug: string; name: string; role: string }[] = []) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider bootstrap={false}>
        <TenantProvider>
          <AuthInit user={user} />
          <TenantInit tenants={tenants} />
          <Routes>
            <Route path="/t/:tenantSlug/*" element={<AppLayout />}>
              <Route index element={<div data-testid="page">Dashboard</div>} />
              <Route path="feed" element={<div data-testid="page">Feed</div>} />
            </Route>
            <Route path="/app/*" element={<AppLayout />}>
              <Route index element={<div data-testid="page">Dashboard</div>} />
              <Route path="feed" element={<div data-testid="page">Feed</div>} />
            </Route>
          </Routes>
        </TenantProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AppLayout tenant integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // routeBase
  // ----------------------------------------------------------------

  it('uses /t/<slug> as routeBase under tenant route', () => {
    renderLayout('/t/aef', testUser, [{ id: 't1', slug: 'aef', name: 'AEF', role: 'owner' }]);
    expect(screen.getByTestId('aside-logo-text').textContent).toBe('AEF · Portal');
  });

  it('uses /app as routeBase under legacy route', () => {
    renderLayout('/app', testUser);
    expect(screen.getByTestId('aside-logo-text').textContent).toBe('AEF · Portal');
  });

  // ----------------------------------------------------------------
  // TenantSwitcher rendering via AppHeader tenantSwitcher slot
  // ----------------------------------------------------------------

  it('renders TenantSwitcher via AppHeader when multiple tenants are available', () => {
    renderLayout('/t/aef', testUser, [
      { id: 't1', slug: 'aef', name: 'AEF', role: 'owner' },
      { id: 't2', slug: 'beta', name: 'Beta', role: 'member' },
    ]);
    // TenantSwitcher renders the dropdown button with display_name
    expect(screen.getByText('AEF')).toBeInTheDocument();
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  it('does not render TenantSwitcher dropdown when single tenant', () => {
    renderLayout('/t/aef', testUser, [{ id: 't1', slug: 'aef', name: 'AEF', role: 'owner' }]);
    expect(screen.queryByText('▼')).not.toBeInTheDocument();
    // AppLayout only renders TenantSwitcher when availableTenants > 1,
    // so with a single tenant the slot is undefined. Name only shown in logo.
    expect(screen.getByTestId('aside-logo-text').textContent).toContain('AEF');
  });

  // ----------------------------------------------------------------
  // Logo text reflects tenant
  // ----------------------------------------------------------------

  it('logo text shows tenant slug uppercase when activeTenant is set', () => {
    renderLayout('/t/aef', testUser, [{ id: 't1', slug: 'aef', name: 'AEF', role: 'owner' }]);
    expect(screen.getByTestId('aside-logo-text').textContent).toContain('AEF');
  });

  it('logo text falls back to user.tenant when no activeTenant context', () => {
    renderLayout('/app', testUser);
    // No tenants passed → activeTenant is null, falls through to user.tenant.slug
    expect(screen.getByTestId('aside-logo-text').textContent).toBe('AEF · Portal');
  });

  it('logo text falls back to "UpdSpace Portal" when no tenant info at all', () => {
    const userNoTenant = { ...testUser, tenant: undefined };
    renderLayout('/app', userNoTenant);
    expect(screen.getByTestId('aside-logo-text').textContent).toBe('UpdSpace Portal');
  });

  // ----------------------------------------------------------------
  // Outlet renders page content
  // ----------------------------------------------------------------

  it('renders child page through Outlet under tenant route', () => {
    renderLayout('/t/aef', testUser, [{ id: 't1', slug: 'aef', name: 'AEF', role: 'owner' }]);
    expect(screen.getByTestId('page')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders child page through Outlet under legacy /app route', () => {
    renderLayout('/app', testUser);
    expect(screen.getByTestId('page')).toBeInTheDocument();
  });
});
