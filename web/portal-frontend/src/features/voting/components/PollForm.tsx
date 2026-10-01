import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Select,
  Text,
  TextArea,
  TextInput,
} from '@gravity-ui/uikit';
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
  onDirtyChange?: (dirty: boolean) => void;
  initialData?: Partial<PollCreatePayload>;
  templates?: PollTemplate[];
  onSubmit: (data: PollCreatePayload | PollUpdatePayload) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

type WizardStep = 0 | 1 | 2;

export const PollForm: React.FC<PollFormProps> = ({
  onDirtyChange,
  initialData = {},
  templates = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel,
}) => {
  const t = useUITranslation();
  const [step, setStep] = useState<WizardStep>(0);
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [scopeType, setScopeType] = useState<PollScopeType>(
    initialData.scope_type || 'TENANT',
  );
  const [scopeId, setScopeId] = useState(initialData.scope_id || '');
  const [visibility, setVisibility] = useState<PollVisibility>(
    initialData.visibility || 'public',
  );
  const [allowRevoting, setAllowRevoting] = useState(
    initialData.allow_revoting ?? false,
  );
  const [anonymous, setAnonymous] = useState(initialData.anonymous ?? false);
  const [resultsVisibility, setResultsVisibility] = useState<ResultsVisibility>(
    initialData.results_visibility || 'after_closed',
  );
  const [template, setTemplate] = useState(initialData.template || '');
  const [startsAt, setStartsAt] = useState<string | null>(
    initialData.starts_at || null,
  );
  const [endsAt, setEndsAt] = useState<string | null>(
    initialData.ends_at || null,
  );
  const [touched, setTouched] = useState(false);

  const scopeIdRequired = scopeType !== 'TENANT';
  const scopeIdValid = !scopeIdRequired || Boolean(scopeId.trim());
  const titleValid = Boolean(title.trim());

  const scopeOptions = [
    { value: 'TENANT', content: t('Сообщество', 'Community') },
    { value: 'COMMUNITY', content: t('Группа', 'Group') },
    { value: 'TEAM', content: t('Команда', 'Team') },
    { value: 'EVENT', content: t('Событие', 'Event') },
    { value: 'POST', content: t('Пост', 'Post') },
  ];

  const visibilityOptions: Array<{
    value: PollVisibility;
    content: string;
    disabled?: boolean;
  }> = [
    {
      value: 'public',
      content: t('Участники сообщества', 'Community members'),
    },
    {
      value: 'community',
      content: t('Сообщество', 'Community'),
      disabled: scopeType !== 'COMMUNITY',
    },
    {
      value: 'team',
      content: t('Команда', 'Team'),
      disabled: scopeType !== 'TEAM',
    },
    { value: 'private', content: t('Приватный', 'Private') },
  ];

  const resultsOptions = [
    { value: 'always', content: t('Всегда доступны', 'Always available') },
    { value: 'after_closed', content: t('После закрытия', 'After closing') },
    {
      value: 'admins_only',
      content: t('Только администраторам', 'Administrators only'),
    },
  ];

  const templateOptions = useMemo(
    () => [
      { value: '', content: t('Без шаблона', 'No template') },
      ...templates.map((t) => ({ value: t.slug, content: t.title })),
    ],
    [templates, t],
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

  const scheduleValid =
    !startsAt || !endsAt || Date.parse(endsAt) > Date.parse(startsAt);
  const dirty =
    title !== (initialData.title || '') ||
    description !== (initialData.description || '') ||
    scopeType !== (initialData.scope_type || 'TENANT') ||
    scopeId !== (initialData.scope_id || '') ||
    visibility !== (initialData.visibility || 'public') ||
    allowRevoting !== (initialData.allow_revoting ?? false) ||
    anonymous !== (initialData.anonymous ?? false) ||
    startsAt !== (initialData.starts_at || null) ||
    endsAt !== (initialData.ends_at || null) ||
    resultsVisibility !== (initialData.results_visibility || 'after_closed');
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const canGoNext =
    step === 0 ? titleValid : step === 1 ? scopeIdValid && scheduleValid : true;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!titleValid || !scopeIdValid || !scheduleValid || isSubmitting) return;
    onSubmit(payload);
  };

  const next = () => {
    setTouched(true);
    if (!canGoNext) return;
    setStep((prev) => Math.min(prev + 1, 2) as WizardStep);
  };

  const prev = () => setStep((prev) => Math.max(prev - 1, 0) as WizardStep);

  return (
    <form onSubmit={submit} className="voting-poll-form">
      <div
        className="voting-form-steps"
        aria-label={t('Этапы создания', 'Creation steps')}
      >
        {[
          t('Основное', 'Basics'),
          t('Правила', 'Rules'),
          t('Проверка', 'Review'),
        ].map((label, index) => (
          <Button
            key={label}
            type="button"
            size="s"
            view={step === index ? 'action' : 'flat'}
            disabled={index > step || isSubmitting}
            onClick={() => setStep(index as WizardStep)}
            selected={step === index}
          >
            {index + 1}. {label}
          </Button>
        ))}
      </div>

      {step === 0 && (
        <Card className="voting-form-section">
          <div className="space-y-1">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="poll-form-title"
            >
              {t('Название *', 'Name *')}
            </label>
            <TextInput
              size="xl"
              id="poll-form-title"
              aria-label={t('Название', 'Name')}
              value={title}
              onUpdate={setTitle}
              placeholder={t(
                'Например: Лучшие проекты года',
                'For example: Best projects of the year',
              )}
            />
            {touched && !titleValid && (
              <p className="text-xs text-amber-600">
                {t('Укажите название опроса.', 'Enter a poll name.')}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="poll-form-description"
            >
              {t('Описание', 'Description')}
            </label>
            <TextArea
              size="xl"
              id="poll-form-description"
              aria-label={t('Описание', 'Description')}
              value={description}
              onUpdate={setDescription}
              rows={3}
              placeholder={t(
                'Контекст, правила или призы',
                'Context, rules or prizes',
              )}
            />
          </div>

          {templates.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">
                {t('Шаблон', 'Template')}
              </div>
              <Select
                size="xl"
                aria-label={t('Шаблон', 'Template')}
                value={[template || '']}
                onUpdate={(value) => setTemplate(value[0] ?? '')}
                options={templateOptions}
              />
            </div>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card className="voting-form-section">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">
                {t('Область опроса', 'Poll audience')}
              </div>
              <Select
                size="xl"
                aria-label={t('Область опроса', 'Poll audience')}
                value={[scopeType]}
                onUpdate={(value) => {
                  const nextScope = (value[0] ?? 'TENANT') as PollScopeType;
                  setScopeType(nextScope);
                  if (nextScope === 'TENANT') setScopeId('');
                }}
                options={scopeOptions}
              />
            </div>

            {scopeIdRequired && (
              <div className="space-y-1">
                <label
                  className="text-sm font-medium text-gray-700"
                  htmlFor="poll-form-scope-id"
                >
                  {t('ID области *', 'Audience ID *')}
                </label>
                <TextInput
                  size="xl"
                  id="poll-form-scope-id"
                  value={scopeId}
                  onUpdate={setScopeId}
                  placeholder={t('UUID области', 'Audience UUID')}
                />
                {touched && !scopeIdValid && (
                  <p className="text-xs text-amber-600">
                    {t(
                      'Для выбранной области нужен ID.',
                      'Select an audience.',
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">
                {t('Видимость', 'Visibility')}
              </div>
              <Select
                size="xl"
                aria-label={t('Видимость', 'Visibility')}
                value={[visibility]}
                onUpdate={(value) =>
                  setVisibility((value[0] ?? 'public') as PollVisibility)
                }
                options={visibilityOptions}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">
                {t('Доступ к результатам', 'Results visibility')}
              </div>
              <Select
                size="xl"
                aria-label={t('Доступ к результатам', 'Results visibility')}
                value={[resultsVisibility]}
                onUpdate={(value) =>
                  setResultsVisibility(
                    (value[0] ?? 'after_closed') as ResultsVisibility,
                  )
                }
                options={resultsOptions}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Checkbox
              checked={allowRevoting}
              onUpdate={setAllowRevoting}
              content={t('Разрешить переголосование', 'Allow revoting')}
            />
            <Checkbox
              checked={anonymous}
              onUpdate={setAnonymous}
              content={t('Анонимное голосование', 'Anonymous voting')}
            />
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">
              {t('Расписание', 'Schedule')}
            </div>
            <ScheduleForm
              initialStartsAt={startsAt}
              initialEndsAt={endsAt}
              onUpdate={(value) => {
                setStartsAt(value.starts_at);
                setEndsAt(value.ends_at);
              }}
            />
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="voting-form-section">
          <Text variant="subheader-2">
            {t('Проверка перед созданием', 'Review before creating')}
          </Text>
          <Alert
            theme="info"
            title={t('После создания', 'Next step')}
            message={t(
              'Вы перейдёте к управлению опросом, где сможете добавить вопросы и участников.',
              'You will be able to add questions and participants after creating the poll.',
            )}
          />
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="font-semibold">{t('Название:', 'Name:')}</span>{' '}
              {payload.title || '—'}
            </div>
            <div>
              <span className="font-semibold">{t('Шаблон:', 'Template:')}</span>{' '}
              {payload.template || t('без шаблона', 'no template')}
            </div>
            <div>
              <span className="font-semibold">
                {t('Область:', 'Audience:')}
              </span>{' '}
              {
                scopeOptions.find((item) => item.value === payload.scope_type)
                  ?.content
              }
            </div>
            {scopeIdRequired && (
              <div>
                <span className="font-semibold">
                  {t('ID области:', 'Audience ID:')}
                </span>{' '}
                {payload.scope_id}
              </div>
            )}
            <div>
              <span className="font-semibold">
                {t('Видимость:', 'Visibility:')}
              </span>{' '}
              {
                visibilityOptions.find(
                  (item) => item.value === payload.visibility,
                )?.content
              }
            </div>
            <div>
              <span className="font-semibold">
                {t('Результаты:', 'Results:')}
              </span>{' '}
              {
                resultsOptions.find(
                  (item) => item.value === payload.results_visibility,
                )?.content
              }
            </div>
            <div>
              <span className="font-semibold">
                {t('Переголосование:', 'Revoting:')}
              </span>{' '}
              {payload.allow_revoting ? t('да', 'yes') : t('нет', 'no')}
            </div>
            <div>
              <span className="font-semibold">
                {t('Анонимность:', 'Anonymous:')}
              </span>{' '}
              {payload.anonymous ? t('да', 'yes') : t('нет', 'no')}
            </div>
          </div>
        </Card>
      )}

      <div className="flex justify-between pt-2">
        <div className="flex gap-2">
          {step > 0 && (
            <Button
              type="button"
              view="outlined"
              onClick={prev}
              disabled={isSubmitting}
            >
              {t('Назад', 'Back')}
            </Button>
          )}
          <Button
            type="button"
            view="flat"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t('Отмена', 'Cancel')}
          </Button>
        </div>

        {step < 2 ? (
          <Button
            type="button"
            view="action"
            onClick={next}
            disabled={isSubmitting || !canGoNext}
          >
            {t('Далее', 'Continue')}
          </Button>
        ) : (
          <Button
            type="submit"
            view="action"
            disabled={
              isSubmitting || !titleValid || !scopeIdValid || !scheduleValid
            }
            loading={isSubmitting}
          >
            {submitLabel || t('Создать опрос', 'Create poll')}
          </Button>
        )}
      </div>
    </form>
  );
};
