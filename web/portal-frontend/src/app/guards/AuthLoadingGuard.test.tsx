import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AuthLoadingGuard } from './AuthLoadingGuard';

const useAuthMock = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../shared/ui/AppLoader', () => ({
  AppLoader: () => <div data-testid="app-loader">Loading...</div>,
}));

describe('AuthLoadingGuard', () => {
  it('renders loader before auth bootstrap is initialized', () => {
    useAuthMock.mockReturnValue({ isInitialized: false, isLoading: true });

    render(
      <AuthLoadingGuard>
        <div>app content</div>
      </AuthLoadingGuard>,
    );

    expect(screen.getByTestId('app-loader')).toBeInTheDocument();
  });

  it('keeps children mounted during background refresh after init', () => {
    useAuthMock.mockReturnValue({ isInitialized: true, isLoading: true });

    render(
      <AuthLoadingGuard>
        <div>app content</div>
      </AuthLoadingGuard>,
    );

    expect(screen.getByText('app content')).toBeInTheDocument();
  });
});
