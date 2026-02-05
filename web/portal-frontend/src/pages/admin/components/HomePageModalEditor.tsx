import React from 'react';
import {
  Button,
  Checkbox,
  Modal,
  Select,
  TextArea,
  TextInput,
} from '@gravity-ui/uikit';
import type { HomePageModal, HomePageModalInput } from '../../../api/personalization';

interface HomePageModalEditorProps {
  open: boolean;
  mode: 'create' | 'edit';
  draft: Partial<HomePageModalInput>;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChangeDraft: (patch: Partial<HomePageModalInput>) => void;
}

const modalTypeOptions = [
  { value: 'info', content: 'Информация' },
  { value: 'warning', content: 'Предупреждение' },
  { value: 'success', content: 'Успех' },
  { value: 'promo', content: 'Промо' },
];

const toInputDateTime = (value?: string | null): string => {
  if (!value) return '';
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  } catch {
    return '';
  }
};

export const HomePageModalEditor: React.FC<HomePageModalEditorProps> = ({
  open,
  mode,
  draft,
  isSaving,
  onClose,
  onSave,
  onChangeDraft,
}) => {
  const title = mode === 'create' ? 'Создать модалку' : 'Редактировать модалку';

  return (
    <Modal open={open} onClose={onClose}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">{title}</h2>
        </div>

        <div className="admin-modal-body">
          <div className="form-group">
            <label className="form-label">Заголовок *</label>
            <TextInput
              size="l"
              value={draft.title ?? ''}
              onUpdate={(value) => onChangeDraft({ title: value })}
              placeholder="Введите заголовок модалки"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Содержание *</label>
            <TextArea
              size="l"
              minRows={4}
              value={draft.content ?? ''}
              onUpdate={(value) => onChangeDraft({ content: value })}
              placeholder="Введите текст сообщения"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Текст кнопки</label>
              <TextInput
                size="l"
                value={draft.buttonText ?? 'OK'}
                onUpdate={(value) => onChangeDraft({ buttonText: value })}
                placeholder="OK"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ссылка кнопки</label>
              <TextInput
                size="l"
                value={draft.buttonUrl ?? ''}
                onUpdate={(value) => onChangeDraft({ buttonUrl: value })}
                placeholder="https://example.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Тип модалки</label>
            <Select
              size="l"
              value={[draft.modalType ?? 'info']}
              onUpdate={(value) => onChangeDraft({ modalType: value[0] as HomePageModal['modalType'] })}
              options={modalTypeOptions}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Дата начала показа</label>
              <input
                type="datetime-local"
                className="form-control"
                value={toInputDateTime(draft.startDate)}
                onChange={(e) =>
                  onChangeDraft({ startDate: e.target.value ? new Date(e.target.value).toISOString() : null })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Дата окончания показа</label>
              <input
                type="datetime-local"
                className="form-control"
                value={toInputDateTime(draft.endDate)}
                onChange={(e) =>
                  onChangeDraft({ endDate: e.target.value ? new Date(e.target.value).toISOString() : null })
                }
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Порядок показа</label>
              <TextInput
                size="l"
                type="number"
                value={String(draft.order ?? 0)}
                onUpdate={(value) => onChangeDraft({ order: Number.parseInt(value, 10) || 0 })}
              />
            </div>

            <div className="form-group">
              <Checkbox
                size="l"
                checked={draft.isActive ?? true}
                onUpdate={(checked) => onChangeDraft({ isActive: checked })}
              >
                Активна
              </Checkbox>
            </div>
          </div>

          <div className="form-group">
            <Checkbox
              size="l"
              checked={draft.displayOnce ?? false}
              onUpdate={(checked) => onChangeDraft({ displayOnce: checked })}
            >
              Показать только один раз (для каждого пользователя)
            </Checkbox>
          </div>
        </div>

        <div className="admin-modal-footer">
          <Button view="flat" size="l" onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button view="action" size="l" onClick={onSave} disabled={isSaving} loading={isSaving}>
            {mode === 'create' ? 'Создать' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
