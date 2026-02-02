import React from 'react';
import { Button, Card, Icon } from '@gravity-ui/uikit';
import Pencil from '@gravity-ui/icons/Pencil';

import type { Nomination } from '../../data/nominations';

type PreviewPanelProps = {
  nomination: Nomination | null;
  isLoading: boolean;
  onOpenDialog: () => void;
};

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
    subtitle: option.game?.studio ?? option.game?.genre ?? 'Информация не заполнена',
    description: option.game?.description ?? 'Описание игры пока не добавлено.',
  };
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
        {nomination.options.map((option) => {
          const meta = buildOptionMeta(nomination, option);
          const voteCount = option.counts
            ? Object.values(option.counts).reduce((sum, value) => sum + value, 0)
            : nomination.counts?.[option.id] ?? null;
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
                    Добавьте ссылку на изображение для лучшей витрины.
                  </span>
                </div>
              )}
              <div className="option-card-overlay">
                <span className="option-card-overlay-text">{meta.overlay}</span>
              </div>
            </div>
              <div className="option-card-footer">
                <div className="option-card-header">
                  <div className="option-card-title">{option.title}</div>
                  <div className="option-card-votes text-muted">
                    Голосов: {typeof voteCount === 'number' ? voteCount : '—'}
                  </div>
                </div>
                <div className="option-card-subtitle text-muted">
                  {meta.subtitle}
                </div>
                <div className="option-card-description text-muted">
                  {meta.description}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
