import React from 'react';
import { Dialog, TextInput } from '@gravity-ui/uikit';
import type { ReviewerDraft } from '../types';

type ReviewerModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  draft: ReviewerDraft;
  selectedReviewerId: string | null;
  onClose: () => void;
  onSave: () => void;
  onChangeDraft: (patch: Partial<ReviewerDraft>) => void;
  onReset: () => void;
};

export const ReviewerModal: React.FC<ReviewerModalProps> = ({
  open,
  mode,
  draft,
  selectedReviewerId,
  onClose,
  onSave,
  onChangeDraft,
  onReset,
}) => (
  <Dialog open={open} onClose={onClose} size="l" hasCloseButton>
    <Dialog.Header caption={mode === 'create' ? 'Добавить обзорщика' : 'Редактировать обзорщика'} />
    <Dialog.Body>
      <div className="admin-detail-title-row">
        <TextInput
          size="l"
          value={draft.name}
          onChange={(event) => onChangeDraft({ name: event.target.value })}
          placeholder="Имя или никнейм обзорщика"
          autoFocus
        />
        {selectedReviewerId && (
          <span className="text-muted small">
            ID: <code>{selectedReviewerId}</code>
          </span>
        )}
      </div>
      <div className="admin-detail-subtitle">Описание и ссылки</div>
      <textarea
        className="admin-editable-textarea"
        rows={3}
        value={draft.bio}
        onChange={(event) => onChangeDraft({ bio: event.target.value })}
        placeholder="Краткое описание, формат контента, профиль."
      />
      <div className="admin-game-grid">
        <div className="admin-game-field">
          <div className="text-muted small">Ссылки (через запятую)</div>
          <TextInput
            size="m"
            value={draft.links}
            onChange={(event) => onChangeDraft({ links: event.target.value })}
            placeholder="https://youtube.com/..., https://t.me/..."
          />
        </div>
        <div className="admin-game-field">
          <div className="text-muted small">Теги/роли</div>
          <TextInput
            size="m"
            value={draft.tags}
            onChange={(event) => onChangeDraft({ tags: event.target.value })}
            placeholder="обзорщик, автор, подкастер"
          />
        </div>
      </div>
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
