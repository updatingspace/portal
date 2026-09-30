import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Select, TextArea, TextInput } from '@gravity-ui/uikit';
import { dateTime } from '@gravity-ui/date-utils';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { request } from '../../../api/client';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import { useSessionDraft } from '../../../shared/hooks/useSessionDraft';
import {
  FormField,
  InlineError,
  PageLayout,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';
import { useCreateEvent, useUpdateEvent } from '../hooks';
import type {
  CreateEventPayload,
  EventWithCounts,
  UpdateEventPayload,
} from '../types';
import './events.css';

type FormValues = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  locationText: string;
  locationUrl: string;
  gameId: string;
  visibility: 'public' | 'private' | 'community' | 'team';
  groupId: string;
  teamId: string;
};
type ScopeOption = { id: string; name: string };
export type EventFormProps = {
  event?: EventWithCounts;
  onSuccess: (event: EventWithCounts) => void;
  onCancel: () => void;
};
function EventFormInner({ event, onSuccess, onCancel }: EventFormProps) {
  const { user } = useAuth();
  const t = useUITranslation();
  const { timezone, formatDateTime } = useFormatters();
  const initial = useMemo<FormValues>(() => {
    const start =
      event?.startsAt ?? new Date(Date.now() + 3600000).toISOString();
    const end = event?.endsAt ?? new Date(Date.now() + 7200000).toISOString();
    return {
      title: event?.title ?? '',
      description: event?.description ?? '',
      startsAt: dateTime({ input: start, timeZone: timezone }).format(
        'YYYY-MM-DDTHH:mm',
      ),
      endsAt: dateTime({ input: end, timeZone: timezone }).format(
        'YYYY-MM-DDTHH:mm',
      ),
      locationText: event?.locationText ?? '',
      locationUrl: event?.locationUrl ?? '',
      gameId: event?.gameId ?? '',
      visibility: event?.visibility ?? 'public',
      groupId: event?.scopeType === 'COMMUNITY' ? event.scopeId : '',
      teamId: event?.scopeType === 'TEAM' ? event.scopeId : '',
    };
    // A refetch or preference update must not replace a draft already being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);
  const draft = useSessionDraft(
    `${user?.id}:${user?.tenant?.id}:event:${event?.id ?? 'new'}`,
    initial,
  );
  const schema = z
    .object({
      title: z
        .string()
        .trim()
        .min(1, t('Введите название', 'Enter a title'))
        .max(255, t('Не более 255 символов', 'Use at most 255 characters')),
      description: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      locationText: z.string(),
      locationUrl: z
        .string()
        .refine(
          (value) => !value || /^https?:\/\//i.test(value),
          t('Укажите ссылку http или https', 'Use an http or https link'),
        ),
      gameId: z.string(),
      visibility: z.enum(['public', 'private', 'community', 'team']),
      groupId: z.string(),
      teamId: z.string(),
    })
    .superRefine((values, ctx) => {
      const start = dateTime({ input: values.startsAt, timeZone: timezone }),
        end = dateTime({ input: values.endsAt, timeZone: timezone });
      if (!values.startsAt || !start.isValid())
        ctx.addIssue({
          code: 'custom',
          path: ['startsAt'],
          message: t('Укажите время начала', 'Enter a start time'),
        });
      if (!values.endsAt || !end.isValid() || end.valueOf() <= start.valueOf())
        ctx.addIssue({
          code: 'custom',
          path: ['endsAt'],
          message: t(
            'Окончание должно быть позже начала',
            'End time must be after start time',
          ),
        });
      if (
        !event &&
        ['community', 'team'].includes(values.visibility) &&
        !values.groupId
      )
        ctx.addIssue({
          code: 'custom',
          path: ['groupId'],
          message: t('Выберите группу', 'Choose a group'),
        });
      if (!event && values.visibility === 'team' && !values.teamId)
        ctx.addIssue({
          code: 'custom',
          path: ['teamId'],
          message: t('Выберите команду', 'Choose a team'),
        });
    });
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    defaultValues: draft.value,
    resolver: zodResolver(schema),
  });
  const values = useWatch({ control }) as FormValues;
  const { setValue: setDraft } = draft;
  useEffect(() => {
    setDraft((current) =>
      JSON.stringify(current) === JSON.stringify(values) ? current : values,
    );
  }, [values, setDraft]);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateEvent(),
    update = useUpdateEvent(event?.id ?? '');
  const groups = useQuery({
    queryKey: ['event-audience-groups', user?.tenant?.id],
    queryFn: () => request<ScopeOption[]>('/portal/communities'),
    enabled: !event && ['community', 'team'].includes(values.visibility),
  });
  const teams = useQuery({
    queryKey: ['event-audience-teams', user?.tenant?.id, values.groupId],
    queryFn: () =>
      request<ScopeOption[]>(
        `/portal/teams?community_id=${encodeURIComponent(values.groupId)}`,
      ),
    enabled: !event && values.visibility === 'team' && Boolean(values.groupId),
  });
  const submit = (submitted: FormValues) => {
    if (lock.current) return;
    if (!user?.tenant?.id) {
      setError(
        t(
          'Выберите сообщество перед сохранением.',
          'Choose a community before saving.',
        ),
      );
      return;
    }
    lock.current = true;
    setSaving(true);
    setError(null);
    const common = {
      title: submitted.title.trim(),
      startsAt: dateTime({
        input: submitted.startsAt,
        timeZone: timezone,
      }).toISOString()!,
      endsAt: dateTime({
        input: submitted.endsAt,
        timeZone: timezone,
      }).toISOString()!,
      visibility: submitted.visibility,
    };
    const callbacks = {
      onSuccess: (saved: EventWithCounts) => {
        lock.current = false;
        setSaving(false);
        draft.clear(submitted);
        onSuccess(saved);
      },
      onError: (reason: unknown) => {
        lock.current = false;
        setSaving(false);
        const status = (reason as { status?: number })?.status;
        setError(
          status === 409
            ? t(
                'Событие изменилось. Ваш ввод сохранён; проверьте актуальную версию перед повтором.',
                'The event changed. Your input is retained; review the current version before retrying.',
              )
            : status === 403
              ? t(
                  'Нет права сохранить событие. Ваш ввод сохранён.',
                  'You cannot save this event. Your input is retained.',
                )
              : t(
                  'Не удалось подтвердить сохранение. Ваш ввод сохранён. Проверьте список событий перед повторной отправкой.',
                  'Unable to confirm the save. Your input is retained. Check the events list before submitting again.',
                ),
        );
      },
    };
    if (event) {
      const payload: UpdateEventPayload = {
        ...common,
        description: submitted.description.trim() || null,
        locationText: submitted.locationText.trim() || null,
        locationUrl: submitted.locationUrl.trim() || null,
        gameId: submitted.gameId.trim() || null,
      };
      update.mutate(payload, callbacks);
    } else {
      const payload: CreateEventPayload = {
        ...common,
        scopeType:
          submitted.visibility === 'team'
            ? 'TEAM'
            : submitted.visibility === 'community'
              ? 'COMMUNITY'
              : 'TENANT',
        scopeId:
          submitted.visibility === 'team'
            ? submitted.teamId
            : submitted.visibility === 'community'
              ? submitted.groupId
              : user.tenant.id,
        description: submitted.description.trim() || undefined,
        locationText: submitted.locationText.trim() || undefined,
        locationUrl: submitted.locationUrl.trim() || undefined,
        gameId: submitted.gameId.trim() || undefined,
      };
      create.mutate(payload, callbacks);
    }
  };
  const textField = (
    name:
      | 'title'
      | 'startsAt'
      | 'endsAt'
      | 'locationText'
      | 'locationUrl'
      | 'gameId',
    label: string,
    type: 'text' | 'url' | 'datetime-local' = 'text',
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormField label={label} error={errors[name]?.message}>
          {(props) =>
            type === 'datetime-local' ? (
              <input
                {...props}
                className="portal-native-input"
                type="datetime-local"
                value={field.value}
                onChange={(change) => field.onChange(change.target.value)}
                onBlur={field.onBlur}
                ref={field.ref}
                disabled={saving}
              />
            ) : (
              <TextInput
                size="xl"
                {...props}
                controlProps={{
                  'aria-describedby': props['aria-describedby'],
                  'aria-invalid': props['aria-invalid'],
                }}
                type={type}
                value={field.value}
                onUpdate={field.onChange}
                onBlur={field.onBlur}
                controlRef={field.ref}
                disabled={saving}
              />
            )
          }
        </FormField>
      )}
    />
  );
  const visibilityOptions = [
    { value: 'public', content: t('Сообщество', 'Community') },
    { value: 'private', content: t('Только организатор', 'Organizer only') },
    ...(!event || event.scopeType === 'COMMUNITY'
      ? [
          {
            value: 'community',
            content: t('Группа внутри сообщества', 'Group within community'),
          },
        ]
      : []),
    ...(!event || event.scopeType === 'TEAM'
      ? [{ value: 'team', content: t('Команда', 'Team') }]
      : []),
  ];
  return (
    <PageLayout
      title={
        event
          ? t('Редактировать событие', 'Edit event')
          : t('Создать событие', 'Create event')
      }
      description={`${t('Время в часовом поясе', 'Times are in')}: ${timezone}`}
    >
      {draft.guard}
      <form
        className="portal-stack portal-event-form"
        onSubmit={handleSubmit(submit)}
        noValidate
      >
        <section className="portal-event-form__section portal-stack">
          <h2>{t('Основное', 'Basics')}</h2>
          {textField('title', t('Название', 'Title'))}
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <FormField label={t('Описание', 'Description')}>
                {(props) => (
                  <TextArea
                    size="xl"
                    {...props}
                    value={field.value}
                    onUpdate={field.onChange}
                    disabled={saving}
                    rows={5}
                  />
                )}
              </FormField>
            )}
          />
        </section>
        <section className="portal-event-form__section portal-stack">
          <h2>{t('Время', 'Schedule')}</h2>
          <div className="portal-grid">
            {textField('startsAt', t('Начало', 'Starts'), 'datetime-local')}
            {textField('endsAt', t('Окончание', 'Ends'), 'datetime-local')}
          </div>
        </section>
        <section className="portal-event-form__section portal-stack">
          <h2>{t('Место', 'Location')}</h2>
          {textField('locationText', t('Место встречи', 'Meeting place'))}
          {textField('locationUrl', t('Ссылка', 'Link'), 'url')}
        </section>
        <section className="portal-event-form__section portal-stack">
          <h2>{t('Аудитория', 'Audience')}</h2>
          <Controller
            name="visibility"
            control={control}
            render={({ field }) => (
              <FormField
                label={t('Кому доступно событие', 'Who can view this event')}
              >
                {(props) => (
                  <Select
                    size="xl"
                    {...props}
                    width="max"
                    value={[field.value]}
                    disabled={saving}
                    options={visibilityOptions}
                    onUpdate={(next) => field.onChange(next[0])}
                  />
                )}
              </FormField>
            )}
          />
          {event && (
            <p>
              {t(
                'Область существующего события сохраняется.',
                'The existing event scope is preserved.',
              )}
            </p>
          )}
          {!event && ['community', 'team'].includes(values.visibility) && (
            <>
              <FormField
                label={t('Группа', 'Group')}
                error={errors.groupId?.message}
              >
                {(props) => (
                  <Select
                    size="xl"
                    {...props}
                    width="max"
                    value={[values.groupId]}
                    disabled={saving || groups.isLoading}
                    options={(groups.data ?? []).map((item) => ({
                      value: item.id,
                      content: item.name,
                    }))}
                    onUpdate={(next) => {
                      setValue('groupId', next[0] ?? '');
                      setValue('teamId', '');
                    }}
                  />
                )}
              </FormField>
              {groups.isError && (
                <InlineError onRetry={() => void groups.refetch()}>
                  {t(
                    'Не удалось получить доступные группы.',
                    'Unable to load available groups.',
                  )}
                </InlineError>
              )}
            </>
          )}
          {!event && values.visibility === 'team' && values.groupId && (
            <>
              <FormField
                label={t('Команда', 'Team')}
                error={errors.teamId?.message}
              >
                {(props) => (
                  <Select
                    size="xl"
                    {...props}
                    width="max"
                    value={[values.teamId]}
                    disabled={saving || teams.isLoading}
                    options={(teams.data ?? []).map((item) => ({
                      value: item.id,
                      content: item.name,
                    }))}
                    onUpdate={(next) => setValue('teamId', next[0] ?? '')}
                  />
                )}
              </FormField>
              {teams.isError && (
                <InlineError onRetry={() => void teams.refetch()}>
                  {t(
                    'Не удалось получить команды группы.',
                    'Unable to load group teams.',
                  )}
                </InlineError>
              )}
            </>
          )}
        </section>
        <details className="portal-disclosure">
          <summary>{t('Предпросмотр', 'Preview')}</summary>
          <h3>{values.title || t('Название события', 'Event title')}</h3>
          <p>{values.description}</p>
          <p>
            {formatDateTime(
              dateTime({ input: values.startsAt, timeZone: timezone }).toDate(),
            )}{' '}
            · {timezone}
          </p>
        </details>
        {error && <InlineError>{error}</InlineError>}
        <div className="portal-actions">
          <Button type="button" disabled={saving} onClick={onCancel}>
            {t('Отмена', 'Cancel')}
          </Button>
          <Button
            type="submit"
            view="action"
            loading={saving}
            disabled={saving}
          >
            {event
              ? t('Сохранить', 'Save')
              : t('Создать событие', 'Create event')}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
export function EventForm(props: EventFormProps) {
  return <EventFormInner key={props.event?.id ?? 'new'} {...props} />;
}
