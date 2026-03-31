import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ request: vi.fn() }));
import { request } from './client';

describe('votings api mapping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps catalog booleans and optional fields', async () => {
    const { fetchVotingCatalog } = await vi.importActual<typeof import('./votings')>('./votings');

    vi.mocked(request).mockResolvedValueOnce([
      {
        id: 'v1',
        title: 'Voting 1',
        nominationCount: 2,
        is_active: true,
        is_open: false,
        is_public: false,
        deadline_at: '2026-01-01',
        show_vote_counts: true,
        image_url: 'img',
      },
    ]);

    const catalog = await fetchVotingCatalog();

    expect(request).toHaveBeenCalledWith('/voting/votings/feed');
    expect(catalog[0]).toMatchObject({ isActive: true, isOpen: false, isPublic: false, imageUrl: 'img' });
  });

  it('exports, previews and imports voting with force query', async () => {
    const { deleteVoting, exportVoting, importVoting, previewVotingImport } =
      await vi.importActual<typeof import('./votings')>('./votings');

    vi.mocked(request)
      .mockResolvedValueOnce({ code: 'v-code', title: 'V', nominations: [] })
      .mockResolvedValueOnce({
        voting: { code: 'v-code', title: 'V', nominations: [{ id: 'n1', title: 'Nom', type: 'legacy_kind', options: [] }] },
        will_replace: true,
        totals: { nominations: 1, options: 0, games: 0 },
      })
      .mockResolvedValueOnce({
        voting: { code: 'v-code', title: 'V', nominations: [] },
        willReplace: false,
        totals: { nominations: 0, options: 0, games: 0 },
        replaced_existing: true,
        created_games: 2,
        updated_games: 3,
      })
      .mockResolvedValueOnce(undefined);

    const payload = { code: 'v-code', title: 'Vote', nominations: [{ id: 'n1', title: 'Nom', options: [] }] } as never;

    await expect(exportVoting('v-code')).resolves.toMatchObject({ code: 'v-code' });
    const preview = await previewVotingImport(payload, { force: true });
    const imported = await importVoting(payload, { force: true });
    await deleteVoting('v-code');

    expect(preview.willReplace).toBe(true);
    expect(imported).toMatchObject({ replacedExisting: true, createdGames: 2, updatedGames: 3 });
    expect(request).toHaveBeenNthCalledWith(2, '/voting/votings/import/preview?force=true', expect.anything());
  });
});
