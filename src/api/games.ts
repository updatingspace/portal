import { request } from './client';
import type { Game } from '../types/games';

export type ApiGame = {
  id: string;
  title: string;
  genre?: string | null;
  studio?: string | null;
  releaseYear?: number | null;
  release_year?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
};

export const mapGame = (game: ApiGame): Game => ({
  id: game.id,
  title: game.title,
  genre: game.genre ?? null,
  studio: game.studio ?? null,
  releaseYear: game.releaseYear ?? game.release_year ?? null,
  description: game.description ?? null,
  imageUrl: game.imageUrl ?? game.image_url ?? null,
});

const buildGamePayload = (payload: Partial<Game>): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.genre !== undefined) body.genre = payload.genre;
  if (payload.studio !== undefined) body.studio = payload.studio;
  if (payload.releaseYear !== undefined) body.release_year = payload.releaseYear;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.imageUrl !== undefined) body.image_url = payload.imageUrl;
  return body;
};

export async function fetchGames(search?: string): Promise<Game[]> {
  const query = search ? `?${new URLSearchParams({ search }).toString()}` : '';
  const data = await request<ApiGame[]>(`/games/${query}`);
  return data.map(mapGame);
}

export async function updateGame(id: string, payload: Partial<Game>): Promise<Game> {
  const body = buildGamePayload(payload);

  const data = await request<ApiGame>(`/games/${id}`, {
    method: 'PATCH',
    body,
  });

  return mapGame(data);
}

export async function createGame(payload: Partial<Game>): Promise<Game> {
  const body = buildGamePayload(payload);

  const data = await request<ApiGame>('/games/', {
    method: 'POST',
    body,
  });

  return mapGame(data);
}
