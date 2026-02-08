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
import type { Poll, PollDetailedInfo } from '../../../features/voting/types';
import { renderWithProviders, screen, userEvent } from '../../../test/test-utils';
import { PollPage } from './PollPage';
import { VotingRateLimitState } from '../ui';

const TEST_TIMEOUT_MS = 15000;

const poll: Poll = {
  id: 'poll-1',
  tenant_id: 'tenant-1',
  title: 'A11Y Poll',
  description: null,
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
      title: 'Вопрос',
      description: null,
      kind: 'custom',
      sort_order: 0,
      max_votes: 1,
      is_required: false,
      config: {},
      options: [
        {
          id: 'opt-1',
          nomination_id: 'nom-1',
          title: 'Вариант 1',
          description: null,
          media_url: null,
          game_id: null,
          sort_order: 0,
        },
      ],
    },
  ],
  meta: {
    has_voted: false,
    can_vote: true,
  },
};

describe('Voting A11Y integration', () => {
  it('supports keyboard-only vote submission on ballot page', async () => {
    const castMutate = vi.fn();
    vi.mocked(votingFeature.usePollInfo).mockReturnValue({
      data: pollInfo,
      isLoading: false,
      isError: false,
      error: null,
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
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    } as ReturnType<typeof votingFeature.useRevokeVote>);

    renderWithProviders(
      <Routes>
        <Route path="/app/voting/:id" element={<PollPage />} />
      </Routes>,
      { route: '/app/voting/poll-1' },
    );

    const chooseButton = await screen.findByRole('button', { name: 'Выбрать' });
    chooseButton.focus();
    await userEvent.keyboard('{Enter}');

    expect(castMutate).toHaveBeenCalledWith({
      poll_id: poll.id,
      nomination_id: 'nom-1',
      option_id: 'opt-1',
    });
  }, TEST_TIMEOUT_MS);

  it('exposes aria-live status region for rate limit state', async () => {
    const onRetry = vi.fn();
    renderWithProviders(<VotingRateLimitState retryAfter={12} onRetry={onRetry} />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveTextContent('Слишком много запросов');
    expect(statusRegion).toHaveTextContent('Подождите 12 сек. и попробуйте снова.');

    const retryButton = screen.getByRole('button', { name: 'Повторить' });
    retryButton.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalled();
  }, TEST_TIMEOUT_MS);
});
