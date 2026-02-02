import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar } from '@gravity-ui/date-components';
import { dateTime, settings } from '@gravity-ui/date-utils';
import {
    Loader,
    Button,
    Pagination,
    Card,
    Text,
    Icon,
    Label,
    Select,
    TextInput,
} from '@gravity-ui/uikit';
import { Plus as PlusIcon, Calendar as CalendarIcon, Clock, Xmark } from '@gravity-ui/icons';
import { useAuth } from '../../../contexts/AuthContext';
import { useEventsList } from '../../../features/events';
import { EventsTimeline, EventCard } from '../../../features/events/components';
import { can } from '../../../features/rbac/can';
import type { EventVisibility, EventWithCounts, RsvpStatus } from '../../../features/events';

const PAGE_SIZE = 20;

type CalendarValue = React.ComponentProps<typeof Calendar>['value'];

type CalendarLike = {
    toDate?: () => Date;
    toJSDate?: () => Date;
    year?: () => number;
    month?: () => number;
    date?: () => number;
};

type EventStatusFilter = 'upcoming' | 'past';

type OwnershipFilter = 'all' | 'mine';

type RsvpFilter = 'all' | RsvpStatus;

type VisibilityFilter = 'all' | EventVisibility;

const toCalendarValue = (date: Date | null): CalendarValue => {
    if (!date) return null;
    return dateTime({ input: date }) as CalendarValue;
};

const toJsDate = (value: CalendarValue): Date | null => {
    if (!value || typeof value !== 'object') return null;
    const v = value as CalendarLike;

    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.toJSDate === 'function') return v.toJSDate();
    if (typeof v.year === 'function' && typeof v.month === 'function' && typeof v.date === 'function') {
        return new Date(v.year(), v.month() - 1, v.date());
    }
    return null;
};

const formatDateFull = (date: Date, locale: string) =>
    new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);

const formatDateWithWeekday = (date: Date, locale: string) =>
    new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    }).format(date);

const formatDateTimeRange = (event: EventWithCounts, locale: string) => {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 'Дата уточняется';
    }
    const dayLabel = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
    }).format(start);
    const startTime = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(start);
    const endTime = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(end);
    return `${dayLabel} · ${startTime}–${endTime}`;
};

const isSameDay = (date: Date, target: Date) =>
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate();

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const getSafeDate = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const TAB_ITEMS = [
    { id: 'upcoming', title: 'Предстоящие', icon: CalendarIcon },
    { id: 'past', title: 'Прошедшие', icon: Clock },
] as const;

const RSVP_OPTIONS: { value: RsvpFilter; content: string }[] = [
    { value: 'all', content: 'Все ответы' },
    { value: 'going', content: 'Иду' },
    { value: 'interested', content: 'Интересно' },
    { value: 'not_going', content: 'Не пойду' },
];

const VISIBILITY_OPTIONS: { value: VisibilityFilter; content: string }[] = [
    { value: 'all', content: 'Любая видимость' },
    { value: 'public', content: 'Публичное' },
    { value: 'community', content: 'Сообщество' },
    { value: 'team', content: 'Команда' },
    { value: 'private', content: 'Приватное' },
];

const OWNERSHIP_OPTIONS: { value: OwnershipFilter; content: string }[] = [
    { value: 'all', content: 'Все события' },
    { value: 'mine', content: 'Создано мной' },
];

