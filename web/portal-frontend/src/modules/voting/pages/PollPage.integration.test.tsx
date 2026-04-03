import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../features/voting', async () => {
  const actual = await vi.importActual<typeof import('../../../features/voting')>('../../../features/voting');

  return {
    ...actual,
    usePollInfo: vi.fn(),
    useMyVotes: vi.fn(),
    useCastVote: vi.fn(),
    useRevokeVote: vi.fn(),
    isRateLimitError: vi.fn(),
  };
});

import * as votingFeature from '../../../features/voting';
import type { Poll, PollDetailedInfo, Vote } from '../../../features/voting/types';
import { renderWithProviders, screen, userEvent } from '../../../test/test-utils';
import { PollPage } from './PollPage';

const TEST_TIMEOUT_MS = 15000;

const poll: Poll = {
  id: 'poll-1',
  tenant_id: 'tenant-1',
  title: 'Активный опрос',
  description: 'Выберите лучшие проекты',
  status: 'active',
  scope_type: 'TENANT',
  scope_id: 'tenant-1',
  visibility: 'public',
  template: null,
  allow_revoting: true,
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
  nominations: [
    {
      id: 'nom-1',
      poll_id: poll.id,
      title: 'Лучшая команда',
      description: 'Можно выбрать одного победителя',
      kind: 'custom',
      sort_order: 0,
      max_votes: 1,
      is_required: true,
      config: {},
      options: [
        {
          id: 'opt-1',
          nomination_id: 'nom-1',
          title: 'Team Alpha',
          description: null,
          media_url: null,
          game_id: null,
          sort_order: 0,
        },
        {
          id: 'opt-2',
          nomination_id: 'nom-1',
          title: 'Team Beta',
          description: null,
          media_url: null,
          game_id: null,
          sort_order: 1,
        },
      ],
    },
  ],
  meta: {
    has_voted: false,
    can_vote: true,
  },
};

const selectedVote: Vote = {
  id: 'vote-1',
  poll_id: poll.id,
  nomination_id: 'nom-1',
  option_id: 'opt-1',
  user_id: 'user-1',
  created_at: '2026-01-10T10:05:00Z',
};

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/app/voting/:id" element={<PollPage />} />
    </Routes>,
    { route: '/app/voting/poll-1' },
  );

const castMutate = vi.fn();
const revokeMutate = vi.fn();

const setupBaseMocks = () => {
  vi.mocked(votingFeature.usePollInfo).mockReturnValue({
    data: pollInfo,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as ReturnType<typeof votingFeature.usePollInfo>);

  vi.mocked(votingFeature.useCastVote).mockReturnValue({
    mutate: castMutate,
    isPending: false,
    variables: undefined,
  } as ReturnType<typeof votingFeature.useCastVote>);

  vi.mocked(votingFeature.useRevokeVote).mockReturnValue({
    mutate: revokeMutate,
    isPending: false,
    variables: undefined,
  } as ReturnType<typeof votingFeature.useRevokeVote>);
};

describe('PollPage integration', () => {
  it('submits vote on option selection', async () => {
    setupBaseMocks();
    vi.mocked(votingFeature.useMyVotes).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.useMyVotes>);

    renderPage();

    expect(await screen.findByText('Активный опрос')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Выбрать' })[0]);

    expect(castMutate).toHaveBeenCalledWith({
      poll_id: poll.id,
      nomination_id: 'nom-1',
      option_id: 'opt-1',
    });
  }, TEST_TIMEOUT_MS);

  it('revokes selected vote when revote is enabled', async () => {
    setupBaseMocks();
    vi.mocked(votingFeature.useMyVotes).mockReturnValue({
      data: [selectedVote],
      isLoading: false,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.useMyVotes>);

    renderPage();

    expect(await screen.findByText('Team Alpha')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Снять выбор' }));

    expect(revokeMutate).toHaveBeenCalledWith({
      voteId: 'vote-1',
      pollId: poll.id,
    });
  }, TEST_TIMEOUT_MS);

  it('enforces max vote limit in UI', async () => {
    setupBaseMocks();
    vi.mocked(votingFeature.useMyVotes).mockReturnValue({
      data: [selectedVote],
      isLoading: false,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.useMyVotes>);

    renderPage();

    expect(await screen.findByText('Team Beta')).toBeInTheDocument();
    const chooseButtons = screen.getAllByRole('button', { name: 'Выбрать' });
    expect(chooseButtons[0]).toBeDisabled();
  }, TEST_TIMEOUT_MS);

  it('shows rate limit state on poll loading', async () => {
    vi.mocked(votingFeature.isRateLimitError).mockReturnValue(true);
    vi.mocked(votingFeature.usePollInfo).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { retryAfter: 25 },
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.usePollInfo>);
    vi.mocked(votingFeature.useMyVotes).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.useMyVotes>);
    vi.mocked(votingFeature.useCastVote).mockReturnValue({
      mutate: castMutate,
      isPending: false,
      variables: undefined,
    } as ReturnType<typeof votingFeature.useCastVote>);
    vi.mocked(votingFeature.useRevokeVote).mockReturnValue({
      mutate: revokeMutate,
      isPending: false,
      variables: undefined,
    } as ReturnType<typeof votingFeature.useRevokeVote>);

    renderPage();

    expect(await screen.findByText('Слишком много запросов')).toBeInTheDocument();
    expect(screen.getByText('Подождите 25 сек. и попробуйте снова.')).toBeInTheDocument();
  }, TEST_TIMEOUT_MS);
});
