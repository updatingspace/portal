import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { Calendar } from '@gravity-ui/date-components';
import { dateTime, settings } from '@gravity-ui/date-utils';
import {
    Loader,
    Button,
    Pagination,
    Card,
    Text,
    Icon,
    Select,
    TextInput,
} from '@gravity-ui/uikit';
import { Plus as PlusIcon, Calendar as CalendarIcon, Clock } from '@gravity-ui/icons';
import { useAuth } from '../../../contexts/AuthContext';
import { useEventsList } from '../../../features/events';
import { EventsTimeline } from '../../../features/events/components';
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

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const getSafeDate = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateFull = (date: Date, locale: string) =>
    new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);

const formatRelativeDateLabel = (date: Date, locale: string) => {
    const today = startOfDay(new Date());
    const target = startOfDay(date);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

    const prefix =
        diffDays === 0
            ? 'Сегодня'
            : diffDays === 1
                ? 'Завтра'
                : diffDays === -1
                    ? 'Вчера'
                    : null;

    const formatted = formatDateFull(date, locale);
    return prefix ? `${prefix}, ${formatted}` : formatted;
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
    const routeBase = useRouteBase();
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
    }, [user]);

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
    }, [events, ownershipFilter, query, rsvpFilter, user, visibilityFilter]);

    const filteredEvents = useMemo(() => {
        if (selectedDate) {
            return baseFilteredEvents;
        }
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
    }, [activeTab, baseFilteredEvents, selectedDate]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEdit = (event: EventWithCounts) => {
        navigate(`${routeBase}/events/${event.id}/edit`);
    };

    const handleDateChange = (value: CalendarValue) => {
        setSelectedDate(toJsDate(value));
        setPage(1);
    };

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId as EventStatusFilter);
        setSelectedDate(null);
        setPage(1);
    };

    const handleResetFilters = () => {
        setQuery('');
        setRsvpFilter('all');
        setVisibilityFilter('all');
        setOwnershipFilter('all');
        setPage(1);
    };

    const hasFilters =
        query.trim().length > 0 ||
        rsvpFilter !== 'all' ||
        visibilityFilter !== 'all' ||
        ownershipFilter !== 'all';

    const listTitle = selectedDate
        ? formatRelativeDateLabel(selectedDate, locale)
        : activeTab === 'past'
            ? 'Прошедшие мероприятия'
            : 'Предстоящие мероприятия';

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
            <div className="container max-w-7xl mx-auto px-4 py-6">
                <div className="flex flex-col gap-6 lg:flex-row">
                    <div className="flex-1 space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <Text variant="header-1" className="text-slate-900 dark:text-white">
                                    Мероприятия
                                </Text>
                                <Text variant="body-2" color="secondary" className="mt-1">
                                    Планируйте встречи, следите за RSVP и держите расписание под рукой.
                                </Text>
                            </div>
                            {canCreate && (
                                <Link to={`${routeBase}/events/create`}>
                                    <Button view="action" size="l" className="shadow-sm">
                                        <Icon data={PlusIcon} />
                                        Создать
                                    </Button>
                                </Link>
                            )}
                        </div>

                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
                            {TAB_ITEMS.map((tab) => (
                                <Button
                                    key={tab.id}
                                    view="flat"
                                    size="l"
                                    onClick={() => handleTabChange(tab.id)}
                                    className={[
                                        'rounded-none px-2 pb-3 pt-2 transition-colors',
                                        activeTab === tab.id
                                            ? 'border-b-2 border-slate-900 dark:border-white text-slate-900 dark:text-white'
                                            : 'text-slate-500 dark:text-slate-400',
                                    ].join(' ')}
                                >
                                    <Icon data={tab.icon} size={16} />
                                    {tab.title}
                                </Button>
                            ))}
                        </div>

                        <Card className="p-4 bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-white/10">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                <TextInput
                                    size="l"
                                    value={query}
                                    onUpdate={setQuery}
                                    placeholder="Поиск по названию, месту или описанию"
                                    className="lg:flex-1"
                                />
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <Select
                                        size="l"
                                        value={[rsvpFilter]}
                                        onUpdate={(value) => setRsvpFilter((value[0] ?? 'all') as RsvpFilter)}
                                        options={RSVP_OPTIONS}
                                        width="max"
                                    />
                                    <Select
                                        size="l"
                                        value={[visibilityFilter]}
                                        onUpdate={(value) => setVisibilityFilter((value[0] ?? 'all') as VisibilityFilter)}
                                        options={VISIBILITY_OPTIONS}
                                        width="max"
                                    />
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

                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <Text variant="subheader-1" className="text-slate-900 dark:text-white">
                                        {listTitle}
                                    </Text>
                                    <Text variant="body-2" color="secondary">
                                        {filteredEvents.length
                                            ? `Показано ${filteredEvents.length} событий`
                                            : 'Список пока пуст'}
                                    </Text>
                                </div>
                                {selectedDate && (
                                    <Button
                                        view="outlined"
                                        size="m"
                                        onClick={() => {
                                            setSelectedDate(null);
                                            setPage(1);
                                        }}
                                    >
                                        Показать всё
                                    </Button>
                                )}
                            </div>

                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader size="l" />
                                </div>
                            ) : filteredEvents.length === 0 ? (
                                <Card className="p-10 text-center">
                                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <Icon data={CalendarIcon} size={30} className="text-slate-400" />
                                    </div>
                                    <Text variant="subheader-2" className="mb-2">
                                        Мероприятий не найдено
                                    </Text>
                                    <Text variant="body-2" color="secondary">
                                        Попробуйте изменить фильтры или выбрать другую дату в календаре.
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

                    <div className="lg:sticky lg:top-6 w-full lg:w-[320px] space-y-4">
                        <Card className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <Text variant="subheader-1" className="flex items-center gap-2">
                                    <Icon data={CalendarIcon} size={18} />
                                    Календарь
                                </Text>
                                {selectedDate && (
                                    <Button
                                        view="flat"
                                        size="xs"
                                        onClick={() => {
                                            setSelectedDate(null);
                                            setPage(1);
                                        }}
                                    >
                                        Сбросить
                                    </Button>
                                )}
                            </div>
                            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-3">
                                <Calendar
                                    value={toCalendarValue(selectedDate)}
                                    onUpdate={handleDateChange}
                                />
                            </div>
                            {selectedDate && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <Text variant="body-2" color="secondary">
                                        Выбрано: {formatRelativeDateLabel(selectedDate, locale)}
                                    </Text>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
