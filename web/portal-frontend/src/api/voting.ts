import { request } from './client';

export type PollStatus = 'draft' | 'active' | 'closed';
export type PollScopeType = 'TENANT' | 'COMMUNITY' | 'TEAM' | 'EVENT' | 'POST';
export type PollVisibility = 'public' | 'community' | 'team' | 'private';
export type ResultsVisibility = 'always' | 'after_closed' | 'admins_only';

export interface Poll {
  id: string;
  tenant_id: string;
  title: string;
  status: PollStatus;
  scope_type: PollScopeType;
  scope_id: string;
  visibility: PollVisibility;
  created_by: string;
  description?: string | null;
  template?: string | null;
  allow_revoting?: boolean;
  anonymous?: boolean;
  results_visibility?: ResultsVisibility;
  settings?: Record<string, unknown>;
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
  kind?: string | null;
  sort_order: number;
  max_votes?: number;
  is_required?: boolean;
  config?: Record<string, unknown>;
}

export interface Option {
  id: string;
  nomination_id: string;
  title: string;
  description?: string | null;
  media_url?: string | null;
  game_id?: string | null;
  sort_order?: number;
}

export interface PollInfo {
  poll: Poll;
  nominations: Nomination[];
  options: Option[];
  meta: {
    has_voted: boolean;
    can_vote: boolean;
  };
}

export interface VoteCastPayload {
  poll_id: string;
  nomination_id: string;
  option_id: string;
}

export interface VoteResult {
    id: string;
    poll_id: string;
    nomination_id: string;
    option_id: string;
    user_id: string;
    created_at: string;
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

// API Methods

export async function fetchPolls(params?: { scope_type?: string; scope_id?: string }): Promise<Poll[]> {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return request<Poll[]>(`/voting/polls?${query}`);
}

export async function fetchPoll(pollId: string): Promise<Poll> {
  return request<Poll>(`/voting/polls/${pollId}`);
}

export async function fetchPollInfo(pollId: string): Promise<PollInfo> {
  return request<PollInfo>(`/voting/polls/${pollId}/info`);
}

export async function castVote(payload: VoteCastPayload): Promise<VoteCastPayload> {
  return request<VoteCastPayload>('/voting/votes', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchMyVotes(pollId: string): Promise<VoteResult[]> {
    return request<VoteResult[]>(`/voting/polls/${pollId}/votes/me`);
}

export async function fetchPollResults(pollId: string): Promise<PollResults> {
    return request<PollResults>(`/voting/polls/${pollId}/results`);
}
