import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@gravity-ui/uikit';
import {
  PageState,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';
import { useEvent } from '../../../features/events';
import { EventForm } from '../../../features/events/components';
import type { EventWithCounts } from '../../../features/events';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useRouteBase } from '@/shared/hooks/useRouteBase';

export const EditEventPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeBase = useRouteBase();

  const t = useUITranslation();
  const { data: event, isLoading, error, refetch } = useEvent(id || '');
  useDocumentTitle(
    event
      ? `${event.title} · Редактирование события`
      : 'Редактирование события',
  );

  const handleSuccess = (updatedEvent: EventWithCounts) => {
    navigate(`${routeBase}/events/${updatedEvent.id}`);
  };

  const handleCancel = () => {
    navigate(`${routeBase}/events/${id}`);
  };

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
          status === 404 ? 'not-found' : status === 403 ? 'forbidden' : 'error'
        }
        title={
          status === 404
            ? t('Событие не найдено', 'Event not found')
            : status === 403
              ? t('Нет доступа к событию', 'Event access restricted')
              : t('Не удалось загрузить событие', 'Unable to load event')
        }
        action={
          <Button onClick={() => navigate(`${routeBase}/events`)}>
            {t('К событиям', 'Back to events')}
          </Button>
        }
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
    <EventForm
      key={event.id}
      event={event}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
};
