import { request } from './client';

export type VotingCatalogItem = {
  id: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isOpen: boolean;
  isPublic: boolean;
  deadlineAt?: string | null;
  showVoteCounts?: boolean;
  rules?: Record<string, unknown> | null;
  nominationCount: number;
  imageUrl?: string | null;
};

type ApiVotingCatalogItem = VotingCatalogItem & {
  is_public?: boolean;
  is_active?: boolean;
  is_open?: boolean;
  deadline_at?: string | null;
  show_vote_counts?: boolean;
  image_url?: string | null;
};

const mapVotingCatalog = (voting: ApiVotingCatalogItem): VotingCatalogItem => ({
  id: voting.id,
  title: voting.title,
  description: voting.description ?? null,
  isActive: voting.isActive ?? voting.is_active ?? false,
  isOpen: voting.isOpen ?? voting.is_open ?? true,
  isPublic: voting.isPublic ?? voting.is_public ?? true,
  deadlineAt: voting.deadlineAt ?? voting.deadline_at ?? null,
  showVoteCounts: voting.showVoteCounts ?? voting.show_vote_counts ?? false,
  rules: voting.rules ?? null,
  nominationCount: voting.nominationCount,
  imageUrl: voting.imageUrl ?? voting.image_url ?? null,
});

export async function fetchVotingCatalog(): Promise<VotingCatalogItem[]> {
  const catalog = await request<ApiVotingCatalogItem[]>('/voting/votings/feed');
  return catalog.map(mapVotingCatalog);
}

export type VotingImportGame = {
  id?: string | null;
  title: string;
  genre?: string | null;
  studio?: string | null;
  releaseYear?: number | null;
  description?: string | null;
  imageUrl?: string | null;
};

export type VotingImportOption = {
  id: string;
  title: string;
  imageUrl?: string | null;
  order?: number | null;
  game?: VotingImportGame | null;
  payload?: Record<string, unknown> | null;
};

export type VotingImportNomination = {
  id: string;
  title: string;
  description?: string | null;
  kind?: string | null;
  config?: Record<string, unknown> | null;
  order?: number | null;
  options: VotingImportOption[];
};

export type VotingImportPayload = {
  code: string;
  title: string;
  description?: string | null;
  order?: number | null;
  isActive?: boolean;
  showVoteCounts?: boolean;
  rules?: Record<string, unknown> | null;
  deadlineAt?: string | null;
  nominations: VotingImportNomination[];
};

export type VotingImportPreview = {
  voting: VotingImportPayload;
  willReplace: boolean;
  totals: {
    nominations: number;
    options: number;
    games: number;
  };
};

export type VotingImportResult = VotingImportPreview & {
  replacedExisting: boolean;
  createdGames: number;
  updatedGames: number;
};

type ApiVotingImportGame = {
  id?: string | null;
  title: string;
  genre?: string | null;
  studio?: string | null;
  releaseYear?: number | null;
  release_year?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
};

type ApiVotingImportOption = {
  id: string;
  title: string;
  imageUrl?: string | null;
  image_url?: string | null;
  order?: number | null;
  game?: ApiVotingImportGame | null;
  payload?: Record<string, unknown> | null;
};

type ApiVotingImportNomination = {
  id: string;
  title: string;
  description?: string | null;
  kind?: string | null;
  type?: string | null;
  config?: Record<string, unknown> | null;
  order?: number | null;
  options: ApiVotingImportOption[];
};

type ApiVotingImportPayload = {
  code: string;
  title: string;
  description?: string | null;
  order?: number | null;
  isActive?: boolean;
  is_active?: boolean;
  showVoteCounts?: boolean;
  show_vote_counts?: boolean;
  rules?: Record<string, unknown> | null;
  deadlineAt?: string | null;
  deadline_at?: string | null;
  nominations: ApiVotingImportNomination[];
};

type ApiVotingImportPreview = {
  voting: ApiVotingImportPayload;
  willReplace?: boolean;
  will_replace?: boolean;
  totals: {
    nominations: number;
    options: number;
    games: number;
  };
};

type ApiVotingImportResult = ApiVotingImportPreview & {
  replacedExisting?: boolean;
  replaced_existing?: boolean;
  createdGames?: number;
  created_games?: number;
  updatedGames?: number;
  updated_games?: number;
};

const parseYear = (value: string | number | null | undefined): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const mapImportGame = (game: ApiVotingImportGame): VotingImportGame => ({
  id: game.id ?? null,
  title: game.title,
  genre: game.genre ?? null,
  studio: game.studio ?? null,
  releaseYear: game.releaseYear ?? game.release_year ?? null,
  description: game.description ?? null,
  imageUrl: game.imageUrl ?? game.image_url ?? null,
});

const normalizePayload = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
};

const mapImportOption = (option: ApiVotingImportOption): VotingImportOption => {
  const legacyPayload = (option as { meta?: unknown }).meta;
  return {
    id: option.id,
    title: option.title,
    imageUrl: option.imageUrl ?? option.image_url ?? null,
    order: option.order ?? null,
    game: option.game ? mapImportGame(option.game) : null,
    payload: normalizePayload(option.payload ?? legacyPayload),
  };
};

