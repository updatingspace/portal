/**
 * Unified Voting Types
 * 
 * This file provides a unified type system that bridges Legacy (Nominations) 
 * and Modern (Polls) voting systems. It allows gradual migration while maintaining
 * backward compatibility.
 * 
 * Architecture:
 * - Core types: Modern Poll/Nomination/Option/Vote types (from index.ts)
 * - Legacy adapters: Types that adapt legacy API responses to modern structure
 * - Converters: Functions to transform between legacy and modern representations
 */

import type {
  Poll,
  Nomination as ModernNomination,
  Option,
  Vote,
  PollStatus,
  PollScopeType,
  NominationKind,
} from './index';

import type {
  Nomination as LegacyNomination,
  NominationOption as LegacyOption,
  Voting as LegacyVoting,
} from '../../../data/nominations';

import type {
  VotingCatalogItem,
} from '../../../api/votings';

// ============================================================================
// Unified Naming (Semantic Aliases)
// ============================================================================

/**
 * VotingSession = A voting container (Poll in modern API, Voting in legacy)
 * Represents the top-level voting event that contains questions/nominations
 */
export type VotingSession = Poll;

/**
 * VotingQuestion = A single question within a voting session
 * (Nomination in both APIs, but with different shapes)
 */
export type VotingQuestion = ModernNomination;

/**
 * VotingAnswer = An option/choice for a question
 * (Option in modern API, NominationOption in legacy)
 */
export type VotingAnswer = Option;

/**
 * UserVote = A user's vote record
 */
export type UserVote = Vote;

// ============================================================================
// Legacy Bridge Types
// ============================================================================

/**
 * LegacyVotingSession extends Poll with legacy-specific fields
 * Allows legacy Voting data to be used in modern Poll components
 */
export interface LegacyVotingSession extends Omit<Poll, 'scope_type' | 'scope_id' | 'tenant_id'> {
  // Legacy marker
  __legacy: true;
  
  // Legacy-specific fields
  isActive: boolean;
  isOpen: boolean;
  isPublic?: boolean;
  deadlineAt?: string | null;
  showVoteCounts?: boolean;
  nominationCount: number;
  imageUrl?: string | null;
  rules?: Record<string, unknown>;
  
  // Modern required fields (populated by adapter)
  scope_type: 'TENANT';
  scope_id: string;
  tenant_id: string;
}

/**
 * LegacyVotingQuestion extends ModernNomination with legacy-specific fields
 */
export interface LegacyVotingQuestion extends Omit<ModernNomination, 'poll_id' | 'max_votes' | 'is_required'> {
  __legacy: true;
  
  // Legacy-specific fields
  options: LegacyVotingAnswer[];
  counts?: Record<string, number>;
  userVote?: string | null;
  isVotingOpen?: boolean;
  canVote?: boolean;
  requiresTelegramLink?: boolean;
  votingDeadline?: string | null;
  voting?: LegacyVoting | null;
  status?: 'draft' | 'active' | 'archived';
  
  // Modern required fields (populated by adapter)
  poll_id: string;
  max_votes: number;
  is_required: boolean;
}

/**
 * LegacyVotingAnswer extends Option with legacy-specific fields
 */
export interface LegacyVotingAnswer extends Omit<Option, 'nomination_id'> {
  __legacy: true;
  
  // Legacy-specific fields
  imageUrl?: string;
  game?: {
    id: string;
    title: string;
    genre?: string;
    studio?: string;
    releaseYear?: number;
    imageUrl?: string;
  } | null;
  payload?: Record<string, unknown>;
  counts?: Record<string, number>;
  
  // Modern required field (populated by adapter)
  nomination_id: string;
}

// ============================================================================
// Adapter Functions (Legacy → Modern)
// ============================================================================

/**
 * Convert legacy VotingCatalogItem to modern Poll
 */
export function adaptLegacyVotingToPoll(item: VotingCatalogItem): LegacyVotingSession {
  // Derive status from legacy fields
  let status: PollStatus = 'draft';
  if (item.isActive) {
    status = item.isOpen ? 'active' : 'closed';
  }
  
  return {
    __legacy: true,
    
    // Modern Poll fields
    id: item.id,
    tenant_id: 'default', // Legacy has no tenant concept
    title: item.title,
    description: item.description ?? null,
    status,
    scope_type: 'TENANT',
    scope_id: 'main',
    visibility: item.isPublic ? 'public' : 'private',
    allow_revoting: false, // Legacy doesn't support revoting
    anonymous: false, // Legacy votes are not anonymous
    results_visibility: item.showVoteCounts ? 'always' : 'after_closed',
    settings: item.rules ?? {},
    created_by: '', // Not available in legacy API
    starts_at: null,
    ends_at: item.deadlineAt ?? null,
    created_at: new Date().toISOString(), // Not available
    updated_at: new Date().toISOString(), // Not available
    
    // Legacy-specific fields
    isActive: item.isActive,
    isOpen: item.isOpen,
    isPublic: item.isPublic,
    deadlineAt: item.deadlineAt,
    showVoteCounts: item.showVoteCounts,
    nominationCount: item.nominationCount,
    imageUrl: item.imageUrl,
    rules: item.rules ?? undefined,
  };
}

/**
 * Convert legacy Voting to modern Poll
 */
