import type { Game } from '../../types/games';

export type NominationRow = {
  id: string;
  title: string;
  status: string;
  votes: string | number;
  updatedAt: string;
  kind?: string;
};

export type AdminRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt: string;
};

export type ReviewMaterial = {
  id: string;
  title: string;
  reviewers: string[];
  gameTitle?: string;
  link?: string;
  summary?: string;
};

export type ReviewerProfile = {
  id: string;
  name: string;
  bio?: string;
  links: string[];
  tags?: string[];
};

export type ReviewerDraft = {
  name: string;
  bio: string;
  links: string;
  tags: string;
};

export type ReviewDraft = {
  title: string;
  reviewers: string;
  gameTitle: string;
  link: string;
  summary: string;
};

export type OptionDraft = {
  id: string;
  title: string;
  imageUrl: string;
  gameId: string | null;
  payload: Record<string, unknown>;
};

export type NominationDraft = {
  id: string;
  title: string;
  description: string;
  kind: string;
  config: Record<string, unknown>;
  options: OptionDraft[];
};

export type GameDraft = {
  title: string;
  genre: string;
  studio: string;
  releaseYear: string;
  description: string;
  imageUrl: string;
};

export type VotingDraft = {
  code: string;
  title: string;
  description: string;
  deadlineAt: string;
  isPublished: boolean;
  isActive: boolean;
  showVoteCounts: boolean;
  forceReplace: boolean;
};

export type MetaDraftState = {
  title: string;
  description: string;
  deadlineAt: string;
  isPublished: boolean;
  isActive: boolean;
};

export const createEmptyGameDraft = (): GameDraft => ({
  title: '',
  genre: '',
  studio: '',
  releaseYear: '',
  description: '',
  imageUrl: '',
});

export const mapGameToDraft = (game: Game | null): GameDraft => ({
  title: game?.title ?? '',
  genre: game?.genre ?? '',
  studio: game?.studio ?? '',
  releaseYear: game?.releaseYear ? String(game.releaseYear) : '',
  description: game?.description ?? '',
  imageUrl: game?.imageUrl ?? '',
});
