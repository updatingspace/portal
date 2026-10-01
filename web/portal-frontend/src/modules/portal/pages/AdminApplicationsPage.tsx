import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Label } from '@gravity-ui/uikit';
import { requestResult } from '../../../api/client';
import {
  ConfirmDialog,
  InlineError,
  PageLayout,
  PageState,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';
import { useFormatters } from '../../../shared/hooks/useFormatters';

type Application = {
  id: number;
  tenant_slug: string;
  payload_json: Record<string, unknown>;
  status: string;
  created_at: string;
};
const fieldValue = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
export function AdminApplicationsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const t = useUITranslation();
  const { formatDateTime } = useFormatters();
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<number[]>([]);
  const locks = useRef(new Set<number>());
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [confirmation, setConfirmation] = useState<{
    item: Application;
    action: 'approve' | 'reject';
  } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestResult<{ items: Application[] }>(
        '/portal/applications?status=pending',
      );
      if (!result.ok)
        throw new Error(
          result.status === 403
            ? 'Доступ к заявкам ограничен.'
            : 'Не удалось загрузить заявки.',
        );
      setItems(result.data.items ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось загрузить заявки.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const decide = async () => {
    if (!confirmation) return;
    const { item, action } = confirmation;
    if (locks.current.has(item.id)) return;
    locks.current.add(item.id);
    setPending((prev) => [...prev, item.id]);
    setErrors((prev) => ({ ...prev, [item.id]: '' }));
    setConfirmation(null);
    try {
      const result = await requestResult<unknown>(
        `/portal/applications/${item.id}/${action}`,
        { method: 'POST' },
      );
      if (!result.ok)
        throw new Error(
          result.status === 409
            ? 'Заявка уже обработана другим администратором. Обновите список.'
            : result.status === 403
              ? 'Право обработки заявок больше недоступно.'
              : 'Не удалось подтвердить решение. Обновите статус перед повторной попыткой.',
        );
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, status: action === 'approve' ? 'approved' : 'rejected' }
            : row,
        ),
      );
    } catch (reason) {
      setErrors((prev) => ({
        ...prev,
        [item.id]:
          reason instanceof Error
            ? reason.message
            : 'Не удалось сохранить решение.',
      }));
    } finally {
      locks.current.delete(item.id);
      setPending((prev) => prev.filter((id) => id !== item.id));
    }
  };
  return (
    <PageLayout
      title={t('Заявки на доступ', 'Access applications')}
      description={t(
        'Доступ к аккаунту предоставляется после рассмотрения заявки.',
        'Account access requires an approved application.',
      )}
      actions={
        <>
          {!embedded && (
            <Button href="/choose-tenant">
              {t('Мои сообщества', 'My communities')}
            </Button>
          )}
          <Button
            disabled={loading}
            loading={loading}
            onClick={() => void load()}
          >
            {t('Обновить', 'Refresh')}
          </Button>
        </>
      }
    >
      {error && <InlineError onRetry={() => void load()}>{error}</InlineError>}
      {loading && !items.length && (
        <PageState
          kind="loading"
          title={t('Загружаем заявки', 'Loading applications')}
        />
      )}
      {!loading && !error && !items.length && (
        <PageState
          kind="empty"
          title={t(
            'Нет заявок на рассмотрении',
            'No applications awaiting review',
          )}
        />
      )}
      <div className="portal-stack">
        {items.map((item) => (
          <article className="portal-card" key={item.id}>
            <div className="portal-page__heading">
              <div>
                <h2>
                  {fieldValue(item.payload_json.display_name) ||
                    fieldValue(item.payload_json.name) ||
                    `${t('Заявка', 'Application')} #${item.id}`}
                </h2>
                <p>
                  {item.tenant_slug} · {formatDateTime(item.created_at)}
                </p>
              </div>
              <Label>
                {item.status === 'approved'
                  ? t('Одобрена', 'Approved')
                  : item.status === 'rejected'
                    ? t('Отклонена', 'Declined')
                    : t('На рассмотрении', 'Under review')}
              </Label>
            </div>
            <dl>
              {[
                ['email', t('Почта', 'Email')],
                ['username', t('Имя пользователя', 'Username')],
                ['reason', t('Причина заявки', 'Application reason')],
                ['message', t('Сообщение', 'Message')],
              ].map(
                ([key, label]) =>
                  fieldValue(item.payload_json[key]) && (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{fieldValue(item.payload_json[key])}</dd>
                    </div>
                  ),
              )}
            </dl>
            {errors[item.id] && (
              <InlineError onRetry={() => void load()}>
                {errors[item.id]}
              </InlineError>
            )}
            {item.status === 'pending' && (
              <div className="portal-actions">
                <Button
                  view="action"
                  loading={pending.includes(item.id)}
                  disabled={pending.includes(item.id)}
                  onClick={() => setConfirmation({ item, action: 'approve' })}
                >
                  {t('Одобрить', 'Approve')}
                </Button>
                <Button
                  view="outlined-danger"
                  disabled={pending.includes(item.id)}
                  onClick={() => setConfirmation({ item, action: 'reject' })}
                >
                  {t('Отклонить', 'Decline')}
                </Button>
              </div>
            )}
            {item.status === 'approved' && (
              <p>
                {t(
                  'Решение сохранено. Активация аккаунта выполняется через UpdSpaceID.',
                  'Decision saved. Account activation is handled by UpdSpaceID.',
                )}
              </p>
            )}
          </article>
        ))}
      </div>
      <ConfirmDialog
        open={confirmation !== null}
        title={t('Решение по заявке', 'Application decision')}
        description={
          confirmation
            ? `${t('Заявка', 'Application')} #${confirmation.item.id}: ${confirmation.action === 'approve' ? t('разрешить активацию аккаунта?', 'allow account activation?') : t('отклонить запрос доступа?', 'decline access?')}`
            : ''
        }
        confirmLabel={
          confirmation?.action === 'approve'
            ? t('Одобрить', 'Approve')
            : t('Отклонить', 'Decline')
        }
        destructive={confirmation?.action === 'reject'}
        onClose={() => setConfirmation(null)}
        onConfirm={() => void decide()}
      />
    </PageLayout>
  );
}
