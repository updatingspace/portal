import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar } from '@gravity-ui/date-components';
import { dateTime, settings } from '@gravity-ui/date-utils';
import { Button, Card, Select, TextArea, TextInput } from '@gravity-ui/uikit';

import { useAuth } from '../../../contexts/AuthContext';
import { useCreateEvent, useUpdateEvent } from '../hooks';
import type {
  CreateEventPayload,
  EventVisibility,
  EventWithCounts,
  UpdateEventPayload,
} from '../types';

// --------- Helpers and types --------------------------------------------------

type EventFormState = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  locationText: string;
  locationUrl: string;
  gameId: string;
  visibility: EventVisibility;
};

type LanguageKey = 'en' | 'ru';

const pad = (value: number) => String(value).padStart(2, '0');

const toControlDatetime = (value: Date | string | null | undefined) => {
  if (!value) {
    return '';
  }
  const normalized = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(normalized.getTime())) {
    return '';
  }
  const year = normalized.getFullYear();
  const month = pad(normalized.getMonth() + 1);
  const date = pad(normalized.getDate());
  const hours = pad(normalized.getHours());
  const minutes = pad(normalized.getMinutes());
  return `${year}-${month}-${date}T${hours}:${minutes}`;
};

const parseControlDatetime = (value: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const createFallbackRange = () => {
  const now = new Date();
  const start = new Date(now.getTime());
  const roundedMinutes = Math.ceil(start.getMinutes() / 5) * 5;
  start.setMinutes(roundedMinutes);
  start.setSeconds(0);
  start.setMilliseconds(0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
};

type CalendarValue = React.ComponentProps<typeof Calendar>['value'];

const toCalendarValue = (date: Date | null): CalendarValue => (date ? (dateTime({ input: date }) as CalendarValue) : null);

const toJsDate = (value: CalendarValue): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    const maybeValue = value as { toDate?: () => Date; toJSDate?: () => Date };
    if (typeof maybeValue.toDate === 'function') return maybeValue.toDate();
    if (typeof maybeValue.toJSDate === 'function') return maybeValue.toJSDate();
  }
  return null;
};

