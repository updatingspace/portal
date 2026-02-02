/**
 * Voting Feature - TanStack Query Hooks
 * 
 * React Query hooks for voting operations with:
 * - Optimistic updates
 * - Cache invalidation
 * - Rate limit handling with automatic retry
 * - Error handling
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {
  fetchPolls,
  fetchPoll,
  fetchPollInfo,
  createPoll,
  updatePoll,
  deletePoll,
  fetchPollTemplates,
  createNomination,
  updateNomination,
  deleteNomination,
  createOption,
  updateOption,
  deleteOption,
  castVote,
  revokeVote,
  fetchMyVotes,
  fetchPollResults,
  fetchParticipants,
  addParticipant,
  removeParticipant,
  isRateLimitError,
} from '../api/votingApi';
import type {
  Poll,
  PollCreatePayload,
  PollUpdatePayload,
  PollResults,
  PaginatedResponse,
  PollsQueryParams,
  Nomination,
  NominationCreatePayload,
  NominationUpdatePayload,
  Option,
  OptionCreatePayload,
  OptionUpdatePayload,
  Vote,
  VoteCastPayload,
  PollParticipant,
  ParticipantAddPayload,
  PollTemplate,
  PollDetailedInfo,
} from '../types';

// ============================================================================
// Query Keys
// ============================================================================

export const votingKeys = {
  all: ['voting'] as const,
  polls: () => [...votingKeys.all, 'polls'] as const,
  pollsList: (params?: PollsQueryParams) => [...votingKeys.polls(), 'list', params] as const,
  pollDetail: (id: string) => [...votingKeys.polls(), 'detail', id] as const,
  pollInfo: (id: string) => [...votingKeys.polls(), 'info', id] as const,
  pollResults: (id: string) => [...votingKeys.polls(), 'results', id] as const,
  pollVotes: (id: string) => [...votingKeys.polls(), 'votes', id] as const,
  pollParticipants: (id: string) => [...votingKeys.polls(), 'participants', id] as const,
  templates: () => [...votingKeys.all, 'templates'] as const,
};

// ============================================================================
// Rate Limit Retry Configuration
// ============================================================================

const RATE_LIMIT_RETRY_CONFIG = {
  retry: (failureCount: number, error: unknown) => {
    // Don't retry rate limit errors - let the UI handle it
    if (isRateLimitError(error)) {
      return false;
    }
    // Retry other errors up to 3 times
    return failureCount < 3;
  },
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

// ============================================================================
// Polls Queries
// ============================================================================

/**
 * Fetch paginated list of polls
 */
export function usePolls(
  params?: PollsQueryParams,
  options?: Omit<UseQueryOptions<PaginatedResponse<Poll>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: votingKeys.pollsList(params),
    queryFn: () => fetchPolls(params),
    staleTime: 30_000, // 30 seconds
    ...RATE_LIMIT_RETRY_CONFIG,
    ...options,
  });
}

/**
 * Fetch single poll by ID
 */
export function usePoll(
  pollId: string,
  options?: Omit<UseQueryOptions<Poll>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: votingKeys.pollDetail(pollId),
    queryFn: () => fetchPoll(pollId),
    enabled: !!pollId,
    staleTime: 30_000,
    ...RATE_LIMIT_RETRY_CONFIG,
    ...options,
  });
}

/**
 * Fetch poll with detailed info (nominations, options, user votes)
 */
export function usePollInfo(
  pollId: string,
  options?: Omit<UseQueryOptions<PollDetailedInfo>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: votingKeys.pollInfo(pollId),
    queryFn: () => fetchPollInfo(pollId),
    enabled: !!pollId,
    staleTime: 10_000, // More frequently updated
    ...RATE_LIMIT_RETRY_CONFIG,
    ...options,
  });
}

/**
 * Fetch poll results
 */
export function usePollResults(
  pollId: string,
  options?: Omit<UseQueryOptions<PollResults>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: votingKeys.pollResults(pollId),
    queryFn: () => fetchPollResults(pollId),
    enabled: !!pollId,
    staleTime: 10_000,
    ...RATE_LIMIT_RETRY_CONFIG,
    ...options,
  });
}

/**
 * Fetch current user's votes for a poll
 */
export function useMyVotes(
  pollId: string,
  options?: Omit<UseQueryOptions<Vote[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: votingKeys.pollVotes(pollId),
    queryFn: () => fetchMyVotes(pollId),
    enabled: !!pollId,
    staleTime: 5_000,
    ...RATE_LIMIT_RETRY_CONFIG,
    ...options,
  });
}