const mapImportNomination = (
  nomination: ApiVotingImportNomination,
): VotingImportNomination => {
  const legacyKind = (nomination as { type?: unknown }).type;
  const kind = typeof legacyKind === 'string' && legacyKind.trim() ? legacyKind : nomination.kind;
  return {
    id: nomination.id,
    title: nomination.title,
    description: nomination.description ?? null,
    kind: kind ?? 'game',
    config: nomination.config ?? null,
    order: nomination.order ?? null,
    options: nomination.options?.map(mapImportOption) ?? [],
  };
};

const mapImportVoting = (voting: ApiVotingImportPayload): VotingImportPayload => ({
  code: voting.code,
  title: voting.title,
  description: voting.description ?? null,
  order: voting.order ?? null,
  isActive: voting.isActive ?? voting.is_active ?? true,
  showVoteCounts: voting.showVoteCounts ?? voting.show_vote_counts ?? false,
  rules: voting.rules ?? null,
  deadlineAt: voting.deadlineAt ?? voting.deadline_at ?? null,
  nominations: voting.nominations?.map(mapImportNomination) ?? [],
});

const mapImportPreview = (preview: ApiVotingImportPreview): VotingImportPreview => ({
  voting: mapImportVoting(preview.voting),
  willReplace: preview.willReplace ?? preview.will_replace ?? false,
  totals: {
    nominations: preview.totals?.nominations ?? 0,
    options: preview.totals?.options ?? 0,
    games: preview.totals?.games ?? 0,
  },
});

const mapImportResult = (result: ApiVotingImportResult): VotingImportResult => ({
  ...mapImportPreview(result),
  replacedExisting: result.replacedExisting ?? result.replaced_existing ?? false,
  createdGames: result.createdGames ?? result.created_games ?? 0,
  updatedGames: result.updatedGames ?? result.updated_games ?? 0,
});

const mapGameToApi = (game: VotingImportGame | null | undefined): ApiVotingImportGame | null => {
  if (!game) return null;
  return {
    id: game.id ?? undefined,
    title: game.title,
    genre: game.genre ?? null,
    studio: game.studio ?? null,
    releaseYear: parseYear(game.releaseYear),
    release_year: parseYear(game.releaseYear),
    description: game.description ?? null,
    imageUrl: game.imageUrl ?? null,
    image_url: game.imageUrl ?? null,
  };
};

const mapOptionToApi = (
  option: VotingImportOption,
  index: number,
): ApiVotingImportOption => ({
  id: option.id,
  title: option.title,
  image_url: option.imageUrl ?? null,
  imageUrl: option.imageUrl ?? null,
  order: option.order ?? index,
  game: mapGameToApi(option.game),
  payload: option.payload ?? null,
});

const mapNominationToApi = (
  nomination: VotingImportNomination,
  index: number,
): ApiVotingImportNomination => ({
  id: nomination.id,
  title: nomination.title,
  description: nomination.description ?? null,
  kind: nomination.kind ?? 'game',
  config: nomination.config ?? {},
  order: nomination.order ?? index,
  options: nomination.options.map((option, optIndex) => mapOptionToApi(option, optIndex)),
});

const toApiImportPayload = (payload: VotingImportPayload): ApiVotingImportPayload => ({
  code: payload.code,
  title: payload.title,
  description: payload.description ?? null,
  order: payload.order ?? 0,
  is_active: payload.isActive ?? true,
  show_vote_counts: payload.showVoteCounts ?? false,
  rules: payload.rules ?? {},
  deadline_at: payload.deadlineAt ?? null,
  nominations: payload.nominations.map((nomination, index) => mapNominationToApi(nomination, index)),
});

const withForceQuery = (force?: boolean) => (force ? `?${new URLSearchParams({ force: 'true' }).toString()}` : '');

export async function exportVoting(code: string): Promise<VotingImportPayload> {
  const data = await request<ApiVotingImportPayload>(`/voting/votings/${code}/export`);
  return mapImportVoting(data);
}

export async function previewVotingImport(
  payload: VotingImportPayload,
  options?: { force?: boolean },
): Promise<VotingImportPreview> {
  const data = await request<ApiVotingImportPreview>(
    `/voting/votings/import/preview${withForceQuery(options?.force)}`,
    {
      method: 'POST',
      body: toApiImportPayload(payload),
    },
  );
  return mapImportPreview(data);
}

export async function importVoting(
  payload: VotingImportPayload,
  options?: { force?: boolean },
): Promise<VotingImportResult> {
  const data = await request<ApiVotingImportResult>(
    `/voting/votings/import${withForceQuery(options?.force)}`,
    {
      method: 'POST',
      body: toApiImportPayload(payload),
    },
  );
  return mapImportResult(data);
}

export async function deleteVoting(code: string): Promise<void> {
  await request(`/voting/votings/${code}`, { method: 'DELETE' });
}
