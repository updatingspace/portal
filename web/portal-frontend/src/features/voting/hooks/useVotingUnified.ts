/**
 * Unified Voting Hooks
 * 
 * TanStack Query hooks that work with both Legacy (Nominations) and Modern (Polls) APIs.
 * These hooks provide a unified interface for components that need to support both systems
 * during migration.
 * 
 * Usage:
 * ```typescript
 * // Auto-detect API based on ID format
 * const { data, isLoading } = useVotingSession(id);
 * 
 * // Explicitly use legacy API
 * const { data } = useVotingSessions({ useLegacy: true });
 * 
 * // Cast vote with auto-detection
 * const castVote = useCastVoteUnified();
 * await castVote.mutateAsync({ pollId, nominationId, optionId });
 * ```
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { ApiError } from '../../../api/client';

import {
  fetchVotingSessions,
  fetchVotingSessionDetail,
  fetchNomination,
  submitVote,
  revokeVote,
  fetchMyVotes,
  fetchVotingResults,
  detectApi,
  isRateLimitError,
} from '../api/unifiedApi';

import type {
  VotingSession,
  VotingListResponse,
  VotingDetailResponse,
  LegacyVotingQuestion,
  ApiConfig,
  VotingQueryParams,
  Poll,
  Vote,
  PollResults,
} from '../types/unified';

// ============================================================================
// Query Keys Factory (Unified)
// ============================================================================

export const votingKeysUnified = {
  all: ['voting-unified'] as const,
  
  // Sessions (Polls/Votings)
  sessions: () => [...votingKeysUnified.all, 'sessions'] as const,
  sessionsList: (params?: VotingQueryParams, config?: ApiConfig) =>
    [...votingKeysUnified.sessions(), 'list', { params, config }] as const,
  sessionDetail: (id: string, config?: ApiConfig) =>
    [...votingKeysUnified.sessions(), 'detail', id, { config }] as const,
  
  // Nominations (Legacy)
  nominations: () => [...votingKeysUnified.all, 'nominations'] as const,
  nomination: (id: string) =>
    [...votingKeysUnified.nominations(), 'detail', id] as const,
  
  // Votes
  myVotes: (pollId: string, config?: ApiConfig) =>
    [...votingKeysUnified.all, 'my-votes', pollId, { config }] as const,
  
  // Results
  results: (pollId: string, config?: ApiConfig) =>
    [...votingKeysUnified.all, 'results', pollId, { config }] as const,
};

// ============================================================================
// Voting Sessions List
// ============================================================================

/**
 * Fetch voting sessions (unified hook)
 * @param params Query parameters
 * @param config API configuration (useLegacy flag)
 * @param options TanStack Query options
 */
export function useVotingSessions(
  params?: VotingQueryParams,
  config?: ApiConfig,
  options?: Omit<UseQueryOptions<VotingListResponse, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<VotingListResponse, ApiError>({
    queryKey: votingKeysUnified.sessionsList(params, config),
    queryFn: () => fetchVotingSessions(params, config),
    staleTime: 30_000, // 30 seconds
    ...options,
  });
}

/**
 * Fetch voting sessions with auto-detection
 * Prefers modern API unless explicitly set to legacy
 */
export function useVotingSessionsAuto(
  params?: VotingQueryParams,
  options?: Omit<UseQueryOptions<VotingListResponse, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useVotingSessions(params, { useLegacy: false }, options);
}

/**
 * Fetch legacy votings (backward compatibility)
 */
export function useLegacyVotings(
  options?: Omit<UseQueryOptions<VotingListResponse, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useVotingSessions(undefined, { useLegacy: true }, options);
}

// ============================================================================
// Voting Session Detail
// ============================================================================

/**
 * Fetch single voting session detail (unified hook)
 * @param id Voting/Poll ID
 * @param config API configuration (useLegacy flag)
 * @param options TanStack Query options
 */
export function useVotingSession(
  id: string,
  config?: ApiConfig,
  options?: Omit<UseQueryOptions<VotingDetailResponse, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<VotingDetailResponse, ApiError>({
    queryKey: votingKeysUnified.sessionDetail(id, config),
    queryFn: () => fetchVotingSessionDetail(id, config),
    enabled: Boolean(id),
    staleTime: 30_000,
    ...options,
  });
}

/**
 * Fetch voting session with auto-detection based on ID format
 * UUID format → modern API
 * Other format → legacy API
 */
export function useVotingSessionAuto(
  id: string,
  options?: Omit<UseQueryOptions<VotingDetailResponse, ApiError>, 'queryKey' | 'queryFn'>
) {
  const config = detectApi(id);
  return useVotingSession(id, config, options);
}

// ============================================================================
// Nomination Detail (Legacy)
// ============================================================================

/**
 * Fetch single nomination (legacy API only)
 * @param nominationId Nomination ID
 * @param options TanStack Query options
 */
export function useNomination(
  nominationId: string,
  options?: Omit<UseQueryOptions<LegacyVotingQuestion, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<LegacyVotingQuestion, ApiError>({
    queryKey: votingKeysUnified.nomination(nominationId),
    queryFn: () => fetchNomination(nominationId),
    enabled: Boolean(nominationId),
    staleTime: 30_000,
    ...options,
  });
}

// ============================================================================
// My Votes
// ============================================================================

/**
 * Fetch current user's votes (unified hook)
 * @param pollId Poll ID
 * @param config API configuration (useLegacy flag)
 * @param options TanStack Query options
 */
