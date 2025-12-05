export type VoteStatus = 'active' | 'paused' | 'expired';

export type DecoratedVoting = {
  id: string;
  title: string;
  description?: string;
  status: VoteStatus;
  deadline: Date | null;
  deadlineValue: number;
  palette: readonly [string, string];
  nominationCount: number;
  isOpen: boolean;
  isActive: boolean;
};
