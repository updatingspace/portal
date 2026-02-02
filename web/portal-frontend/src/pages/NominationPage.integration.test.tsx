import React from 'react';
import { vi } from 'vitest';

import { ApiError } from '../api/client';
import { Routes, Route } from 'react-router-dom';

import { nominationsApiMock } from '../test/mocks/api';
import { createNominationDetail } from '../test/fixtures';
import { renderWithProviders, screen, userEvent, within, waitFor } from '../test/test-utils';
import { NominationPage } from './NominationPage';

const fixedNow = new Date('2025-01-02T12:00:00Z').getTime();
const mockNow = () => vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

describe('NominationPage integration', () => {
  test('shows error stub and retries loading', async () => {
    const nowSpy = mockNow();
    nominationsApiMock.fetchNomination.mockRejectedValueOnce(
      new ApiError('not_found', { kind: 'not_found', status: 404 }),
    );

    try {
      renderWithProviders(
        <Routes>
          <Route path="/nominations/:id" element={<NominationPage />} />
        </Routes>,
        { route: '/nominations/missing' },
      );

      const notFoundMessages = await screen.findAllByText('Не найдено');
      expect(notFoundMessages.length).toBeGreaterThan(0);
      const retry = screen.getByRole('button', { name: 'Попробовать еще раз' });
      await userEvent.click(retry);

      expect(nominationsApiMock.fetchNomination).toHaveBeenCalledTimes(2);
      expect(await screen.findByText('Выбор редакции')).toBeInTheDocument();
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('paginates options and toggles vote counters', async () => {
    const nowSpy = mockNow();
    try {
      renderWithProviders(
        <Routes>
          <Route path="/nominations/:id" element={<NominationPage />} />
        </Routes>,
        { route: '/nominations/nom-detail?limit=3' },
      );

      expect(await screen.findByText('Выбор редакции')).toBeInTheDocument();
      expect(screen.getByText('Страница 1 из 3')).toBeInTheDocument();
      expect(screen.getByText('Игра 1')).toBeInTheDocument();
      expect(screen.getByText('Игра 3')).toBeInTheDocument();
      expect(screen.queryByText('Игра 4')).not.toBeInTheDocument();

      const nextBtn = screen.getByRole('button', { name: '>' });
      await userEvent.click(nextBtn);
      expect(screen.getByText('Страница 2 из 3')).toBeInTheDocument();
      expect(screen.getByText('Игра 4')).toBeInTheDocument();
      expect(screen.queryByText('Игра 1')).not.toBeInTheDocument();

      const toggle = screen.getByLabelText('Посмотреть количество голосов');
      await userEvent.click(toggle);
      expect(screen.getByText('Голосов: 3')).toBeInTheDocument();
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('submits a vote and updates counters', async () => {
    const nowSpy = mockNow();
    try {
      renderWithProviders(
        <Routes>
          <Route path="/nominations/:id" element={<NominationPage />} />
        </Routes>,
        { route: '/nominations/nom-detail' },
      );

      expect(await screen.findByText('Выбор редакции')).toBeInTheDocument();

      const optionCard = screen.getByText('Игра 3').closest('.option-card');
      expect(optionCard).toBeTruthy();
      const voteBtn = within(optionCard as HTMLElement).getByRole('button');
      await userEvent.click(voteBtn);

      await waitFor(() => {
        expect(nominationsApiMock.voteForOption).toHaveBeenCalledWith({
          nominationId: 'nom-detail',
          optionId: 'opt-3',
        });
      });
      const updatedCard = screen.getByText('Игра 3').closest('.option-card');
      expect(within(updatedCard as HTMLElement).getByRole('button', { name: 'Обновить голос' })).toBeInTheDocument();
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('disables voting when nomination is closed', async () => {
    const nowSpy = mockNow();
    const closedNomination = {
      ...createNominationDetail(),
      title: 'Закрытая номинация',
      isVotingOpen: false,
      canVote: false,
    };
    nominationsApiMock.fetchNomination.mockResolvedValueOnce(closedNomination);

    try {
      renderWithProviders(
        <Routes>
          <Route path="/nominations/:id" element={<NominationPage />} />
        </Routes>,
        { route: '/nominations/nom-detail' },
      );

      expect(await screen.findByText('Закрытая номинация')).toBeInTheDocument();

      const closedNotices = screen.getAllByText('Голосование завершено');
      expect(closedNotices.length).toBeGreaterThan(0);

      const lockedBtns = screen.getAllByRole('button', { name: 'Голосование завершено' });
      expect(lockedBtns.length).toBeGreaterThan(0);
      lockedBtns.forEach((btn) => expect(btn).toBeDisabled());
    } finally {
      nowSpy.mockRestore();
    }
  });
});
