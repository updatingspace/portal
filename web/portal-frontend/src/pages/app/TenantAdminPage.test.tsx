import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { TenantAdminPage } from './TenantAdminPage';

const TEST_USER_ID = 'test-user';
const TEST_USER_DISPLAY_NAME = 'Test User';
const TEST_TENANT_ID = 'tenant-123';
const TEST_TENANT_SLUG = 'aef';
const TEST_TENANT_ADMIN_ROLE = 'tenant-admin';
const TEST_PERMISSION_KEY = 'portal.roles.read';
const TEST_ROLE_SERVICE = 'portal';
const TEST_MEMBER_USER_ID = 'user-1';
const TEST_MEMBER_FIRST_NAME = 'Test';
const TEST_MEMBER_LAST_NAME = 'User';
const TEST_ISO_DATE = '2025-01-01T00:00:00Z';

vi.mock('@gravity-ui/uikit', () => ({
  Avatar: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Button: ({ ...props }: React.ComponentProps<'button'> & { loading?: boolean }) => (
    <button {...props} />
  ),
  Card: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  Icon: () => <span />,
  Label: (props: React.ComponentProps<'span'>) => <span {...props} />,
  Loader: () => <div data-testid="loader" />,
  Select: ({ ...props }: React.ComponentProps<'div'> & { options?: unknown[]; onUpdate?: () => void; value?: unknown }) => (
    <div data-testid="select" {...props} />
  ),
  Switch: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Table: (props: React.ComponentProps<'div'>) => <div {...props} />,
  TextInput: ({ onUpdate, ...props }: React.ComponentProps<'input'> & { onUpdate?: (value: string) => void }) => {
    const { ...rest } = props as React.ComponentProps<'input'> & { startContent?: React.ReactNode };
    return <input onChange={(event) => onUpdate?.(event.target.value)} {...rest} />;
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: TEST_USER_ID,
      tenant: { id: TEST_TENANT_ID, slug: TEST_TENANT_SLUG },
      isSuperuser: false,
      capabilities: [TEST_PERMISSION_KEY],
      roles: [],
      displayName: TEST_USER_DISPLAY_NAME,
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
        tenant_id: TEST_TENANT_ID,
        service: TEST_ROLE_SERVICE,
        name: TEST_TENANT_ADMIN_ROLE,
        permission_keys: [TEST_PERMISSION_KEY],
      },
    ],
    loading: false,
    reload: mockReload,
  }),
  useRoleBindings: () => ({ bindings: [], loading: false, reload: mockReload }),
  useTenantMembers: () => ({
    members: [
      {
        tenant_id: TEST_TENANT_ID,
        user_id: TEST_MEMBER_USER_ID,
        first_name: TEST_MEMBER_FIRST_NAME,
        last_name: TEST_MEMBER_LAST_NAME,
        bio: null,
        created_at: TEST_ISO_DATE,
        updated_at: TEST_ISO_DATE,
      },
    ],
    loading: false,
    reload: mockReload,
  }),
  useTenantAdminEvents: () => ({ events: [], loading: false, reload: mockReload }),
  usePermissionCatalog: () => ({
    permissions: [
      { key: TEST_PERMISSION_KEY, description: 'Read tenant roles', service: TEST_ROLE_SERVICE },
    ],
    loading: false,
    reload: mockReload,
  }),
}));

vi.mock('../../modules/tenantAdmin/api', () => ({
  SCOPE_TYPES: ['GLOBAL', 'TENANT', 'COMMUNITY', 'TEAM', 'SERVICE'],
  createTenantRole: vi.fn(() =>
    Promise.resolve({ id: 2, tenant_id: TEST_TENANT_ID, service: TEST_ROLE_SERVICE, name: 'foo', permission_keys: [] }),
  ),
  updateTenantRole: vi.fn(() =>
    Promise.resolve({ id: 1, tenant_id: TEST_TENANT_ID, service: TEST_ROLE_SERVICE, name: TEST_TENANT_ADMIN_ROLE, permission_keys: [] }),
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
