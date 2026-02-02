import React from 'react';
import { Card, Dialog, Loader } from '@gravity-ui/uikit';

import type { Nomination } from '../../data/nominations';

const normalizeList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

const buildOptionMeta = (nomination: Nomination, option: Nomination['options'][number]) => {
  const kind = nomination.kind ?? 'game';
  const payload = (option.payload ?? {}) as Record<string, unknown>;
  const reviewers = normalizeList(payload.reviewers);
  const reviewerName = typeof payload.reviewer === 'string' ? payload.reviewer : '';
  const games = normalizeList(payload.games);
  const link = typeof payload.link === 'string' ? payload.link : null;
  const summary = typeof payload.summary === 'string' ? payload.summary : null;
  const role = typeof payload.role === 'string' ? payload.role : null;
  const coverLabel =
    kind === 'person'
      ? 'Портрет автора'
      : kind === 'review'
        ? 'Обложка обзора'
        : 'Кадр игры';

  if (kind === 'person') {
    return {
      coverLabel,
      overlay: role ? `Роль: ${role}` : 'Обзорщик',
      subtitle: reviewerName || reviewers.join(', ') || option.title,
      description:
        normalizeList(payload.links).join(', ') || 'Добавьте ссылки или краткую заметку.',
    };
  }

  if (kind === 'review') {
    const reviewerList = reviewers.length ? reviewers : reviewerName ? [reviewerName] : [];
    return {
      coverLabel,
      overlay: games.join(', ') || option.game?.title || 'Игра не указана',
      subtitle: reviewerList.join(', ') || 'Автор не указан',
      description: link || summary || 'Добавьте ссылку на обзор или краткое описание.',
    };
  }

  return {
    coverLabel,
    overlay: option.game?.genre ? `Жанр: ${option.game.genre}` : 'Жанр - ?',
    subtitle: option.game?.studio ?? option.game?.genre ?? 'Жанр не указан',
    description: option.game?.description ?? 'Описание игры пока не добавлено.',
  };
};

type PreviewDialogProps = {
  open: boolean;
  nomination: Nomination | null;
  onClose: () => void;
  isLoading: boolean;
};

export const NominationPreviewDialog: React.FC<PreviewDialogProps> = ({
  open,
  nomination,
  onClose,
  isLoading,
}) => (
  <Dialog open={open} onClose={onClose} size="l" hasCloseButton>
    <Dialog.Header caption="Предпросмотр карточки игры" />
    <Dialog.Body>
      {isLoading || !nomination ? (
        <div className="admin-loader-box">
          <Loader size="m" />
          <div className="text-muted small">Загружаем карточки...</div>
        </div>
      ) : (
        <div className="option-grid-roomy">
          {nomination.options.map((option) => {
            const meta = buildOptionMeta(nomination, option);
            return (
              <Card key={option.id} className="option-card">
                <div className="option-card-cover">
                  {option.imageUrl ? (
                    <img
                      src={option.imageUrl}
                      alt={`Обложка карточки ${option.title}`}
                      className="option-card-cover-img"
                    />
                  ) : (
                  <div className="option-card-cover-placeholder">
                    <span className="option-card-cover-accent">{meta.coverLabel}</span>
                    <span className="option-card-cover-note">
                      Используйте ссылку в редакторе, чтобы добавить изображение.
                    </span>
                  </div>
                )}
                <div className="option-card-overlay">
                  <div className="option-card-overlay-text">
                    {meta.overlay}
                  </div>
                </div>
              </div>
              <div className="option-card-footer">
                <div className="option-card-header">
                  <div className="option-card-title">{option.title}</div>
                  <div className="option-card-votes text-muted">
                    Тип: {nomination.kind ?? 'game'}
                  </div>
                </div>
                <div className="option-card-subtitle text-muted">
                  {meta.subtitle}
                </div>
                <div className="option-card-description text-muted">{meta.description}</div>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </Dialog.Body>
  </Dialog>
);
