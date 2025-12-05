import React from 'react';
import { Button } from '@gravity-ui/uikit';

import { formatDeadline, formatTimeLeft } from '../utils';
import type { DecoratedVoting } from '../types';

const statusLabel: Record<DecoratedVoting['status'], string> = {
  active: 'Активно',
  paused: 'На паузе',
  expired: 'Завершено',
};

type VotingCardProps = {
  item: DecoratedVoting;
  nowTs: number;
  onOpen: (id: string) => void;
};

export const VotingCard: React.FC<VotingCardProps> = ({ item, nowTs, onOpen }) => {
  const deadlineLabel = formatDeadline(item.deadline);
  const timeLeftLabel = formatTimeLeft(item.deadline, item.status, nowTs);
  const shortDeadline = item.deadline
    ? item.deadline.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })
    : 'без даты';

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(item.id);
    }
  };

  return (
    <div
      key={item.id}
      className={`vote-card${item.status === 'expired' ? ' vote-card-expired' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={handleCardKeyDown}
    >
      <div
        className="vote-card-cover"
        style={{
          background: `linear-gradient(135deg, ${item.palette[0]} 0%, ${item.palette[1]} 100%)`,
        }}
      >
        <div className="vote-card-cover-top">
          <span className={`vote-status vote-status-${item.status}`}>
            {statusLabel[item.status]}
          </span>
          <span className="vote-card-deadline-tag">
            {item.status === 'expired' ? 'финиш' : 'дедлайн'} · {shortDeadline}
          </span>
        </div>
        <div className="vote-card-cover-title">{item.title}</div>
      </div>

      <div className="vote-card-body">
        <div className="vote-card-title">{item.title}</div>
        <p className="vote-card-desc">
          {item.description ?? 'Кратко о голосовании, правила и обсуждение откроются позже.'}
        </p>
        <div className="vote-card-meta">
          <span className="text-muted small">{item.nominationCount} номинаций</span>
        </div>
        <div className="vote-card-footer">
          <div className="vote-card-meta">
            <div className="vote-card-deadline">{deadlineLabel}</div>
            <div className="vote-card-timer">{timeLeftLabel}</div>
          </div>
          <Button
            size="s"
            view={item.status === 'expired' ? 'flat-secondary' : 'outlined'}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item.id);
            }}
          >
            Открыть
          </Button>
        </div>
      </div>
    </div>
  );
};
