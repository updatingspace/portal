import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '../../test/test-utils';
import { AppHeader, DEVELOPER_HEADER_THEME_FLAG } from './AppHeader';

vi.mock('./BrandLink', () => ({
  BrandLink: () => <div data-testid="brand-link" />,
}));

vi.mock('./AuthActions', () => ({
  AuthActions: () => <div data-testid="auth-actions" />,
}));

const baseUser = {
  id: 'user-1',
  username: 'member',
  email: 'member@example.com',
  displayName: 'Portal Member',
  isSuperuser: false,
  isStaff: false,
  featureFlags: {},
};

describe('AppHeader', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hides the header theme switcher from regular members even when the flag is enabled', () => {
    renderWithProviders(<AppHeader />, {
      authUser: {
        ...baseUser,
        featureFlags: {
          [DEVELOPER_HEADER_THEME_FLAG]: true,
        },
      },
    });

    expect(screen.queryByTestId('app-theme-select')).not.toBeInTheDocument();
  });

  it('shows the header theme switcher only for a flagged platform developer', () => {
    renderWithProviders(<AppHeader />, {
      authUser: {
        ...baseUser,
        isSuperuser: true,
        featureFlags: {
          [DEVELOPER_HEADER_THEME_FLAG]: true,
        },
      },
    });

    expect(screen.getByTestId('app-theme-select')).toBeInTheDocument();
  });
});
