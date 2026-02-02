export type VotingState = {
  isVoting: boolean;
  isVotingClosed: boolean;
  canVoteNow: boolean;
  needsTelegramLink: boolean;
  disableVoting: boolean;
};
