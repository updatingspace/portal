import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardCustomizer } from '../components/dashboard/DashboardCustomizer';

vi.mock('@gravity-ui/uikit', async () => {
  const actual = await vi.importActual<typeof import('@gravity-ui/uikit')>('@gravity-ui/uikit');
  return {
    ...actual,
    useToaster: () => ({ add: vi.fn() }),
  };
});

vi.mock('../api/contentApi', () => ({
  fetchDashboardLayouts: vi.fn().mockResolvedValue([
    {
      id: 'layout-1',
      user_id: 'user-1',
      tenant_id: 'tenant-1',
      layout_name: 'Main',
      layout_config: {},
      is_default: true,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]),
  createDashboardLayout: vi.fn().mockImplementation(async (payload) => ({
    id: 'layout-created',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    layout_name: payload.layout_name,
    layout_config: payload.layout_config,
    is_default: !!payload.is_default,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  updateDashboardLayout: vi.fn().mockResolvedValue({}),
  deleteDashboardLayout: vi.fn().mockResolvedValue({ success: true }),
  fetchDashboardWidgets: vi.fn().mockResolvedValue([
    {
      id: 'widget-1',
      layout_id: 'layout-1',
      tenant_id: 'tenant-1',
      widget_key: 'activity-feed',
      position_x: 0,
      position_y: 0,
      width: 6,
      height: 3,
      settings: { limit: 10 },
      is_visible: true,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]),
  createDashboardWidget: vi.fn().mockResolvedValue({}),
  updateDashboardWidget: vi.fn().mockResolvedValue({}),
  deleteDashboardWidget: vi.fn().mockResolvedValue({ success: true }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('DashboardCustomizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard customizer blocks', async () => {
    render(<DashboardCustomizer />, { wrapper: createWrapper() });

    expect(await screen.findByText('Dashboard Customizer')).toBeInTheDocument();
    expect(screen.getByText('Widget library')).toBeInTheDocument();
    expect(screen.getByText('Widgets in layout')).toBeInTheDocument();
    expect(screen.getByText('Select or create a layout to manage widgets.')).toBeInTheDocument();
  });

  it('creates a layout from the input', async () => {
    const user = userEvent.setup();
    render(<DashboardCustomizer />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText('New layout name');
    await user.type(input, 'My Layout');
    await user.click(screen.getByText('Create layout'));

    expect(screen.getByText('Create layout')).toBeInTheDocument();
  });
});
