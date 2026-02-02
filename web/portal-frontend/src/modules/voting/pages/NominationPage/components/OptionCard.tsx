import React from 'react';
import { Button, Card } from '@gravity-ui/uikit';

import type { NominationOption } from '../../../../../data/nominations';
import type { VotingState } from './types';

type OptionCardProps = {
  option: NominationOption;
  isUserChoice: boolean;
  votingState: VotingState;
  shouldShowVoteCounts: boolean;
  voteCount: number;
  onVote: (optionId: string) => void;
  onOpenModal: (optionId: string) => void;
};

const getVoteButtonLabel = (state: VotingState, isUserChoice: boolean): string => {
  if (state.isVoting) return 'Отправляем...';
  if (state.isVotingClosed) return 'Голосование завершено';
  if (!state.canVoteNow) {
    return state.needsTelegramLink ? 'Привяжите Telegram' : 'Нужна авторизация';
  }
  return isUserChoice ? 'Обновить голос' : 'Проголосовать';
};

export const OptionCard: React.FC<OptionCardProps> = ({
  option,
  isUserChoice,
  votingState,
  shouldShowVoteCounts,
  voteCount,
  onVote,
  onOpenModal,
}) => {
  const voteButtonLabel = getVoteButtonLabel(votingState, isUserChoice);

  return (
    <Card type="action" className="option-card" onClick={() => onOpenModal(option.id)}>
      <div className="option-card-cover">
        {option.imageUrl || option.game?.imageUrl ? (
          <img
            src={option.imageUrl ?? option.game?.imageUrl ?? undefined}
            alt={`Обложка игры ${option.title}`}
            className="option-card-cover-img"
          />
        ) : (
          <div className="option-card-cover-placeholder">
            <span className="option-card-cover-accent">Кадр игры</span>
            <span className="option-card-cover-note">оно не нашлось, но мы уже добавляем живое превью.</span>
          </div>
        )}
        <div className="option-card-badge">{option.game?.genre ? `Жанр: ${option.game.genre}` : 'Жанр - ?'}</div>
      </div>
      <div className="option-card-footer">
        <div className="option-card-header">
          <div className="option-card-title">{option.title}</div>
          {shouldShowVoteCounts && <div className="option-card-votes text-muted">Голосов: {voteCount}</div>}
        </div>
        <div className="option-card-description text-muted small">
          {option.game?.description ?? 'Описание игры пока не добавлено.'}
        </div>
        <div className="option-card-subtitle text-muted">
          {isUserChoice
            ? 'Этот вариант уже привязан к вашему аккаунту.'
            : 'Клик откроет подробную модалку с описанием.'}
        </div>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onVote(option.id);
          }}
          disabled={votingState.disableVoting || votingState.isVoting}
          view={isUserChoice ? 'action' : 'outlined'}
          size="l"
          width="max"
        >
          {voteButtonLabel}
        </Button>
      </div>
    </Card>
  );
};
