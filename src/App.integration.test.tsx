import React from 'react';

import App from './App';
import { ApiError } from './api/client';
import { serviceApiMock } from './test/mocks/api';
import { renderWithProviders, screen } from './test/test-utils';

describe('App integration', () => {
  test('opens auth modal when guest visits a protected route', async () => {
    serviceApiMock.me.mockRejectedValueOnce(
      new ApiError('unauthorized', { kind: 'unauthorized', status: 401 }),
    );

    renderWithProviders(<App />, { route: '/profile' });

    expect(await screen.findByText('Вход')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  test('renders admin page for superuser', async () => {
    renderWithProviders(<App />, { route: '/admin' });

    expect(await screen.findByText('Панель модерации')).toBeInTheDocument();
    const votings = await screen.findAllByText('AEF Game Jam · основной поток');
    expect(votings[0]).toBeInTheDocument();
  });

  test('shows footer on homepage but not on admin page', async () => {
    // Check footer is visible on homepage
    const { unmount } = renderWithProviders(<App />, { route: '/' });
    await screen.findByText('Сервис честных голосований');
    expect(screen.getByText('AEF Vote © 2025')).toBeInTheDocument();

    // Unmount and check footer is not visible on admin page
    unmount();
    renderWithProviders(<App />, { route: '/admin' });
    await screen.findByText('Панель модерации');
    expect(screen.queryByText('AEF Vote © 2025')).not.toBeInTheDocument();
  });
});
