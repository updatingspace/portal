import React from 'react';
import { Checkbox } from '@gravity-ui/uikit';

type VoteCountsToggleProps = {
  hasVoteCounts: boolean;
  showVoteCounts: boolean;
  onToggle: (value: boolean) => void;
};

export const VoteCountsToggle: React.FC<VoteCountsToggleProps> = ({
  hasVoteCounts,
  showVoteCounts,
  onToggle,
}) => {
  if (!hasVoteCounts) {
    return null;
  }

  return (
    <div className="mb-3">
      <Checkbox
        size="m"
        checked={showVoteCounts}
        onUpdate={onToggle}
      >
        Посмотреть количество голосов
      </Checkbox>
    </div>
  );
};
