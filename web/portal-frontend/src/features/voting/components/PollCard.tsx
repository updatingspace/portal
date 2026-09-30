import React from 'react';
import { Label } from '@gravity-ui/uikit';
import type { Poll } from '../types';
import {
  POLL_STATUS_META,
  formatDateTime,
  getScheduleMeta,
} from '../utils/pollMeta';

export interface PollCardProps {
  poll: Poll;
  actions?: React.ReactNode;
  locale?: string | null;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  actions,
  locale,
}) => {
  const status = POLL_STATUS_META[poll.status];
  const schedule = getScheduleMeta(poll.starts_at, poll.ends_at);
  return (
    <article className="voting-poll-card">
      <div className="voting-poll-card__status">
        <Label theme={status.theme} size="s">
          {status.label}
        </Label>
      </div>
      <h2>{poll.title}</h2>
      {poll.description && (
        <p className="voting-poll-card__description">{poll.description}</p>
      )}
      {schedule && (
        <p className="voting-poll-card__schedule">
          {schedule.label}: {formatDateTime(schedule.at, locale)}
        </p>
      )}
      {actions && <div className="voting-poll-card__actions">{actions}</div>}
    </article>
  );
};
