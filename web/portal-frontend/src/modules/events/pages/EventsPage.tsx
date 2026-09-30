import { ContentDialog } from '../../../shared/ui/portal/ContentDialog';
import { SectionTabs } from '../../../shared/ui/portal/SectionTabs';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Pagination, Select, TextInput } from '@gravity-ui/uikit';
import { Calendar } from '@gravity-ui/date-components';
import { dateTime, settings } from '@gravity-ui/date-utils';
import { useAuth } from '../../../contexts/AuthContext';
import {
  useEventsList,
  type RsvpStatus,
  type EventVisibility,
  type FetchEventsParams,
} from '../../../features/events';
import { EventsTimeline } from '../../../features/events/components/EventsTimeline';
import { can } from '../../../features/rbac/can';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import {
  FormField,
  InlineError,
  PageLayout,
  PageState,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';

const PAGE_SIZE = 20;
export function EventsPage() {
  const { user } = useAuth();
  const mobile = useMediaQuery('(max-width: 1079px)');
  const base = useRouteBase();
  const navigate = useNavigate();
  const t = useUITranslation();
  const { timezone, locale } = useFormatters();
  const [params, setParams] = useSearchParams();
  const [panel, setPanel] = useState<'filters' | 'calendar' | null>(null);
  const [calendarReady, setCalendarReady] = useState(false);
  useEffect(() => {
    let current = true;
    settings.loadLocale(locale).then(() => {
      if (current) setCalendarReady(true);
    });
    return () => {
      current = false;
    };
  }, [locale]);
  const period = params.get('period') === 'past' ? 'past' : 'upcoming';
  const query = params.get('q') ?? '';
  const owner = params.get('owner') === 'mine' ? 'mine' : 'all';
  const rsvp = ['going', 'interested', 'not_going'].includes(
    params.get('rsvp') ?? '',
  )
    ? (params.get('rsvp') as RsvpStatus)
    : undefined;
  const visibility = ['public', 'community', 'team', 'private'].includes(
    params.get('visibility') ?? '',
  )
    ? (params.get('visibility') as EventVisibility)
    : undefined;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const day = params.get('date') ?? '';
  const selectedDay = /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? dateTime({ input: day, timeZone: timezone })
    : null;
  const selected = selectedDay?.isValid() ? selectedDay : null;
  const filters: FetchEventsParams = {
    q: query || undefined,
    mine: owner === 'mine',
    rsvp,
    visibility,
    period: selected ? undefined : period,
    from: selected?.startOf('day').toISOString(),
    to: selected?.endOf('day').toISOString(),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  const { data, isLoading, isError, refetch } = useEventsList(filters);
  const events = data?.items ?? [];
  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: true },
    );
  const reset = () =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        ['q', 'owner', 'rsvp', 'visibility', 'page', 'date'].forEach((key) =>
          next.delete(key),
        );
        return next;
      },
      { replace: true },
    );
  const hasFilters = Boolean(
    query || owner === 'mine' || rsvp || visibility || selected,
  );
  const filterControls = (
    <div className="portal-event-filters">
      <FormField label={t('Поиск событий', 'Search events')}>
        {(props) => (
          <TextInput
            {...props}
            size="xl"
            value={query}
            onUpdate={(value) => update('q', value)}
            placeholder={t(
              'Название, место или описание',
              'Title, location or description',
            )}
          />
        )}
      </FormField>
      <FormField label={t('Мой ответ', 'My response')}>
        {(props) => (
          <Select
            {...props}
            size="xl"
            width="max"
            value={[rsvp ?? 'all']}
            onUpdate={(values) =>
              update('rsvp', values[0] === 'all' ? '' : values[0])
            }
            options={[
              {
                value: 'all',
                content: t('Все ответы', 'All responses'),
              },
              { value: 'going', content: t('Пойду', 'Going') },
              {
                value: 'interested',
                content: t('Интересно', 'Interested'),
              },
              {
                value: 'not_going',
                content: t('Не пойду', 'Not going'),
              },
            ]}
          />
        )}
      </FormField>
      <FormField label={t('Аудитория', 'Audience')}>
        {(props) => (
          <Select
            {...props}
            size="xl"
            width="max"
            value={[visibility ?? 'all']}
            onUpdate={(values) =>
              update('visibility', values[0] === 'all' ? '' : values[0])
            }
            options={[
              {
                value: 'all',
                content: t('Любая аудитория', 'All audiences'),
              },
              {
                value: 'public',
                content: t('Сообщество', 'Community'),
              },
              { value: 'community', content: t('Группа', 'Group') },
              { value: 'team', content: t('Команда', 'Team') },
              {
                value: 'private',
                content: t('Ограниченный доступ', 'Restricted access'),
              },
            ]}
          />
        )}
      </FormField>
      <FormField label={t('Организатор', 'Organizer')}>
        {(props) => (
          <Select
            {...props}
            size="xl"
            width="max"
            value={[owner]}
            onUpdate={(values) =>
              update('owner', values[0] === 'all' ? '' : values[0])
            }
            options={[
              { value: 'all', content: t('Все события', 'All events') },
              {
                value: 'mine',
                content: t('Созданные мной', 'Created by me'),
              },
            ]}
          />
        )}
      </FormField>
      {hasFilters && (
        <Button onClick={reset}>
          {t('Сбросить фильтры', 'Clear filters')}
        </Button>
      )}
    </div>
  );
  const calendar = (
    <div className="portal-events-calendar">
      {calendarReady && (
        <Calendar
          key={locale}
          value={selected}
          timeZone={timezone}
          onUpdate={(value) => update('date', value.format('YYYY-MM-DD'))}
        />
      )}
      <p>{timezone}</p>
      {selected && (
        <Button onClick={() => update('date', '')}>
          {t('Показать всё', 'Show all')}
        </Button>
      )}
    </div>
  );
  return (
    <PageLayout
      title={t('События', 'Events')}
      actions={
        can(user, 'events.event.create') && (
          <Button
            view="action"
            onClick={() => navigate(`${base}/events/create`)}
          >
            {t('Создать событие', 'Create event')}
          </Button>
        )
      }
    >
      <div className="portal-events-layout">
        <div className="portal-stack">
          <SectionTabs
            label={t('Период', 'Period')}
            value={period}
            items={[
              { id: 'upcoming', label: t('Предстоящие', 'Upcoming') },
              { id: 'past', label: t('Прошедшие', 'Past') },
            ]}
            onChange={(value) =>
              setParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  next.set('period', value);
                  next.delete('date');
                  next.delete('page');
                  return next;
                },
                { replace: true },
              )
            }
          />
          <div className="portal-event-list-tools">
            <span>{timezone}</span>
            {mobile && (
              <>
                <Button
                  size="xl"
                  view="flat"
                  onClick={() => setPanel('calendar')}
                >
                  {t('Календарь', 'Calendar')}
                </Button>
                <Button
                  size="xl"
                  view="flat"
                  onClick={() => setPanel('filters')}
                >
                  {t('Фильтры событий', 'Event filters')}
                  {hasFilters ? ' •' : ''}
                </Button>
              </>
            )}
          </div>
          {selected && (
            <Button
              size="xl"
              view="outlined"
              onClick={() => update('date', '')}
            >
              {day} ×
            </Button>
          )}
          {!mobile && filterControls}
          {isError && (
            <InlineError onRetry={() => void refetch()}>
              {t(
                'Не удалось загрузить события. Попробуйте ещё раз.',
                'Unable to load events. Try again.',
              )}
            </InlineError>
          )}
          {isLoading && (
            <PageState
              kind="loading"
              title={t('Загружаем события', 'Loading events')}
            />
          )}
          {!isLoading && !isError && events.length === 0 && (
            <PageState
              kind="empty"
              title={
                hasFilters
                  ? t('Событий не найдено', 'No matching events')
                  : t('Здесь пока нет событий', 'No events yet')
              }
              description={
                hasFilters
                  ? t(
                      'Измените фильтры или выберите другой день.',
                      'Change filters or choose another day.',
                    )
                  : t(
                      'Встречи сообщества появятся здесь.',
                      'Community events will appear here.',
                    )
              }
            />
          )}
          <EventsTimeline
            events={events}
            onEdit={
              can(user, 'events.event.manage')
                ? (event) => navigate(`${base}/events/${event.id}/edit`)
                : undefined
            }
          />
          {(data?.meta.total ?? 0) > PAGE_SIZE && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data?.meta.total ?? 0}
              onUpdate={(value) => update('page', String(value))}
            />
          )}
        </div>
        {!mobile && calendar}
      </div>
      {mobile && panel && (
        <ContentDialog
          title={
            panel === 'calendar'
              ? t('Календарь', 'Calendar')
              : t('Фильтры событий', 'Event filters')
          }
          onClose={() => setPanel(null)}
        >
          {panel === 'calendar' ? calendar : filterControls}
          <Button size="xl" view="action" onClick={() => setPanel(null)}>
            {t('Показать события', 'Show events')}
          </Button>
        </ContentDialog>
      )}
    </PageLayout>
  );
}
