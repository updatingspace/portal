import { useMemo } from 'react';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import type { EventWithCounts } from '../types';
import { EventCard } from './EventCard';

export function EventsTimeline({
  events,
  onEdit,
}: {
  events: EventWithCounts[];
  onEdit?: (event: EventWithCounts) => void;
}) {
  const { formatDate, timezone } = useFormatters();
  const grouped = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const days = new Map<string, EventWithCounts[]>();
    for (const event of [...events].sort(
      (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
    )) {
      const day = formatter.format(new Date(event.startsAt));
      days.set(day, [...(days.get(day) ?? []), event]);
    }
    return [...days.entries()];
  }, [events, timezone]);
  return (
    <div className="portal-stack">
      {grouped.map(([day, items]) => (
        <section key={day} className="portal-event-day">
          <h2 className="portal-event-day-heading">
            {formatDate(items[0].startsAt, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h2>
          {items.map((event) => (
            <EventCard key={event.id} event={event} onEdit={onEdit} />
          ))}
        </section>
      ))}
    </div>
  );
}
