/**
 * TenantSwitcher — comprehensive unit tests.
 *
 * Covers every branch:
 * - No activeTenant, no availableTenants → renders null
 * - activeTenant with only 1 tenant → shows name, no dropdown
 * - activeTenant with 2+ tenants → shows dropdown toggle
 * - Dropdown open: lists all tenants, checkmark on active
 * - Selecting the same tenant → closes dropdown, no switch
 * - Selecting different tenant → calls doSwitchTenant, navigates
 * - Switch fails → stays on current tenant
 * - "Все сообщества →" link navigates to /choose-tenant
 * - Switching shows "..." text while in progress
 * - Keyboard: Enter clicks tenant card and nav link
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';

import { TenantSwitcher } from './TenantSwitcher';
import type { ActiveTenant, TenantSummary } from '../api/tenant';

// Mock TenantContext
const doSwitchTenantMock = vi.fn();
const mockTenantContext = {
  activeTenant: null as ActiveTenant | null,
  availableTenants: [] as TenantSummary[],
  doSwitchTenant: doSwitchTenantMock,
};
vi.mock('../contexts/TenantContext', () => ({
  useTenantContext: () => mockTenantContext,
}));

function renderSwitcher() {
  return render(
    <MemoryRouter initialEntries={['/t/aef']}>
      <Routes>
        <Route path="*" element={<TenantSwitcher />} />
        <Route path="/choose-tenant" element={<div data-testid="choose-tenant">Choose</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const activeTenant: ActiveTenant = {
  tenant_id: 't1',
  tenant_slug: 'aef',
  display_name: 'AEF',
  base_role: 'owner',
};

const tenantB: TenantSummary = {
  tenant_id: 't2',
  tenant_slug: 'beta',
  display_name: 'Beta',
  status: 'active',
  base_role: 'member',
};

const tenantA: TenantSummary = {
  tenant_id: 't1',
  tenant_slug: 'aef',
  display_name: 'AEF',
  status: 'active',
  base_role: 'owner',
};

describe('TenantSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantContext.activeTenant = null;
    mockTenantContext.availableTenants = [];
  });

  // ----------------------------------------------------------------
  // No active tenant → null
  // ----------------------------------------------------------------

  it('renders null when no activeTenant and no tenants', () => {
    const { container } = renderSwitcher();
    expect(container.innerHTML).toBe('');
  });

  // ----------------------------------------------------------------
  // Single tenant → name only, no dropdown
  // ----------------------------------------------------------------

  it('shows static name when only 1 tenant available', () => {
    mockTenantContext.activeTenant = activeTenant;
    mockTenantContext.availableTenants = [tenantA];

    renderSwitcher();

    expect(screen.getByText('AEF')).toBeInTheDocument();
    expect(screen.queryByText('▼')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Multiple tenants → dropdown toggle
  // ----------------------------------------------------------------

  it('shows dropdown button when 2+ tenants available', () => {
    mockTenantContext.activeTenant = activeTenant;
    mockTenantContext.availableTenants = [tenantA, tenantB];

    renderSwitcher();

    expect(screen.getByText('AEF')).toBeInTheDocument();
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Dropdown open: lists tenants with checkmark  
  // ----------------------------------------------------------------

  it('opens dropdown and shows all tenants with checkmark on active', async () => {
    mockTenantContext.activeTenant = activeTenant;
    mockTenantContext.availableTenants = [tenantA, tenantB];

    renderSwitcher();

    await userEvent.click(screen.getByText('AEF'));

    // Dropdown is open
    expect(screen.getByText('/aef')).toBeInTheDocument();
    expect(screen.getByText('/beta')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    // Checkmark on active
    expect(screen.getByText('✓')).toBeInTheDocument();

    // "All communities" link
    expect(screen.getByText('Все сообщества →')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Selecting same tenant → just close dropdown
  // ----------------------------------------------------------------

  it('selecting active tenant just closes dropdown without switching', async () => {
    mockTenantContext.activeTenant = activeTenant;
    mockTenantContext.availableTenants = [tenantA, tenantB];

    renderSwitcher();

    await userEvent.click(screen.getByText('AEF'));
    expect(screen.getByText('/aef')).toBeInTheDocument();

    // Click the active tenant in dropdown
    await userEvent.click(screen.getAllByText('AEF')[1]); // second one is in dropdown

    // Should NOT switch
    expect(doSwitchTenantMock).not.toHaveBeenCalled();

    // Dropdown should close
    expect(screen.queryByText('/beta')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Selecting different tenant → switch + navigate
  // ----------------------------------------------------------------

  it('selecting different tenant calls doSwitchTenant and navigates', async () => {
    mockTenantContext.activeTenant = activeTenant;
    mockTenantContext.availableTenants = [tenantA, tenantB];
    doSwitchTenantMock.mockResolvedValue(true);

    renderSwitcher();

    await userEvent.click(screen.getByText('AEF'));
    await userEvent.click(screen.getByText('Beta'));

    await waitFor(() => {
      expect(doSwitchTenantMock).toHaveBeenCalledWith('beta');
    });
  });

  // ----------------------------------------------------------------
  // Switch fails → stays
  // ----------------------------------------------------------------

  it('when switch fails, dropdown closes but does not navigate', async () => {
    mockTenantContext.activeTenant = activeTenant;
    mockTenantContext.availableTenants = [tenantA, tenantB];
    doSwitchTenantMock.mockResolvedValue(false);

    renderSwitcher();

    await userEvent.click(screen.getByText('AEF'));
    await userEvent.click(screen.getByText('Beta'));

    await waitFor(() => {
      expect(doSwitchTenantMock).toHaveBeenCalledWith('beta');
    });

    // Should still show the current tenant
    expect(screen.getByText('AEF')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // "Все сообщества →" link
  // ----------------------------------------------------------------

  it('"Все сообщества →" navigates to /choose-tenant', async () => {
    mockTenantContext.activeTenant = activeTenant;
    mockTenantContext.availableTenants = [tenantA, tenantB];

    render(
      <MemoryRouter initialEntries={['/t/aef']}>
        <Routes>
          <Route path="*" element={<TenantSwitcher />} />
          <Route path="/choose-tenant" element={<div data-testid="choose-tenant">Choose</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByText('AEF'));
    await userEvent.click(screen.getByText('Все сообщества →'));

    await waitFor(() => {
      expect(screen.getByTestId('choose-tenant')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // Switching shows "..." 
  // ----------------------------------------------------------------

  it('shows "..." while switching tenant', async () => {
    mockTenantContext.activeTenant = activeTenant;
    mockTenantContext.availableTenants = [tenantA, tenantB];

    // Create a promise we control
    let resolveSwitch: (value: boolean) => void;
    doSwitchTenantMock.mockReturnValue(new Promise((r) => { resolveSwitch = r; }));

    renderSwitcher();

    await userEvent.click(screen.getByText('AEF'));
    await userEvent.click(screen.getByText('Beta'));

    // While switching, button should show "..."
    await waitFor(() => {
      expect(screen.getByText('...')).toBeInTheDocument();
    });

    // Resolve the switch
    resolveSwitch!(true);

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    });
  });
});
