import React from 'react';
import { Dialog } from '@gravity-ui/uikit';

import type { NominationOption } from '../../../../../data/nominations';
import type { VotingState } from './types';

type OptionModalProps = {
  option: NominationOption | null;
  votingState: VotingState;
  shouldShowVoteCounts: boolean;
  voteCount: number;
  isUserChoice: boolean;
  isOpen: boolean;
  onClose: () => void;
  onVote: (optionId: string) => void;
};

const getModalVoteLabel = (state: VotingState): string => {
  if (state.isVoting) return 'Отправляем...';
  if (state.isVotingClosed) return 'Голосование завершено';
  if (!state.canVoteNow) {
    return state.needsTelegramLink ? 'Привяжите Telegram' : 'Нужна авторизация';
  }
  return 'Отдать голос за эту игру';
};

export const OptionModal: React.FC<OptionModalProps> = ({
  option,
  votingState,
  shouldShowVoteCounts,
  voteCount,
  isUserChoice,
  isOpen,
  onClose,
  onVote,
}) => {
  if (!option) {
    return null;
  }

  const showMeta = shouldShowVoteCounts || isUserChoice;
  const modalVoteLabel = getModalVoteLabel(votingState);

  const handleVote = () => {
    if (votingState.disableVoting || votingState.isVoting) return;
    onVote(option.id);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      size="l"
      contentOverflow="auto"
      onClose={onClose}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Dialog.Header caption="Карточка игры" />
      <Dialog.Body>
        <div className="option-modal-body">
          <div className="option-modal-media">
            {option.imageUrl ? (
              <img
                src={option.imageUrl}
                alt={`Обложка игры ${option.title}`}
                className="option-modal-cover-img"
              />
            ) : (
              <div className="option-modal-cover-placeholder">
                <span className="option-card-cover-accent">Обложка игры</span>
                <span className="option-card-cover-note">Добавим живое превью из API.</span>
              </div>
            )}
          </div>
          <div className="option-modal-content">
            <div className="option-modal-title">{option.title}</div>
            {showMeta && (
              <div className="option-modal-meta">
                {shouldShowVoteCounts && <span className="option-modal-votes">Голосов: {voteCount}</span>}
                {isUserChoice && (
                  <span className="option-modal-badge option-modal-badge-success">Ваш голос</span>
                )}
              </div>
            )}
            <p className="text-muted">
              {option.game?.studio || 'Студия не указана'} · {option.game?.genre ?? 'Жанр не указан'}
            </p>
            <div className="option-card-description text-muted">
              {option.game?.description ?? 'Описание игры пока не добавлено.'}
            </div>
            <ul className="option-modal-list text-muted">
              {option.game?.releaseYear && <li>Год релиза: {option.game.releaseYear}</li>}
              {option.game?.studio && <li>Разработчик: {option.game.studio}</li>}
            </ul>
          </div>
        </div>
      </Dialog.Body>
      <Dialog.Footer
        textButtonApply={modalVoteLabel}
        propsButtonApply={{
          view: 'action',
          disabled: votingState.disableVoting || votingState.isVoting,
        }}
        onClickButtonApply={handleVote}
        textButtonCancel="Закрыть"
        onClickButtonCancel={onClose}
      />
    </Dialog>
  );
};
