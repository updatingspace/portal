import React from 'react';
import { vi } from 'vitest';

import { ApiError } from '../api/client';
import { HomePage } from './HomePage';
import { votingsApiMock } from '../test/mocks/api';
import { renderWithProviders, screen, userEvent } from '../test/test-utils';

const fixedNow = new Date('2025-01-02T12:00:00Z').getTime();
const mockNow = () => vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

describe('HomePage integration', () => {
  test('shows loader and renders active + archived votings', async () => {
    const nowSpy = mockNow();
    try {
      renderWithProviders(<HomePage />);

      expect(screen.getByText('Подтягиваем голосования...')).toBeInTheDocument();

      expect(await screen.findByText('Актуальные голосования')).toBeInTheDocument();
      expect(screen.getAllByText('AEF Game Jam · основной поток').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Экспресс-опрос').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Архив 2024').length).toBeGreaterThan(0);
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('renders error state and retries loading', async () => {
    const nowSpy = mockNow();
    votingsApiMock.fetchVotingCatalog.mockRejectedValueOnce(
      new ApiError('fail', { kind: 'server', status: 500 }),
    );

    try {
      renderWithProviders(<HomePage />);

      const errorTitles = await screen.findAllByText(/Сервис недоступен|Не удалось загрузить голосования/);
      expect(errorTitles.length).toBeGreaterThan(0);
      const retry = screen.getByRole('button', { name: 'Попробовать еще раз' });
      await userEvent.click(retry);

      const mainVotingInstances = await screen.findAllByText('AEF Game Jam · основной поток');
      expect(mainVotingInstances.length).toBeGreaterThan(0);
      expect(votingsApiMock.fetchVotingCatalog).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('manual refresh re-requests catalog', async () => {
    const nowSpy = mockNow();
    try {
      renderWithProviders(<HomePage />);

      const mainVoting = await screen.findAllByText('AEF Game Jam · основной поток');
      expect(mainVoting.length).toBeGreaterThan(0);

      const refreshBtn = screen.getByRole('button', { name: 'Обновить список' });
      await userEvent.click(refreshBtn);

      expect(votingsApiMock.fetchVotingCatalog).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
