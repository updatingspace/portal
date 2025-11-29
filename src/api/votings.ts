import { request } from './client';

export type VotingNominationSummary = {
  id: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  order: number;
};

export type VotingCatalogItem = {
  id: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isOpen: boolean;
  deadlineAt?: string | null;
  showVoteCounts?: boolean;
  rules?: Record<string, unknown> | null;
  nominations: VotingNominationSummary[];
  nominationCount: number;
};

const mapVotingNomination = (
  nomination: VotingNominationSummary,
): VotingNominationSummary => ({
  id: nomination.id,
  title: nomination.title,
  description: nomination.description ?? null,
  isActive: nomination.isActive,
  order: nomination.order,
});

const mapVotingCatalog = (voting: VotingCatalogItem): VotingCatalogItem => ({
  ...voting,
  description: voting.description ?? null,
  rules: voting.rules ?? null,
  nominations: voting.nominations.map(mapVotingNomination),
});

export async function fetchVotingCatalog(): Promise<VotingCatalogItem[]> {
  const catalog = await request<VotingCatalogItem[]>('/votings/');
  return catalog.map(mapVotingCatalog);
}
