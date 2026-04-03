import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Select, Text, TextArea, TextInput } from '@gravity-ui/uikit';
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

type WizardStep = 0 | 1 | 2;

export const PollForm: React.FC<PollFormProps> = ({
  initialData = {},
  templates = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Создать опрос',
}) => {
  const [step, setStep] = useState<WizardStep>(0);
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
  const [touched, setTouched] = useState(false);

  const scopeIdRequired = scopeType !== 'TENANT';
  const scopeIdValid = !scopeIdRequired || Boolean(scopeId.trim());
  const titleValid = Boolean(title.trim());

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

  const templateOptions = useMemo(
    () => [{ value: '', content: 'Без шаблона' }, ...templates.map((t) => ({ value: t.slug, content: t.title }))],
    [templates],
  );

  const payload: PollCreatePayload = useMemo(
    () => ({
      title: title.trim(),
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
    }),
    [
      title,
      description,
      scopeType,
      scopeId,
      visibility,
      allowRevoting,
      anonymous,
      resultsVisibility,
      template,
      startsAt,
      endsAt,
    ],
  );

  const canGoNext = step === 0 ? titleValid : step === 1 ? scopeIdValid : true;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!titleValid || !scopeIdValid) return;
    onSubmit(payload);
  };

  const next = () => {
    setTouched(true);
    if (!canGoNext) return;
    setStep((prev) => (Math.min(prev + 1, 2) as WizardStep));
  };

  const prev = () => setStep((prev) => (Math.max(prev - 1, 0) as WizardStep));

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-2">
        {['База', 'Правила', 'Проверка'].map((label, index) => (
          <Button
            key={label}
            type="button"
            size="s"
            view={step === index ? 'action' : 'flat'}
            disabled={index > step}
          >
            {index + 1}. {label}
          </Button>
        ))}
      </div>

      {step === 0 && (
        <Card className="p-4 space-y-4">
          <div className="space-y-1">
            <Text variant="subheader-2">Основная информация</Text>
            <Text variant="body-2" color="secondary">Название, описание и шаблон для быстрого старта.</Text>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">Название *</div>
            <TextInput value={title} onUpdate={setTitle} placeholder="Например: Лучшие проекты года" />
            {touched && !titleValid && <p className="text-xs text-amber-600">Укажите название опроса.</p>}
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">Описание</div>
            <TextArea value={description} onUpdate={setDescription} rows={3} placeholder="Контекст, правила или призы" />
          </div>

          {templates.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Шаблон</div>
              <Select value={[template || '']} onUpdate={(value) => setTemplate(value[0] ?? '')} options={templateOptions} />
            </div>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card className="p-4 space-y-4">
          <div className="space-y-1">
            <Text variant="subheader-2">Правила и доступ</Text>
            <Text variant="body-2" color="secondary">Выберите область, видимость и расписание голосования.</Text>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Область опроса</div>
              <Select
                value={[scopeType]}
                onUpdate={(value) => {
                  const nextScope = (value[0] ?? 'TENANT') as PollScopeType;
                  setScopeType(nextScope);
                  if (nextScope === 'TENANT') setScopeId('');
                }}
                options={scopeOptions}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">
                {`ID области ${scopeType === 'TENANT' ? '(необязательно)' : '*'}`}
              </div>
              <TextInput
                value={scopeId}
                onUpdate={setScopeId}
                disabled={scopeType === 'TENANT'}
                placeholder={scopeType === 'TENANT' ? 'Берётся из текущего тенанта' : 'UUID области'}
              />
              {touched && scopeType !== 'TENANT' && !scopeIdValid && (
                <p className="text-xs text-amber-600">Для выбранной области нужен ID.</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Видимость</div>
              <Select value={[visibility]} onUpdate={(value) => setVisibility((value[0] ?? 'public') as PollVisibility)} options={visibilityOptions} />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Доступ к результатам</div>
              <Select
                value={[resultsVisibility]}
                onUpdate={(value) => setResultsVisibility((value[0] ?? 'after_closed') as ResultsVisibility)}
                options={resultsOptions}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Checkbox checked={allowRevoting} onUpdate={setAllowRevoting} content="Разрешить переголосование" />
            <Checkbox checked={anonymous} onUpdate={setAnonymous} content="Анонимное голосование" />
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Расписание</div>
            <ScheduleForm initialStartsAt={startsAt} initialEndsAt={endsAt} onUpdate={(value) => {
              setStartsAt(value.starts_at);
              setEndsAt(value.ends_at);
            }} />
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-4 space-y-4">
          <Text variant="subheader-2">Проверка перед созданием</Text>
          <Alert theme="info" title="После создания" message="Вы перейдёте к управлению опросом, где сможете добавить вопросы и участников." />
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div><span className="font-semibold">Название:</span> {payload.title || '—'}</div>
            <div><span className="font-semibold">Шаблон:</span> {payload.template || 'без шаблона'}</div>
            <div><span className="font-semibold">Область:</span> {payload.scope_type}</div>
            <div><span className="font-semibold">ID области:</span> {payload.scope_id || 'текущий tenant'}</div>
            <div><span className="font-semibold">Видимость:</span> {payload.visibility}</div>
            <div><span className="font-semibold">Результаты:</span> {payload.results_visibility}</div>
            <div><span className="font-semibold">Переголосование:</span> {payload.allow_revoting ? 'да' : 'нет'}</div>
            <div><span className="font-semibold">Анонимность:</span> {payload.anonymous ? 'да' : 'нет'}</div>
          </div>
        </Card>
      )}

      <div className="flex justify-between pt-2">
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" view="outlined" onClick={prev} disabled={isSubmitting}>
              Назад
            </Button>
          )}
          <Button type="button" view="flat" onClick={onCancel} disabled={isSubmitting}>
            Отмена
          </Button>
        </div>

        {step < 2 ? (
          <Button type="button" view="action" onClick={next} disabled={isSubmitting || !canGoNext}>
            Далее
          </Button>
        ) : (
          <Button type="submit" view="action" disabled={isSubmitting || !titleValid || !scopeIdValid} loading={isSubmitting}>
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
};
