import React from 'react';
import { vi } from 'vitest';

import { ApiError } from '../api/client';
import { nominationsApiMock } from '../test/mocks/api';
import { Routes, Route } from 'react-router-dom';

import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { VotingPage } from './VotingPage';

const fixedNow = new Date('2025-01-02T12:00:00Z').getTime();
const mockNow = () => vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

describe('VotingPage integration', () => {
  test('loads and renders nominations list', async () => {
    const nowSpy = mockNow();
    try {
      renderWithProviders(
        <Routes>
          <Route path="/votings/:votingId" element={<VotingPage />} />
        </Routes>,
        { route: '/votings/vote-active' },
      );

      expect(screen.getByText('Загружаем номинации...')).toBeInTheDocument();

      expect(await screen.findByText('Лучшая графика')).toBeInTheDocument();
      expect(screen.getByText('Лучший геймплей')).toBeInTheDocument();
      expect(screen.getByText('Активно')).toBeInTheDocument();

      const firstLink = screen.getByRole('link', { name: 'Лучшая графика' });
      expect(firstLink).toHaveAttribute('href', '/nominations/nom-1');
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('shows error state and retries fetch', async () => {
    const nowSpy = mockNow();
    nominationsApiMock.fetchNominations.mockRejectedValueOnce(
      new ApiError('fail', { kind: 'server', status: 500 }),
    );

    try {
      renderWithProviders(
        <Routes>
          <Route path="/votings/:votingId" element={<VotingPage />} />
        </Routes>,
        { route: '/votings/vote-active' },
      );

      const retryButton = await screen.findByRole('button', { name: 'Попробовать еще раз' });
      await userEvent.click(retryButton);

      expect(nominationsApiMock.fetchNominations).toHaveBeenCalledTimes(2);
      expect(await screen.findByText('Лучшая графика')).toBeInTheDocument();
    } finally {
      nowSpy.mockRestore();
    }
  });
});
