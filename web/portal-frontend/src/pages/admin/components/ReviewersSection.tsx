import React from 'react';
import { Button, Card, Icon, TextInput } from '@gravity-ui/uikit';
import ArrowUpRightFromSquare from '@gravity-ui/icons/ArrowUpRightFromSquare';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Pencil from '@gravity-ui/icons/Pencil';
import type { ReviewerProfile } from '../types';

type ReviewersSectionProps = {
  search: string;
  onSearchChange: (value: string) => void;
  reviewers: ReviewerProfile[];
  selectedReviewerId: string | null;
  onSelectReviewer: (id: string) => void;
  onCreateReviewer: () => void;
  onCopyNomination: () => void;
  onEditReviewer: (profile: ReviewerProfile) => void;
  onDeleteReviewer: (id: string) => void;
};

export const ReviewersSection: React.FC<ReviewersSectionProps> = ({
  search,
  onSearchChange,
  reviewers,
  selectedReviewerId,
  onSelectReviewer,
  onCreateReviewer,
  onCopyNomination,
  onEditReviewer,
  onDeleteReviewer,
}) => (
  <div className="admin-voting-layout">
    <div className="admin-search-row admin-games-search">
      <TextInput
        size="l"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Поиск обзорщиков и кураторов"
        startContent={<Icon data={Magnifier} size={16} />}
        hasClear
      />
      <Button size="m" view="flat-secondary" onClick={onCreateReviewer}>
        Добавить обзорщика
      </Button>
      <Button size="m" view="outlined" onClick={onCopyNomination}>
        <Icon data={ArrowUpRightFromSquare} size={14} /> Конфиг номинации
      </Button>
    </div>
    <div className="admin-voting-grid">
      {reviewers.length ? (
        reviewers.map((reviewer) => (
          <Card
            key={reviewer.id}
            className={
              'admin-voting-card' + (selectedReviewerId === reviewer.id ? ' admin-voting-card-active' : '')
            }
            onClick={() => onSelectReviewer(reviewer.id)}
          >
            <div className="admin-voting-card-top">
              <span className="admin-status admin-status-active">Активен</span>
              <span className="text-muted small">
                {reviewer.tags?.length ? reviewer.tags.join(', ') : 'обзорщик'}
              </span>
            </div>
            <div className="admin-voting-title">{reviewer.name}</div>
            <div className="text-muted admin-voting-desc">
              {reviewer.bio || 'Добавьте заметку или ссылку на портфолио.'}
            </div>
            <div className="admin-voting-meta">
              <span className="text-muted small">Ссылок: {reviewer.links.length || '—'}</span>
              <div className="admin-voting-actions">
                <Button
                  size="s"
                  view="flat"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditReviewer(reviewer);
                  }}
                >
                  <Icon data={Pencil} size={14} /> Редактировать
                </Button>
                <Button
                  size="s"
                  view="outlined"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteReviewer(reviewer.id);
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
          <div className="status-title">Обзорщики не найдены</div>
          <p className="text-muted mb-0">
            Добавьте запись через форму, чтобы собрать номинацию «Лучший обзорщик».
          </p>
        </div>
      )}
    </div>
  </div>
);
