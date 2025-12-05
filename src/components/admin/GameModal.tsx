import React from 'react';
import { Dialog, TextInput } from '@gravity-ui/uikit';

import type { Game } from '../../types/games';

type GameDraftField = 'title' | 'genre' | 'studio' | 'releaseYear' | 'description' | 'imageUrl';

type GameModalProps = {
  open: boolean;
  mode: 'edit' | 'create';
  game: Game | null;
  draft: {
    title: string;
    genre: string;
    studio: string;
    releaseYear: string;
    description: string;
    imageUrl: string;
  };
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onReset: () => void;
  onDraftChange: (field: GameDraftField, value: string) => void;
};

export const GameModal: React.FC<GameModalProps> = ({
  open,
  mode,
  draft,
  game,
  isSaving,
  onClose,
  onSave,
  onReset,
  onDraftChange,
}) => (
  <Dialog open={open} onClose={onClose} size="l" hasCloseButton>
    <Dialog.Header caption={mode === 'create' ? 'Добавить игру' : 'Редактирование игры'} />
    <Dialog.Body>
      <div className="admin-detail-title-row">
        <TextInput
          size="l"
          value={draft.title}
          onChange={(event) => onDraftChange('title', event.target.value)}
          placeholder="Название игры"
          autoFocus
        />
        {game && (
          <span className="text-muted small">
            ID: <code>{game.id}</code>
          </span>
        )}
      </div>
      <div className="admin-game-grid">
        <div className="admin-game-field">
          <div className="text-muted small">Студия</div>
          <TextInput
            size="m"
            value={draft.studio}
            onChange={(event) => onDraftChange('studio', event.target.value)}
            placeholder="Студия или разработчик"
          />
        </div>
        <div className="admin-game-field">
          <div className="text-muted small">Жанр</div>
          <TextInput
            size="m"
            value={draft.genre}
            onChange={(event) => onDraftChange('genre', event.target.value)}
            placeholder="Жанровая принадлежность"
          />
        </div>
        <div className="admin-game-field">
          <div className="text-muted small">Год выпуска</div>
          <TextInput
            size="m"
            type="number"
            value={draft.releaseYear}
            onChange={(event) => onDraftChange('releaseYear', event.target.value)}
            placeholder="2025"
          />
        </div>
        <div className="admin-game-field">
          <div className="text-muted small">Ссылка на обложку</div>
          <TextInput
            size="m"
            value={draft.imageUrl}
            onChange={(event) => onDraftChange('imageUrl', event.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>
      <div className="admin-detail-subtitle">Описание и заметки</div>
      <textarea
        className="admin-editable-textarea"
        rows={4}
        value={draft.description}
        onChange={(event) => onDraftChange('description', event.target.value)}
        placeholder="Краткое описание игры: платформа, особенности, настроение."
      />
    </Dialog.Body>
    <Dialog.Footer
      textButtonCancel="Отмена"
      textButtonApply={isSaving ? 'Сохраняем...' : mode === 'create' ? 'Добавить' : 'Сохранить'}
      onClickButtonApply={onSave}
      onClickButtonCancel={() => {
        onClose();
        onReset();
      }}
      loading={isSaving}
    />
  </Dialog>
);
