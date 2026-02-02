import React from 'react';
import { describe, test } from 'vitest';

import { renderWithProviders, screen } from '../test/test-utils';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage integration', () => {
  test('shows path and navigation links', async () => {
    renderWithProviders(<NotFoundPage />, { route: '/missing/page' });

    expect(await screen.findByText(/Страница не найдена/)).toBeInTheDocument();
    expect(screen.getByText('/missing/page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'На главную' })).toBeInTheDocument();
    expect(screen.getByText(/Перейти в профиль/)).toBeInTheDocument();
  });
});