/**
 * Fetch poll templates
 */
export function usePollTemplates(
  options?: Omit<UseQueryOptions<PollTemplate[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: votingKeys.templates(),
    queryFn: fetchPollTemplates,
    staleTime: 5 * 60_000, // 5 minutes - templates rarely change
    ...RATE_LIMIT_RETRY_CONFIG,
    ...options,
  });
}

/**
 * Fetch poll participants
 */
export function usePollParticipants(
  pollId: string,
  options?: Omit<UseQueryOptions<PollParticipant[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: votingKeys.pollParticipants(pollId),
    queryFn: () => fetchParticipants(pollId),
    enabled: !!pollId,
    staleTime: 30_000,
    ...RATE_LIMIT_RETRY_CONFIG,
    ...options,
  });
}

// ============================================================================
// Poll Mutations
// ============================================================================

/**
 * Create a new poll
 */
export function useCreatePoll(
  options?: UseMutationOptions<Poll, unknown, PollCreatePayload>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPoll,
    onSuccess: () => {
      // Invalidate polls list to refetch
      queryClient.invalidateQueries({ queryKey: votingKeys.polls() });
    },
    ...options,
  });
}

/**
 * Update an existing poll
 */
export function useUpdatePoll(
  options?: UseMutationOptions<Poll, unknown, { pollId: string; payload: PollUpdatePayload }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pollId, payload }) => updatePoll(pollId, payload),
    onSuccess: (data) => {
      // Update cache with new data
      queryClient.setQueryData(votingKeys.pollDetail(data.id), data);
      queryClient.invalidateQueries({ queryKey: votingKeys.pollInfo(data.id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: votingKeys.polls() });
    },
    ...options,
  });
}

/**
 * Delete a poll
 */
export function useDeletePoll(
  options?: UseMutationOptions<void, unknown, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deletePoll,
    onSuccess: (_, pollId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: votingKeys.pollDetail(pollId) });
      queryClient.removeQueries({ queryKey: votingKeys.pollInfo(pollId) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: votingKeys.polls() });
    },
    ...options,
  });
}

// ============================================================================
// Nomination Mutations
// ============================================================================

/**
 * Create a new nomination
 */
export function useCreateNomination(
  options?: UseMutationOptions<Nomination, unknown, { pollId: string; payload: NominationCreatePayload }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pollId, payload }) => createNomination(pollId, payload),
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.pollInfo(pollId) });
    },
    ...options,
  });
}

/**
 * Update a nomination
 */
export function useUpdateNomination(
  options?: UseMutationOptions<Nomination, unknown, { pollId: string; nominationId: string; payload: NominationUpdatePayload }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pollId, nominationId, payload }) => updateNomination(pollId, nominationId, payload),
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.pollInfo(pollId) });
    },
    ...options,
  });
}

/**
 * Delete a nomination
 */
export function useDeleteNomination(
  options?: UseMutationOptions<void, unknown, { pollId: string; nominationId: string }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pollId, nominationId }) => deleteNomination(pollId, nominationId),
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.pollInfo(pollId) });
    },
    ...options,
  });
}

// ============================================================================
// Option Mutations
// ============================================================================

/**
 * Create a new option
 */
export function useCreateOption(
  options?: UseMutationOptions<Option, unknown, { pollId: string; nominationId: string; payload: OptionCreatePayload }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pollId, nominationId, payload }) => createOption(pollId, nominationId, payload),
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.pollInfo(pollId) });
    },
    ...options,
  });
}

/**
 * Update an option
 */
export function useUpdateOption(
  options?: UseMutationOptions<Option, unknown, { pollId: string; optionId: string; payload: OptionUpdatePayload }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pollId, optionId, payload }) => updateOption(pollId, optionId, payload),
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.pollInfo(pollId) });
    },
    ...options,
  });
}

/**
 * Delete an option
 */
export function useDeleteOption(
  options?: UseMutationOptions<void, unknown, { pollId: string; optionId: string }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pollId, optionId }) => deleteOption(pollId, optionId),
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.pollInfo(pollId) });
    },
    ...options,
  });
}

// ============================================================================
// Vote Mutations
// ============================================================================

/**
 * Cast a vote with optimistic update
 */
