/**
 * TenantContext — comprehensive unit tests.
 *
 * Covers:
 * - Provider renders children
 * - useTenantContext throws outside provider
 * - useTenant / useAvailableTenants hooks
 * - doSwitchTenant: success, forbidden (403), generic error, unknown error shape
 * - refreshTenants: success, failure
 * - setActiveTenant / setAvailableTenants / setState direct setters
 * - State transitions: idle → switching → ready, idle → switching → forbidden, idle → switching → error
 */
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import {
  TenantProvider,
  useTenantContext,
  useTenant,
  useAvailableTenants,
} from './TenantContext';
import type { ActiveTenant, TenantSummary } from '../api/tenant';

// Mock tenant API
vi.mock('../api/tenant', () => ({
  switchTenant: vi.fn(),
  fetchSessionTenants: vi.fn(),
}));

import { switchTenant, fetchSessionTenants } from '../api/tenant';

const switchTenantMock = switchTenant as Mock;
const fetchSessionTenantsMock = fetchSessionTenants as Mock;

// Helper that renders a consumer inside TenantProvider
function TestConsumer({ onContext }: { onContext: (ctx: ReturnType<typeof useTenantContext>) => void }) {
  const ctx = useTenantContext();
  onContext(ctx);
  return <div data-testid="consumer">ok</div>;
}

function TenantHookDisplay() {
  const tenant = useTenant();
  const available = useAvailableTenants();
  return (
    <div>
      <span data-testid="tenant">{tenant ? tenant.tenant_slug : 'none'}</span>
      <span data-testid="available">{available.length}</span>
    </div>
  );
}

