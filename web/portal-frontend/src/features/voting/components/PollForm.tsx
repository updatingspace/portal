import React, { useState } from 'react';
import { Button, Checkbox, Select, TextArea, TextInput } from '@gravity-ui/uikit';
import type {
  PollCreatePayload,
  PollUpdatePayload,
  PollTemplate,
  PollVisibility,
  ResultsVisibility,
  PollScopeType,
} from '../types';
import { ScheduleForm } from './ScheduleForm';

interface PollFormProps {
  initialData?: Partial<PollCreatePayload>;
  templates?: PollTemplate[];
  onSubmit: (data: PollCreatePayload | PollUpdatePayload) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export const PollForm: React.FC<PollFormProps> = ({
  initialData = {},
  templates = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Save Poll',
}) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [scopeType, setScopeType] = useState<PollScopeType>(initialData.scope_type || 'TENANT');
  const [scopeId, setScopeId] = useState(initialData.scope_id || '');
  const [visibility, setVisibility] = useState<PollVisibility>(initialData.visibility || 'public');
  const [allowRevoting, setAllowRevoting] = useState(initialData.allow_revoting ?? false);
  const [anonymous, setAnonymous] = useState(initialData.anonymous ?? false);
  const [resultsVisibility, setResultsVisibility] = useState<ResultsVisibility>(
    initialData.results_visibility || 'after_closed',
  );
  const [template, setTemplate] = useState(initialData.template || '');
  const [startsAt, setStartsAt] = useState<string | null>(initialData.starts_at || null);
  const [endsAt, setEndsAt] = useState<string | null>(initialData.ends_at || null);

  const scopeIdRequired = scopeType !== 'TENANT';
  const scopeIdValid = !scopeIdRequired || Boolean(scopeId.trim());

  const scopeOptions = [
    { value: 'TENANT', content: 'Тенант' },
    { value: 'COMMUNITY', content: 'Сообщество' },
    { value: 'TEAM', content: 'Команда' },
    { value: 'EVENT', content: 'Событие' },
    { value: 'POST', content: 'Пост' },
  ];

  const visibilityOptions: Array<{ value: PollVisibility; content: string; disabled?: boolean }> = [
    { value: 'public', content: 'Публичный' },
    { value: 'community', content: 'Сообщество', disabled: scopeType !== 'COMMUNITY' },
    { value: 'team', content: 'Команда', disabled: scopeType !== 'TEAM' },
    { value: 'private', content: 'Приватный' },
  ];

  const resultsOptions = [
    { value: 'always', content: 'Всегда доступны' },
    { value: 'after_closed', content: 'После закрытия' },
    { value: 'admins_only', content: 'Только администраторам' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!scopeIdValid) return;

    const payload: PollCreatePayload | PollUpdatePayload = {
      title,
      description: description || undefined,
      scope_type: scopeType,
      scope_id: scopeType === 'TENANT' ? undefined : scopeId || undefined,
      visibility,
      allow_revoting: allowRevoting,
      anonymous,
      results_visibility: resultsVisibility,
      template: template || undefined,
      starts_at: startsAt,
      ends_at: endsAt,
    };

    onSubmit(payload);
  };

  const handleScheduleUpdate = (payload: { starts_at: string | null; ends_at: string | null }) => {
    setStartsAt(payload.starts_at);
    setEndsAt(payload.ends_at);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-700">Название</div>
          <TextInput
            value={title}
            onUpdate={setTitle}
            placeholder="Например: Лучшие проекты года"
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
            placeholder="Контекст, правила или призы"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">Область опроса</div>
            <Select
              value={[scopeType]}
              onUpdate={(value) => {
                const next = (value[0] ?? 'TENANT') as PollScopeType;
                setScopeType(next);

                if (next === 'TENANT') setScopeId('');

                if (next !== 'COMMUNITY' && visibility === 'community') setVisibility('public');
                if (next !== 'TEAM' && visibility === 'team') setVisibility('public');
              }}
              options={scopeOptions}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Область определяет, где проверяются права доступа.</p>
        </div>

        <div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">
              {`ID области ${scopeType === 'TENANT' ? '(необязательно)' : '*'}`}
            </div>
            <TextInput
              value={scopeId}
              onUpdate={setScopeId}
              disabled={scopeType === 'TENANT'}
              placeholder={
                scopeType === 'TENANT'
                  ? 'Берётся из текущего тенанта'
                  : 'UUID сообщества / команды / события'
              }
            />
          </div>
          {scopeType !== 'TENANT' && !scopeId.trim() ? (
            <p className="mt-1 text-xs text-amber-600">Для выбранной области нужен ID.</p>
          ) : null}
        </div>

        <div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">Видимость</div>
            <Select
              value={[visibility]}
              onUpdate={(value) => setVisibility((value[0] ?? 'public') as PollVisibility)}
              options={visibilityOptions}
            />
          </div>
          {(scopeType !== 'COMMUNITY' && visibility === 'community') ||
          (scopeType !== 'TEAM' && visibility === 'team') ? (
            <p className="mt-1 text-xs text-amber-600">
              Для корректной видимости выберите соответствующую область.
            </p>
          ) : null}
        </div>

        <div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">Доступ к результатам</div>
            <Select
              value={[resultsVisibility]}
              onUpdate={(value) =>
                setResultsVisibility((value[0] ?? 'after_closed') as ResultsVisibility)
              }
              options={resultsOptions}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Checkbox
          checked={allowRevoting}
          onUpdate={setAllowRevoting}
          content="Разрешить переголосование"
        />

        <Checkbox checked={anonymous} onUpdate={setAnonymous} content="Анонимное голосование" />
      </div>

      {templates.length > 0 ? (
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-700">Шаблон</div>
          <Select
            value={[template || '']}
            onUpdate={(value) => setTemplate(value[0] ?? '')}
            options={[
              { value: '', content: 'Без шаблона' },
              ...templates.map((t) => ({ value: t.slug, content: t.title })),
            ]}
          />
        </div>
      ) : null}

      <div>
        <div className="text-sm font-medium text-gray-700 mb-1">Расписание</div>
        <ScheduleForm
          initialStartsAt={startsAt}
          initialEndsAt={endsAt}
          onUpdate={handleScheduleUpdate}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button view="outlined" onClick={onCancel} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button
          view="action"
          type="submit"
          disabled={isSubmitting || !scopeIdValid}
          loading={isSubmitting}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