export function useCastVote(
  options?: Omit<
    UseMutationOptions<VoteCastPayload, unknown, VoteCastPayload, { previousVotes: Vote[] | undefined }>,
    'mutationFn' | 'onMutate'
  >
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, ...restOptions } = options ?? {};
  
  return useMutation<VoteCastPayload, unknown, VoteCastPayload, { previousVotes: Vote[] | undefined }>({
    ...restOptions,
    mutationFn: castVote,
    onMutate: async (payload) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: votingKeys.pollVotes(payload.poll_id) });
      await queryClient.cancelQueries({ queryKey: votingKeys.pollResults(payload.poll_id) });
      
      // Snapshot previous value
      const previousVotes = queryClient.getQueryData<Vote[]>(votingKeys.pollVotes(payload.poll_id));
      
      // Optimistically add the vote (temporary ID)
      if (previousVotes) {
        const optimisticVote: Vote = {
          id: `temp-${Date.now()}`,
          poll_id: payload.poll_id,
          nomination_id: payload.nomination_id,
          option_id: payload.option_id,
          user_id: 'current-user', // Will be replaced on success
          created_at: new Date().toISOString(),
        };
        queryClient.setQueryData(
          votingKeys.pollVotes(payload.poll_id),
          [...previousVotes, optimisticVote]
        );
      }
      
      return { previousVotes };
    },
    onError: (error, payload, context, mutationContext) => {
      // Rollback on error
      if (context?.previousVotes) {
        queryClient.setQueryData(votingKeys.pollVotes(payload.poll_id), context.previousVotes);
      }
      onError?.(error, payload, context, mutationContext);
    },
    onSuccess: (vote, variables, context, mutationContext) => {
      // Replace optimistic vote with real data
      queryClient.invalidateQueries({ queryKey: votingKeys.pollVotes(vote.poll_id) });
      queryClient.invalidateQueries({ queryKey: votingKeys.pollResults(vote.poll_id) });
      queryClient.invalidateQueries({ queryKey: votingKeys.pollInfo(vote.poll_id) });
      onSuccess?.(vote, variables, context, mutationContext);
    },
    onSettled: (data, error, variables, context, mutationContext) => {
      onSettled?.(data, error, variables, context, mutationContext);
    },
  });
}

/**
 * Revoke a vote
 */
export function useRevokeVote(
  options?: Omit<
    UseMutationOptions<void, unknown, { voteId: string; pollId: string }, { previousVotes: Vote[] | undefined; pollId: string }>,
    'mutationFn' | 'onMutate'
  >
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, ...restOptions } = options ?? {};
  
  return useMutation<void, unknown, { voteId: string; pollId: string }, { previousVotes: Vote[] | undefined; pollId: string }>({
    ...restOptions,
    mutationFn: ({ voteId }) => revokeVote(voteId),
    onMutate: async ({ voteId, pollId }) => {
      await queryClient.cancelQueries({ queryKey: votingKeys.pollVotes(pollId) });
      
      const previousVotes = queryClient.getQueryData<Vote[]>(votingKeys.pollVotes(pollId));
      
      // Optimistically remove the vote
      if (previousVotes) {
        queryClient.setQueryData(
          votingKeys.pollVotes(pollId),
          previousVotes.filter(v => v.id !== voteId)
        );
      }
      
      return { previousVotes, pollId };
    },
    onError: (error, variables, context, mutationContext) => {
      const { pollId } = variables;
      if (context?.previousVotes) {
        queryClient.setQueryData(votingKeys.pollVotes(pollId), context.previousVotes);
      }
      onError?.(error, variables, context, mutationContext);
    },
    onSuccess: (_, variables, context, mutationContext) => {
      const { pollId } = variables;
      queryClient.invalidateQueries({ queryKey: votingKeys.pollVotes(pollId) });
      queryClient.invalidateQueries({ queryKey: votingKeys.pollResults(pollId) });
      queryClient.invalidateQueries({ queryKey: votingKeys.pollInfo(pollId) });
      onSuccess?.(_, variables, context, mutationContext);
    },
    onSettled: (data, error, variables, context, mutationContext) => {
      onSettled?.(data, error, variables, context, mutationContext);
    },
  });
}

// ============================================================================
// Participant Mutations
// ============================================================================

/**
 * Add a participant to a poll
 */
export function useAddParticipant(
  options?: UseMutationOptions<PollParticipant, unknown, { pollId: string; payload: ParticipantAddPayload }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pollId, payload }) => addParticipant(pollId, payload),
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.pollParticipants(pollId) });
    },
    ...options,
  });
}

/**
 * Remove a participant from a poll
 */
export function useRemoveParticipant(
  options?: UseMutationOptions<void, unknown, { pollId: string; userId: string }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pollId, userId }) => removeParticipant(pollId, userId),
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.pollParticipants(pollId) });
    },
    ...options,
  });
}