export const EventsPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const navigate = useNavigate();
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [activeTab, setActiveTab] = useState<EventStatusFilter>('upcoming');
    const [query, setQuery] = useState('');
    const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>('all');
    const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
    const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');

    const rawLocale = user?.language ?? 'ru';
    const locale = rawLocale.toLowerCase().startsWith('ru') ? 'ru-RU' : 'en-US';
    const calendarLocale = rawLocale.toLowerCase().startsWith('ru') ? 'ru' : 'en';

    React.useEffect(() => {
        settings.loadLocale(calendarLocale).catch(() => undefined);
    }, [calendarLocale]);

    const offset = (page - 1) * PAGE_SIZE;

    const dateRange = useMemo(() => {
        const now = new Date();
        if (selectedDate) {
            const day = startOfDay(selectedDate);
            return { from: day, to: endOfDay(day) };
        }
        if (activeTab === 'past') {
            const to = endOfDay(now);
            return { from: addDays(startOfDay(now), -30), to };
        }
        const from = now;
        return { from, to: addDays(now, 60) };
    }, [activeTab, selectedDate]);

    const scopeFilters = useMemo(() => {
        if (user?.tenant?.id) {
            return { scopeType: 'TENANT' as const, scopeId: user.tenant.id };
        }
        return {};
    }, [user?.tenant?.id]);

    const { data, isLoading, isError, refetch } = useEventsList({
        limit: PAGE_SIZE,
        offset,
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        ...scopeFilters,
    });

    const events = useMemo(() => data?.items ?? [], [data?.items]);
    const pagination = data?.meta;
    const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 1;

    const canCreate = can(user, 'events.event.create');
    const canManage = can(user, 'events.event.manage');

    const { upcomingCount, pastCount, goingCount, interestedCount, myEventsCount } = useMemo(() => {
        const now = new Date();
        let upcoming = 0;
        let past = 0;
        let going = 0;
        let interested = 0;
        let mine = 0;
        for (const event of events) {
            const start = getSafeDate(event.startsAt);
            const end = getSafeDate(event.endsAt) ?? start;
            const isPast = Boolean(end && end < now);
            if (isPast) {
                past += 1;
            } else {
                upcoming += 1;
            }
            if (event.myRsvp === 'going') going += 1;
            if (event.myRsvp === 'interested') interested += 1;
            if (user?.id && event.createdBy === user.id) mine += 1;
        }
        return {
            upcomingCount: upcoming,
            pastCount: past,
            goingCount: going,
            interestedCount: interested,
            myEventsCount: mine,
        };
    }, [events, user?.id]);

    const baseFilteredEvents = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return events
            .filter((event) => {
                if (rsvpFilter !== 'all' && event.myRsvp !== rsvpFilter) return false;
                if (visibilityFilter !== 'all' && event.visibility !== visibilityFilter) return false;
                if (ownershipFilter === 'mine') {
                    if (!user?.id) return false;
                    if (event.createdBy !== user.id) return false;
                }

                if (normalizedQuery) {
                    const haystack = [event.title, event.description, event.locationText]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                    if (!haystack.includes(normalizedQuery)) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const aDate = getSafeDate(a.startsAt);
                const bDate = getSafeDate(b.startsAt);
                if (!aDate || !bDate) return 0;
                return aDate.getTime() - bDate.getTime();
            });
    }, [events, ownershipFilter, query, rsvpFilter, user?.id, visibilityFilter]);

    const filteredEvents = useMemo(() => {
        const now = new Date();
        return baseFilteredEvents.filter((event) => {
            const start = getSafeDate(event.startsAt);
            const end = getSafeDate(event.endsAt) ?? start;
            const isPast = Boolean(end && end < now);
            const isUpcoming = !isPast;

            if (activeTab === 'upcoming' && !isUpcoming) return false;
            if (activeTab === 'past' && !isPast) return false;
            return true;
        });
    }, [activeTab, baseFilteredEvents]);

    const focusDate = selectedDate ?? new Date();

    const agendaEvents = useMemo(() => {
        if (!filteredEvents.length) return [] as EventWithCounts[];
        if (!selectedDate) {
            const anchor = startOfDay(new Date());
            const start = activeTab === 'past' ? addDays(anchor, -7) : anchor;
            const end = activeTab === 'past' ? anchor : addDays(anchor, 7);
            return filteredEvents.filter((event) => {
                const eventDate = getSafeDate(event.startsAt);
                return Boolean(eventDate && eventDate >= start && eventDate < end);
            });
        }
        return filteredEvents.filter((event) => {
            const startsAt = getSafeDate(event.startsAt);
            if (!startsAt) return false;
            return isSameDay(startsAt, focusDate);
        });
    }, [activeTab, filteredEvents, focusDate, selectedDate]);

    const nextEvent = useMemo(() => {
        const now = new Date();
        return (
            baseFilteredEvents
                .map((event) => ({ event, start: getSafeDate(event.startsAt) }))
                .filter((item) => item.start && item.start >= now)
                .sort((a, b) => (a.start && b.start ? a.start.getTime() - b.start.getTime() : 0))
                .map((item) => item.event)[0] ?? null
        );
    }, [baseFilteredEvents]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEdit = (event: EventWithCounts) => {
        navigate(`/app/events/${event.id}/edit`);
    };

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId as EventStatusFilter);
        setPage(1);
    };

    const handleResetFilters = () => {
        setQuery('');
        setRsvpFilter('all');
        setVisibilityFilter('all');
        setOwnershipFilter('all');
        setSelectedDate(new Date());
        setPage(1);
    };

    const hasFilters =
        query.trim().length > 0 ||
        rsvpFilter !== 'all' ||
        visibilityFilter !== 'all' ||
        ownershipFilter !== 'all';

    if (isLoading && !events.length) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader size="l" />
                    <Text variant="body-2" color="secondary" className="mt-4">
                        Загружаем события...
                    </Text>
                </div>
            </div>
        );
    }

    if (isError && !events.length) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <Icon data={Xmark} size={32} className="text-red-500" />
                    </div>
                    <Text variant="subheader-2" className="mb-2">Ошибка загрузки</Text>
                    <Text variant="body-2" color="secondary" className="mb-6">
                        Не удалось загрузить мероприятия. Проверьте соединение и попробуйте снова.
                    </Text>
                    <Button onClick={() => refetch()} view="action" size="l" width="max">
                        Повторить
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="container max-w-7xl mx-auto px-4 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <Text variant="header-1" className="text-slate-900 dark:text-white">
                                Мероприятия
                            </Text>
                        </div>
                        {canCreate && (
                            <Link to="/app/events/create">
                                <Button view="action" size="l">
                                    <Icon data={PlusIcon} />
                                    Создать мероприятие
                                </Button>
                            </Link>
                        )}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                        {TAB_ITEMS.map((tab) => (
                            <Button
                                key={tab.id}
                                view={activeTab === tab.id ? 'action' : 'outlined'}
                                size="l"
                                onClick={() => handleTabChange(tab.id)}
                            >
                                <Icon data={tab.icon} size={16} />
                                {tab.title}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="container max-w-7xl mx-auto px-4 py-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Text variant="subheader-1">Ближайшее событие</Text>
                                {nextEvent && (
                                    <Text variant="caption-2" color="secondary">
                                        {formatDateTimeRange(nextEvent, locale)}
                                    </Text>
                                )}
                            </div>
                            {nextEvent ? (
                                <EventCard event={nextEvent} onEdit={canManage ? handleEdit : undefined} showActions={false} variant="tile" />
                            ) : (
                                <Card className="p-6 text-center">
                                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <Icon data={CalendarIcon} size={30} className="text-slate-400" />
                                    </div>
                                    <Text variant="subheader-2" className="mb-2">Пока пусто</Text>
                                    <Text variant="body-2" color="secondary">
                                        Создайте событие или настройте фильтры, чтобы увидеть расписание.
                                    </Text>
                                </Card>
                            )}
                        </div>

                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Text variant="subheader-1">
                                        {selectedDate
                                            ? formatDateWithWeekday(focusDate, locale)
                                            : activeTab === 'past'
                                                ? 'Последние 7 дней'
                                                : 'Ближайшие 7 дней'}
                                    </Text>
                                    <Text variant="body-2" color="secondary">
                                        Повестка дня
                                    </Text>
                                </div>
                                {selectedDate && (
                                    <Button view="flat" size="s" onClick={() => setSelectedDate(null)}>
                                        Сбросить
                                    </Button>
                                )}
                            </div>
                            <div className="mt-4 space-y-2">
                                {agendaEvents.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center">
                                        <Text variant="body-2" color="secondary">
                                            {selectedDate
                                                ? 'На эту дату событий нет'
                                                : activeTab === 'past'
                                                    ? 'За последнюю неделю событий нет'
                                                    : 'В ближайшую неделю событий нет'}
                                        </Text>
                                        <Text variant="caption-2" color="secondary" className="mt-1">
                                            Попробуйте выбрать другую дату или изменить фильтры.
                                        </Text>
                                    </div>
                                ) : (
                                    agendaEvents.map((event) => (
                                        <EventCard
                                            key={`agenda-${event.id}`}
                                            event={event}
                                            onEdit={canManage ? handleEdit : undefined}
                                            showActions={false}
                                            variant="tile"
                                        />
                                    ))
                                )}
                            </div>
                        </Card>

                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <Text variant="subheader-1">
                                        {activeTab === 'past' ? 'Прошедшие события' : 'Расписание'}
                                    </Text>
                                    <Text variant="body-2" color="secondary">
                                        {filteredEvents.length
                                            ? `Показано ${filteredEvents.length} событий`
                                            : 'Подборка по выбранным фильтрам'}
                                    </Text>
                                </div>
                                {hasFilters && (
                                    <Button view="outlined" size="m" onClick={handleResetFilters}>
                                        Сбросить фильтры
                                    </Button>
                                )}
                            </div>

                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader size="l" />
                                </div>
                            ) : filteredEvents.length === 0 ? (
                                <Card className="p-12 text-center">
                                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <Icon data={CalendarIcon} size={40} className="text-slate-400" />
                                    </div>
                                    <Text variant="subheader-2" className="mb-2">
                                        Нет событий по выбранным условиям
                                    </Text>
                                    <Text variant="body-2" color="secondary" className="mb-6">
                                        Измените фильтры или переключитесь на другую вкладку.
                                    </Text>
                                </Card>
                            ) : (
                                <EventsTimeline events={filteredEvents} onEdit={canManage ? handleEdit : undefined} />
                            )}

                            {totalPages > 1 && (
                                <div className="mt-8 flex justify-center">
                                    <Pagination
                                        page={page}
                                        pageSize={PAGE_SIZE}
                                        total={pagination?.total || 0}
                                        onUpdate={handlePageChange}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:sticky lg:top-4 space-y-4">
                        <Card className="p-4">
                            <Text variant="subheader-1" className="mb-3">Фильтры</Text>
                            <div className="space-y-3">
                                <div>
                                    <Text variant="caption-2" color="secondary">Поиск</Text>
                                    <TextInput
                                        size="l"
                                        value={query}
                                        onUpdate={setQuery}
                                        placeholder="Название, место или описание"
                                    />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <Text variant="caption-2" color="secondary">RSVP</Text>
                                        <Select
                                            size="l"
                                            value={[rsvpFilter]}
                                            onUpdate={(value) => setRsvpFilter((value[0] ?? 'all') as RsvpFilter)}
                                            options={RSVP_OPTIONS}
                                            width="max"
                                        />
                                    </div>
                                    <div>
                                        <Text variant="caption-2" color="secondary">Видимость</Text>
                                        <Select
                                            size="l"
                                            value={[visibilityFilter]}
                                            onUpdate={(value) => setVisibilityFilter((value[0] ?? 'all') as VisibilityFilter)}
                                            options={VISIBILITY_OPTIONS}
                                            width="max"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Text variant="caption-2" color="secondary">Автор</Text>
                                    <Select
                                        size="l"
                                        value={[ownershipFilter]}
                                        onUpdate={(value) => setOwnershipFilter((value[0] ?? 'all') as OwnershipFilter)}
                                        options={OWNERSHIP_OPTIONS}
                                            width="max"
                                    />
                                </div>
                                {hasFilters && (
                                    <Button view="flat" size="m" onClick={handleResetFilters}>
                                        Сбросить
                                    </Button>
                                )}
                            </div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <Text variant="subheader-1" className="flex items-center gap-2">
                                    <Icon data={CalendarIcon} size={18} />
                                    Календарь
                                </Text>
                                {selectedDate && (
                                    <Button view="flat" size="xs" onClick={() => setSelectedDate(null)}>
                                        Сбросить
                                    </Button>
                                )}
                            </div>
                            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-3">
                                <Calendar
                                    value={toCalendarValue(selectedDate)}
                                    onUpdate={(value) => setSelectedDate(toJsDate(value))}
                                />
                            </div>
                            {selectedDate && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <Text variant="body-2" color="secondary">
                                        Выбрано: {formatDateFull(selectedDate, locale)}
                                    </Text>
                                </div>
                            )}
                        </Card>

                        <Card className="p-4">
                            <Text variant="subheader-1" className="mb-4">
                                Сводка
                            </Text>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Text variant="body-2" color="secondary">Всего событий</Text>
                                    <Label theme="normal" size="s">{events.length}</Label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <Text variant="body-2" color="secondary">Предстоящие</Text>
                                    <Label theme="success" size="s">{upcomingCount}</Label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <Text variant="body-2" color="secondary">Прошедшие</Text>
                                    <Label theme="info" size="s">{pastCount}</Label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <Text variant="body-2" color="secondary">Мой RSVP: иду</Text>
                                    <Label theme="success" size="s">{goingCount}</Label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <Text variant="body-2" color="secondary">Мой RSVP: интересно</Text>
                                    <Label theme="warning" size="s">{interestedCount}</Label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <Text variant="body-2" color="secondary">Создано мной</Text>
                                    <Label theme="utility" size="s">{myEventsCount}</Label>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
