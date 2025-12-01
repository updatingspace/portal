import { ApiError } from './client';
import { fetchNominations } from './nominations';
import { fetchVotingCatalog } from './votings';

export type AdminNomination = {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
  votes?: number | null;
  updatedAt?: string | null;
};

export type AdminVotingListItem = {
  id: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'active' | 'archived';
  deadlineAt?: string | null;
  nominationCount: number;
};

export type AdminVoting = AdminVotingListItem & {
  nominations: AdminNomination[];
  isPublished?: boolean;
};

export async function fetchAdminVotings(search?: string): Promise<AdminVotingListItem[]> {
  const catalog = await fetchVotingCatalog();
  const searchValue = search?.toLowerCase() ?? '';

  return catalog
    .filter((item) => item.title.toLowerCase().includes(searchValue))
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? null,
      status: item.isActive ? 'active' : 'archived',
      deadlineAt: item.deadlineAt ?? null,
      nominationCount: item.nominationCount,
    }));
}

export async function fetchAdminVoting(id: string): Promise<AdminVoting> {
  const catalog = await fetchVotingCatalog();
  const meta = catalog.find((item) => item.id === id);

  const nominations = await fetchNominations(id);

  if (!meta) {
    throw new ApiError('Голосование не найдено', { kind: 'not_found' });
  }

  return {
    id: meta.id,
    title: meta.title,
    description: meta.description ?? null,
    status: meta.isActive ? 'active' : 'archived',
    deadlineAt: meta.deadlineAt ?? null,
    nominationCount: meta.nominationCount,
    nominations: nominations.map((nom) => ({
      id: nom.id,
      title: nom.title,
      status: nom.isVotingOpen === false ? 'archived' : 'active',
      votes: nom.counts ? Object.values(nom.counts).reduce((sum, value) => sum + value, 0) : null,
      updatedAt: null,
    })),
    isPublished: meta.isActive,
  };
}

export async function updateAdminVotingMeta(
  _id: string,
  _payload: { title?: string; description?: string | null },
): Promise<AdminVoting> {
  throw new ApiError('Редактирование голосований пока не поддержано API', { kind: 'forbidden' });
}
