import React, { useMemo } from 'react';
import { Card, Button, Icon, Label, Text } from '@gravity-ui/uikit';
import { Pencil, MapPin, Person, Eye, Clock, ArrowRight, Calendar } from '@gravity-ui/icons';
import { Link } from 'react-router-dom';
import type { EventWithCounts } from '../../../features/events';

type Variant = 'list' | 'tile';

interface EventCardProps {
    event: EventWithCounts;
    onEdit?: (event: EventWithCounts) => void;
    showActions?: boolean;
    variant?: Variant;
}

const VISIBILITY_CONFIG: Record<string, { theme: 'info' | 'success' | 'warning' | 'danger' | 'normal' | 'utility'; label: string; accent: string }> = {
    public: { theme: 'info', label: 'Публичное', accent: 'bg-indigo-500' },
    community: { theme: 'success', label: 'Сообщество', accent: 'bg-emerald-500' },
    team: { theme: 'warning', label: 'Команда', accent: 'bg-amber-500' },
    private: { theme: 'danger', label: 'Приватное', accent: 'bg-rose-500' },
};

const RSVP_LABELS: Record<string, string> = {
    going: 'Иду',
    interested: 'Интересно',
    not_going: 'Не пойду',
};

const SCOPE_LABELS: Record<string, string> = {
    TENANT: 'Тенант',
    COMMUNITY: 'Сообщество',
    TEAM: 'Команда',
};

function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isWithinHours(date: Date, hours: number) {
    const now = new Date();
    return date.getTime() - now.getTime() <= hours * 3_600_000 && date.getTime() >= now.getTime();
}

const getSafeDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const EventCard: React.FC<EventCardProps> = ({
    event,
    onEdit,
    showActions = true,
    variant = 'list',
}) => {
    const startsAt = useMemo(() => getSafeDate(event.startsAt), [event.startsAt]);
    const endsAt = useMemo(() => getSafeDate(event.endsAt), [event.endsAt]);
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'ru-RU';

    const dateFmt = useMemo(() => {
        if (!startsAt) {
            return { day: '--', month: '--', time: '--:--', dayLabel: 'Дата уточняется' };
        }

        const day = startsAt.getDate();
        const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(startsAt).toUpperCase();
        const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(startsAt);

        const today = startOfDay(new Date());
        const d0 = startOfDay(startsAt);
        const diffDays = Math.round((d0.getTime() - today.getTime()) / 86_400_000);

        const dayLabel =
            diffDays === 0
                ? 'Сегодня'
                : diffDays === 1
                    ? 'Завтра'
                    : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(startsAt);

        return { day, month, time, dayLabel };
    }, [locale, startsAt]);

    const timeRange = useMemo(() => {
        if (!startsAt) return null;
        const startLabel = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(startsAt);
        if (!endsAt) return startLabel;
        const endLabel = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(endsAt);
        return `${startLabel}–${endLabel}`;
    }, [endsAt, locale, startsAt]);

    const visibility = VISIBILITY_CONFIG[event.visibility] || { theme: 'normal' as const, label: event.visibility, accent: 'bg-slate-400' };
    const totalAttendees = (event.rsvpCounts?.going || 0) + (event.rsvpCounts?.interested || 0);

    const now = new Date();
    const isPast = Boolean(startsAt && startsAt.getTime() < now.getTime());
    const isOngoing = Boolean(startsAt && endsAt && startsAt <= now && endsAt >= now);
    const isSoon = Boolean(startsAt && isWithinHours(startsAt, 24) && !isPast);

    return (
        <Card
            className={[
                'group relative overflow-hidden',
                'border border-slate-200 dark:border-white/10',
                'bg-white dark:bg-slate-900/50',
                'hover:border-slate-300 dark:hover:border-white/20',
                'hover:shadow-md dark:hover:shadow-2xl dark:hover:shadow-black/20',
                'transition-all duration-200',
                isPast ? 'opacity-75' : '',
            ].join(' ')}
        >
            <Link
                to={`/app/events/${event.id}`}
                className="absolute inset-0 z-0"
                aria-label={`Открыть мероприятие: ${event.title}`}
            />

            <div className={`absolute left-0 top-0 h-full w-1 ${visibility.accent} opacity-80`} />

            <div
                className={[
                    'relative z-10 flex gap-3',
                    variant === 'tile' ? 'p-4 flex-col' : 'px-4 py-3 sm:flex-row',
                ].join(' ')}
            >
                <div className={variant === 'tile' ? 'flex items-center gap-3' : 'flex-shrink-0 w-16'}>
                    <div className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] px-2 py-2 text-center min-w-[64px]">
                        <div className="text-xl font-semibold leading-none text-slate-900 dark:text-white">{dateFmt.day}</div>
                        <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{dateFmt.month}</div>
                        <div className="mt-2 inline-flex items-center justify-center rounded-md bg-slate-900/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-200">
                            {dateFmt.time}
                        </div>
                    </div>
                    {variant === 'tile' && (
                        <div className="flex flex-col">
                            <Text variant="caption-2" color="secondary">
                                {dateFmt.dayLabel}
                            </Text>
                            {timeRange && (
                                <Text variant="caption-2" color="secondary" className="flex items-center gap-1">
                                    <Icon data={Calendar} size={12} />
                                    {timeRange}
                                </Text>
                            )}
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Label theme={visibility.theme} size="xs">
                            <Icon data={Eye} size={12} className="mr-1" />
                            {visibility.label}
                        </Label>

                        <Label theme="utility" size="xs">{SCOPE_LABELS[event.scopeType] ?? event.scopeType}</Label>

                        {event.myRsvp && (
                            <Label theme="success" size="xs">
                                Вы: {RSVP_LABELS[event.myRsvp] || event.myRsvp}
                            </Label>
                        )}

                        {isOngoing && (
                            <Label theme="success" size="xs">
                                <Icon data={Clock} size={12} className="mr-1" />
                                Идет сейчас
                            </Label>
                        )}

                        {!isOngoing && isSoon && (
                            <Label theme="warning" size="xs">
                                <Icon data={Clock} size={12} className="mr-1" />
                                Скоро
                            </Label>
                        )}

                        {isPast && !isOngoing && (
                            <Label theme="normal" size="xs">
                                <Icon data={Clock} size={12} className="mr-1" />
                                Завершено
                            </Label>
                        )}

                        {variant === 'list' && (
                            <Text variant="caption-2" color="secondary" className="ml-1">
                                {dateFmt.dayLabel}
                            </Text>
                        )}
                    </div>

                    <div className="mt-1 min-w-0">
                        <Text
                            variant="subheader-2"
                            className="line-clamp-1 text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                        >
                            {event.title}
                        </Text>
                    </div>

                    {event.description && (
                        <Text variant="body-1" color="secondary" className="mt-1 line-clamp-2">
                            {event.description}
                        </Text>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                        {event.locationText && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <Icon data={MapPin} size={14} />
                                {event.locationUrl ? (
                                    <a
                                        href={event.locationUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    >
                                        {event.locationText}
                                    </a>
                                ) : (
                                    <span className="line-clamp-1">{event.locationText}</span>
                                )}
                            </div>
                        )}

                        {timeRange && variant === 'list' && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <Icon data={Calendar} size={14} />
                                <span>{timeRange}</span>
                            </div>
                        )}

                        {totalAttendees > 0 && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <Icon data={Person} size={14} />
                                <span className="whitespace-nowrap">
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{event.rsvpCounts.going}</span>
                                    {event.rsvpCounts.interested > 0 && (
                                        <span className="text-slate-400 dark:text-slate-500"> {' '}+{event.rsvpCounts.interested}</span>
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {showActions && (
                    <div className="flex-shrink-0 flex items-start gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Link to={`/app/events/${event.id}`} onClick={(e) => e.stopPropagation()}>
                            <Button view="flat" size="m" title="Подробнее">
                                <Icon data={ArrowRight} />
                            </Button>
                        </Link>

                        {onEdit && (
                            <Button
                                view="flat"
                                size="m"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(event);
                                }}
                                title="Редактировать"
                            >
                                <Icon data={Pencil} />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
};
