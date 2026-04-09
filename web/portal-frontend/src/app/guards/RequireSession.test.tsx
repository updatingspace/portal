import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { RequireSession } from './RequireSession';

const useAuthMock = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../modules/portal/components/StatusView', () => ({
  StatusView: ({ kind, title, description }: { kind: string; title?: string; description?: string }) => (
    <div data-testid="status-view">
      <span>{kind}</span>
      <span>{title ?? ''}</span>
      <span>{description ?? ''}</span>
    </div>
  ),
}));

function renderGuard(initialPath = '/app/feed') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireSession />}>
          <Route path="/app/feed" element={<div>feed page</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

type AuthState = {
  user: unknown;
  isInitialized: boolean;
  isLoading: boolean;
  sessionIssue: { code: string; message: string } | null;
};

function mockAuthState(overrides: Partial<AuthState> = {}) {
  useAuthMock.mockReturnValue({
    user: null,
    isInitialized: true,
    isLoading: false,
    sessionIssue: null,
    ...overrides,
  });
}

describe('RequireSession', () => {
  it('keeps protected content during background refresh when user exists', async () => {
    mockAuthState({
      user: { id: 'u-1' },
      isLoading: true,
    });

    renderGuard('/app/feed');

    expect(await screen.findByText('feed page')).toBeTruthy();
  });

  it('redirects guest user to login by default', async () => {
    mockAuthState();

    renderGuard('/app/feed?from=test');

    expect(await screen.findByText('login page')).toBeTruthy();
  });

  it('shows no-access status when session issue is NO_ACTIVE_MEMBERSHIP', async () => {
    mockAuthState({
      sessionIssue: {
        code: 'NO_ACTIVE_MEMBERSHIP',
        message: 'No active membership for tenant',
      },
    });

    renderGuard();

    const status = await screen.findByTestId('status-view');
    expect(status.textContent).toContain('no-access');
    expect(status.textContent).toContain('Нет активного доступа к tenant');
    expect(status.textContent).toContain('No active membership for tenant');
  });
});
