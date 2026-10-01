import { useState, useEffect } from 'react';
import { Button, Label } from '@gravity-ui/uikit';
import { Link } from 'react-router-dom';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import type { EventWithCounts } from '../types';
import './events.css';

export function EventCard({
  event,
  onEdit,
  showActions = true,
}: {
  event: EventWithCounts;
  onEdit?: (event: EventWithCounts) => void;
  showActions?: boolean;
  variant?: 'list' | 'tile';
}) {
  const base = useRouteBase();
  const t = useUITranslation();
  const { formatDate, formatTime, formatDateTime } = useFormatters();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const ongoing =
    Date.parse(event.startsAt) <= now && Date.parse(event.endsAt) >= now;
  const past = Date.parse(event.endsAt) < now;
  const rsvp = {
    going: t('Пойду', 'Going'),
    interested: t('Интересно', 'Interested'),
    not_going: t('Не пойду', 'Not going'),
  };
  const audiences = {
    public: t('Сообщество', 'Community'),
    community: t('Группа', 'Group'),
    team: t('Команда', 'Team'),
    private: t('Ограниченный доступ', 'Restricted access'),
  };
  return (
    <article className="portal-event-card">
      <div
        className="portal-event-card__date"
        aria-label={formatDate(event.startsAt)}
      >
        <strong data-testid="event-day">
          {formatDate(event.startsAt, {
            day: 'numeric',
            month: undefined,
            year: undefined,
          })}
        </strong>
        <span>
          {formatDate(event.startsAt, {
            month: 'short',
            day: undefined,
            year: undefined,
          })}
        </span>
      </div>
      <div className="portal-event-card__body">
        <div className="portal-actions">
          <Label>{audiences[event.visibility]}</Label>
          {ongoing && (
            <Label theme="success">{t('Идёт сейчас', 'In progress')}</Label>
          )}
          {past && <Label>{t('Завершено', 'Ended')}</Label>}
        </div>
        <h3>
          <Link to={`${base}/events/${event.id}`}>{event.title}</Link>
        </h3>
        <p>
          <time dateTime={event.startsAt}>{formatTime(event.startsAt)}</time>
          {' – '}
          <time dateTime={event.endsAt}>
            {formatDate(event.startsAt) === formatDate(event.endsAt)
              ? formatTime(event.endsAt)
              : formatDateTime(event.endsAt)}
          </time>
        </p>
        {event.description && (
          <p className="portal-event-card__description">{event.description}</p>
        )}
        {event.locationText && (
          <p>
            {event.locationUrl ? (
              <a
                href={event.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {event.locationText} ↗
              </a>
            ) : (
              event.locationText
            )}
          </p>
        )}
        {event.myRsvp && (
          <Label theme="success">
            {t('Мой ответ', 'My response')}: {rsvp[event.myRsvp]}
          </Label>
        )}
        {showActions && onEdit && (
          <div className="portal-actions">
            <Button onClick={() => onEdit(event)}>
              {t('Редактировать', 'Edit')}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
