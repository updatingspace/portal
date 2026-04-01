/**
 * Voting Hooks Unit Tests
 * 
 * Tests for TanStack Query hooks in the voting feature.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import {
    usePolls,
    usePoll,
    usePollInfo,
    useMyVotes,
    useCastVote,
    useRevokeVote,
    votingKeys,
} from '../hooks/useVoting';
import { RateLimitError, isRateLimitError } from '../api/votingApi';
import {
    createPaginatedPolls,
    createPollInfo,
    createVotesList,
    createVoteCastPayload,
    createPoll,
} from './fixtures';
import { createQueryClientWrapper } from '../../../test/queryClient';

// Mock the voting API
vi.mock('../api/votingApi', async () => {
    const actual = await vi.importActual('../api/votingApi');
    return {
        ...actual,
        fetchPolls: vi.fn(),
        fetchPoll: vi.fn(),
        fetchPollInfo: vi.fn(),
        fetchMyVotes: vi.fn(),
        castVote: vi.fn(),
        revokeVote: vi.fn(),
    };
});

import * as votingApi from '../api/votingApi';

const DEFAULT_POLL_ID = 'poll-1';
const DEFAULT_CAST_VOTE_PAYLOAD = {
    poll_id: DEFAULT_POLL_ID,
    nomination_id: 'nom-1',
    option_id: 'opt-1',
};
const RATE_LIMIT_INFO = {
    retryAfter: 30,
    limit: 10,
    window: 60,
} as const;

function createWrapper() {
    return createQueryClientWrapper();
}

describe('Voting Hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('votingKeys', () => {
        it.each([
            ['all', () => votingKeys.all, ['voting']],
            ['poll list', () => votingKeys.polls(), ['voting', 'polls']],
            ['poll detail', () => votingKeys.pollDetail('123'), ['voting', 'polls', 'detail', '123']],
            ['poll info', () => votingKeys.pollInfo('123'), ['voting', 'polls', 'info', '123']],
        ])('returns %s key', (_name, getKey, expected) => {
            expect(getKey()).toEqual(expected);
        });
    });

    describe('usePolls', () => {
        it('returns polls data when request succeeds', async () => {
            const mockData = createPaginatedPolls(5);
            vi.mocked(votingApi.fetchPolls).mockResolvedValueOnce(mockData);

            const { result } = renderHook(
                () => usePolls(),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockData);
        });

        it('calls polls API without params when hook params are omitted', async () => {
            vi.mocked(votingApi.fetchPolls).mockResolvedValueOnce(createPaginatedPolls(2));

            const { result } = renderHook(
                () => usePolls(),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(votingApi.fetchPolls).toHaveBeenCalledWith(undefined);
        });

        it('fetches polls with custom parameters', async () => {
            const mockData = createPaginatedPolls(3, { limit: 10, offset: 5 });
            vi.mocked(votingApi.fetchPolls).mockResolvedValueOnce(mockData);

            const { result } = renderHook(
                () => usePolls({ limit: 10, offset: 5, status: 'active' }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(votingApi.fetchPolls).toHaveBeenCalledWith({ 
                limit: 10, 
                offset: 5, 
                status: 'active' 
            });
        });

        it('handles error state', async () => {
            const error = new Error('Network error');
            vi.mocked(votingApi.fetchPolls).mockRejectedValue(error);

            const { result } = renderHook(
                () => usePolls(undefined, { retry: false }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            }, { timeout: 2000 });

            expect(result.current.error).toBe(error);
        });

        it('handles rate limit error', async () => {
            const rateLimitError = new RateLimitError('Too many requests', RATE_LIMIT_INFO);
            vi.mocked(votingApi.fetchPolls).mockRejectedValueOnce(rateLimitError);

            const { result } = renderHook(
                () => usePolls(),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(isRateLimitError(result.current.error)).toBe(true);
            expect((result.current.error as RateLimitError).retryAfter).toBe(RATE_LIMIT_INFO.retryAfter);
        });
    });

    describe('usePoll', () => {
        it('fetches single poll by id', async () => {
            const mockPoll = createPoll({ id: 'poll-123' });
            vi.mocked(votingApi.fetchPoll).mockResolvedValueOnce(mockPoll);

            const { result } = renderHook(
                () => usePoll('poll-123'),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockPoll);
            expect(votingApi.fetchPoll).toHaveBeenCalledWith('poll-123');
        });

        it('does not fetch when id is empty', () => {
            const { result } = renderHook(
                () => usePoll(''),
                { wrapper: createWrapper() }
            );

            expect(result.current.isLoading).toBe(false);
            expect(result.current.fetchStatus).toBe('idle');
            expect(votingApi.fetchPoll).not.toHaveBeenCalled();
        });
    });

    describe('usePollInfo', () => {
        it('fetches poll info with nominations and voting status', async () => {
            const mockInfo = createPollInfo();
            vi.mocked(votingApi.fetchPollInfo).mockResolvedValueOnce(mockInfo);

            const { result } = renderHook(
                () => usePollInfo('poll-1'),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockInfo);
            expect(result.current.data?.meta.can_vote).toBe(true);
            expect(result.current.data?.nominations).toHaveLength(2);
        });
    });

    describe('useMyVotes', () => {
        it('fetches user votes for a poll', async () => {
            const mockVotes = createVotesList(3);
            vi.mocked(votingApi.fetchMyVotes).mockResolvedValueOnce(mockVotes);

            const { result } = renderHook(
                () => useMyVotes('poll-1'),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockVotes);
            expect(result.current.data).toHaveLength(3);
        });
    });

    describe('useCastVote', () => {
        it('calls castVote with expected payload', async () => {
            const mockVote = createVoteCastPayload();
            vi.mocked(votingApi.castVote).mockResolvedValueOnce(mockVote);

            const { result } = renderHook(
                () => useCastVote(),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                result.current.mutate(DEFAULT_CAST_VOTE_PAYLOAD);
            });

            expect(votingApi.castVote).toHaveBeenCalled();
            const callArgs = vi.mocked(votingApi.castVote).mock.calls[0][0];
            expect(callArgs).toEqual(DEFAULT_CAST_VOTE_PAYLOAD);
        });

        it('reports success state when vote cast succeeds', async () => {
            vi.mocked(votingApi.castVote).mockResolvedValueOnce(createVoteCastPayload());

            const { result } = renderHook(
                () => useCastVote(),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                result.current.mutate(DEFAULT_CAST_VOTE_PAYLOAD);
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });

        it('handles cast vote error', async () => {
            const error = new Error('Already voted');
            vi.mocked(votingApi.castVote).mockRejectedValueOnce(error);

            const { result } = renderHook(
                () => useCastVote(),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                result.current.mutate(DEFAULT_CAST_VOTE_PAYLOAD);
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe(error);
        });

        it('calls onSuccess callback', async () => {
            const mockVote = createVoteCastPayload();
            vi.mocked(votingApi.castVote).mockResolvedValueOnce(mockVote);
            const onSuccess = vi.fn();

            const { result } = renderHook(
                () => useCastVote({ onSuccess }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                result.current.mutate(DEFAULT_CAST_VOTE_PAYLOAD);
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(onSuccess).toHaveBeenCalled();
        });
    });

    describe('useRevokeVote', () => {
        it('revokes a vote successfully', async () => {
            vi.mocked(votingApi.revokeVote).mockResolvedValueOnce(undefined);

            const { result } = renderHook(
                () => useRevokeVote(),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                result.current.mutate({
                    voteId: 'vote-1',
                    pollId: DEFAULT_POLL_ID,
                });
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(votingApi.revokeVote).toHaveBeenCalledWith('vote-1');
        });
    });
});

describe('RateLimitError', () => {
    it('preserves message when RateLimitError is created', () => {
        const error = new RateLimitError('Rate limit exceeded', {
            retryAfter: 45,
            limit: 10,
            window: 60,
        });
        
        expect(error.message).toBe('Rate limit exceeded');
    });

    it('preserves retryAfter when RateLimitError is created', () => {
        const error = new RateLimitError('Rate limit exceeded', {
            retryAfter: 45,
            limit: 10,
            window: 60,
        });

        expect(error.retryAfter).toBe(45);
    });

    it('uses RateLimitError name for created errors', () => {
        const error = new RateLimitError('Rate limit exceeded', {
            retryAfter: 45,
            limit: 10,
            window: 60,
        });

        expect(error.name).toBe('RateLimitError');
    });

    it('returns true in isRateLimitError for RateLimitError instances', () => {
        const rateLimitError = new RateLimitError('Too many requests', RATE_LIMIT_INFO);

        expect(isRateLimitError(rateLimitError)).toBe(true);
    });

    it.each([new Error('Some error'), null, undefined])(
        'returns false in isRateLimitError for %p',
        (value) => {
            expect(isRateLimitError(value)).toBe(false);
        },
    );
});
