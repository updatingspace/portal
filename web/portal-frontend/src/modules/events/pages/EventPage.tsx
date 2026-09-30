import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, DropdownMenu, Label } from '@gravity-ui/uikit';
import { useAuth } from '../../../contexts/AuthContext';
import {
  useEvent,
  useExportEventAsIcs,
  useSetRsvp,
  type RsvpStatus,
} from '../../../features/events';
import { can } from '../../../features/rbac/can';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import {
  InlineError,
  PageLayout,
  PageState,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';
import '../../../features/events/components/events.css';

export function EventPage() {
  const { id = '' } = useParams<{ id: string }>();
  const base = useRouteBase();
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useUITranslation();
  const { formatDateTime, timezone } = useFormatters();
  const { data: event, isLoading, isError, error, refetch } = useEvent(id);
  const rsvp = useSetRsvp(id);
  const calendar = useExportEventAsIcs();
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useDocumentTitle(event?.title ?? t('Событие', 'Event'));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const past = Boolean(event && Date.parse(event.endsAt) < now);
  const canRespond = can(user, 'events.rsvp.set');
  const labels: Record<RsvpStatus, string> = {
    going: t('Пойду', 'Going'),
    interested: t('Интересно', 'Interested'),
    not_going: t('Не пойду', 'Not going'),
  };
  const reconcile = async (failed: boolean) => {
    try {
      const result = await refetch();
      if (result.isError) throw new Error('refresh');
      setActionError(
        failed
          ? t(
              'Не удалось подтвердить отправку. Показан ответ, полученный с сервера.',
              'The submission could not be confirmed. The response read from the server is shown.',
            )
          : null,
      );
      if (!failed)
        setNotice(t('Ваш ответ сохранён.', 'Your response has been saved.'));
    } catch {
      setActionError(
        t(
          'Проверяем результат: не удалось обновить событие. Обновите страницу перед повторным ответом.',
          'Unable to verify the result. Refresh the event before responding again.',
        ),
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  const respond = (status: RsvpStatus) => {
    if (lock.current || past || !canRespond || isError) return;
    lock.current = true;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    rsvp.mutate(status, {
      onSuccess: () => reconcile(false),
      onError: () => reconcile(true),
    });
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${base}/events/${id}`,
      );
      setNotice(t('Ссылка скопирована.', 'Link copied.'));
    } catch {
      setActionError(
        t(
          'Не удалось скопировать ссылку. Используйте адресную строку.',
          'Unable to copy the link. Use the address bar.',
        ),
      );
    }
  };
  const exportCalendar = () =>
    calendar.mutate(id, {
      onSuccess: () =>
        setNotice(t('Файл календаря скачан.', 'Calendar file downloaded.')),
      onError: () =>
        setActionError(
          t(
            'Не удалось скачать календарь. Попробуйте ещё раз.',
            'Unable to download the calendar. Try again.',
          ),
        ),
    });
  const back = (
    <Button onClick={() => navigate(`${base}/events`)}>
      {t('К событиям', 'Back to events')}
    </Button>
  );
  if (isLoading && !event)
    return (
      <PageState
        kind="loading"
        title={t('Загружаем событие', 'Loading event')}
      />
    );
  if (!event) {
    const status = (error as { status?: number } | null)?.status;
    return (
      <PageState
        kind={
          status === 403 ? 'forbidden' : status === 404 ? 'not-found' : 'error'
        }
        title={
          status === 403
            ? t('Событие недоступно', 'Event unavailable')
            : status === 404
              ? t('Событие не найдено', 'Event not found')
              : t('Не удалось загрузить событие', 'Unable to load event')
        }
        action={back}
        secondaryAction={
          status !== 403 &&
          status !== 404 && (
            <Button onClick={() => void refetch()}>
              {t('Повторить', 'Try again')}
            </Button>
          )
        }
      />
    );
  }
  return (
    <PageLayout
      title={event.title}
      description={`${formatDateTime(event.startsAt)} — ${formatDateTime(event.endsAt)} · ${timezone}`}
      actions={
        <>
          {back}
          <DropdownMenu
            defaultSwitcherProps={{
              size: 'xl',
              'aria-label': t('Действия с событием', 'Event actions'),
            }}
            items={[
              ...(can(user, 'events.event.manage')
                ? [
                    {
                      text: t('Редактировать', 'Edit'),
                      action: () => navigate(`${base}/events/${id}/edit`),
                    },
                  ]
                : []),
              {
                text: t('В календарь', 'Add to calendar'),
                action: exportCalendar,
                disabled: calendar.isPending,
              },
              {
                text: t('Скопировать ссылку', 'Copy link'),
                action: () => void copyLink(),
              },
            ]}
          />
        </>
      }
    >
      <div className="portal-stack">
        {isError && (
          <InlineError onRetry={() => void refetch()}>
            {t(
              'Не удалось обновить событие. Ответы временно приостановлены.',
              'Unable to refresh the event. Responses are temporarily paused.',
            )}
          </InlineError>
        )}
        {actionError && <InlineError>{actionError}</InlineError>}
        {notice && <p role="status">{notice}</p>}
        <div className="portal-event-meta">
          <Label theme={past ? 'normal' : 'success'}>
            {past
              ? t('Завершено', 'Ended')
              : Date.parse(event.startsAt) <= now
                ? t('Идёт сейчас', 'In progress')
                : t('Предстоящее событие', 'Upcoming event')}
          </Label>
          {event.locationText && (
            <span>
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
            </span>
          )}
        </div>
        <div className="portal-event-content">
          <section className="portal-event-section">
            <h2>{t('Мой ответ', 'My response')}</h2>
            <p>
              {event.myRsvp
                ? `${t('Сохранённый ответ', 'Saved response')}: ${labels[event.myRsvp]}`
                : t('Вы ещё не ответили.', 'You have not responded yet.')}
            </p>
            {canRespond ? (
              <div className="portal-actions">
                {(Object.keys(labels) as RsvpStatus[]).map((status) => (
                  <Button
                    key={status}
                    view={event.myRsvp === status ? 'action' : 'outlined'}
                    selected={event.myRsvp === status}
                    disabled={past || saving || rsvp.isPending || isError}
                    onClick={() => respond(status)}
                  >
                    {labels[status]}
                  </Button>
                ))}
              </div>
            ) : (
              <p>
                {t(
                  'У вас нет права отвечать на это событие.',
                  'You cannot respond to this event.',
                )}
              </p>
            )}
            {saving && (
              <p role="status">
                {t(
                  'Сохраняем и проверяем ответ…',
                  'Saving and verifying your response…',
                )}
              </p>
            )}
            {past && (
              <p>
                {t(
                  'Событие завершилось. Ответы больше не принимаются.',
                  'This event has ended. Responses are closed.',
                )}
              </p>
            )}
          </section>
          <section className="portal-event-section">
            <h2>{t('О событии', 'About the event')}</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {event.description ||
                t(
                  'Организатор пока не добавил описание.',
                  'The organizer has not added a description yet.',
                )}
            </p>
            <p>
              {t('Аудитория', 'Audience')}:{' '}
              {event.visibility === 'public'
                ? t('Сообщество', 'Community')
                : event.visibility === 'community'
                  ? t('Группа', 'Group')
                  : event.visibility === 'team'
                    ? t('Команда', 'Team')
                    : t('Ограниченный доступ', 'Restricted access')}
            </p>
          </section>
        </div>
        <details className="portal-disclosure">
          <summary>{t('Ответы участников', 'Member responses')}</summary>
          <div className="portal-actions">
            {(Object.keys(labels) as RsvpStatus[]).map((status) => (
              <Label key={status}>
                {labels[status]}: {event.rsvpCounts[status]}
              </Label>
            ))}
          </div>
        </details>
      </div>
    </PageLayout>
  );
}
