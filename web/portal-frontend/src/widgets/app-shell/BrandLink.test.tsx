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

describe('BrandLink', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useAuthMock.mockReset();
  });

  test('renders tenant label and no switcher for single-tenant user', () => {
    useAuthMock.mockReturnValue({
      user: {
        tenant: { id: 'tenant-1', slug: 'aef' },
        availableTenants: [{ id: 'tenant-1', slug: 'aef' }],
      },
    });
    render(<BrandLink />);

    expect(screen.getByRole('button', { name: 'AEF · aef' })).toBeTruthy();
    expect(screen.queryByTestId('brand-tenant-switch')).toBeNull();
  });

  test('renders tenant switcher for multi-tenant user', () => {
    useAuthMock.mockReturnValue({
      user: {
        tenant: { id: 'tenant-1', slug: 'aef' },
        availableTenants: [
          { id: 'tenant-1', slug: 'aef' },
          { id: 'tenant-2', slug: 'wolves' },
        ],
      },
    });
    render(<BrandLink />);

    expect(screen.getByTestId('brand-tenant-switch')).toBeTruthy();
  });
});
