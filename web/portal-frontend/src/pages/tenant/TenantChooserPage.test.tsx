/**
 * TenantChooserPage — comprehensive unit tests.
 *
 * Covers every PageState and branch:
 * - loading: shows AppLoader while fetching entry/me
 * - list: shows tenant cards, clicking navigates
 * - list with last_tenant: shows last tenant info
 * - no-memberships: shows create application form
 * - pending: shows pending application status + refresh button
 * - error: shows error message + retry button
 * - reason=forbidden query param: shows warning
 * - Create form: validation, submission success → pending
 * - Create form: submission failure → error message
 * - handleSelectTenant: calls doSwitchTenant, navigates on success
 * - handleSelectTenant: switch fails, does not navigate
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import userEvent from '@testing-library/user-event';

import { TenantChooserPage } from './TenantChooserPage';
import type { EntryMeResponse } from '../../api/tenant';

// Mock tenant API
vi.mock('../../api/tenant', () => ({
  fetchEntryMe: vi.fn(),
  submitTenantApplication: vi.fn(),
}));

// Mock TenantContext
const doSwitchTenantMock = vi.fn();
vi.mock('../../contexts/TenantContext', () => ({
  useTenantContext: () => ({
    doSwitchTenant: doSwitchTenantMock,
  }),
}));

// Mock AppLoader
vi.mock('../../shared/ui/AppLoader', () => ({
  AppLoader: () => <div data-testid="app-loader">Loading...</div>,
}));

import { fetchEntryMe, submitTenantApplication } from '../../api/tenant';

const fetchEntryMeMock = fetchEntryMe as Mock;
const submitTenantApplicationMock = submitTenantApplication as Mock;

function renderChooser(route = '/choose-tenant') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/choose-tenant" element={<TenantChooserPage />} />
        <Route path="/t/:tenantSlug/*" element={<div data-testid="tenant-route">Tenant App</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const makeMemberships = (): EntryMeResponse => ({
  user: { id: 'u1', email: 'test@example.com' },
  memberships: [
    { tenant_id: 't1', tenant_slug: 'aef', display_name: 'AEF', status: 'active', base_role: 'owner' },
    { tenant_id: 't2', tenant_slug: 'beta', display_name: 'Beta', status: 'active', base_role: 'member' },
  ],
  last_tenant: { tenant_slug: 'aef' },
  pending_tenant_applications: [],
});

const makeNoMemberships = (): EntryMeResponse => ({
  user: { id: 'u1', email: 'test@example.com' },
  memberships: [],
  last_tenant: null,
  pending_tenant_applications: [],
});

const makePending = (): EntryMeResponse => ({
  user: { id: 'u1', email: 'test@example.com' },
  memberships: [],
  last_tenant: null,
  pending_tenant_applications: [
    { id: 'app1', slug: 'new-community', status: 'pending' },
  ],
});

describe('TenantChooserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------------

  it('shows AppLoader while fetching entry/me', () => {
    fetchEntryMeMock.mockReturnValue(new Promise(() => {})); // never resolves
    renderChooser();
    expect(screen.getByTestId('app-loader')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // List state — tenant cards
  // ----------------------------------------------------------------

  it('shows tenant list when memberships exist', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeMemberships());
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('AEF')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    // Shows slug
    expect(screen.getByText('/aef')).toBeInTheDocument();
    expect(screen.getByText('/beta')).toBeInTheDocument();

    // Shows base role
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
  });

  it('shows last_tenant info when available', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeMemberships());
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText(/Последний tenant/)).toBeInTheDocument();
      expect(screen.getByText('aef')).toBeInTheDocument();
    });
  });

  it('does not show last_tenant when null', async () => {
    const data = makeMemberships();
    data.last_tenant = null;
    fetchEntryMeMock.mockResolvedValueOnce(data);
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('AEF')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Последний tenant/)).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Clicking a tenant card
  // ----------------------------------------------------------------

  it('navigates to /t/slug/ on successful tenant selection', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeMemberships());
    doSwitchTenantMock.mockResolvedValue(true);
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('AEF')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('AEF'));

    await waitFor(() => {
      expect(doSwitchTenantMock).toHaveBeenCalledWith('aef');
    });

    await waitFor(() => {
      expect(screen.getByTestId('tenant-route')).toBeInTheDocument();
    });
  });

  it('does not navigate when doSwitchTenant returns false', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeMemberships());
    doSwitchTenantMock.mockResolvedValue(false);
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('AEF')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('AEF'));

    await waitFor(() => {
      expect(doSwitchTenantMock).toHaveBeenCalledWith('aef');
    });

    // Should still be on chooser page
    expect(screen.queryByTestId('tenant-route')).not.toBeInTheDocument();
    expect(screen.getByText('Portal Updating Space')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // No memberships — create form
  // ----------------------------------------------------------------

  it('shows create application form when no memberships', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeNoMemberships());
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('У вас пока нет сообществ. Создайте заявку:')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Slug (например: my-community)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Название')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Описание (необязательно)')).toBeInTheDocument();
    expect(screen.getByText('Отправить заявку')).toBeInTheDocument();
  });

  it('submit button is disabled when slug is empty', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeNoMemberships());
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('Отправить заявку')).toBeInTheDocument();
    });

    expect(screen.getByText('Отправить заявку')).toBeDisabled();
  });

  it('submitting application transitions to pending state', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeNoMemberships());
    submitTenantApplicationMock.mockResolvedValueOnce({ ok: true });
    fetchEntryMeMock.mockResolvedValueOnce(makePending()); // re-fetch after submit

    renderChooser();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Slug (например: my-community)')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText('Slug (например: my-community)'), 'new-community');
    await userEvent.type(screen.getByPlaceholderText('Название'), 'New Community');
    await userEvent.type(screen.getByPlaceholderText('Описание (необязательно)'), 'A great community');

    await userEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() => {
      expect(submitTenantApplicationMock).toHaveBeenCalledWith({
        slug: 'new-community',
        name: 'New Community',
        description: 'A great community',
      });
    });

    // Should now show pending state
    await waitFor(() => {
      expect(screen.getByText('Ваша заявка на рассмотрении:')).toBeInTheDocument();
      expect(screen.getByText('/new-community')).toBeInTheDocument();
    });
  });

  it('submitting application with empty name uses slug as name', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeNoMemberships());
    submitTenantApplicationMock.mockResolvedValueOnce({ ok: true });
    fetchEntryMeMock.mockResolvedValueOnce(makePending());

    renderChooser();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Slug (например: my-community)')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText('Slug (например: my-community)'), 'slug-only');
    await userEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() => {
      expect(submitTenantApplicationMock).toHaveBeenCalledWith({
        slug: 'slug-only',
        name: 'slug-only',
        description: '',
      });
    });
  });

  it('submission failure shows error message', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeNoMemberships());
    submitTenantApplicationMock.mockRejectedValueOnce(new Error('Network error'));

    renderChooser();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Slug (например: my-community)')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText('Slug (например: my-community)'), 'my-slug');
    await userEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() => {
      expect(screen.getByText('Не удалось отправить заявку.')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // Pending state
  // ----------------------------------------------------------------

  it('shows pending applications', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makePending());
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('Ваша заявка на рассмотрении:')).toBeInTheDocument();
      expect(screen.getByText('/new-community')).toBeInTheDocument();
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  it('refresh button re-fetches and transitions state', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makePending());
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('Обновить статус')).toBeInTheDocument();
    });

    // After refresh, now user has memberships
    fetchEntryMeMock.mockResolvedValueOnce(makeMemberships());
    await userEvent.click(screen.getByText('Обновить статус'));

    await waitFor(() => {
      expect(screen.getByText('AEF')).toBeInTheDocument();
    });
  });

  it('refresh button shows pending again if still pending', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makePending());
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('Обновить статус')).toBeInTheDocument();
    });

    fetchEntryMeMock.mockResolvedValueOnce(makePending());
    await userEvent.click(screen.getByText('Обновить статус'));

    await waitFor(() => {
      expect(screen.getByText('Ваша заявка на рассмотрении:')).toBeInTheDocument();
    });
  });

  it('refresh button shows no-memberships if applications are gone', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makePending());
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('Обновить статус')).toBeInTheDocument();
    });

    fetchEntryMeMock.mockResolvedValueOnce(makeNoMemberships());
    await userEvent.click(screen.getByText('Обновить статус'));

    await waitFor(() => {
      expect(screen.getByText('У вас пока нет сообществ. Создайте заявку:')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // Error state
  // ----------------------------------------------------------------

  it('shows error and retry button when entry/me fails', async () => {
    fetchEntryMeMock.mockRejectedValueOnce(new Error('Service down'));
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('Не удалось загрузить список tenant.')).toBeInTheDocument();
      expect(screen.getByText('Повторить')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // reason=forbidden query param
  // ----------------------------------------------------------------

  it('shows forbidden warning when ?reason=forbidden', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeMemberships());
    renderChooser('/choose-tenant?reason=forbidden');

    await waitFor(() => {
      expect(screen.getByText('У вас нет доступа к запрашиваемому сообществу.')).toBeInTheDocument();
    });
  });

  it('does not show forbidden warning without query param', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeMemberships());
    renderChooser('/choose-tenant');

    await waitFor(() => {
      expect(screen.getByText('AEF')).toBeInTheDocument();
    });
    expect(screen.queryByText('У вас нет доступа к запрашиваемому сообществу.')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Heading always visible  
  // ----------------------------------------------------------------

  it('always shows heading text', async () => {
    fetchEntryMeMock.mockResolvedValueOnce(makeMemberships());
    renderChooser();

    await waitFor(() => {
      expect(screen.getByText('Portal Updating Space')).toBeInTheDocument();
      expect(screen.getByText('Выберите сообщество')).toBeInTheDocument();
    });
  });
});
