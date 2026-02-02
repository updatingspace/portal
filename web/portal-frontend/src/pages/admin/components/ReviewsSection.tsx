import React from 'react';
import { Button, Card, Icon, TextInput } from '@gravity-ui/uikit';
import ArrowUpRightFromSquare from '@gravity-ui/icons/ArrowUpRightFromSquare';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Pencil from '@gravity-ui/icons/Pencil';
import type { ReviewMaterial } from '../types';

type ReviewsSectionProps = {
  search: string;
  onSearchChange: (value: string) => void;
  reviews: ReviewMaterial[];
  selectedReviewId: string | null;
  onSelectReview: (id: string) => void;
  onCreateReview: () => void;
  onCopyNomination: () => void;
  onEditReview: (review: ReviewMaterial) => void;
  onDeleteReview: (id: string) => void;
};

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  search,
  onSearchChange,
  reviews,
  selectedReviewId,
  onSelectReview,
  onCreateReview,
  onCopyNomination,
  onEditReview,
  onDeleteReview,
}) => (
  <div className="admin-voting-layout">
    <div className="admin-search-row admin-games-search">
      <TextInput
        size="l"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Поиск обзоров по названию, игре или автору"
        startContent={<Icon data={Magnifier} size={16} />}
        hasClear
      />
      <Button size="m" view="flat-secondary" onClick={onCreateReview}>
        Добавить обзор
      </Button>
      <Button size="m" view="outlined" onClick={onCopyNomination}>
        <Icon data={ArrowUpRightFromSquare} size={14} /> Конфиг номинации
      </Button>
    </div>
    <div className="admin-voting-grid">
      {reviews.length ? (
        reviews.map((material) => (
          <Card
            key={material.id}
            className={
              'admin-voting-card' + (selectedReviewId === material.id ? ' admin-voting-card-active' : '')
            }
            onClick={() => onSelectReview(material.id)}
          >
            <div className="admin-voting-card-top">
              <span className="admin-status admin-status-active">Материал</span>
              <span className="text-muted small">{material.gameTitle ?? 'Игра не указана'}</span>
            </div>
            <div className="admin-voting-title">{material.title}</div>
            <div className="text-muted admin-voting-desc">Авторы: {material.reviewers.join(', ') || 'Не указаны'}</div>
            <div className="admin-voting-meta">
              <span className="text-muted small">{material.link ? 'Есть ссылка' : 'Ссылка не указана'}</span>
              <div className="admin-voting-actions">
                <Button
                  size="s"
                  view="flat"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditReview(material);
                  }}
                >
                  <Icon data={Pencil} size={14} /> Редактировать
                </Button>
                <Button
                  size="s"
                  view="outlined"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteReview(material.id);
                  }}
                >
                  Удалить
                </Button>
              </div>
            </div>
          </Card>
        ))
      ) : (
        <div className="status-block status-block-warning">
          <div className="status-title">Обзоров нет</div>
          <p className="text-muted mb-0">
            Добавьте карточки обзоров и привяжите их к играм для номинации «Лучший обзор».
          </p>
        </div>
      )}
    </div>
  </div>
);