describe('TenantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // Provider basics
  // ----------------------------------------------------------------

  it('renders children inside TenantProvider', () => {
    render(
      <TenantProvider>
        <div data-testid="child">Hello</div>
      </TenantProvider>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('throws when useTenantContext is used outside TenantProvider', () => {
    const Bomb = () => {
      useTenantContext();
      return null;
    };
    expect(() => render(<Bomb />)).toThrow('useTenantContext must be used within TenantProvider');
  });

  // ----------------------------------------------------------------
  // Initial state
  // ----------------------------------------------------------------

  it('initial state: idle, null activeTenant, empty availableTenants, null errorMessage', () => {
    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );
    expect(captured).toBeDefined();
    expect(captured!.state).toBe('idle');
    expect(captured!.activeTenant).toBeNull();
    expect(captured!.availableTenants).toEqual([]);
    expect(captured!.errorMessage).toBeNull();
  });

  // ----------------------------------------------------------------
  // useTenant / useAvailableTenants hooks
  // ----------------------------------------------------------------

  it('useTenant returns null initially', () => {
    render(
      <TenantProvider>
        <TenantHookDisplay />
      </TenantProvider>,
    );
    expect(screen.getByTestId('tenant')).toHaveTextContent('none');
    expect(screen.getByTestId('available')).toHaveTextContent('0');
  });

  // ----------------------------------------------------------------
  // doSwitchTenant — success
  // ----------------------------------------------------------------

  it('doSwitchTenant success: transitions idle → switching → ready', async () => {
    const activeTenant: ActiveTenant = {
      tenant_id: 'tid-1',
      tenant_slug: 'aef',
      display_name: 'AEF',
      base_role: 'owner',
    };
    switchTenantMock.mockResolvedValueOnce({ active_tenant: activeTenant, redirect_to: '/t/aef/' });

    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    let result: boolean | undefined;
    await act(async () => {
      result = await captured!.doSwitchTenant('aef');
    });

    expect(result).toBe(true);
    expect(captured!.state).toBe('ready');
    expect(captured!.activeTenant).toEqual(activeTenant);
    expect(captured!.errorMessage).toBeNull();
    expect(switchTenantMock).toHaveBeenCalledWith('aef');
  });

  // ----------------------------------------------------------------
  // doSwitchTenant — forbidden (403 / TENANT_FORBIDDEN)
  // ----------------------------------------------------------------

  it('doSwitchTenant forbidden (code=TENANT_FORBIDDEN): state → forbidden', async () => {
    switchTenantMock.mockRejectedValueOnce({
      code: 'TENANT_FORBIDDEN',
      status: 403,
      message: 'Access denied to this tenant',
    });

    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    let result: boolean | undefined;
    await act(async () => {
      result = await captured!.doSwitchTenant('restricted');
    });

    expect(result).toBe(false);
    expect(captured!.state).toBe('forbidden');
    expect(captured!.errorMessage).toBe('Access denied to this tenant');
  });

  it('doSwitchTenant status 403 without code: state → forbidden', async () => {
    switchTenantMock.mockRejectedValueOnce({ status: 403 });

    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    let result: boolean | undefined;
    await act(async () => {
      result = await captured!.doSwitchTenant('forbidden-slug');
    });

    expect(result).toBe(false);
    expect(captured!.state).toBe('forbidden');
    expect(captured!.errorMessage).toBe('Access denied to this tenant');
  });

  // ----------------------------------------------------------------
  // doSwitchTenant — generic error
  // ----------------------------------------------------------------

  it('doSwitchTenant generic error: state → error', async () => {
    switchTenantMock.mockRejectedValueOnce({ status: 500, message: 'Server exploded' });

    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    let result: boolean | undefined;
    await act(async () => {
      result = await captured!.doSwitchTenant('bad-slug');
    });

    expect(result).toBe(false);
    expect(captured!.state).toBe('error');
    expect(captured!.errorMessage).toBe('Server exploded');
  });

  it('doSwitchTenant with no message: uses fallback message', async () => {
    switchTenantMock.mockRejectedValueOnce({ status: 500 });

    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    await act(async () => {
      await captured!.doSwitchTenant('no-msg');
    });

    expect(captured!.state).toBe('error');
    expect(captured!.errorMessage).toBe('Failed to switch tenant');
  });

  // ----------------------------------------------------------------
  // refreshTenants — success
  // ----------------------------------------------------------------

  it('refreshTenants success: updates availableTenants', async () => {
    const tenants: TenantSummary[] = [
      { tenant_id: 'a', tenant_slug: 'alpha', display_name: 'Alpha', status: 'active', base_role: 'member' },
      { tenant_id: 'b', tenant_slug: 'beta', display_name: 'Beta', status: 'active', base_role: 'owner' },
    ];
    fetchSessionTenantsMock.mockResolvedValueOnce(tenants);

    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    let result: TenantSummary[] | undefined;
    await act(async () => {
      result = await captured!.refreshTenants();
    });

    expect(result).toEqual(tenants);
    expect(captured!.availableTenants).toEqual(tenants);
  });

  // ----------------------------------------------------------------
  // refreshTenants — failure
  // ----------------------------------------------------------------

  it('refreshTenants failure: returns empty array, does not crash', async () => {
    fetchSessionTenantsMock.mockRejectedValueOnce(new Error('network error'));

    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    let result: TenantSummary[] | undefined;
    await act(async () => {
      result = await captured!.refreshTenants();
    });

    expect(result).toEqual([]);
  });

  // ----------------------------------------------------------------
  // Direct setters
  // ----------------------------------------------------------------

  it('setActiveTenant updates activeTenant', async () => {
    const tenant: ActiveTenant = {
      tenant_id: 'x',
      tenant_slug: 'x-slug',
      display_name: 'X',
      base_role: 'admin',
    };

    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    await act(async () => {
      captured!.setActiveTenant(tenant);
    });

    expect(captured!.activeTenant).toEqual(tenant);
  });

  it('setActiveTenant(null) clears tenant', async () => {
    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    // Set, then clear
    await act(async () => {
      captured!.setActiveTenant({ tenant_id: '1', tenant_slug: 's', display_name: 'S', base_role: 'member' });
    });
    expect(captured!.activeTenant).not.toBeNull();

    await act(async () => {
      captured!.setActiveTenant(null);
    });
    expect(captured!.activeTenant).toBeNull();
  });

  it('setAvailableTenants updates available list', async () => {
    const tenants: TenantSummary[] = [
      { tenant_id: 'z', tenant_slug: 'zulu', display_name: 'Zulu', status: 'active', base_role: 'member' },
    ];

    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    await act(async () => {
      captured!.setAvailableTenants(tenants);
    });

    expect(captured!.availableTenants).toEqual(tenants);
  });

  it('setState updates state', async () => {
    let captured: ReturnType<typeof useTenantContext> | undefined;
    render(
      <TenantProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </TenantProvider>,
    );

    await act(async () => {
      captured!.setState('ready');
    });
    expect(captured!.state).toBe('ready');

    await act(async () => {
      captured!.setState('no-memberships');
    });
    expect(captured!.state).toBe('no-memberships');
  });
});
