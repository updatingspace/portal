import React from 'react';
import { Dialog, TextInput } from '@gravity-ui/uikit';
import type { ReviewDraft } from '../types';

type ReviewModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  draft: ReviewDraft;
  selectedReviewId: string | null;
  onClose: () => void;
  onSave: () => void;
  onChangeDraft: (patch: Partial<ReviewDraft>) => void;
  onReset: () => void;
};

export const ReviewModal: React.FC<ReviewModalProps> = ({
  open,
  mode,
  draft,
  selectedReviewId,
  onClose,
  onSave,
  onChangeDraft,
  onReset,
}) => (
  <Dialog open={open} onClose={onClose} size="l" hasCloseButton>
    <Dialog.Header caption={mode === 'create' ? 'Добавить обзор' : 'Редактировать обзор'} />
    <Dialog.Body>
      <div className="admin-detail-title-row">
        <TextInput
          size="l"
          value={draft.title}
          onChange={(event) => onChangeDraft({ title: event.target.value })}
          placeholder="Название обзора"
          autoFocus
        />
        {selectedReviewId && (
          <span className="text-muted small">
            ID: <code>{selectedReviewId}</code>
          </span>
        )}
      </div>
      <div className="admin-game-grid">
        <div className="admin-game-field">
          <div className="text-muted small">Авторы (через запятую)</div>
          <TextInput
            size="m"
            value={draft.reviewers}
            onChange={(event) => onChangeDraft({ reviewers: event.target.value })}
            placeholder="AlGumer, UncleHayter"
          />
        </div>
        <div className="admin-game-field">
          <div className="text-muted small">Игра</div>
          <TextInput
            size="m"
            value={draft.gameTitle}
            onChange={(event) => onChangeDraft({ gameTitle: event.target.value })}
            placeholder="Какую игру/материал разбираем"
          />
        </div>
        <div className="admin-game-field">
          <div className="text-muted small">Ссылка</div>
          <TextInput
            size="m"
            value={draft.link}
            onChange={(event) => onChangeDraft({ link: event.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>
      <div className="admin-detail-subtitle">Описание обзора</div>
      <textarea
        className="admin-editable-textarea"
        rows={3}
        value={draft.summary}
        onChange={(event) => onChangeDraft({ summary: event.target.value })}
        placeholder="Коротко об обзоре: чем зацепил, формат, длительность."
      />
    </Dialog.Body>
    <Dialog.Footer
      textButtonCancel="Отмена"
      textButtonApply={mode === 'create' ? 'Добавить' : 'Сохранить'}
      onClickButtonApply={onSave}
      onClickButtonCancel={() => {
        onClose();
        onReset();
      }}
    />
  </Dialog>
);
