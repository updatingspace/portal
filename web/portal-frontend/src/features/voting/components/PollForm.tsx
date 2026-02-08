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
    <form onSubmit={handleSubmit} className="voting-form">
      <div>
        <label className="voting-form__label" htmlFor="poll-form-title">Название</label>
          <TextInput
            id="poll-form-title"
            value={title}
            onUpdate={setTitle}
            placeholder="Например: Лучшие проекты года"
          />
      </div>

      <div>
        <label className="voting-form__label" htmlFor="poll-form-description">Описание</label>
          <TextArea
            id="poll-form-description"
            value={description}
            onUpdate={setDescription}
            rows={3}
            placeholder="Контекст, правила или призы"
          />
      </div>

      <div className="voting-form__grid">
        <div>
          <label className="voting-form__label">Область опроса</label>
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
          <p className="voting-v2__small voting-v2__muted">Область определяет, где проверяются права доступа.</p>
        </div>

        <div>
          <label className="voting-form__label" htmlFor="poll-form-scope-id">
              {`ID области ${scopeType === 'TENANT' ? '(необязательно)' : '*'}`}
          </label>
            <TextInput
              id="poll-form-scope-id"
              value={scopeId}
              onUpdate={setScopeId}
              disabled={scopeType === 'TENANT'}
              placeholder={
                scopeType === 'TENANT'
                  ? 'Берётся из текущего тенанта'
                  : 'UUID сообщества / команды / события'
              }
            />
          {scopeType !== 'TENANT' && !scopeId.trim() ? (
            <p className="voting-v2__small">Для выбранной области нужен ID.</p>
          ) : null}
        </div>

        <div>
          <label className="voting-form__label">Видимость</label>
            <Select
              value={[visibility]}
              onUpdate={(value) => setVisibility((value[0] ?? 'public') as PollVisibility)}
              options={visibilityOptions}
            />
          {(scopeType !== 'COMMUNITY' && visibility === 'community') ||
          (scopeType !== 'TEAM' && visibility === 'team') ? (
            <p className="voting-v2__small">
              Для корректной видимости выберите соответствующую область.
            </p>
          ) : null}
        </div>

        <div>
          <label className="voting-form__label">Доступ к результатам</label>
            <Select
              value={[resultsVisibility]}
              onUpdate={(value) =>
                setResultsVisibility((value[0] ?? 'after_closed') as ResultsVisibility)
              }
              options={resultsOptions}
            />
        </div>
      </div>

      <div className="voting-form__grid">
        <Checkbox
          checked={allowRevoting}
          onUpdate={setAllowRevoting}
          content="Разрешить переголосование"
        />

        <Checkbox checked={anonymous} onUpdate={setAnonymous} content="Анонимное голосование" />
      </div>

      {templates.length > 0 ? (
        <div>
          <label className="voting-form__label">Шаблон</label>
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
        <div className="voting-form__label">Расписание</div>
        <ScheduleForm
          initialStartsAt={startsAt}
          initialEndsAt={endsAt}
          onUpdate={handleScheduleUpdate}
        />
      </div>

      <div className="voting-form__actions">
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
