import React from 'react';
import { Button, Loader } from '@gravity-ui/uikit';
import type { VoteAction } from '../types';

export interface VoteButtonProps {
  optionId: string;
  nominationId: string;
  pollId: string;
  isSelected: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  onVote: (vote: VoteAction) => void;
  onRevoke: (voteId: string) => void;
  existingVoteId?: string;
  children: React.ReactNode;
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  optionId,
  nominationId,
  pollId,
  isSelected,
  isDisabled = false,
  isLoading = false,
  onVote,
  onRevoke,
  existingVoteId,
  children,
}) => {
  const handleClick = () => {
    if (isSelected && existingVoteId) {
      onRevoke(existingVoteId);
    } else {
      onVote({ pollId, nominationId, optionId });
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled || isLoading}
      view={isSelected ? 'action' : 'outlined'}
      className="w-full flex items-center justify-center gap-2"
    >
      {isLoading ? (
        <Loader size="s" />
      ) : (
        <>
          {children}
          {isSelected && (
            <span className="text-xs">✓</span>
          )}
        </>
      )}
    </Button>
  );
};