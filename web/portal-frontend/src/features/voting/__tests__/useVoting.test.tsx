/**
 * Voting Hooks Unit Tests
 * 
 * Tests for TanStack Query hooks in the voting feature.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    createVote,
    createVotesList,
    createVoteCastPayload,
    createPoll,
} from './fixtures';

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

// Create wrapper with QueryClient
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
        },
    });

    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

describe('Voting Hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('votingKeys', () => {
        it('generates correct query keys', () => {
            expect(votingKeys.all).toEqual(['voting']);
            expect(votingKeys.polls()).toEqual(['voting', 'polls']);
            expect(votingKeys.pollDetail('123')).toEqual(['voting', 'polls', 'detail', '123']);
            expect(votingKeys.pollInfo('123')).toEqual(['voting', 'polls', 'info', '123']);
        });
    });

    describe('usePolls', () => {
        it('fetches polls with default parameters', async () => {
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
            // Called with undefined params when no arguments passed
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

            const queryClient = new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: false,
                        gcTime: 0,
                    },
                },
            });

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            );

            const { result } = renderHook(
                () => usePolls(undefined, { retry: false }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            }, { timeout: 2000 });

            expect(result.current.error).toBe(error);
        });

        it('handles rate limit error', async () => {
            const rateLimitError = new RateLimitError('Too many requests', {
                retryAfter: 30,
                limit: 10,
                window: 60,
            });
            vi.mocked(votingApi.fetchPolls).mockRejectedValueOnce(rateLimitError);

            const queryClient = new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: false,
                        gcTime: 0,
                    },
                },
            });

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            );

            const { result } = renderHook(
                () => usePolls(),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(isRateLimitError(result.current.error)).toBe(true);
            expect((result.current.error as RateLimitError).retryAfter).toBe(30);
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
        it('casts a vote successfully', async () => {
            const mockVote = createVoteCastPayload();
            vi.mocked(votingApi.castVote).mockResolvedValueOnce(mockVote);

            const queryClient = new QueryClient({
                defaultOptions: {
                    queries: { retry: false, gcTime: 0 },
                },
            });

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            );

            const { result } = renderHook(
                () => useCastVote(),
                { wrapper }
            );

            await act(async () => {
                result.current.mutate({
                    poll_id: 'poll-1',
                    nomination_id: 'nom-1',
                    option_id: 'opt-1',
                });
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Check first argument only (payload)
            expect(votingApi.castVote).toHaveBeenCalled();
            const callArgs = vi.mocked(votingApi.castVote).mock.calls[0][0];
            expect(callArgs).toEqual({
                poll_id: 'poll-1',
                nomination_id: 'nom-1',
                option_id: 'opt-1',
            });
        });

        it('handles cast vote error', async () => {
            const error = new Error('Already voted');
            vi.mocked(votingApi.castVote).mockRejectedValueOnce(error);

            const queryClient = new QueryClient({
                defaultOptions: {
                    queries: { retry: false, gcTime: 0 },
                },
            });

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            );

            const { result } = renderHook(
                () => useCastVote(),
                { wrapper }
            );

            await act(async () => {
                result.current.mutate({
                    poll_id: 'poll-1',
                    nomination_id: 'nom-1',
                    option_id: 'opt-1',
                });
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

            const queryClient = new QueryClient({
                defaultOptions: {
                    queries: { retry: false, gcTime: 0 },
                },
            });

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            );

            const { result } = renderHook(
                () => useCastVote({ onSuccess }),
                { wrapper }
            );

            await act(async () => {
                result.current.mutate({
                    poll_id: 'poll-1',
                    nomination_id: 'nom-1',
                    option_id: 'opt-1',
                });
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
                    pollId: 'poll-1',
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
    it('creates error with retry info', () => {
        const error = new RateLimitError('Rate limit exceeded', {
            retryAfter: 45,
            limit: 10,
            window: 60,
        });
        
        expect(error.message).toBe('Rate limit exceeded');
        expect(error.retryAfter).toBe(45);
        expect(error.name).toBe('RateLimitError');
    });

    it('isRateLimitError correctly identifies error type', () => {
        const rateLimitError = new RateLimitError('Too many requests', {
            retryAfter: 30,
            limit: 10,
            window: 60,
        });
        const regularError = new Error('Some error');
        
        expect(isRateLimitError(rateLimitError)).toBe(true);
        expect(isRateLimitError(regularError)).toBe(false);
        expect(isRateLimitError(null)).toBe(false);
        expect(isRateLimitError(undefined)).toBe(false);
    });
});
