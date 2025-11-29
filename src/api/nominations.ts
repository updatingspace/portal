import { request } from './client';
import type { Nomination, NominationOption, Voting } from '../data/nominations';

type ApiNominationOption = {
  id: string;
  title: string;
  imageUrl?: string | null;
  image_url?: string | null;
};

type ApiVoting = {
  id: string;
  title: string;
  description?: string | null;
  isActive?: boolean;
  is_active?: boolean;
  isOpen?: boolean;
  is_open?: boolean;
  deadlineAt?: string | null;
  deadline_at?: string | null;
  showVoteCounts?: boolean;
  show_vote_counts?: boolean;
  rules?: Record<string, unknown> | null;
};

type ApiNomination = {
  id: string;
  title: string;
  description?: string | null;
  options: ApiNominationOption[];
  counts?: Record<string, number> | null;
  userVote?: string | null;
  user_vote?: string | null;
  isVotingOpen?: boolean;
  is_voting_open?: boolean;
  canVote?: boolean;
  can_vote?: boolean;
  votingDeadline?: string | null;
  voting_deadline?: string | null;
  voting?: ApiVoting | null;
};

type VoteResponse = {
  nominationId?: string;
  nomination_id?: string;
  optionId?: string;
  option_id?: string;
  counts?: Record<string, number> | null;
  userVote?: string | null;
  user_vote?: string | null;
  isVotingOpen?: boolean;
  is_voting_open?: boolean;
  canVote?: boolean;
  can_vote?: boolean;
  votingDeadline?: string | null;
  voting_deadline?: string | null;
};

export type VoteResult = {
  nominationId: string;
  optionId: string;
  counts?: Record<string, number>;
  userVote: string | null;
  isVotingOpen: boolean;
  canVote: boolean;
  votingDeadline: string | null;
};

const mapOption = (option: ApiNominationOption): NominationOption => ({
  id: option.id,
  title: option.title,
  imageUrl: option.imageUrl ?? option.image_url ?? undefined,
});

const mapVoting = (value?: ApiVoting | null): Voting | null => {
  if (!value) {
    return null;
  }

  const deadlineAt = value.deadlineAt ?? value.deadline_at ?? null;

  return {
    id: value.id,
    title: value.title,
    description: value.description ?? undefined,
    isActive: value.isActive ?? value.is_active ?? true,
    isOpen: value.isOpen ?? value.is_open ?? true,
    deadlineAt,
    showVoteCounts: value.showVoteCounts ?? value.show_vote_counts ?? undefined,
    rules: value.rules ?? undefined,
  };
};

const mapNomination = (nomination: ApiNomination): Nomination => ({
  id: nomination.id,
  title: nomination.title,
  description: nomination.description ?? undefined,
  options: nomination.options.map(mapOption),
  ...(nomination.counts ? { counts: nomination.counts } : {}),
  userVote: nomination.userVote ?? nomination.user_vote ?? null,
  isVotingOpen: nomination.isVotingOpen ?? nomination.is_voting_open ?? true,
  canVote: nomination.canVote ?? nomination.can_vote ?? false,
  votingDeadline: nomination.votingDeadline ?? nomination.voting_deadline ?? null,
  voting: mapVoting(nomination.voting),
});

const mapVoteResponse = (response: VoteResponse): VoteResult => ({
  nominationId: response.nominationId ?? response.nomination_id ?? '',
  optionId: response.optionId ?? response.option_id ?? '',
  ...(response.counts ? { counts: response.counts } : {}),
  userVote:
    response.userVote ??
    response.user_vote ??
    response.optionId ??
    response.option_id ??
    null,
  isVotingOpen: response.isVotingOpen ?? response.is_voting_open ?? true,
  canVote: response.canVote ?? response.can_vote ?? false,
  votingDeadline: response.votingDeadline ?? response.voting_deadline ?? null,
});

export async function fetchNominations(votingCode?: string): Promise<Nomination[]> {
  const queryString = votingCode
    ? `?${new URLSearchParams({ voting: votingCode }).toString()}`
    : '';
  const nominations = await request<ApiNomination[]>(`/nominations/${queryString}`);
  return nominations.map(mapNomination);
}

export async function fetchNomination(id: string): Promise<Nomination> {
  const nomination = await request<ApiNomination>(`/nominations/${id}`);
  return mapNomination(nomination);
}

export async function voteForOption(params: { nominationId: string; optionId: string }): Promise<VoteResult> {
  const response = await request<VoteResponse>(`/nominations/${params.nominationId}/vote`, {
    method: 'POST',
    body: { option_id: params.optionId },
  });

  return mapVoteResponse(response);
}
