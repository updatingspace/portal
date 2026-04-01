import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ request: vi.fn() }));
import { request } from './client';

describe('games api mapping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps API game shape with snake/camel variants', async () => {
    const { mapGame } = await vi.importActual<typeof import('./games')>('./games');

    expect(
      mapGame({
        id: 'g1',
        title: 'Witcher',
        genre: 'RPG',
        studio: 'CDPR',
        release_year: 2015,
        image_url: 'http://img',
      }),
    ).toMatchObject({ id: 'g1', title: 'Witcher', releaseYear: 2015, imageUrl: 'http://img' });
  });

  it('fetches, updates, creates and deletes games with normalized payload', async () => {
    const { createGame, deleteGame, fetchGames, updateGame } =
      await vi.importActual<typeof import('./games')>('./games');

    vi.mocked(request)
      .mockResolvedValueOnce([{ id: 'g1', title: 'One', release_year: 2001 }])
      .mockResolvedValueOnce({ id: 'g1', title: 'Updated', release_year: 2002 })
      .mockResolvedValueOnce({ id: 'g2', title: 'Created', release_year: 2003 })
      .mockResolvedValueOnce(undefined);

    const list = await fetchGames('witch');
    const updated = await updateGame('g1', { title: 'Updated', releaseYear: 2002, imageUrl: 'img' });
    const created = await createGame({ title: 'Created', studio: 'Studio', description: 'desc' });
    await deleteGame('g2');

    expect(list[0].releaseYear).toBe(2001);
    expect(updated.releaseYear).toBe(2002);
    expect(created.title).toBe('Created');
    expect(request).toHaveBeenNthCalledWith(1, '/voting/games/?search=witch');
  });
});
