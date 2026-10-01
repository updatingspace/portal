import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@gravity-ui/uikit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './Page';

// jsdom's selector engine cannot parse Gravity's generated modal IDs.
// Dialog focus and keyboard behavior are exercised in the browser suite.
vi.mock('@gravity-ui/uikit', async (original) => {
  const actual = await original<typeof import('@gravity-ui/uikit')>();
  const Slot = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ...actual,
    Dialog: Object.assign(
      ({ open, children }: { open: boolean; children: React.ReactNode }) =>
        open ? <div role="dialog">{children}</div> : null,
      {
        Header: ({ caption }: { caption: string }) => <h2>{caption}</h2>,
        Body: Slot,
        Footer: Slot,
      },
    ),
  };
});

const mocks = vi.hoisted(() => ({
  leave: vi.fn(),
  list: vi.fn(),
  setUser: vi.fn(),
  setActiveTenant: vi.fn(),
  setAvailableTenants: vi.fn(),
  setState: vi.fn(),
  role: 'member',
}));
vi.mock('../../../api/tenant', () => ({
  leaveTenant: mocks.leave,
  fetchSessionTenants: mocks.list,
}));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user',
      username: 'Player',
      displayName: 'Player',
      tenant: { id: 'alpha-id', slug: 'alpha' },
    },
    setUser: mocks.setUser,
  }),
}));
vi.mock('../../../contexts/TenantContext', () => ({
  useTenantContext: () => ({
    activeTenant: {
      tenant_id: 'alpha-id',
      tenant_slug: 'alpha',
      display_name: 'Alpha',
      base_role: mocks.role,
    },
    availableTenants: [],
    setActiveTenant: mocks.setActiveTenant,
    setAvailableTenants: mocks.setAvailableTenants,
    setState: mocks.setState,
  }),
}));
vi.mock('../../../shared/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));
vi.mock('../../../shared/ui/portal/PortalUI', async (original) => ({
  ...(await original<typeof import('../../../shared/ui/portal/PortalUI')>()),
  useUITranslation: () => (_ru: string, en: string) => en,
}));
vi.mock('../../../features/personalization', () => ({
  UserSettingsPanel: () => <div>Preferences</div>,
}));
function mount(url = '/t/alpha/settings') {
  const client = new QueryClient();
  client.setQueryData(['private-posts'], ['private']);
  render(
    <ThemeProvider theme="dark">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/t/alpha/settings" element={<SettingsPage />} />
            <Route path="/choose-tenant" element={<h1>Choose a space</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = 'member';
  mocks.list.mockResolvedValue([{ tenant_id: 'alpha-id' }]);
});
describe('compact membership in settings', () => {
  it('replaces the redundant community page with one membership row', () => {
    mount('/t/alpha/settings?tab=community');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Community' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Switch community' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave…' })).toBeVisible();
  });
  it('only leaves after confirmation, clears private data and returns to the chooser', async () => {
    mocks.leave.mockResolvedValue({ tenant_id: 'alpha-id', status: 'left' });
    const client = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Leave…' }));
    expect(mocks.leave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.leave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Leave…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave community' }));
    await screen.findByRole('heading', { name: 'Choose a space' });
    expect(mocks.leave).toHaveBeenCalledExactlyOnceWith('alpha-id');
    expect(mocks.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ tenant: undefined, capabilities: [] }),
    );
    expect(client.getQueryData(['private-posts'])).toBeUndefined();
  });
  it('keeps the dialog and context on failure', async () => {
    mocks.leave.mockRejectedValue(new Error('offline'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Leave…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave community' }));
    await screen.findByText('Unable to confirm leaving. Try again.');
    expect(mocks.setUser).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeVisible();
  });
  it('checks membership after a lost response before allowing another write', async () => {
    mocks.leave.mockRejectedValue(new Error('lost response'));
    mocks.list.mockResolvedValue([]);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Leave…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave community' }));
    await screen.findByRole('heading', { name: 'Choose a space' });
    expect(mocks.leave).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
  it('explains the owner restriction without offering a failing action', async () => {
    mocks.role = 'owner';
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Leave…' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeVisible());
    expect(screen.getByText(/You own this community/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Leave community' }),
    ).not.toBeInTheDocument();
    expect(mocks.leave).not.toHaveBeenCalled();
  });
});
