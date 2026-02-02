import { request } from './client';

export type AdminVotingStatus = 'draft' | 'active' | 'archived';

export type AdminNomination = {
  id: string;
  title: string;
  status: AdminVotingStatus;
  votes?: number | null;
  updatedAt?: string | null;
  kind?: string;
};

export type AdminVotingListItem = {
  id: string;
  title: string;
  description?: string | null;
  status: AdminVotingStatus;
  deadlineAt?: string | null;
  nominationCount: number;
  isPublished: boolean;
  isActive: boolean;
  isOpen: boolean;
  showVoteCounts?: boolean;
  rules?: Record<string, unknown> | null;
};

export type AdminVoting = AdminVotingListItem & {
  nominations: AdminNomination[];
};

export type AdminStats = {
  activeVotings: number;
  draftVotings: number;
  archivedVotings: number;
  totalVotes: number;
  uniqueVoters: number;
  openNominations: number;
  openForVoting: number;
};

type ApiAdminNomination = {
  id: string;
  title: string;
  status: string;
  votes?: number | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  kind?: string | null;
};

type ApiAdminVoting = {
  id: string;
  title: string;
  description?: string | null;
  isActive?: boolean;
  is_active?: boolean;
  isOpen?: boolean;
  is_open?: boolean;
  isPublic?: boolean;
  is_public?: boolean;
  deadlineAt?: string | null;
  deadline_at?: string | null;
  nominationCount?: number;
  nomination_count?: number;
  nominations?: ApiAdminNomination[];
  showVoteCounts?: boolean;
  show_vote_counts?: boolean;
  rules?: Record<string, unknown> | null;
};

const deriveStatus = (item: ApiAdminVoting): AdminVotingStatus => {
  const isPublished = item.isPublic ?? item.is_public ?? true;
  const isActive = item.isActive ?? item.is_active ?? true;
  const isOpen = item.isOpen ?? item.is_open ?? true;
  if (!isPublished) return 'draft';
  if (!isActive || isOpen === false) return 'archived';
  return 'active';
};

const mapAdminNomination = (item: ApiAdminNomination): AdminNomination => ({
  id: item.id,
  title: item.title,
  status: (item.status as AdminVotingStatus) ?? 'archived',
  votes: item.votes ?? null,
  updatedAt: item.updatedAt ?? item.updated_at ?? null,
  kind: item.kind ?? undefined,
});

const mapAdminVotingSummary = (item: ApiAdminVoting): AdminVotingListItem => {
  const status = deriveStatus(item);
  const isPublished = item.isPublic ?? item.is_public ?? status !== 'draft';
  const deadlineAt = item.deadlineAt ?? item.deadline_at ?? null;
  const nominationCount =
    item.nominationCount ?? item.nomination_count ?? item.nominations?.length ?? 0;
  const showVoteCounts = item.showVoteCounts ?? item.show_vote_counts ?? false;

  return {
    id: item.id,
    title: item.title,
    description: item.description ?? null,
    status,
    deadlineAt,
    nominationCount,
    isPublished,
    isActive: item.isActive ?? item.is_active ?? true,
    isOpen: item.isOpen ?? item.is_open ?? true,
    showVoteCounts,
    rules: item.rules ?? null,
  };
};

const mapAdminVotingDetail = (item: ApiAdminVoting): AdminVoting => ({
  ...mapAdminVotingSummary(item),
  nominations: (item.nominations ?? []).map(mapAdminNomination),
});

export async function fetchAdminVotings(search?: string): Promise<AdminVotingListItem[]> {
  const data = await request<ApiAdminVoting[]>('/voting/admin/votings');
  const mapped = data.map(mapAdminVotingSummary);
  const searchValue = search?.trim().toLowerCase() ?? '';
  if (!searchValue) {
    return mapped;
  }
  return mapped.filter((item) => item.title.toLowerCase().includes(searchValue));
}

export async function fetchAdminVoting(id: string): Promise<AdminVoting> {
  const detail = await request<ApiAdminVoting>(`/voting/admin/votings/${id}`);
  return mapAdminVotingDetail(detail);
}

export async function updateAdminVotingMeta(
  id: string,
  payload: {
    title?: string;
    description?: string | null;
    deadlineAt?: string | null;
    isPublished?: boolean;
    isActive?: boolean;
    closeNow?: boolean;
    showVoteCounts?: boolean;
    rules?: Record<string, unknown> | null;
  },
): Promise<AdminVoting> {
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.deadlineAt !== undefined) body.deadlineAt = payload.deadlineAt;
  if (payload.isPublished !== undefined) body.isPublic = payload.isPublished;
  if (payload.isActive !== undefined) body.isActive = payload.isActive;
  if (payload.showVoteCounts !== undefined) body.showVoteCounts = payload.showVoteCounts;
  if (payload.rules !== undefined) body.rules = payload.rules;
  if (payload.closeNow) body.closeNow = true;

  const updated = await request<ApiAdminVoting>(`/voting/admin/votings/${id}`, {
    method: 'PATCH',
    body,
  });

  return mapAdminVotingDetail(updated);
}

export async function fetchAdminStats(): Promise<AdminStats> {
  return request<AdminStats>('/voting/admin/stats');
}
