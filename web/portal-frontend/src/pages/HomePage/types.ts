export type VoteStatus = 'active' | 'finished' | 'archived';

export type DecoratedVoting = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  status: VoteStatus;
  deadline: Date | null;
  deadlineValue: number;
  palette: readonly [string, string];
  nominationCount: number;
  isOpen: boolean;
  isActive: boolean;
};
