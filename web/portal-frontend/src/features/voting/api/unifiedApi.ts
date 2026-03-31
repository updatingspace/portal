/**
 * Unified Voting API
 * 
 * This module provides a unified API that bridges Legacy (Nominations) and Modern (Polls)
 * voting systems. It automatically routes requests to the appropriate backend endpoint
 * and transforms responses to a consistent format.
 * 
 * Usage:
 * ```typescript
 * // Fetch votings (auto-detects which API to use)
 * const votings = await fetchVotingSessions({ useLegacy: true });
 * 
 * // Cast vote (works with both legacy and modern)
 * await submitVote({ pollId, nominationId, optionId }, { useLegacy: true });
 * ```
 */

import { request } from '../../../api/client';
import {
  fetchPolls as fetchPollsModern,
  fetchPoll as fetchPollModern,
  fetchPollInfo as fetchPollInfoModern,
  castVote as castVoteModern,
  revokeVote as revokeVoteModern,
  fetchMyVotes as fetchMyVotesModern,
  fetchPollResults as fetchPollResultsModern,
} from './votingApi';

import type {
  Poll,
  Vote,
  PaginatedResponse,
  PollDetailedInfo,
  PollResults,
  VoteCastPayload,
} from '../types';

import type {
  VotingSession,
  LegacyVotingSession,
  VotingSessionWithQuestions,
  LegacyVotingQuestion,
  ApiConfig,
  VotingQueryParams,
  VotingListResponse,
  VotingDetailResponse,
  adaptLegacyVotingToPoll,
  adaptLegacyNominationToModern,
  isLegacyPoll,
} from '../types/unified';

// Import legacy API functions
import { fetchVotingCatalog } from '../../../api/votings';
import { 
  fetchNomination as fetchNominationLegacy,
  voteForOption as voteForOptionLegacy,
} from '../../../api/nominations';

import type {
  VotingCatalogItem,
} from '../../../api/votings';

import type {
  Nomination as LegacyNomination,
} from '../../../data/nominations';

// ============================================================================
// API Endpoints Constants
// ============================================================================

const API_ENDPOINTS = {
  LEGACY: {
    VOTING_CATALOG: '/voting/votings/feed',
    NOMINATIONS: '/voting/nominations',
    VOTE: (nominationId: string) => `/voting/nominations/${nominationId}/vote`,
  },
  MODERN: {
    POLLS: '/voting/polls',
    POLL_INFO: (pollId: string) => `/voting/polls/${pollId}/info`,
    VOTES: '/voting/votes',
    MY_VOTES: (pollId: string) => `/voting/polls/${pollId}/votes/me`,
    RESULTS: (pollId: string) => `/voting/polls/${pollId}/results`,
  },
} as const;

// ============================================================================
// Voting Sessions (Polls/Votings List)
// ============================================================================

/**
 * Fetch voting sessions (unified for legacy and modern)
 * @param params Query parameters
 * @param config API configuration (useLegacy flag)
 * @returns Array of voting sessions (legacy or modern format)
 */
export async function fetchVotingSessions(
  params?: VotingQueryParams,
  config?: ApiConfig
): Promise<VotingListResponse> {
  if (config?.useLegacy) {
    return fetchVotingSessionsLegacy();
  }
  
  return fetchVotingSessionsModern(params);
}

/**
 * Fetch voting sessions from legacy API
 * @returns Array of LegacyVotingSession (adapted to Poll structure)
 */
async function fetchVotingSessionsLegacy(): Promise<LegacyVotingSession[]> {
  const catalog = await fetchVotingCatalog();
  
  // Import adapter function (circular dependency fix)
  const { adaptLegacyVotingToPoll } = await import('../types/unified');
  
  return catalog.map(adaptLegacyVotingToPoll);
}

/**
 * Fetch voting sessions from modern API
 * @param params Query parameters
 * @returns Paginated response with Poll items
 */
async function fetchVotingSessionsModern(
  params?: VotingQueryParams
): Promise<PaginatedResponse<Poll>> {
  return fetchPollsModern(params);
}

// ============================================================================
// Voting Session Detail (Single Poll/Voting)
// ============================================================================

/**
 * Fetch single voting session detail
 * @param id Voting/Poll ID
 * @param config API configuration (useLegacy flag)
 * @returns VotingSessionWithQuestions or LegacyVotingSessionWithQuestions
 */
export async function fetchVotingSessionDetail(
  id: string,
  config?: ApiConfig
): Promise<VotingDetailResponse> {
  if (config?.useLegacy) {
    return fetchVotingSessionDetailLegacy(id);
  }
  
  return fetchVotingSessionDetailModern(id);
}

/**
 * Fetch voting session detail from legacy API
 * 
 * NOTE: Legacy API doesn't have a /votings/{id} endpoint that returns full data
 * with nominations. We need to fetch nominations separately.
 * For now, return minimal data. Component should use fetchNominationLegacy directly.
 */
async function fetchVotingSessionDetailLegacy(
  votingId: string
): Promise<LegacyVotingSessionWithQuestions> {
  // Legacy API doesn't have voting detail endpoint
  // This is a limitation - components using legacy should fetch nominations directly
  throw new Error(
    'Legacy API does not support voting detail. Use fetchNomination for individual nominations.'
  );
}

