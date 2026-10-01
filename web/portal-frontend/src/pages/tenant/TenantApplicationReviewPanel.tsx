import { Button, Icon } from '@gravity-ui/uikit';
import { ArrowRotateRight } from '@gravity-ui/icons';
import { InlineError, useUITranslation } from '../../shared/ui/portal/PortalUI';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchTenantApplicationsForReview,
  reviewTenantApplication,
} from '../../api/tenant';

const queryKey = ['tenant-applications', 'review'] as const;

export function TenantApplicationReviewPanel({
  onReviewed,
}: {
  onReviewed: () => void;
}) {
  const queryClient = useQueryClient();
  const t = useUITranslation();
  const applications = useQuery({
    queryKey,
    queryFn: fetchTenantApplicationsForReview,
  });
  const review = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: 'approve' | 'reject';
    }) => reviewTenantApplication(id, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      onReviewed();
    },
  });

  return (
    <section
      aria-label={t(
        'Рассмотрение заявок на сообщества',
        'Community application review',
      )}
      className="portal-stack"
    >
      {applications.isPending && (
        <p role="status">{t('Загружаем заявки…', 'Loading applications…')}</p>
      )}
      {(applications.isError || review.isError) && (
        <InlineError>
          {t(
            'Не удалось обработать заявку или загрузить список. Обновите статус и повторите.',
            'Could not process the application or load the list. Refresh and try again.',
          )}
        </InlineError>
      )}
      <Button
        view="flat"
        size="xl"
        className="space-review__refresh"
        aria-label={t('Обновить заявки', 'Refresh applications')}
        onClick={() => void applications.refetch()}
        disabled={applications.isFetching}
      >
        <Icon data={ArrowRotateRight} size={20} />
      </Button>
      {applications.data?.length === 0 && (
        <p>
          {t('Нет заявок на рассмотрении.', 'No applications awaiting review.')}
        </p>
      )}
      {applications.data?.map((application) => (
        <article
          key={application.id}
          aria-label={`${t('Заявка', 'Application')} ${application.name}`}
          className="space-review__application"
        >
          <h3>{application.name}</h3>
          <p>/{application.slug}</p>
          <p>{application.description}</p>
          <p>
            {application.status === 'provisioning'
              ? t(
                  'Одобрено. Настраиваем доступ владельцу.',
                  'Approved. Preparing owner access.',
                )
              : t('Ожидает рассмотрения', 'Awaiting review')}
          </p>
          <div className="portal-actions">
            <Button
              view="action"
              size="l"
              disabled={review.isPending}
              onClick={() =>
                review.mutate({ id: application.id, decision: 'approve' })
              }
            >
              {application.status === 'provisioning'
                ? t('Повторить настройку доступа', 'Retry access setup')
                : t('Одобрить', 'Approve')}
            </Button>
            {application.status === 'pending' && (
              <Button
                view="outlined"
                size="l"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({ id: application.id, decision: 'reject' })
                }
              >
                {t('Отклонить', 'Decline')}
              </Button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
