import React from 'react';
import { Button, Card, Dialog, Loader, Select, TextInput } from '@gravity-ui/uikit';
import type { Game } from '../../../types/games';
import type { NominationDraft, OptionDraft, ReviewerProfile } from '../types';

type NominationEditorDialogProps = {
  open: boolean;
  loading: boolean;
  nominationDraft: NominationDraft | null;
  games: Game[];
  reviewers: ReviewerProfile[];
  isSaving: boolean;
  onClose: () => void;
  onChangeDraft: (patch: Partial<NominationDraft>) => void;
  onAddOption: () => void;
  onUpdateOption: (index: number, patch: Partial<OptionDraft>) => void;
  onRemoveOption: (index: number) => void;
  onSave: () => void;
};

export const NominationEditorDialog: React.FC<NominationEditorDialogProps> = ({
  open,
  loading,
  nominationDraft,
  games,
  reviewers,
  isSaving,
  onClose,
  onChangeDraft,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onSave,
}) => (
  <Dialog open={open} onClose={onClose} size="l" hasCloseButton>
    <Dialog.Header caption="Редактирование номинации" />
    <Dialog.Body>
      {loading || !nominationDraft ? (
        <div className="admin-loader-box">
          <Loader size="m" />
          <div className="text-muted small">Загружаем номинацию...</div>
        </div>
      ) : (
        <>
          <div className="admin-detail-title-row">
            <TextInput
              size="l"
              value={nominationDraft.title}
              onChange={(event) => onChangeDraft({ title: event.target.value })}
              placeholder="Название номинации"
            />
            <Select
              size="l"
              placeholder="Тип"
              value={[nominationDraft.kind]}
              onUpdate={(value) => onChangeDraft({ kind: value[0] ?? 'game' })}
              options={[
                { value: 'game', content: 'Игры' },
                { value: 'person', content: 'Обзорщики' },
                { value: 'review', content: 'Обзоры' },
                { value: 'custom', content: 'Произвольное' },
              ]}
            />
          </div>
          <div className="admin-detail-subtitle">Описание</div>
          <textarea
            className="admin-editable-textarea"
            rows={3}
            value={nominationDraft.description}
            onChange={(event) => onChangeDraft({ description: event.target.value })}
            placeholder="Кратко о критериях номинации."
          />
          <div className="admin-detail-subtitle">Пункты номинации ({nominationDraft.options.length})</div>
          <div className="admin-voting-grid">
            {nominationDraft.options.map((option, index) => {
              const kind = nominationDraft.kind;
              return (
                <Card key={option.id} className="admin-voting-card">
                  <div className="admin-voting-card-top">
                    <span className="admin-status admin-status-active">Пункт</span>
                    <span className="text-muted small">#{index + 1}</span>
                  </div>
                  <div className="admin-voting-title">
                    <TextInput
                      size="m"
                      value={option.title}
                      onChange={(event) => onUpdateOption(index, { title: event.target.value })}
                      placeholder="Название пункта"
                    />
                  </div>
                  <div className="admin-game-grid">
                    <div className="admin-game-field">
                      <div className="text-muted small">Связанная игра</div>
                      <select
                        className="admin-select"
                        value={option.gameId ?? ''}
                        onChange={(event) =>
                          onUpdateOption(index, {
                            gameId: event.target.value || null,
                          })
                        }
                      >
                        <option value="">Не выбрана</option>
                        {games.map((game) => (
                          <option key={game.id} value={game.id}>
                            {game.title}
                          </option>
                        ))}
                      </select>
                      <div className="text-muted tiny mt-1">
                        Выберите из каталога или добавьте игру во вкладке «Игры».
                      </div>
                    </div>
                    <div className="admin-game-field">
                      <div className="text-muted small">Обложка (URL)</div>
                      <TextInput
                        size="m"
                        value={option.imageUrl}
                        onChange={(event) => onUpdateOption(index, { imageUrl: event.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  {kind === 'person' ? (
                    <div className="admin-game-grid">
                      <div className="admin-game-field">
                        <div className="text-muted small">Роль</div>
                        <TextInput
                          size="m"
                          value={(option.payload.role as string) ?? ''}
                          onChange={(event) =>
                            onUpdateOption(index, {
                              payload: { ...option.payload, role: event.target.value },
                            })
                          }
                          placeholder="обзорщик, редактор"
                        />
                      </div>
                      <div className="admin-game-field">
                        <div className="text-muted small">Ссылки (через запятую)</div>
                        <TextInput
                          size="m"
                          value={(option.payload.links as string) ?? ''}
                          onChange={(event) =>
                            onUpdateOption(index, {
                              payload: { ...option.payload, links: event.target.value },
                            })
                          }
                          placeholder="https://youtube.com/..., https://t.me/..."
                        />
                      </div>
                      <div className="admin-game-field">
                        <div className="text-muted small">Обзорщики (из списка)</div>
                        <Select
                          size="m"
                          multiple
                          filterable
                          placeholder="Выберите обзорщиков"
                          value={(option.payload.reviewers as string[] | undefined) ?? []}
                          onUpdate={(value) =>
                            onUpdateOption(index, {
                              payload: { ...option.payload, reviewers: value },
                            })
                          }
                          options={reviewers.map((reviewer) => ({
                            value: reviewer.id,
                            content: reviewer.name,
                          }))}
                        />
                      </div>
                    </div>
                  ) : null}
                  {kind === 'review' ? (
                    <div className="admin-game-grid">
                      <div className="admin-game-field">
                        <div className="text-muted small">Авторы обзора (из списка)</div>
                        <Select
                          size="m"
                          multiple
                          filterable
                          placeholder="Выберите обзорщиков"
                          value={(option.payload.reviewers as string[] | undefined) ?? []}
                          onUpdate={(value) =>
                            onUpdateOption(index, {
                              payload: { ...option.payload, reviewers: value },
                            })
                          }
                          options={reviewers.map((reviewer) => ({
                            value: reviewer.id,
                            content: reviewer.name,
                          }))}
                        />
                      </div>
                      <div className="admin-game-field">
                        <div className="text-muted small">Игры в обзоре (через запятую)</div>
                        <TextInput
                          size="m"
                          value={(option.payload.games as string) ?? ''}
                          onChange={(event) =>
                            onUpdateOption(index, {
                              payload: { ...option.payload, games: event.target.value },
                            })
                          }
                          placeholder="Silent Hill 2, Dying Light 2"
                        />
                      </div>
                      <div className="admin-game-field">
                        <div className="text-muted small">Ссылка на видео/текст</div>
                        <TextInput
                          size="m"
                          value={(option.payload.link as string) ?? ''}
                          onChange={(event) =>
                            onUpdateOption(index, {
                              payload: { ...option.payload, link: event.target.value },
                            })
                          }
                          placeholder="https://youtube.com/..."
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="admin-voting-actions mt-2">
                    <Button size="s" view="outlined" onClick={() => onRemoveOption(index)}>
                      Удалить пункт
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="admin-detail-actions">
            <Button size="m" view="flat-secondary" onClick={onAddOption}>
              Добавить пункт
            </Button>
          </div>
        </>
      )}
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