export function useMyVotesUnified(
  pollId: string,
  config?: ApiConfig,
  options?: Omit<UseQueryOptions<Vote[], ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Vote[], ApiError>({
    queryKey: votingKeysUnified.myVotes(pollId, config),
    queryFn: () => fetchMyVotes(pollId, config),
    enabled: Boolean(pollId) && !config?.useLegacy, // Legacy doesn't have my votes endpoint
    staleTime: 10_000,
    ...options,
  });
}

// ============================================================================
// Results
// ============================================================================

/**
 * Fetch voting results (unified hook)
 * @param pollId Poll ID
 * @param config API configuration (useLegacy flag)
 * @param options TanStack Query options
 */
export function useVotingResults(
  pollId: string,
  config?: ApiConfig,
  options?: Omit<UseQueryOptions<PollResults, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<PollResults, ApiError>({
    queryKey: votingKeysUnified.results(pollId, config),
    queryFn: () => fetchVotingResults(pollId, config),
    enabled: Boolean(pollId) && !config?.useLegacy, // Legacy doesn't have results endpoint
    staleTime: 10_000,
    ...options,
  });
}

// ============================================================================
// Vote Mutations
// ============================================================================

/**
 * Cast vote mutation (unified)
 * Supports both legacy and modern APIs with optimistic updates
 */
export function useCastVoteUnified(config?: ApiConfig) {
  const queryClient = useQueryClient();
  
  return useMutation<
    Vote,
    ApiError,
    { pollId?: string; nominationId: string; optionId: string }
  >({
    mutationFn: (payload) => submitVote(payload, config),
    
    // Optimistic update
    onMutate: async (payload) => {
      const { pollId, nominationId, optionId } = payload;
      
      if (!pollId || config?.useLegacy) {
        // Legacy API doesn't support optimistic updates cleanly
        // because we don't have my votes endpoint
        return {};
      }
      
      // Cancel outgoing queries for this poll
      await queryClient.cancelQueries({
        queryKey: votingKeysUnified.myVotes(pollId, config),
      });
      
      // Snapshot previous value
      const previousVotes = queryClient.getQueryData<Vote[]>(
        votingKeysUnified.myVotes(pollId, config)
      );
      
      // Optimistically add new vote
      const optimisticVote: Vote = {
        id: `temp-${Date.now()}`,
        poll_id: pollId,
        nomination_id: nominationId,
        option_id: optionId,
        user_id: '', // Will be filled by server
        created_at: new Date().toISOString(),
      };
      
      queryClient.setQueryData<Vote[]>(
        votingKeysUnified.myVotes(pollId, config),
        (old) => [...(old ?? []), optimisticVote]
      );
      
      return { previousVotes };
    },
    
    // Rollback on error
    onError: (error, payload, context: any) => {
      if (payload.pollId && !config?.useLegacy && context?.previousVotes) {
        queryClient.setQueryData(
          votingKeysUnified.myVotes(payload.pollId, config),
          context.previousVotes
        );
      }
    },
    
    // Refresh on success
    onSuccess: (vote, payload) => {
      if (payload.pollId) {
        // Invalidate my votes
        queryClient.invalidateQueries({
          queryKey: votingKeysUnified.myVotes(payload.pollId, config),
        });
        
        // Invalidate results
        queryClient.invalidateQueries({
          queryKey: votingKeysUnified.results(payload.pollId, config),
        });
        
        // Invalidate session detail (to update meta.has_voted)
        queryClient.invalidateQueries({
          queryKey: votingKeysUnified.sessionDetail(payload.pollId, config),
        });
      }
      
      // Legacy: Invalidate nomination detail
      if (config?.useLegacy) {
        queryClient.invalidateQueries({
          queryKey: votingKeysUnified.nomination(payload.nominationId),
        });
      }
    },
  });
}

/**
 * Revoke vote mutation (modern API only)
 */
export function useRevokeVoteUnified(config?: ApiConfig) {
  const queryClient = useQueryClient();
  
  return useMutation<
    { ok: boolean },
    ApiError,
    { voteId: string; pollId: string }
  >({
    mutationFn: ({ voteId }) => revokeVote(voteId, config),
    
    // Optimistic update
    onMutate: async ({ voteId, pollId }) => {
      if (config?.useLegacy) {
        throw new Error('Legacy API does not support vote revocation');
      }
      
      await queryClient.cancelQueries({
        queryKey: votingKeysUnified.myVotes(pollId, config),
      });
      
      const previousVotes = queryClient.getQueryData<Vote[]>(
        votingKeysUnified.myVotes(pollId, config)
      );
      
      // Optimistically remove vote
      queryClient.setQueryData<Vote[]>(
        votingKeysUnified.myVotes(pollId, config),
        (old) => (old ?? []).filter((v) => v.id !== voteId)
      );
      
      return { previousVotes };
    },
    
    onError: (error, { pollId }, context: any) => {
      if (context?.previousVotes) {
        queryClient.setQueryData(
          votingKeysUnified.myVotes(pollId, config),
          context.previousVotes
        );
      }
    },
    
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({
        queryKey: votingKeysUnified.myVotes(pollId, config),
      });
      queryClient.invalidateQueries({
        queryKey: votingKeysUnified.results(pollId, config),
      });
      queryClient.invalidateQueries({
        queryKey: votingKeysUnified.sessionDetail(pollId, config),
      });
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Check if error is rate limit error
 */
export { isRateLimitError } from '../api/unifiedApi';

/**
 * Extract voting config from ID (auto-detect legacy vs modern)
 */
export function useVotingConfig(id: string): ApiConfig {
  return detectApi(id);
}

// ============================================================================
// Export Everything
// ============================================================================

export type {
  VotingSession,
  VotingListResponse,
  VotingDetailResponse,
  LegacyVotingQuestion,
  ApiConfig,
  VotingQueryParams,
} from '../types/unified';
