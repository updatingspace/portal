import { useRef, useState } from 'react';
import { Button, TextArea } from '@gravity-ui/uikit';
import { useQuery } from '@tanstack/react-query';
import { deleteNews, fetchPostAudit } from '../../../api/activity';
import { useAuth } from '../../../contexts/AuthContext';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import { ContentDialog } from '../../../shared/ui/portal/ContentDialog';
import {
  FormField,
  InlineError,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';
import { ListSkeleton } from '../../../shared/ui/portal/ListSkeleton';

export function PostModerationDialog({
  newsId,
  title,
  onClose,
  onRemoved,
}: {
  newsId: string;
  title: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const t = useUITranslation();
  const { user } = useAuth();
  const { formatDateTime } = useFormatters();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const audit = useQuery({
    queryKey: ['post-audit', user?.tenant?.id, user?.id, newsId],
    queryFn: () => fetchPostAudit(newsId),
  });
  const remove = async () => {
    if (lock.current) return;
    if (!reason.trim()) {
      setError(t('Укажите причину удаления.', 'Enter a reason for removal.'));
      return;
    }
    lock.current = true;
    setPending(true);
    setError('');
    try {
      await deleteNews(newsId, reason.trim());
      onRemoved();
      onClose();
    } catch {
      setError(
        t(
          'Не удалось удалить публикацию. Причина сохранена в форме.',
          'Unable to remove the post. Your reason is still here.',
        ),
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const actionLabels: Record<string, string> = {
    'news.created': t('Публикация создана', 'Post created'),
    'news.updated': t('Публикация изменена', 'Post edited'),
    'news.deleted': t('Публикация удалена', 'Post removed'),
  };
  return (
    <ContentDialog
      title={
        confirming
          ? t('Удалить публикацию?', 'Remove this post?')
          : t('Модерация публикации', 'Post moderation')
      }
      busy={pending}
      onClose={onClose}
    >
      <p className="post-moderation__title">{title}</p>
      {confirming ? (
        <div className="portal-stack">
          <p>
            {t(
              'Публикация и комментарии будут удалены. Причина останется в журнале.',
              'The post and its comments will be removed. The reason will remain in the audit log.',
            )}
          </p>
          <FormField
            label={t('Причина удаления', 'Reason for removal')}
            error={error}
          >
            {(props) => (
              <TextArea
                {...props}
                rows={3}
                size="xl"
                value={reason}
                onUpdate={setReason}
                controlProps={{ maxLength: 500 }}
                disabled={pending}
              />
            )}
          </FormField>
          <div className="portal-actions">
            <Button
              view="outlined-danger"
              size="l"
              loading={pending}
              disabled={pending || !reason.trim()}
              onClick={() => void remove()}
            >
              {t('Удалить публикацию', 'Remove post')}
            </Button>
            <Button
              size="l"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              {t('Назад', 'Back')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="portal-stack">
          <h3>{t('История публикации', 'Post history')}</h3>
          {audit.isLoading && (
            <ListSkeleton
              label={t('Загружаем историю', 'Loading history')}
              count={2}
            />
          )}
          {audit.isError && (
            <InlineError onRetry={() => void audit.refetch()}>
              {t('Не удалось загрузить историю.', 'Unable to load history.')}
            </InlineError>
          )}
          {audit.data?.items.length === 0 && (
            <p>
              {t('Записей об изменениях пока нет.', 'No changes recorded yet.')}
            </p>
          )}
          {audit.data?.items.map((entry) => (
            <div className="post-audit-entry" key={entry.id}>
              <strong>
                {actionLabels[entry.action] ??
                  t('Публикация изменена', 'Post changed')}
              </strong>
              <time>{formatDateTime(entry.created_at)}</time>
              {entry.reason && <p>{entry.reason}</p>}
            </div>
          ))}
          <div>
            <Button
              view="outlined-danger"
              size="l"
              onClick={() => setConfirming(true)}
            >
              {t('Удалить публикацию…', 'Remove post…')}
            </Button>
          </div>
        </div>
      )}
    </ContentDialog>
  );
}
