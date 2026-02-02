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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-700">Название вопроса</div>
          <TextInput
            value={title}
            onUpdate={setTitle}
            placeholder="Например: Игра года"
          />
        </div>
      </div>

      <div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-700">Описание</div>
          <TextArea
            value={description}
            onUpdate={setDescription}
            rows={3}
            placeholder="Короткое пояснение или критерии"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">Тип вопроса</div>
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
        </div>

        <div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">Максимум вариантов</div>
            <TextInput
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
      </div>

      <Checkbox checked={isRequired} onUpdate={setIsRequired} content="Вопрос обязателен" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700">Варианты ответа</div>
          <Button view="flat" size="s" onClick={handleAddOption}>
            Добавить вариант
          </Button>
        </div>
        
        {options.length > 0 ? (
          <div className="space-y-4">
            {options.map((option, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <OptionForm
                  initialData={option}
                  onChange={(data) => handleOptionChange(index, data)}
                />
                <div className="mt-2 flex justify-end">
                  <Button view="flat-danger" size="s" onClick={() => handleRemoveOption(index)}>
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-sm text-gray-500">Добавьте хотя бы один вариант ответа.</p>
            <Button view="action" size="s" onClick={handleAddOption} className="mt-3">
              Добавить первый вариант
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
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