/**
 * Fetch voting session detail from modern API
 * @param pollId Poll ID
 * @returns VotingSessionWithQuestions
 */
async function fetchVotingSessionDetailModern(
  pollId: string
): Promise<VotingSessionWithQuestions> {
  const info = await fetchPollInfoModern(pollId);
  
  return {
    ...info.poll,
    questions: info.nominations,
    meta: info.meta,
  };
}

// ============================================================================
// Nomination/Question Detail (Legacy Support)
// ============================================================================

/**
 * Fetch single nomination (legacy API only)
 * @param nominationId Nomination ID
 * @returns LegacyVotingQuestion (adapted nomination)
 */
export async function fetchNomination(nominationId: string): Promise<LegacyVotingQuestion> {
  const nomination = await fetchNominationLegacy(nominationId);
  
  const { adaptLegacyNominationToModern } = await import('../types/unified');
  return adaptLegacyNominationToModern(nomination);
}

// ============================================================================
// Voting Actions (Cast/Revoke Vote)
// ============================================================================

/**
 * Submit a vote (unified for legacy and modern)
 * @param payload Vote payload
 * @param config API configuration (useLegacy flag)
 * @returns Vote record
 */
export async function submitVote(
  payload: {
    pollId?: string;
    nominationId: string;
    optionId: string;
  },
  config?: ApiConfig
): Promise<Vote> {
  if (config?.useLegacy) {
    return submitVoteLegacy(payload.nominationId, payload.optionId);
  }
  
  if (!payload.pollId) {
    throw new Error('pollId is required for modern API');
  }
  
  return submitVoteModern({
    poll_id: payload.pollId,
    nomination_id: payload.nominationId,
    option_id: payload.optionId,
  });
}

/**
 * Submit vote via legacy API
 * @param nominationId Nomination ID
 * @param optionId Option ID
 * @returns Vote record (adapted from legacy response)
 */
async function submitVoteLegacy(nominationId: string, optionId: string): Promise<Vote> {
  const response = await voteForOptionLegacy({ nominationId, optionId });
  
  // Legacy API returns VoteResult { nominationId, optionId, message }
  // We need to adapt it to Vote interface
  return {
    id: `legacy-${nominationId}-${optionId}`,
    poll_id: '', // Not available in legacy
    nomination_id: nominationId,
    option_id: optionId,
    user_id: '', // Not available in legacy
    created_at: new Date().toISOString(),
  };
}

/**
 * Submit vote via modern API
 * @param payload Vote payload
 * @returns Vote record
 */
async function submitVoteModern(payload: VoteCastPayload): Promise<Vote> {
  return castVoteModern(payload);
}

/**
 * Revoke a vote (modern API only - legacy doesn't support revocation)
 * @param voteId Vote ID
 * @param config API configuration
 * @returns Success response
 */
export async function revokeVote(
  voteId: string,
  config?: ApiConfig
): Promise<{ ok: boolean }> {
  if (config?.useLegacy) {
    throw new Error('Legacy API does not support vote revocation');
  }
  
  return revokeVoteModern(voteId);
}

// ============================================================================
// User Votes (My Votes)
// ============================================================================

/**
 * Fetch current user's votes for a voting session
 * @param pollId Poll ID
 * @param config API configuration (useLegacy flag)
 * @returns Array of user votes
 */
export async function fetchMyVotes(
  pollId: string,
  config?: ApiConfig
): Promise<Vote[]> {
  if (config?.useLegacy) {
    // Legacy API doesn't have my votes endpoint
    // User votes are included in nomination detail (userVote field)
    // Component should extract from fetchNomination response
    return [];
  }
  
  return fetchMyVotesModern(pollId);
}

// ============================================================================
// Results
// ============================================================================

/**
 * Fetch voting results
 * @param pollId Poll ID
 * @param config API configuration (useLegacy flag)
 * @returns Poll results
 */
export async function fetchVotingResults(
  pollId: string,
  config?: ApiConfig
): Promise<PollResults> {
  if (config?.useLegacy) {
    // Legacy API doesn't have dedicated results endpoint
    // Results are included in nomination detail (counts field)
    throw new Error(
      'Legacy API does not have results endpoint. Results included in nomination detail.'
    );
  }
  
  return fetchPollResultsModern(pollId);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect if ID is legacy format
 * Legacy IDs are typically strings without UUID format
 * Modern IDs are UUIDs
 */
export function isLegacyId(id: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return !uuidPattern.test(id);
}

/**
 * Auto-detect which API to use based on ID format
 * @param id Voting/Poll ID
 * @returns ApiConfig with useLegacy flag
 */
export function detectApi(id: string): ApiConfig {
  return {
    useLegacy: isLegacyId(id),
  };
}

// ============================================================================
// Export Everything
// ============================================================================

export {
  // Re-export rate limit handling from votingApi
  RateLimitError,
  isRateLimitError,
} from './votingApi';

export type {
  // Unified types
  VotingSession,
  VotingSessionWithQuestions,
  LegacyVotingSession,
  LegacyVotingQuestion,
  VotingListResponse,
  VotingDetailResponse,
  ApiConfig,
  VotingQueryParams,
} from '../types/unified';
