import React, { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { Button, Card, Icon, Label, Loader, Text } from '@gravity-ui/uikit';
import { Calendar as CalendarIcon, Clock, MapPin, Pencil, Eye, Person } from '@gravity-ui/icons';
import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import {
    useEvent,
    useExportEventAsIcs,
    useSetRsvp,
    type RsvpStatus,
} from '../../../features/events';
import { EventRsvpCounts } from '../../../features/events/components';
import { notifyApiError } from '../../../utils/apiErrorHandling';
import { toaster } from '../../../toaster';

const VISIBILITY_LABELS: Record<string, { label: string; theme: 'info' | 'success' | 'warning' | 'danger' | 'normal' | 'utility' }> = {
    public: { label: 'Публичное', theme: 'info' },
    community: { label: 'Сообщество', theme: 'success' },
    team: { label: 'Команда', theme: 'warning' },
    private: { label: 'Приватное', theme: 'danger' },
};

const SCOPE_LABELS: Record<string, string> = {
    TENANT: 'Тенант',
    COMMUNITY: 'Сообщество',
    TEAM: 'Команда',
};

const formatDateTime = (value: string, locale: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Дата уточняется';
    return new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

const formatTime = (value: string, locale: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
};

const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    const diffMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    const parts = [] as string[];
    if (hours > 0) parts.push(`${hours}ч`);
    if (minutes > 0) parts.push(`${minutes}м`);
    return parts.length > 0 ? parts.join(' ') : null;
};

const formatRelative = (start: Date, now: Date) => {
    const diffMinutes = Math.round((start.getTime() - now.getTime()) / 60000);
    if (diffMinutes <= 0) return null;
    if (diffMinutes < 60) return `через ${diffMinutes} мин`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `через ${diffHours} ч`;
    const diffDays = Math.round(diffHours / 24);
    return `через ${diffDays} дн`;
};

export const EventPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const routeBase = useRouteBase();
    const { user } = useAuth();

    const locale = user?.language?.toLowerCase().startsWith('ru') ? 'ru-RU' : 'en-US';

    const {
        data: event,
        isLoading,
        isError,
    } = useEvent(id || '');

    const rsvpMutation = useSetRsvp(id || '');
    const exportMutation = useExportEventAsIcs();

    const canManage = can(user, 'events.event.manage');
    const canRsvp = can(user, 'events.rsvp.set');

    const visibility = event ? (VISIBILITY_LABELS[event.visibility] ?? { label: event.visibility, theme: 'normal' }) : null;

    const { isPast, isOngoing, relativeLabel, durationLabel } = useMemo(() => {
        if (!event) {
            return { isPast: false, isOngoing: false, relativeLabel: null, durationLabel: null };
        }
        const start = new Date(event.startsAt);
        const end = new Date(event.endsAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return { isPast: false, isOngoing: false, relativeLabel: null, durationLabel: null };
        }
        const now = new Date();
        const ongoing = start <= now && end >= now;
        const past = end < now;
        return {
            isPast: past,
            isOngoing: ongoing,
            relativeLabel: !past && !ongoing ? formatRelative(start, now) : null,
            durationLabel: formatDuration(event.startsAt, event.endsAt),
        };
    }, [event]);

    const handleRsvp = async (status: RsvpStatus) => {
        if (!id) return;
        try {
            rsvpMutation.mutate(status, {
                onSuccess: () => {
                    toaster.add({
                        name: `rsvp-${status}-${Date.now()}`,
                        title: 'RSVP обновлен',
                        content: status === 'going' ? 'Отметили: иду' : status === 'interested' ? 'Отметили: интересно' : 'Отметили: не пойду',
                        theme: 'success',
                    });
                },
                onError: (error) => {
                    notifyApiError(error, 'RSVP не удалось сохранить');
                },
            });
        } catch (e) {
            notifyApiError(e, 'RSVP не удалось сохранить');
        }
    };

    const handleEdit = () => {
        navigate(`${routeBase}/events/${id}/edit`);
    };

    const handleExport = () => {
        if (!id) return;
        exportMutation.mutate(id, {
            onSuccess: () => {
                toaster.add({
                    name: `export-${Date.now()}`,
                    title: 'Календарь готов',
                    content: 'Файл .ics скачан',
                    theme: 'success',
                });
            },
            onError: (error) => {
                notifyApiError(error, 'Не удалось экспортировать событие');
            },
        });
    };

    const handleCopyLink = async () => {
        if (!event) return;
        const url = `${window.location.origin}${routeBase}/events/${event.id}`;
        try {
            await navigator.clipboard.writeText(url);
            toaster.add({
                name: `copy-${Date.now()}`,
                title: 'Ссылка скопирована',
                content: 'Можете делиться событием',
                theme: 'success',
            });
        } catch (error) {
            notifyApiError(error, 'Не удалось скопировать ссылку');
        }
    };

    if (isLoading && !event) {
        return (
            <div className="flex justify-center p-8">
                <Loader size="l" />
            </div>
        );
    }

    if (isError || !event) {
        return (
            <div className="container py-6 max-w-3xl mx-auto">
                <Card className="p-6">
                    <Text variant="subheader-2" className="text-red-600">Событие не найдено</Text>
                    <Button onClick={() => navigate(`${routeBase}/events`)} view="outlined" className="mt-4">
                        Вернуться к событиям
                    </Button>
                </Card>
            </div>
        );
    }

    const startTime = formatTime(event.startsAt, locale);
    const endTime = formatTime(event.endsAt, locale);

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950">
            <div className="container py-6 max-w-6xl mx-auto px-4">
                <Card className="p-6 mb-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                            <Text variant="header-1" className="text-slate-900 dark:text-white">
                                {event.title}
                            </Text>
                            <div className="flex flex-wrap items-center gap-2">
                                {visibility && (
                                    <Label theme={visibility.theme} size="s">
                                        <Icon data={Eye} size={12} className="mr-1" />
                                        {visibility.label}
                                    </Label>
                                )}
                                <Label theme="utility" size="s">
                                    {SCOPE_LABELS[event.scopeType] ?? event.scopeType}
                                </Label>
                                {event.myRsvp && (
                                    <Label theme="success" size="s">
                                        Мой RSVP: {event.myRsvp === 'going' ? 'иду' : event.myRsvp === 'interested' ? 'интересно' : 'не пойду'}
                                    </Label>
                                )}
                                {isOngoing && (
                                    <Label theme="success" size="s">
                                        <Icon data={Clock} size={12} className="mr-1" />
                                        Идет сейчас
                                    </Label>
                                )}
                                {!isOngoing && isPast && (
                                    <Label theme="normal" size="s">
                                        <Icon data={Clock} size={12} className="mr-1" />
                                        Завершено
                                    </Label>
                                )}
                                {!isOngoing && !isPast && relativeLabel && (
                                    <Label theme="warning" size="s">
                                        <Icon data={Clock} size={12} className="mr-1" />
                                        {relativeLabel}
                                    </Label>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link to={`${routeBase}/events`}>
                                <Button view="flat" size="m">Назад</Button>
                            </Link>
                            {canManage && (
                                <Button onClick={handleEdit} view="outlined" size="m">
                                    <Icon data={Pencil} />
                                    Редактировать
                                </Button>
                            )}
                            <Button onClick={handleExport} view="outlined" size="m" loading={exportMutation.isPending}>
                                <Icon data={CalendarIcon} />
                                В календарь
                            </Button>
                            <Button onClick={handleCopyLink} view="flat" size="m">
                                Скопировать ссылку
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                        <Card className="p-6">
                            <Text variant="subheader-1" className="mb-4">Расписание</Text>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <Text variant="caption-2" color="secondary">Начало</Text>
                                    <Text variant="subheader-1">{formatDateTime(event.startsAt, locale)}</Text>
                                </div>
                                <div>
                                    <Text variant="caption-2" color="secondary">Окончание</Text>
                                    <Text variant="subheader-1">{formatDateTime(event.endsAt, locale)}</Text>
                                </div>
                                {(startTime || endTime) && (
                                    <div>
                                        <Text variant="caption-2" color="secondary">Время</Text>
                                        <Text variant="body-2">{startTime ?? '--:--'} — {endTime ?? '--:--'}</Text>
                                    </div>
                                )}
                                {durationLabel && (
                                    <div>
                                        <Text variant="caption-2" color="secondary">Длительность</Text>
                                        <Text variant="body-2">{durationLabel}</Text>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {event.locationText && (
                            <Card className="p-6">
                                <Text variant="subheader-1" className="mb-3">Локация</Text>
                                <div className="flex items-start gap-3">
                                    <Icon data={MapPin} size={18} className="text-slate-500" />
                                    <div>
                                        {event.locationUrl ? (
                                            <a
                                                href={event.locationUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-600 hover:text-indigo-500 transition-colors"
                                            >
                                                {event.locationText}
                                            </a>
                                        ) : (
                                            <Text variant="body-2">{event.locationText}</Text>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {event.description && (
                            <Card className="p-6">
                                <Text variant="subheader-1" className="mb-3">Описание</Text>
                                <Text variant="body-2" className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                                    {event.description}
                                </Text>
                            </Card>
                        )}
                    </div>

                    <div className="space-y-4">
                        <Card className="p-5">
                            <Text variant="subheader-1" className="mb-3">RSVP</Text>
                            {canRsvp ? (
                                <>
                                    <Text variant="body-2" color="secondary" className="mb-3">
                                        Выберите статус участия
                                    </Text>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            view={event.myRsvp === 'going' ? 'action' : 'outlined'}
                                            size="l"
                                            loading={rsvpMutation.isPending}
                                            onClick={() => handleRsvp('going')}
                                            disabled={isPast}
                                        >
                                            Иду
                                        </Button>
                                        <Button
                                            view={event.myRsvp === 'interested' ? 'action' : 'outlined'}
                                            size="l"
                                            loading={rsvpMutation.isPending}
                                            onClick={() => handleRsvp('interested')}
                                            disabled={isPast}
                                        >
                                            Интересно
                                        </Button>
                                        <Button
                                            view={event.myRsvp === 'not_going' ? 'action' : 'outlined'}
                                            size="l"
                                            loading={rsvpMutation.isPending}
                                            onClick={() => handleRsvp('not_going')}
                                            disabled={isPast}
                                        >
                                            Не пойду
                                        </Button>
                                    </div>
                                    {isPast && (
                                        <Text variant="caption-2" color="secondary" className="mt-3">
                                            Событие завершено — RSVP недоступен.
                                        </Text>
                                    )}
                                </>
                            ) : (
                                <Text variant="body-2" color="secondary">
                                    У вас нет доступа к RSVP для этого события.
                                </Text>
                            )}
                        </Card>

                        <Card className="p-5">
                            <Text variant="subheader-1" className="mb-3">Участники</Text>
                            <EventRsvpCounts counts={event.rsvpCounts} />
                            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                                <Icon data={Person} size={14} />
                                Всего ответов: {event.rsvpCounts.going + event.rsvpCounts.interested + event.rsvpCounts.not_going}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
