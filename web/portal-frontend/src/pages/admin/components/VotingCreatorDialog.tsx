import React from 'react';
import { Dialog, Switch, TextInput } from '@gravity-ui/uikit';
import type { VotingDraft } from '../types';

type VotingCreatorDialogProps = {
  open: boolean;
  draft: VotingDraft;
  isSaving: boolean;
  onClose: () => void;
  onChangeDraft: (patch: Partial<VotingDraft>) => void;
  onSave: () => void;
};

export const VotingCreatorDialog: React.FC<VotingCreatorDialogProps> = ({
  open,
  draft,
  isSaving,
  onClose,
  onChangeDraft,
  onSave,
}) => (
  <Dialog open={open} onClose={onClose} size="l" hasCloseButton>
    <Dialog.Header caption="Новое голосование" />
    <Dialog.Body>
      <div className="admin-detail-title-row">
        <TextInput
          size="l"
          value={draft.title}
          onChange={(event) => onChangeDraft({ title: event.target.value })}
          placeholder="Название голосования"
          autoFocus
        />
        <TextInput
          size="l"
          value={draft.code}
          onChange={(event) => onChangeDraft({ code: event.target.value })}
          placeholder="Стабильный код (slug)"
        />
      </div>
      <div className="admin-detail-subtitle">Описание</div>
      <textarea
        className="admin-editable-textarea"
        rows={3}
        value={draft.description}
        onChange={(event) => onChangeDraft({ description: event.target.value })}
        placeholder="Пара предложений о правилах и тематике."
      />
        <div className="admin-detail-controls">
          <div className="admin-game-field">
            <div className="text-muted small">Дедлайн</div>
            <TextInput
              size="m"
              type="text"
              value={draft.deadlineAt}
              onChange={(event) => onChangeDraft({ deadlineAt: event.target.value })}
              placeholder="2025-12-31T23:59"
            />
          </div>
        <div className="admin-game-field">
          <div className="text-muted small">Публикация</div>
          <Switch size="m" checked={draft.isPublished} onUpdate={(checked) => onChangeDraft({ isPublished: checked })}>
            {draft.isPublished ? 'Опубликовано' : 'Черновик'}
          </Switch>
        </div>
        <div className="admin-game-field">
          <div className="text-muted small">Активность</div>
          <Switch size="m" checked={draft.isActive} onUpdate={(checked) => onChangeDraft({ isActive: checked })}>
            {draft.isActive ? 'Открыто' : 'Архив'}
          </Switch>
        </div>
        <div className="admin-game-field">
          <div className="text-muted small">Показывать результаты</div>
          <Switch
            size="m"
            checked={draft.showVoteCounts}
            onUpdate={(checked) => onChangeDraft({ showVoteCounts: checked })}
          >
            {draft.showVoteCounts ? 'Показывать' : 'Скрывать'}
          </Switch>
          <div className="text-muted small mt-1">
            Флаг передастся в правила голосования и включит отображение счётчиков.
          </div>
        </div>
      </div>
      <div className="admin-game-field">
        <Switch size="m" checked={draft.forceReplace} onUpdate={(checked) => onChangeDraft({ forceReplace: checked })}>
          Заменить, если код уже существует
        </Switch>
      </div>
    </Dialog.Body>
    <Dialog.Footer
      textButtonCancel="Отмена"
      textButtonApply={isSaving ? 'Сохраняем...' : 'Сохранить'}
      onClickButtonApply={onSave}
      onClickButtonCancel={onClose}
      loading={isSaving}
    />
  </Dialog>
);
