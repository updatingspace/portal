import React from 'react';
import { Button, Card, Icon } from '@gravity-ui/uikit';
import Pencil from '@gravity-ui/icons/Pencil';

import type { Nomination } from '../../data/nominations';

type PreviewPanelProps = {
  nomination: Nomination | null;
  isLoading: boolean;
  onOpenDialog: () => void;
};

export const NominationPreviewPanel: React.FC<PreviewPanelProps> = ({
  nomination,
  isLoading,
  onOpenDialog,
}) => {
  if (isLoading) {
    return (
      <div className="status-block status-block-info">
        <div className="status-title">Загружаем карточки...</div>
      </div>
    );
  }

  if (!nomination) {
    return (
      <div className="status-block status-block-warning">
        <div className="status-title">Выберите номинацию</div>
        <p className="text-muted mb-0">Нажмите «Просмотр», чтобы увидеть игровые карточки.</p>
      </div>
    );
  }

  return (
    <div className="nomination-preview-panel">
      <div className="nomination-preview-header">
        <div>
          <h3 className="nomination-preview-title">{nomination.title}</h3>
          <p className="text-muted small">
            {(nomination.status ?? (nomination.isVotingOpen ?? nomination.voting?.isActive) ?? false)
              ? 'Активная номинация'
              : 'Архивная номинация'}
          </p>
        </div>
        <Button size="s" view="outlined" onClick={onOpenDialog}>
          <Icon data={Pencil} size={12} /> Подробнее
        </Button>
      </div>
      <div className="option-grid option-grid-roomy nomination-preview-grid">
        {nomination.options.map((option) => (
          <Card key={option.id} className="option-card">
            <div className="option-card-cover">
              {option.imageUrl ? (
                <img
                  src={option.imageUrl}
                  alt={`Обложка игры ${option.title}`}
                  className="option-card-cover-img"
                />
              ) : (
                <div className="option-card-cover-placeholder">
                  <span className="option-card-cover-accent">Кадр игры</span>
                  <span className="option-card-cover-note">
                    Добавьте ссылку на изображение через редактирование игры.
                  </span>
                </div>
              )}
              <div className="option-card-overlay">
                <span className="option-card-overlay-text">
                  {option.game?.genre ? `Жанр: ${option.game.genre}` : 'Жанр - ?'}
                </span>
              </div>
            </div>
              <div className="option-card-footer">
                <div className="option-card-header">
                  <div className="option-card-title">{option.title}</div>
                  <div className="option-card-votes text-muted">
                    Голосов:{' '}
                    {(() => {
                      const voteCount = option.counts
                        ? Object.values(option.counts).reduce((sum, value) => sum + value, 0)
                        : nomination.counts?.[option.id] ?? null;
                      return typeof voteCount === 'number' ? voteCount : '—';
                    })()}
                  </div>
                </div>
                <div className="option-card-subtitle text-muted">
                  {option.game?.studio ?? option.game?.genre ?? 'Информация о студии и жанре не заполнена'}
                </div>
                <div className="option-card-description text-muted">
                  {option.game?.description ?? 'Описание игры пока не добавлено.'}
                </div>
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
};
