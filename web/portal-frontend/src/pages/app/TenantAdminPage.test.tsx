import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { TenantAdminPage } from './TenantAdminPage';

vi.mock('@gravity-ui/uikit', () => ({
  Avatar: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Button: (props: React.ComponentProps<'button'> & { loading?: boolean }) => <button {...props} />,
  Card: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  Icon: () => <span />,
  Label: (props: React.ComponentProps<'span'>) => <span {...props} />,
  Loader: () => <div data-testid="loader" />,
  Select: (props: React.ComponentProps<'div'> & { options?: unknown[]; onUpdate?: () => void; value?: unknown }) => (
    <div data-testid="select" {...props} />
  ),
  Switch: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Table: (props: React.ComponentProps<'div'>) => <div {...props} />,
  TextInput: ({ onUpdate, ...props }: React.ComponentProps<'input'> & { onUpdate?: (value: string) => void }) => {
    const { startContent, ...rest } = props as React.ComponentProps<'input'> & { startContent?: React.ReactNode };
    void startContent;
    return <input onChange={(event) => onUpdate?.(event.target.value)} {...rest} />;
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user',
      tenant: { id: 'tenant-123', slug: 'aef' },
      isSuperuser: false,
      capabilities: ['portal.roles.read'],
      roles: [],
      displayName: 'Test User',
    },
    isInitialized: true,
    isLoading: false,
    refreshProfile: vi.fn(),
    setUser: vi.fn(),
  }),
}));

vi.mock('../../utils/apiErrorHandling', () => ({
  notifyApiError: vi.fn(),
}));

vi.mock('../../toaster', () => ({
  toaster: { add: vi.fn() },
}));

const mockReload = vi.fn();

vi.mock('../../modules/tenantAdmin/hooks', () => ({
  useTenantRoles: () => ({
    roles: [
      {
        id: 1,
        tenant_id: 'tenant-123',
        service: 'portal',
        name: 'tenant-admin',
        permission_keys: ['portal.roles.read'],
      },
    ],
    loading: false,
    reload: mockReload,
  }),
  useRoleBindings: () => ({ bindings: [], loading: false, reload: mockReload }),
  useTenantMembers: () => ({
    members: [
      {
        tenant_id: 'tenant-123',
        user_id: 'user-1',
        first_name: 'Test',
        last_name: 'User',
        bio: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ],
    loading: false,
    reload: mockReload,
  }),
  useTenantAdminEvents: () => ({ events: [], loading: false, reload: mockReload }),
  usePermissionCatalog: () => ({
    permissions: [
      { key: 'portal.roles.read', description: 'Read tenant roles', service: 'portal' },
    ],
    loading: false,
    reload: mockReload,
  }),
}));

vi.mock('../../modules/tenantAdmin/api', () => ({
  SCOPE_TYPES: ['GLOBAL', 'TENANT', 'COMMUNITY', 'TEAM', 'SERVICE'],
  createTenantRole: vi.fn(() =>
    Promise.resolve({ id: 2, tenant_id: 'tenant-123', service: 'portal', name: 'foo', permission_keys: [] }),
  ),
  updateTenantRole: vi.fn(() =>
    Promise.resolve({ id: 1, tenant_id: 'tenant-123', service: 'portal', name: 'tenant-admin', permission_keys: [] }),
  ),
  deleteTenantRole: vi.fn(() => Promise.resolve({ ok: true })),
  createRoleBinding: vi.fn(() => Promise.resolve({})),
  deleteRoleBinding: vi.fn(() => Promise.resolve({ ok: true })),
}));

describe('TenantAdminPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders tenant admin UI', () => {
    render(<TenantAdminPage />);
    expect(screen.getByText('Tenant Admin')).toBeInTheDocument();
    expect(screen.getByText('Роли, доступы и аудит')).toBeInTheDocument();
    expect(screen.getAllByText('Роли').length).toBeGreaterThan(0);
    expect(screen.getByText('Каталог ролей')).toBeInTheDocument();
  });
});
