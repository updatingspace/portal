/**
 * Unified Voting Module - Index
 * 
 * Centralized exports for unified voting API (legacy + modern support)
 */

// Types
export type {
  // Core types
  VotingSession,
  VotingQuestion,
  VotingAnswer,
  UserVote,
  
  // Legacy bridge types
  LegacyVotingSession,
  LegacyVotingQuestion,
  LegacyVotingAnswer,
  
  // Response types
  VotingSessionWithQuestions,
  VotingQuestionWithAnswers,
  LegacyVotingSessionWithQuestions,
  VotingListResponse,
  VotingDetailResponse,
  PaginatedResponse,
  
  // Config & params
  ApiConfig,
  VotingQueryParams,
  
  // Re-export modern types
  Poll,
  Nomination,
  Option,
  Vote,
  PollStatus,
  PollScopeType,
} from '../types/unified';

// Adapter functions
export {
  adaptLegacyVotingToPoll,
  adaptLegacyVotingObjectToPoll,
  adaptLegacyNominationToModern,
  adaptLegacyOptionToModern,
  isLegacyPoll,
  isLegacyNomination,
  isLegacyOption,
} from '../types/unified';

// API functions
export {
  fetchVotingSessions,
  fetchVotingSessionDetail,
  fetchNomination,
  submitVote,
  revokeVote,
  fetchMyVotes,
  fetchVotingResults,
  detectApi,
  isLegacyId,
  RateLimitError,
  isRateLimitError,
} from '../api/unifiedApi';

// Hooks
export {
  votingKeysUnified,
  useVotingSessions,
  useVotingSessionsAuto,
  useLegacyVotings,
  useVotingSession,
  useVotingSessionAuto,
  useNomination,
  useMyVotesUnified,
  useVotingResults,
  useCastVoteUnified,
  useRevokeVoteUnified,
  useVotingConfig,
} from '../hooks/useVotingUnified';
