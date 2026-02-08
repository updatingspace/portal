import React, { useCallback, useMemo, useState } from 'react';
import { Button, Card, Select, Text, TextArea, TextInput } from '@gravity-ui/uikit';

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

type SectionKey = 'basics' | 'schedule' | 'location' | 'audience';

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

const toDateInputValue = (value: Date | null) => {
  if (!value) return '';
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const parseDateInputValue = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
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

const mergeDateWithTime = (dateOnly: Date, timeSource?: Date | null) => {
  const base = new Date(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate());
  const time = timeSource ?? new Date();
  base.setHours(time.getHours(), time.getMinutes(), 0, 0);
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

const formatDateFull = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

const formatDateShort = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);

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

const SectionCard: React.FC<React.PropsWithChildren<{
  title: string;
  description?: string;
  id?: string;
}>> = ({ title, description, children, id }) => (
  <Card className="p-5" id={id}>
    <div className="flex flex-col gap-1">
      <Text variant="subheader-2" className="text-slate-900">
        {title}
      </Text>
      {description ? (
        <Text variant="body-2" color="secondary">
          {description}
        </Text>
      ) : null}
    </div>
    <div className="mt-4">{children}</div>
  </Card>
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

const sections: { key: SectionKey; labelKey: keyof typeof translations['ru']['sections'] }[] = [
  { key: 'basics', labelKey: 'basics' },
  { key: 'schedule', labelKey: 'schedule' },
  { key: 'location', labelKey: 'location' },
  { key: 'audience', labelKey: 'audience' },
];

const EventFormInner: React.FC<EventFormProps> = ({ event, onCancel, onSuccess }) => {
  const { user } = useAuth();
  const locale = useMemo(() => getPortalLanguage(user?.language ?? null), [user?.language]);
  const copy = translations[locale];
  const [formState, setFormState] = useState(() => buildInitialFormState(event));
  const [formError, setFormError] = useState<string | null>(null);

  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent(event?.id ?? '');

  const startDate = parseControlDatetime(formState.startsAt);
  const endDate = parseControlDatetime(formState.endsAt);
  const startTime = formatTimeValue(startDate);
  const endTime = formatTimeValue(endDate);
  const durationMinutes = useMemo(() => {
    if (!startDate || !endDate) return null;
    return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  }, [endDate, startDate]);
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

  const resolveEndAfterStart = (nextStart: Date) => {
    if (endDate && endDate.getTime() > nextStart.getTime()) {
      return new Date(endDate.getTime());
    }
    const fallbackMinutes = durationMinutes && durationMinutes > 0 ? durationMinutes : 60;
    return new Date(nextStart.getTime() + fallbackMinutes * 60000);
  };

  const handleStartDateUpdate = (value: string) => {
    const parsed = parseDateInputValue(value);
    if (!parsed) {
      updateField({ startsAt: '' });
      return;
    }
    const nextStart = mergeDateWithTime(parsed, startDate);
    const nextEnd = resolveEndAfterStart(nextStart);
    updateField({
      startsAt: toControlDatetime(nextStart),
      endsAt: toControlDatetime(nextEnd),
    });
  };

  const handleEndDateUpdate = (value: string) => {
    const parsed = parseDateInputValue(value);
    if (!parsed) {
      updateField({ endsAt: '' });
      return;
    }
    const nextEnd = mergeDateWithTime(parsed, endDate ?? startDate);
    updateField({ endsAt: toControlDatetime(nextEnd) });
  };

  const handleStartTimeUpdate = (value: string) => {
    const base = startDate ? new Date(startDate.getTime()) : new Date();
    const nextDate = applyTimeToDate(base, value);
    const nextEnd = resolveEndAfterStart(nextDate);
    updateField({
      startsAt: toControlDatetime(nextDate),
      endsAt: toControlDatetime(nextEnd),
    });
  };

  const handleEndTimeUpdate = (value: string) => {
    const base = endDate ? new Date(endDate.getTime()) : new Date();
    const nextDate = applyTimeToDate(base, value);
    updateField({ endsAt: toControlDatetime(nextDate) });
  };

  const handleDurationPreset = (minutes: number) => {
    const base = startDate ?? new Date();
    const nextEnd = new Date(base.getTime() + minutes * 60000);
    updateField({ startsAt: toControlDatetime(base), endsAt: toControlDatetime(nextEnd) });
  };

  const scrollToSection = (key: SectionKey) => {
    const target = document.getElementById(`event-${key}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Text variant="header-1" className="text-slate-900">
          {isEditing ? copy.heading.edit : copy.heading.create}
        </Text>
        <Text variant="body-2" color="secondary" className="max-w-3xl">
          {copy.intro}
        </Text>
        {user?.tenant?.slug && (
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            {copy.hints.tenantScope} <span className="font-semibold text-slate-800">{user.tenant.slug}</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <Card className="p-4 sticky top-6">
            <Text variant="caption-2" color="secondary">
              Навигация
            </Text>
            <div className="mt-3 flex flex-col gap-1">
              {sections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => scrollToSection(section.key)}
                  className="text-left rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {copy.sections[section.labelKey]}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Text variant="caption-2" color="secondary">
                  Дата
                </Text>
                <Text variant="subheader-2" className="text-slate-900">
                  {startDate ? formatDateFull(startDate, locale) : '—'}
                </Text>
              </div>
              <div>
                <Text variant="caption-2" color="secondary">
                  Время
                </Text>
                <Text variant="subheader-2" className="text-slate-900">
                  {startTime && endTime ? `${startTime}–${endTime}` : '—'}
                </Text>
              </div>
              <div>
                <Text variant="caption-2" color="secondary">
                  Видимость
                </Text>
                <Text variant="subheader-2" className="text-slate-900">
                  {copy.visibilityOptions.find((opt) => opt.value === formState.visibility)?.label ?? '—'}
                </Text>
              </div>
            </div>
          </Card>

          <SectionCard id="event-basics" title={copy.sections.basics} description={copy.placeholders.title}>
            <div className="grid gap-4">
              <FieldBlock label={copy.labels.title}>
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
          </SectionCard>

          <SectionCard id="event-schedule" title={copy.sections.schedule} description={copy.hints.timezone}>
            <div className="flex flex-wrap items-center gap-2">
              <Button view="outlined" size="s" onClick={() => handleDurationPreset(30)}>
                30 мин
              </Button>
              <Button view="outlined" size="s" onClick={() => handleDurationPreset(60)}>
                1 час
              </Button>
              <Button view="outlined" size="s" onClick={() => handleDurationPreset(120)}>
                2 часа
              </Button>
              {durationLabel && (
                <Text variant="caption-2" color="secondary">
                  {copy.hints.duration}: <span className="font-semibold text-slate-700">{durationLabel}</span>
                </Text>
              )}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card className="p-4 border border-slate-200 shadow-none">
                <Text variant="caption-2" color="secondary">
                  {copy.labels.startsAt}
                </Text>
                <div className="mt-2 grid gap-3">
                  <TextInput
                    size="l"
                    type="date"
                    value={toDateInputValue(startDate)}
                    onUpdate={handleStartDateUpdate}
                  />
                  <TextInput
                    size="l"
                    type="time"
                    value={startTime}
                    onUpdate={handleStartTimeUpdate}
                    placeholder={copy.placeholders.time}
                  />
                </div>
              </Card>

              <Card className="p-4 border border-slate-200 shadow-none">
                <Text variant="caption-2" color="secondary">
                  {copy.labels.endsAt}
                </Text>
                <div className="mt-2 grid gap-3">
                  <TextInput
                    size="l"
                    type="date"
                    value={toDateInputValue(endDate)}
                    onUpdate={handleEndDateUpdate}
                  />
                  <TextInput
                    size="l"
                    type="time"
                    value={endTime}
                    onUpdate={handleEndTimeUpdate}
                    placeholder={copy.placeholders.time}
                  />
                </div>
              </Card>
            </div>
          </SectionCard>

          <SectionCard id="event-location" title={copy.sections.location} description={copy.placeholders.locationText}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={copy.labels.locationText}>
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
          </SectionCard>

          <SectionCard id="event-audience" title={copy.sections.audience} description={copy.placeholders.visibility}>
            <div className="grid gap-4 md:grid-cols-2">
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
                  width="max"
                />
              </FieldBlock>
            </div>
          </SectionCard>

          <Card className="p-5">
            <Text variant="subheader-2" className="text-slate-900">
              Предпросмотр
            </Text>
            <Text variant="body-2" color="secondary" className="mt-1">
              {formState.title.trim() || copy.placeholders.title}
            </Text>
            <Text variant="body-2" color="secondary" className="mt-2 line-clamp-3">
              {formState.description.trim() || copy.placeholders.description}
            </Text>
            {startDate && (
              <Text variant="caption-2" color="secondary" className="mt-3">
                {formatDateShort(startDate, locale)}
              </Text>
            )}
          </Card>

          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <Card className="p-4">
            <div className="flex flex-col gap-2 md:flex-row md:justify-end">
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
        </div>
      </div>
    </div>
  );
};

export const EventForm: React.FC<EventFormProps> = (props) => (
  <EventFormInner key={props.event?.id ?? 'new'} {...props} />
);
