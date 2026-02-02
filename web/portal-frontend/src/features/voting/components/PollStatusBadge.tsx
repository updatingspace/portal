import React from 'react';
import { Label } from '@gravity-ui/uikit';
import type { PollStatus } from '../types';
import { POLL_STATUS_META } from '../utils/pollMeta';

export interface PollStatusBadgeProps {
  status: PollStatus;
}

export const PollStatusBadge: React.FC<PollStatusBadgeProps> = ({ status }) => {
  const meta = POLL_STATUS_META[status];

  return (
    <Label theme={meta.theme} size="xs" title={meta.description}>
      {meta.label}
    </Label>
  );
};
