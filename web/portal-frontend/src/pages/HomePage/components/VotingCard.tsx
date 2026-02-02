import React from 'react';
import { Button } from '@gravity-ui/uikit';

import { formatDeadline, formatTimeLeft } from '../utils';
import type { DecoratedVoting } from '../types';

const statusLabel: Record<DecoratedVoting['status'], string> = {
  active: 'Активно',
  finished: 'Завершено',
  archived: 'Архив',
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
  const truncatedDescription = item.description
    ? item.description.length > 140
      ? `${item.description.slice(0, 140)}…`
      : item.description
    : 'Кратко о голосовании, правила и обсуждение откроются позже.';

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(item.id);
    }
  };

  return (
    <div
      key={item.id}
      className={`vote-card${item.status !== 'active' ? ' vote-card-expired' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={handleCardKeyDown}
    >
      <div
        className="vote-card-cover"
        style={{
          background: item.imageUrl
            ? `linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.55) 100%), url(${item.imageUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${item.palette[0]} 0%, ${item.palette[1]} 100%)`,
        }}
      >
      <div className="vote-card-cover-top">
        <span className={`vote-status vote-status-${item.status}`}>
          {statusLabel[item.status]}
        </span>
        <span className="vote-card-deadline-tag">
          {item.status !== 'active' ? 'финиш' : 'дедлайн'} · {shortDeadline}
        </span>
      </div>
        <div className="vote-card-cover-title">{item.title}</div>
      </div>

      <div className="vote-card-body">
        <p className="vote-card-desc">
          {truncatedDescription}
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
            view={item.status !== 'active' ? 'flat-secondary' : 'outlined'}
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
