import React, { useMemo } from 'react';
import { Text } from '@gravity-ui/uikit';
import type { EventWithCounts } from '../types';
import { EventCard } from './EventCard';

function dayKey(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

function dayTitle(d: Date, locale: string) {
    const today = new Date();
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((d0.getTime() - t0.getTime()) / 86_400_000);

    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Завтра';
    return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

export const EventsTimeline: React.FC<{
    events: EventWithCounts[];
    onEdit?: (e: EventWithCounts) => void;
}> = ({ events, onEdit }) => {
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'ru-RU';
    const grouped = useMemo(() => {
        const map = new Map<string, { date: Date; items: EventWithCounts[] }>();

        const sorted = [...events].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
        for (const ev of sorted) {
            const d = new Date(ev.startsAt);
            const k = dayKey(d);
            const entry = map.get(k) || { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [] };
            entry.items.push(ev);
            map.set(k, entry);
        }

        return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [events]);

    if (events.length === 0) return null;

    return (
        <div className="space-y-6">
            {grouped.map((g) => (
                <section key={g.date.toISOString()} className="space-y-2">
                    <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-950/60 backdrop-blur border-b border-slate-200/60 dark:border-white/10 py-2">
                        <div className="flex items-baseline justify-between">
                            <Text variant="subheader-1" className="capitalize">
                                {dayTitle(g.date, locale)}
                            </Text>
                            <Text variant="caption-2" color="secondary">
                                {g.items.length} {g.items.length === 1 ? 'событие' : g.items.length < 5 ? 'события' : 'событий'}
                            </Text>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {g.items.map((ev) => (
                            <EventCard key={ev.id} event={ev} onEdit={onEdit} variant="list" />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};
