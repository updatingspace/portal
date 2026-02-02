/**
 * Voting Feature - Type Definitions
 * 
 * These types match the backend schemas from tenant_voting/schemas.py
 */

// ============================================================================
// Enums / Literal Types
// ============================================================================

export type PollStatus = 'draft' | 'active' | 'closed';
export type PollScopeType = 'TENANT' | 'COMMUNITY' | 'TEAM' | 'EVENT' | 'POST';
export type PollVisibility = 'public' | 'community' | 'team' | 'private';
export type ResultsVisibility = 'always' | 'after_closed' | 'admins_only';
export type NominationKind = 'game' | 'review' | 'person' | 'custom';
export type PollRole = 'owner' | 'admin' | 'moderator' | 'observer' | 'participant';

// ============================================================================
// Core Models
// ============================================================================

export interface Poll {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  status: PollStatus;
  scope_type: PollScopeType;
  scope_id: string;
  visibility: PollVisibility;
  template?: string | null;
  allow_revoting: boolean;
  anonymous: boolean;
  results_visibility: ResultsVisibility;
  settings: Record<string, unknown>;
  created_by: string;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Nomination {
  id: string;
  poll_id: string;
  title: string;
  description?: string | null;
  kind: NominationKind;
  sort_order: number;
  max_votes: number;
  is_required: boolean;
  config: Record<string, unknown>;
}

export interface Option {
  id: string;
  nomination_id: string;
  title: string;
  description?: string | null;
  media_url?: string | null;
  game_id?: string | null;
  sort_order: number;
}

export interface Vote {
  id: string;
  poll_id: string;
  nomination_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface PollParticipant {
  user_id: string;
  role: PollRole;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface PollTemplate {
  slug: string;
  title: string;
  description: string;
  visibility: PollVisibility;
  settings: Record<string, unknown>;
  questions: NominationCreatePayload[];
}

// ============================================================================
// API Request Payloads
// ============================================================================

export interface OptionCreatePayload {
  title: string;
  description?: string | null;
  media_url?: string | null;
  game_id?: string | null;
  sort_order?: number | null;
}

export interface OptionUpdatePayload {
  title?: string;
  description?: string | null;
  media_url?: string | null;
  game_id?: string | null;
  sort_order?: number | null;
}

export interface NominationCreatePayload {
  title: string;
  description?: string | null;
  kind?: NominationKind;
  sort_order?: number | null;
  max_votes?: number;
  is_required?: boolean;
  config?: Record<string, unknown>;
  options?: OptionCreatePayload[] | null;
}

export interface NominationUpdatePayload {
  title?: string;
  description?: string | null;
  kind?: NominationKind;
  sort_order?: number | null;
  max_votes?: number;
  is_required?: boolean;
  config?: Record<string, unknown>;
}

export interface PollCreatePayload {
  title: string;
  description?: string | null;
  scope_type?: PollScopeType;
  scope_id?: string | null;
  visibility?: PollVisibility;
  status?: PollStatus;
  template?: string | null;
  allow_revoting?: boolean;
  anonymous?: boolean;
  results_visibility?: ResultsVisibility;
  settings?: Record<string, unknown>;
  starts_at?: string | null;
  ends_at?: string | null;
  nominations?: NominationCreatePayload[] | null;
}

export interface PollUpdatePayload {
  title?: string;
  description?: string | null;
  visibility?: PollVisibility;
  allow_revoting?: boolean;
  anonymous?: boolean;
  results_visibility?: ResultsVisibility;
  settings?: Record<string, unknown>;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: PollStatus;
}

export interface VoteCastPayload {
  poll_id: string;
  nomination_id: string;
  option_id: string;
}

export interface ParticipantAddPayload {
  user_id: string;
  role: PollRole;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface ResultOption {
  option_id: string;
  text: string;
  votes: number;
}

export interface ResultNomination {
  nomination_id: string;
  title: string;
  options: ResultOption[];
}

export interface PollResults {
  poll_id: string;
  nominations: ResultNomination[];
}

export interface PollInfoMeta {
  has_voted: boolean;
  can_vote: boolean;
}

export interface PollInfoResponse {
  poll: Poll;
  nominations: Nomination[];
  options: Option[];
  meta: PollInfoMeta;
}

export type NominationWithOptions = Nomination & {
  options: Option[];
};

export interface PollDetailedInfo {
  poll: Poll;
  nominations: NominationWithOptions[];
  meta: PollInfoMeta;
}

// ============================================================================
// API Error Types
// ============================================================================

export interface ApiErrorDetails {
  retry_after?: number;
  limit?: number;
  window?: number;
}

export interface VotingApiError {
  code: string;
  message: string;
  details?: ApiErrorDetails;
  request_id?: string;
}

export type VotingErrorCode =
  | 'ALREADY_VOTED'
  | 'TOO_MANY_VOTES'
  | 'REVOTE_NOT_ALLOWED'
  | 'POLL_NOT_ACTIVE'
  | 'POLL_NOT_FOUND'
  | 'NOMINATION_NOT_FOUND'
  | 'OPTION_NOT_FOUND'
  | 'FORBIDDEN'
  | 'RATE_LIMIT_EXCEEDED'
  | 'RESULTS_HIDDEN'
  | 'VALIDATION_ERROR';

// ============================================================================
// Query Parameter Types
// ============================================================================

export interface PollsQueryParams {
  scope_type?: PollScopeType;
  scope_id?: string;
  status?: PollStatus;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface VoteAction {
  pollId: string;
  nominationId: string;
  optionId: string;
}

export interface PollWithNominations extends Poll {
  nominations: NominationWithOptions[];
}
