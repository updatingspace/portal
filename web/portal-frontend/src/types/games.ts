export type Game = {
  id: string;
  title: string;
  genre?: string | null;
  studio?: string | null;
  releaseYear?: number | null;
  description?: string | null;
  imageUrl?: string | null;
};
