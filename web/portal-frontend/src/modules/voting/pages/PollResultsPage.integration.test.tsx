import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../features/voting', async () => {
  const actual = await vi.importActual<typeof import('../../../features/voting')>('../../../features/voting');

  return {
    ...actual,
    usePollInfo: vi.fn(),
    usePollResults: vi.fn(),
  };
});

import { ApiError } from '../../../api/client';
import * as votingFeature from '../../../features/voting';
import type { Poll, PollDetailedInfo, PollResults } from '../../../features/voting/types';
import { renderWithProviders, screen, userEvent } from '../../../test/test-utils';
import { PollResultsPage } from './PollResultsPage';

const TEST_TIMEOUT_MS = 15000;

const poll: Poll = {
  id: 'poll-1',
  tenant_id: 'tenant-1',
  title: 'Итоговый опрос',
  description: 'Описание итогового опроса',
  status: 'closed',
  scope_type: 'TENANT',
  scope_id: 'tenant-1',
  visibility: 'public',
  template: null,
  allow_revoting: false,
  anonymous: false,
  results_visibility: 'always',
  settings: {},
  created_by: 'user-1',
  starts_at: null,
  ends_at: null,
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-01-10T10:00:00Z',
};

const pollInfo: PollDetailedInfo = {
  poll,
  nominations: [],
  meta: {
    has_voted: true,
    can_vote: false,
  },
};

const pollResults: PollResults = {
  poll_id: poll.id,
  nominations: [
    {
      nomination_id: 'nom-1',
      title: 'Лучшая команда',
      options: [
        { option_id: 'opt-1', text: 'Team Alpha', votes: 42 },
        { option_id: 'opt-2', text: 'Team Beta', votes: 18 },
      ],
    },
  ],
};

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/app/voting/:id/results" element={<PollResultsPage />} />
    </Routes>,
    { route: '/app/voting/poll-1/results' },
  );

describe('PollResultsPage integration', () => {
  it('shows hidden results state', async () => {
    vi.mocked(votingFeature.usePollInfo).mockReturnValue({
      data: pollInfo,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.usePollInfo>);

    vi.mocked(votingFeature.usePollResults).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiError('hidden', { kind: 'forbidden', status: 403, code: 'RESULTS_HIDDEN' }),
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.usePollResults>);

    renderPage();

    expect(await screen.findByText('Результаты пока скрыты')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вернуться к опросу' })).toBeInTheDocument();
  }, TEST_TIMEOUT_MS);

  it('renders available results', async () => {
    vi.mocked(votingFeature.usePollInfo).mockReturnValue({
      data: pollInfo,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.usePollInfo>);

    vi.mocked(votingFeature.usePollResults).mockReturnValue({
      data: pollResults,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.usePollResults>);

    renderPage();

    expect(await screen.findByText('Результаты опроса')).toBeInTheDocument();
    expect(screen.getAllByText('Лучшая команда').length).toBeGreaterThan(0);
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Всего голосов: 60')).toBeInTheDocument();
  }, TEST_TIMEOUT_MS);

  it('uses retry action when results query fails', async () => {
    const refetchResults = vi.fn();
    const refetchPoll = vi.fn();

    vi.mocked(votingFeature.usePollInfo).mockReturnValue({
      data: pollInfo,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchPoll,
    } as ReturnType<typeof votingFeature.usePollInfo>);

    vi.mocked(votingFeature.usePollResults).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('temporary'),
      refetch: refetchResults,
    } as ReturnType<typeof votingFeature.usePollResults>);

    renderPage();

    expect(await screen.findByText('Не удалось загрузить результаты')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetchPoll).toHaveBeenCalledTimes(1);
    expect(refetchResults).toHaveBeenCalledTimes(1);
  }, TEST_TIMEOUT_MS);
});
