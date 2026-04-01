import React from 'react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BrandLink } from './BrandLink';

const navigateMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

type Tenant = { id: string; slug: string };

const BASE_TENANT: Tenant = { id: 'tenant-1', slug: 'aef' };

function mockAuthUser(availableTenants: Tenant[]) {
  useAuthMock.mockReturnValue({
    user: {
      tenant: BASE_TENANT,
      availableTenants,
    },
  });
}

describe('BrandLink', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useAuthMock.mockReset();
  });

  test('renders tenant label and no switcher for single-tenant user', () => {
    mockAuthUser([BASE_TENANT]);
    render(<BrandLink />);

    expect(screen.getByRole('button', { name: 'AEF · aef' })).toBeTruthy();
    expect(screen.queryByTestId('brand-tenant-switch')).toBeNull();
  });

  test('renders tenant switcher for multi-tenant user', () => {
    mockAuthUser([
      BASE_TENANT,
      { id: 'tenant-2', slug: 'wolves' },
    ]);
    render(<BrandLink />);

    expect(screen.getByTestId('brand-tenant-switch')).toBeTruthy();
  });
});
