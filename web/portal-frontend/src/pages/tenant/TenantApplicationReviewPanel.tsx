import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchTenantApplicationsForReview, reviewTenantApplication } from '../../api/tenant';

const queryKey = ['tenant-applications', 'review'] as const;

export function TenantApplicationReviewPanel({ onReviewed }: { onReviewed: () => void }) {
  const queryClient = useQueryClient();
  const applications = useQuery({ queryKey, queryFn: fetchTenantApplicationsForReview });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      reviewTenantApplication(id, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      onReviewed();
    },
  });

  return (
    <section aria-label="Рассмотрение заявок на сообщества" className="tenant-chooser__pending">
      <h2>Заявки на сообщества</h2>
      {applications.isPending && <p>Загружаем заявки…</p>}
      {(applications.isError || review.isError) && (
        <p role="alert">Не удалось обработать заявку или загрузить список. Обновите статус и повторите.</p>
      )}
      <button type="button" className="tenant-chooser__action-btn tenant-chooser__action-btn--secondary"
        onClick={() => void applications.refetch()} disabled={applications.isFetching}>
        Обновить заявки
      </button>
      {applications.data?.length === 0 && <p>Нет заявок на рассмотрении.</p>}
      {applications.data?.map((application) => (
        <article key={application.id} aria-label={`Заявка ${application.name}`} className="tenant-chooser__pending-item">
          <h3>{application.name} /{application.slug}</h3>
          <p>{application.description}</p>
          <p>{application.status === 'provisioning' ? 'Одобрено. Настраиваем доступ владельцу.' : 'Ожидает рассмотрения'}</p>
          <button type="button" className="tenant-chooser__action-btn tenant-chooser__action-btn--primary"
            disabled={review.isPending}
            onClick={() => review.mutate({ id: application.id, decision: 'approve' })}>
            {application.status === 'provisioning' ? 'Повторить настройку доступа' : 'Одобрить'}
          </button>
          {application.status === 'pending' && (
            <button type="button" className="tenant-chooser__action-btn tenant-chooser__action-btn--secondary"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: application.id, decision: 'reject' })}>
              Отклонить
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
