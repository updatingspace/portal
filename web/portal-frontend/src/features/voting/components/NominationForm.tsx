import React, { useState } from 'react';
import { Button, Checkbox, Select, TextArea, TextInput } from '@gravity-ui/uikit';
import type { NominationCreatePayload, NominationUpdatePayload, NominationKind, OptionCreatePayload } from '../types';
import { OptionForm } from './OptionForm';

interface NominationFormProps {
  initialData?: Partial<NominationCreatePayload>;
  onSubmit: (data: NominationCreatePayload | NominationUpdatePayload) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export const NominationForm: React.FC<NominationFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Save Nomination',
}) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [kind, setKind] = useState<NominationKind>(initialData.kind || 'custom');
  const [maxVotes, setMaxVotes] = useState(initialData.max_votes || 1);
  const [isRequired, setIsRequired] = useState(initialData.is_required ?? false);
  const [options, setOptions] = useState<OptionCreatePayload[]>(initialData.options || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: NominationCreatePayload | NominationUpdatePayload = {
      title,
      description: description || undefined,
      kind,
      max_votes: maxVotes,
      is_required: isRequired,
      options: options.length > 0 ? options : undefined,
    };
    
    onSubmit(payload);
  };

  const handleOptionChange = (index: number, option: OptionCreatePayload) => {
    const newOptions = [...options];
    newOptions[index] = option;
    setOptions(newOptions);
  };

  const handleAddOption = () => {
    setOptions([...options, { title: '' }]);
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  return (
    <form onSubmit={handleSubmit} className="voting-form">
      <div>
        <label className="voting-form__label" htmlFor="nomination-title">Название вопроса</label>
          <TextInput
            id="nomination-title"
            value={title}
            onUpdate={setTitle}
            placeholder="Например: Игра года"
          />
      </div>

      <div>
        <label className="voting-form__label" htmlFor="nomination-description">Описание</label>
          <TextArea
            id="nomination-description"
            value={description}
            onUpdate={setDescription}
            rows={3}
            placeholder="Короткое пояснение или критерии"
          />
      </div>

      <div className="voting-form__grid">
        <div>
          <label className="voting-form__label">Тип вопроса</label>
            <Select
              value={[kind]}
              onUpdate={(value) => setKind((value[0] ?? 'custom') as NominationKind)}
              options={[
                { value: 'game', content: 'Игра' },
                { value: 'review', content: 'Отзыв' },
                { value: 'person', content: 'Персона' },
                { value: 'custom', content: 'Свой вариант' },
              ]}
            />
        </div>

        <div>
          <label className="voting-form__label" htmlFor="nomination-max-votes">Максимум вариантов</label>
            <TextInput
              id="nomination-max-votes"
              type="number"
              value={String(maxVotes)}
              controlProps={{ min: 1 }}
              onUpdate={(value) => {
                const parsed = Number.parseInt(value, 10);
                setMaxVotes(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
              }}
            />
        </div>
      </div>

      <Checkbox checked={isRequired} onUpdate={setIsRequired} content="Вопрос обязателен" />

      <div>
        <div className="voting-v2__toolbar">
          <div className="voting-form__label">Варианты ответа</div>
          <Button view="flat" size="s" onClick={handleAddOption}>
            Добавить вариант
          </Button>
        </div>
        
        {options.length > 0 ? (
          <div className="voting-v2__grid">
            {options.map((option, index) => (
              <div key={index} className="voting-v2__card">
                <OptionForm
                  initialData={option}
                  onChange={(data) => handleOptionChange(index, data)}
                />
                <div className="voting-form__actions">
                  <Button view="flat-danger" size="s" onClick={() => handleRemoveOption(index)}>
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="voting-v2__card voting-v2__state-card">
            <p className="voting-v2__muted">Добавьте хотя бы один вариант ответа.</p>
            <Button view="action" size="s" onClick={handleAddOption}>
              Добавить первый вариант
            </Button>
          </div>
        )}
      </div>

      <div className="voting-form__actions">
        <Button view="outlined" onClick={onCancel} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button view="action" type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