export function adaptLegacyVotingObjectToPoll(voting: LegacyVoting): LegacyVotingSession {
  const status: PollStatus = voting.isActive 
    ? (voting.isOpen ? 'active' : 'closed')
    : 'draft';
  
  return {
    __legacy: true,
    
    id: voting.id,
    tenant_id: 'default',
    title: voting.title,
    description: voting.description ?? null,
    status,
    scope_type: 'TENANT',
    scope_id: 'main',
    visibility: voting.isPublic ? 'public' : 'private',
    allow_revoting: false,
    anonymous: false,
    results_visibility: voting.showVoteCounts ? 'always' : 'after_closed',
    settings: voting.rules ?? {},
    created_by: '',
    starts_at: null,
    ends_at: voting.deadlineAt ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    
    isActive: voting.isActive,
    isOpen: voting.isOpen,
    isPublic: voting.isPublic,
    deadlineAt: voting.deadlineAt,
    showVoteCounts: voting.showVoteCounts,
    nominationCount: 0, // Not available in Voting object
    imageUrl: undefined,
    rules: voting.rules,
  };
}

/**
 * Convert legacy Nomination to modern Nomination
 */
export function adaptLegacyNominationToModern(
  nomination: LegacyNomination,
  pollId?: string
): LegacyVotingQuestion {
  // Derive kind from legacy kind or default to 'custom'
  const kind: NominationKind = 
    nomination.kind === 'game' ? 'game' :
    nomination.kind === 'review' ? 'review' :
    nomination.kind === 'person' ? 'person' :
    'custom';
  
  return {
    __legacy: true,
    
    // Modern Nomination fields
    id: nomination.id,
    poll_id: pollId ?? nomination.voting?.id ?? '',
    title: nomination.title,
    description: nomination.description ?? null,
    kind,
    sort_order: 0, // Legacy doesn't have explicit order
    max_votes: 1, // Legacy is always single-choice
    is_required: false,
    config: nomination.config ?? {},
    
    // Legacy-specific fields
    options: nomination.options.map((opt, index) => 
      adaptLegacyOptionToModern(opt, nomination.id, index)
    ),
    counts: nomination.counts,
    userVote: nomination.userVote,
    isVotingOpen: nomination.isVotingOpen,
    canVote: nomination.canVote,
    requiresTelegramLink: nomination.requiresTelegramLink,
    votingDeadline: nomination.votingDeadline,
    voting: nomination.voting,
    status: nomination.status,
  };
}

/**
 * Convert legacy NominationOption to modern Option
 */
export function adaptLegacyOptionToModern(
  option: LegacyOption,
  nominationId: string,
  sortOrder: number = 0
): LegacyVotingAnswer {
  return {
    __legacy: true,
    
    // Modern Option fields
    id: option.id,
    nomination_id: nominationId,
    title: option.title,
    description: null,
    media_url: option.imageUrl ?? null,
    game_id: option.game?.id ?? null,
    sort_order: sortOrder,
    
    // Legacy-specific fields
    imageUrl: option.imageUrl,
    game: option.game
      ? {
          id: option.game.id,
          title: option.game.title,
          genre: option.game.genre ?? undefined,
          studio: option.game.studio ?? undefined,
          releaseYear: option.game.releaseYear ?? undefined,
          imageUrl: option.game.imageUrl ?? undefined,
        }
      : null,
    payload: option.payload,
    counts: option.counts,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if Poll is legacy
 */
export function isLegacyPoll(poll: Poll | LegacyVotingSession): poll is LegacyVotingSession {
  return '__legacy' in poll && poll.__legacy === true;
}

/**
 * Check if Nomination is legacy
 */
export function isLegacyNomination(
  nomination: ModernNomination | LegacyVotingQuestion
): nomination is LegacyVotingQuestion {
  return '__legacy' in nomination && nomination.__legacy === true;
}

/**
 * Check if Option is legacy
 */
export function isLegacyOption(
  option: Option | LegacyVotingAnswer
): option is LegacyVotingAnswer {
  return '__legacy' in option && option.__legacy === true;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Voting session with full nested data (questions + answers)
 */
export interface VotingSessionWithQuestions extends Poll {
  questions: VotingQuestionWithAnswers[];
  meta: {
    has_voted: boolean;
    can_vote: boolean;
    user_votes?: Record<string, string>; // questionId → answerId
  };
}

/**
 * Voting question with nested answers
 */
export interface VotingQuestionWithAnswers extends ModernNomination {
  answers: VotingAnswer[];
}

/**
 * Legacy voting session with full nested data
 */
export interface LegacyVotingSessionWithQuestions extends LegacyVotingSession {
  questions: LegacyVotingQuestion[];
  meta: {
    has_voted: boolean;
    can_vote: boolean;
    user_votes?: Record<string, string>;
  };
}

// ============================================================================
// Response Types (with pagination)
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Voting list response (can be legacy or modern)
 */
export type VotingListResponse = 
  | PaginatedResponse<Poll>
  | LegacyVotingSession[]; // Legacy doesn't use pagination

/**
 * Voting detail response
 */
export type VotingDetailResponse = VotingSessionWithQuestions | LegacyVotingSessionWithQuestions;

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * API configuration for gradual migration
 */
export interface ApiConfig {
  /**
   * Use legacy API endpoints
   * Set to true for backward compatibility during migration
   */
  useLegacy?: boolean;
  
  /**
   * Endpoint override (for testing)
   */
  endpoint?: string;
}

/**
 * Query parameters for fetching voting sessions
 */
export interface VotingQueryParams {
  // Modern params
  scope_type?: PollScopeType;
  scope_id?: string;
  status?: PollStatus;
  limit?: number;
  offset?: number;
  
  // Legacy params
  voting?: string; // voting code for legacy /nominations?voting=code
  search?: string;
}

// ============================================================================
// Export Everything
// ============================================================================

// Re-export modern types for convenience
export type {
  Poll,
  Nomination,
  Option,
  Vote,
  PollStatus,
  PollScopeType,
  PollResults,
} from './index';

// Re-export the type aliases we created
export type { ModernNomination, LegacyNomination, LegacyOption, LegacyVoting, VotingCatalogItem };