const formatTimeValue = (date: Date | null) => {
  if (!date) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const applyTimeToDate = (baseDate: Date, timeValue: string) => {
  const [hours, minutes] = timeValue.split(':').map((value) => Number(value));
  if (Number.isFinite(hours)) {
    baseDate.setHours(hours, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  }
  return baseDate;
};

const mergeDatePart = (current: Date | null, next: Date | null) => {
  if (!next) return null;
  const base = new Date(next.getTime());
  const timeSource = current ?? new Date();
  base.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
  return base;
};

const formatDurationLabel = (start: Date | null, end: Date | null) => {
  if (!start || !end) return null;
  const diffMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (diffMinutes <= 0) return null;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}ч`);
  if (minutes > 0) parts.push(`${minutes}м`);
  return parts.join(' ');
};

const timeInputClassName =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none';

const translations: Record<LanguageKey, {
  heading: { create: string; edit: string };
  intro: string;
  sections: {
    basics: string;
    schedule: string;
    location: string;
    audience: string;
  };
  labels: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    locationText: string;
    locationUrl: string;
    gameId: string;
    visibility: string;
  };
  placeholders: {
    title: string;
    description: string;
    locationText: string;
    locationUrl: string;
    gameId: string;
    visibility: string;
    time: string;
  };
  buttons: { cancel: string; create: string; save: string };
  hints: { timezone: string; duration: string; tenantScope: string };
  errors: {
    missingTitle: string;
    invalidTimes: string;
    missingScope: string;
    generic: string;
  };
  visibilityOptions: { value: EventVisibility; label: string }[];
}> = {
  en: {
    heading: {
      create: 'Create event',
      edit: 'Edit event',
    },
    intro: 'Plan meetups, streams, or tournaments and keep everyone on the same page.',
    sections: {
      basics: 'Basics',
      schedule: 'Schedule',
      location: 'Location',
      audience: 'Audience',
    },
    labels: {
      title: 'Title',
      description: 'Description',
      startsAt: 'Starts',
      endsAt: 'Ends',
      startDate: 'Start date',
      startTime: 'Start time',
      endDate: 'End date',
      endTime: 'End time',
      locationText: 'Location',
      locationUrl: 'Location link',
      gameId: 'Game / focus',
      visibility: 'Visibility',
    },
    placeholders: {
      title: 'Give it a clear name',
      description: 'Add context, agenda, or highlights',
      locationText: 'Venue, lobby, or voice channel',
      locationUrl: 'Optional link (Zoom, Discord, etc.)',
      gameId: 'Game, genre, or focus area',
      visibility: 'Who can see this event?',
      time: 'HH:MM',
    },
    buttons: {
      cancel: 'Cancel',
      create: 'Create event',
      save: 'Save changes',
    },
    hints: {
      timezone: 'Times reflect your local timezone.',
      duration: 'Duration',
      tenantScope: 'Event will be created in your tenant space.',
    },
    errors: {
      missingTitle: 'Give your event a title.',
      invalidTimes: 'End time must be after the start.',
      missingScope: 'Tenant membership is required to create events.',
      generic: 'Something went wrong. Please try again.',
    },
    visibilityOptions: [
      { value: 'public', label: 'Public' },
      { value: 'community', label: 'Community' },
      { value: 'team', label: 'Team' },
      { value: 'private', label: 'Private' },
    ],
  },
  ru: {
    heading: {
      create: 'Создать событие',
      edit: 'Редактирование события',
    },
    intro: 'Планируйте сборы, стримы или турниры и держите команду на одной волне.',
    sections: {
      basics: 'Основное',
      schedule: 'Расписание',
      location: 'Локация',
      audience: 'Аудитория',
    },
    labels: {
      title: 'Название',
      description: 'Описание',
      startsAt: 'Начало',
      endsAt: 'Окончание',
      startDate: 'Дата начала',
      startTime: 'Время начала',
      endDate: 'Дата окончания',
      endTime: 'Время окончания',
      locationText: 'Место',
      locationUrl: 'Ссылка',
      gameId: 'Игра / фокус',
      visibility: 'Кто увидит',
    },
    placeholders: {
      title: 'Придумайте понятное название',
      description: 'Добавьте подробности, программу или фишки',
      locationText: 'Локация, лобби или голосовой канал',
      locationUrl: 'Ссылка (Zoom, Discord и т. п.)',
      gameId: 'Игра, жанр или тематика',
      visibility: 'Кто сможет увидеть событие?',
      time: 'ЧЧ:ММ',
    },
    buttons: {
      cancel: 'Отмена',
      create: 'Создать событие',
      save: 'Сохранить',
    },
    hints: {
      timezone: 'Время отображается в вашем локальном часовом поясе.',
      duration: 'Длительность',
      tenantScope: 'Событие будет создано в вашем тенанте.',
    },
    errors: {
      missingTitle: 'Укажите название события.',
      invalidTimes: 'Время окончания должно идти после начала.',
      missingScope: 'Нужно быть участником tenant, чтобы создать событие.',
      generic: 'Что-то пошло не так. Повторите попытку.',
    },
    visibilityOptions: [
      { value: 'public', label: 'Публичное' },
      { value: 'community', label: 'Для сообщества' },
      { value: 'team', label: 'Только команда' },
      { value: 'private', label: 'Приватное' },
    ],
  },
};

const defaultVisibility: EventVisibility = 'public';

const buildInitialFormState = (event?: EventWithCounts): EventFormState => {
  const fallback = createFallbackRange();
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    startsAt: event ? toControlDatetime(event.startsAt) : toControlDatetime(fallback.start),
    endsAt: event ? toControlDatetime(event.endsAt) : toControlDatetime(fallback.end),
    locationText: event?.locationText ?? '',
    locationUrl: event?.locationUrl ?? '',
    gameId: event?.gameId ?? '',
    visibility: event?.visibility ?? defaultVisibility,
  };
};

const FieldBlock: React.FC<React.PropsWithChildren<{
  label: string;
  description?: string;
}>> = ({ label, description, children }) => (
  <div className="space-y-2">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    {children}
    {description ? <div className="text-xs text-slate-400">{description}</div> : null}
  </div>
);

const getPortalLanguage = (userLanguage: string | null | undefined) => {
  const normalized = userLanguage?.toLowerCase() ?? '';
  return normalized.startsWith('ru') ? 'ru' : 'en';
};

const optionalCreateFieldValue = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const optionalUpdateFieldValue = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
      return (error as { message?: string }).message ?? fallback;
    }
    if ('detail' in error && typeof (error as { detail?: unknown }).detail === 'string') {
      return (error as { detail?: string }).detail ?? fallback;
    }
  }
  return fallback;
};

// --------- Component --------------------------------------------------------

type EventFormProps = {
  event?: EventWithCounts;
  onSuccess: (event: EventWithCounts) => void;
  onCancel: () => void;
};

export const EventForm: React.FC<EventFormProps> = ({ event, onCancel, onSuccess }) => {
  const { user } = useAuth();
  const locale = useMemo(() => getPortalLanguage(user?.language ?? null), [user?.language]);
  const copy = translations[locale];
  const [formState, setFormState] = useState(() => buildInitialFormState(event));
  const [formError, setFormError] = useState<string | null>(null);

  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent(event?.id ?? '');

  useEffect(() => {
    setFormState(buildInitialFormState(event));
    setFormError(null);
  }, [event?.id]);

  useEffect(() => {
    settings.loadLocale(locale).catch(() => undefined);
  }, [locale]);

  const startDate = parseControlDatetime(formState.startsAt);
  const endDate = parseControlDatetime(formState.endsAt);
  const startTime = formatTimeValue(startDate);
  const endTime = formatTimeValue(endDate);
  const durationLabel = useMemo(() => formatDurationLabel(startDate, endDate), [endDate, startDate]);
  const hasValidRange = startDate && endDate && startDate < endDate;
  const isEditing = Boolean(event?.id);
  const userHasTenant = Boolean(user?.tenant?.id);
  const canSubmit = formState.title.trim().length > 0 && hasValidRange && (isEditing || userHasTenant);
  const isSubmitting = createEventMutation.isPending || updateEventMutation.isPending;

  const handleMutationError = useCallback(
    (error: unknown) => {
      setFormError(extractErrorMessage(error, copy.errors.generic));
    },
    [copy.errors.generic],
  );

  const handleSubmit = () => {
    if (!formState.title.trim()) {
      setFormError(copy.errors.missingTitle);
      return;
    }
    if (!hasValidRange) {
      setFormError(copy.errors.invalidTimes);
      return;
    }
    if (!isEditing && !userHasTenant) {
      setFormError(copy.errors.missingScope);
      return;
    }

    const trimmedTitle = formState.title.trim();
    const trimmedDescription = formState.description.trim();
    const trimmedLocationText = formState.locationText.trim();
    const trimmedLocationUrl = formState.locationUrl.trim();
    const trimmedGameId = formState.gameId.trim();

    if (!startDate || !endDate) {
      setFormError(copy.errors.invalidTimes);
      return;
    }

    const sharedPayload = {
      title: trimmedTitle,
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString(),
      visibility: formState.visibility,
    };

    const updatePayload: UpdateEventPayload = {
      ...sharedPayload,
      description: optionalUpdateFieldValue(trimmedDescription),
      locationText: optionalUpdateFieldValue(trimmedLocationText),
      locationUrl: optionalUpdateFieldValue(trimmedLocationUrl),
      gameId: optionalUpdateFieldValue(trimmedGameId),
    };

    if (isEditing && event) {
      updateEventMutation.mutate(updatePayload, {
        onSuccess,
        onError: handleMutationError,
      });
      return;
    }

    const tenantId = user?.tenant?.id ?? '';
    const createPayload: CreateEventPayload = {
      ...sharedPayload,
      scopeType: 'TENANT',
      scopeId: tenantId,
      description: optionalCreateFieldValue(trimmedDescription),
      locationText: optionalCreateFieldValue(trimmedLocationText),
      locationUrl: optionalCreateFieldValue(trimmedLocationUrl),
      gameId: optionalCreateFieldValue(trimmedGameId),
    };

    createEventMutation.mutate(createPayload, {
      onSuccess,
      onError: handleMutationError,
    });
  };

  const updateField = (patch: Partial<EventFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  const handleStartCalendarUpdate = (value: CalendarValue) => {
    const nextDate = mergeDatePart(startDate, toJsDate(value));
    updateField({ startsAt: nextDate ? toControlDatetime(nextDate) : '' });
  };

  const handleEndCalendarUpdate = (value: CalendarValue) => {
    const nextDate = mergeDatePart(endDate, toJsDate(value));
    updateField({ endsAt: nextDate ? toControlDatetime(nextDate) : '' });
  };

  const handleStartTimeUpdate = (value: string) => {
    const base = startDate ? new Date(startDate.getTime()) : new Date();
    const nextDate = applyTimeToDate(base, value);
    updateField({ startsAt: toControlDatetime(nextDate) });
  };

  const handleEndTimeUpdate = (value: string) => {
    const base = endDate ? new Date(endDate.getTime()) : new Date();
    const nextDate = applyTimeToDate(base, value);
    updateField({ endsAt: toControlDatetime(nextDate) });
  };

  return (
    <Card view="filled" className="p-6 md:p-8 space-y-8">
      <div className="space-y-2">
        <div className="text-2xl font-semibold text-slate-900">
          {isEditing ? copy.heading.edit : copy.heading.create}
        </div>
        <p className="text-sm text-slate-500 max-w-xl">{copy.intro}</p>
      </div>

      {user?.tenant?.slug && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {copy.hints.tenantScope} <span className="font-medium text-slate-800">{user.tenant.slug}</span>
        </div>
      )}

      <section className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.sections.basics}</div>
        <div className="grid gap-6">
          <FieldBlock label={copy.labels.title} description={copy.placeholders.title}>
            <TextInput
              size="l"
              value={formState.title}
              onUpdate={(value) => updateField({ title: value })}
              placeholder={copy.placeholders.title}
            />
          </FieldBlock>

          <FieldBlock label={copy.labels.description} description={copy.placeholders.description}>
            <TextArea
              size="l"
              rows={4}
              value={formState.description}
              onUpdate={(value) => updateField({ description: value })}
              placeholder={copy.placeholders.description}
            />
          </FieldBlock>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.sections.schedule}</div>
          {durationLabel && (
            <div className="text-xs text-slate-500">
              {copy.hints.duration}: <span className="font-medium text-slate-700">{durationLabel}</span>
            </div>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <FieldBlock label={copy.labels.startsAt} description={copy.hints.timezone}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                  {copy.labels.startDate}
                </div>
                <Calendar value={toCalendarValue(startDate)} onUpdate={handleStartCalendarUpdate} />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase text-slate-400">{copy.labels.startTime}</div>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => handleStartTimeUpdate(event.target.value)}
                  placeholder={copy.placeholders.time}
                  className={timeInputClassName}
                />
              </div>
            </div>
          </FieldBlock>

          <FieldBlock label={copy.labels.endsAt}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                  {copy.labels.endDate}
                </div>
                <Calendar value={toCalendarValue(endDate)} onUpdate={handleEndCalendarUpdate} />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase text-slate-400">{copy.labels.endTime}</div>
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => handleEndTimeUpdate(event.target.value)}
                  placeholder={copy.placeholders.time}
                  className={timeInputClassName}
                />
              </div>
            </div>
          </FieldBlock>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.sections.location}</div>
        <div className="grid gap-6 md:grid-cols-2">
          <FieldBlock label={copy.labels.locationText} description={copy.placeholders.locationText}>
            <TextInput
              size="l"
              value={formState.locationText}
              onUpdate={(value) => updateField({ locationText: value })}
              placeholder={copy.placeholders.locationText}
            />
          </FieldBlock>
          <FieldBlock label={copy.labels.locationUrl} description={copy.placeholders.locationUrl}>
            <TextInput
              size="l"
              type="url"
              value={formState.locationUrl}
              onUpdate={(value) => updateField({ locationUrl: value })}
              placeholder={copy.placeholders.locationUrl}
            />
          </FieldBlock>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.sections.audience}</div>
        <div className="grid gap-6 md:grid-cols-2">
          <FieldBlock label={copy.labels.gameId} description={copy.placeholders.gameId}>
            <TextInput
              size="l"
              value={formState.gameId}
              onUpdate={(value) => updateField({ gameId: value })}
              placeholder={copy.placeholders.gameId}
            />
          </FieldBlock>
          <FieldBlock label={copy.labels.visibility} description={copy.placeholders.visibility}>
            <Select
              size="l"
              value={[formState.visibility]}
              onUpdate={(value) =>
                updateField({ visibility: (value[0] ?? defaultVisibility) as EventVisibility })
              }
              options={copy.visibilityOptions.map((opt) => ({
                value: opt.value,
                content: opt.label,
              }))}
              placeholder={copy.placeholders.visibility}
            />
          </FieldBlock>
        </div>
        {userHasTenant ? <div className="text-xs text-slate-500">{copy.hints.tenantScope}</div> : null}
      </section>

      {formError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 justify-end">
        <Button view="flat" size="l" onClick={onCancel} disabled={isSubmitting}>
          {copy.buttons.cancel}
        </Button>
        <Button
          view="action"
          size="l"
          loading={isSubmitting}
          disabled={!canSubmit || isSubmitting}
          onClick={handleSubmit}
        >
          {isEditing ? copy.buttons.save : copy.buttons.create}
        </Button>
      </div>
    </Card>
  );
};
