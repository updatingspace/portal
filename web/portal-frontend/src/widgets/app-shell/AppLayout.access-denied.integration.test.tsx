import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AccessDeniedError, emitAccessDenied } from '../../api/accessDenied';
import { I18nProvider } from '../../app/providers/I18nProvider';
import { AuthProvider } from '../../contexts/AuthContext';
import { TenantProvider } from '../../contexts/TenantContext';
import { AppLayout } from './AppLayout';
import { AuthInitializer } from '../../test/test-utils';

vi.mock('@gravity-ui/navigation', () => ({
  AsideHeader: ({ renderContent }: { renderContent: () => React.ReactNode }) => (
    <div data-testid="aside-layout">{renderContent()}</div>
  ),
}));

vi.mock('./AppHeader', () => ({
  AppHeader: () => <div data-testid="app-header" />,
}));

vi.mock('../../app/providers/RouteDocumentTitle', () => ({
  RouteDocumentTitle: () => null,
}));

vi.mock('../../features/personalization/runtime/PersonalizationRuntime', () => ({
  PersonalizationRuntime: () => null,
}));

const BASE_USER = {
  id: 'u-1',
  username: 'u-1',
  email: 'u-1@example.com',
  isSuperuser: false,
  isStaff: false,
  displayName: 'User 1',
  tenant: { id: 'tenant-1', slug: 'aef' },
  capabilities: ['activity.feed.read'],
};

function renderAppLayout(userOverrides: Partial<typeof BASE_USER> = {}) {
  return render(
    <MemoryRouter initialEntries={['/app/feed']}>
      <I18nProvider>
        <AuthProvider bootstrap={false}>
          <TenantProvider>
            <AuthInitializer user={{ ...BASE_USER, ...userOverrides }} />
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/app/feed" element={<div>Feed Content</div>} />
              </Route>
            </Routes>
          </TenantProvider>
        </AuthProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('AppLayout Access Denied integration', () => {
  it('shows AccessDeniedScreen when api 403 error event is emitted', async () => {
    renderAppLayout();

    expect(await screen.findByText('Feed Content')).toBeInTheDocument();

    await act(async () => {
      emitAccessDenied(
        new AccessDeniedError({
          source: 'api',
          reason: 'Forbidden by API',
          tenant: { id: 'tenant-1', slug: 'aef' },
          requestId: 'req-api-403',
          path: '/app/feed',
        }),
      );
    });

    expect(await screen.findByRole('heading', { name: 'Доступ ограничен' })).toBeInTheDocument();
    expect(screen.getAllByText(/request id: req-api-403/i).length).toBeGreaterThan(0);
  });

  it('ignores access denied events for another route path', async () => {
    renderAppLayout({
      id: 'u-2',
      username: 'u-2',
      email: 'u-2@example.com',
      displayName: 'User 2',
    });

    expect(await screen.findByText('Feed Content')).toBeInTheDocument();

    await act(async () => {
      emitAccessDenied(
        new AccessDeniedError({
          source: 'api',
          reason: 'Forbidden by API',
          requestId: 'req-other-path',
          path: '/app/events',
        }),
      );
    });

    expect(screen.getByText('Feed Content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Доступ ограничен' })).not.toBeInTheDocument();
  });
});
