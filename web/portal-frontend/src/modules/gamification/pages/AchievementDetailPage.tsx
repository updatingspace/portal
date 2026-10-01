import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Label, Select, TextInput, TextArea } from '@gravity-ui/uikit';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import { can } from '../../../features/rbac/can';
import {
  useAchievement,
  useCreateGrant,
  useGrantsList,
  useRevokeGrant,
} from '../../../hooks/useGamification';
import type { Grant, GrantVisibility } from '../../../types/gamification';
import { fetchPortalProfiles } from '../../portal/api';
import { ContentDialog } from '../../../shared/ui/portal/ContentDialog';
import {
  PageLayout,
  PageState,
  InlineError,
  FormField,
} from '../../../shared/ui/portal/PortalUI';
import { SectionTabs } from '../../../shared/ui/portal/SectionTabs';
import { MediaFallback } from '../../../shared/ui/portal/MediaFallback';
import { useConfirmation } from '../../../shared/ui/portal/useConfirmation';
import './gamification.css';

export function AchievementDetailPage() {
  const t = useUITranslation();
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const base = useRouteBase();
  const navigate = useNavigate();
  const { formatDateTime, locale } = useFormatters();
  const canAssign = can(user, 'gamification.achievements.assign');
  const canRevoke = can(user, 'gamification.achievements.revoke');
  const { confirm, confirmationDialog } = useConfirmation();
  const [tab, setTab] = useState<'about' | 'history'>('about');
  const [grantOpen, setGrantOpen] = useState(false);
  const [visibility, setVisibility] = useState('all');
  const [search, setSearch] = useState('');
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState('');
  const [grantVisibility, setGrantVisibility] =
    useState<GrantVisibility>('public');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);
  const {
    data: achievement,
    isLoading,
    isError,
    error,
    refetch,
  } = useAchievement(id);
  const title =
    achievement?.nameI18n[locale] ||
    achievement?.nameI18n.en ||
    achievement?.nameI18n.ru ||
    t('Достижение', 'Achievement');
  useDocumentTitle(title);
  const grants = useGrantsList(tab === 'history' ? id : '', {
    visibility: visibility === 'all' ? undefined : visibility,
    limit: 20,
  });
  const create = useCreateGrant();
  const revoke = useRevokeGrant();
  const profiles = useQuery({
    queryKey: ['portal', 'profiles', user?.tenant?.id, search],
    queryFn: () => fetchPortalProfiles({ q: search.trim(), limit: 10 }),
    enabled: grantOpen && canAssign && search.trim().length >= 2 && !recipient,
    staleTime: 30000,
  });
  const issue = async () => {
    if (lock.current) return;
    if (!recipient) {
      setGrantError(
        t(
          'Выберите участника из результатов поиска.',
          'Select a member from the search results.',
        ),
      );
      return;
    }
    lock.current = true;
    setGrantError(null);
    try {
      await create.mutateAsync({
        achievementId: id,
        payload: {
          recipientId: recipient,
          reason: reason.trim() || undefined,
          visibility: grantVisibility,
        },
      });
      setGrantOpen(false);
      setRecipient('');
      setSearch('');
      setReason('');
      setNotice(t('Награда выдана.', 'Award granted.'));
    } catch {
      setGrantError(
        t(
          'Не удалось выдать награду. Выбранный участник и причина сохранены.',
          'Unable to grant the award. Your selection and reason are preserved.',
        ),
      );
    } finally {
      lock.current = false;
    }
  };
  const withdraw = async (grant: Grant) => {
    if (
      !(await confirm(
        `Отозвать награду «${title}»? Она перестанет отображаться как полученная.`,
      ))
    )
      return;
    setActionError(null);
    try {
      await revoke.mutateAsync({ grantId: grant.id });
    } catch {
      setActionError(
        t(
          'Не удалось подтвердить отзыв награды. Обновите историю перед повтором.',
          'Unable to confirm revocation. Refresh the history before trying again.',
        ),
      );
    }
  };
  if (isLoading && !achievement)
    return (
      <PageState
        kind="loading"
        title={t('Загружаем достижение', 'Loading achievement')}
      />
    );
  if (!achievement)
    return (
      <PageState
        kind={isError ? 'error' : 'not-found'}
        title={
          isError
            ? t('Не удалось загрузить достижение', 'Unable to load achievement')
            : t('Достижение не найдено', 'Achievement not found')
        }
        action={
          <Button size="xl" onClick={() => navigate(`${base}/gamification`)}>
            {t('К достижениям', 'Back to achievements')}
          </Button>
        }
        secondaryAction={
          isError &&
          (error as { status?: number })?.status !== 404 && (
            <Button onClick={() => void refetch()}>
              {t('Повторить', 'Try again')}
            </Button>
          )
        }
      />
    );
  return (
    <PageLayout
      title={title}
      actions={
        <>
          <Button
            size="xl"
            view="flat"
            onClick={() => navigate(`${base}/gamification`)}
          >
            {t('Назад', 'Back')}
          </Button>
          {canAssign && (
            <Button size="xl" view="action" onClick={() => setGrantOpen(true)}>
              {t('Выдать награду', 'Grant award')}
            </Button>
          )}
          {achievement.canEdit &&
            can(user, 'gamification.achievements.edit') && (
              <Button
                size="xl"
                view="outlined"
                onClick={() =>
                  navigate(`${base}/gamification/achievements/${id}/edit`)
                }
              >
                {t('Редактировать', 'Edit')}
              </Button>
            )}
        </>
      }
    >
      {confirmationDialog}
      {isError && (
        <InlineError onRetry={() => void refetch()}>
          {t(
            'Не удалось обновить достижение.',
            'Unable to refresh achievement.',
          )}
        </InlineError>
      )}
      {notice && <p role="status">{notice}</p>}
      <SectionTabs
        label={t('Разделы достижения', 'Achievement sections')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'about', label: t('О награде', 'About') },
          { id: 'history', label: t('История выдач', 'Award history') },
        ]}
      />
      {tab === 'about' ? (
        <section className="achievement-detail">
          <MediaFallback
            src={
              achievement.images?.large ||
              achievement.images?.medium ||
              achievement.images?.small
            }
            alt={title}
          />
          <div>
            <p>
              {achievement.description ||
                t('Описание пока не добавлено.', 'No description yet.')}
            </p>
            <details className="portal-disclosure">
              <summary>{t('Подробности', 'Details')}</summary>
              <p>
                {t('Статус:', 'Status:')}{' '}
                {{
                  draft: t('Черновик', 'Draft'),
                  published: t('Опубликовано', 'Published'),
                  active: t('Активно', 'Active'),
                  hidden: t('Скрыто', 'Hidden'),
                }[achievement.status] || t('Уточняется', 'Unavailable')}
              </p>
              <p>
                {t('Обновлено:', 'Updated:')}
                {formatDateTime(achievement.updatedAt)}
              </p>
            </details>
          </div>
        </section>
      ) : (
        <section className="achievement-history">
          <Select
            size="xl"
            aria-label={t('Видимость выдач', 'Award visibility')}
            value={[visibility]}
            onUpdate={([value]) => setVisibility(value)}
            options={[
              { value: 'all', content: t('Все выдачи', 'All awards') },
              {
                value: 'public',
                content: t('Видимые сообществу', 'Community awards'),
              },
              { value: 'private', content: t('Личные', 'Private') },
            ]}
          />
          {grants.isError && (
            <InlineError onRetry={() => void grants.refetch()}>
              {t(
                'Не удалось загрузить историю выдач.',
                'Unable to load award history.',
              )}
            </InlineError>
          )}
          {actionError && <InlineError>{actionError}</InlineError>}
          {grants.isLoading ? (
            <p role="status">{t('Загружаем историю…', 'Loading history…')}</p>
          ) : (
            !grants.isError &&
            !grants.data?.pages.some((page) => page.items.length) && (
              <p>{t('Пока нет выдач.', 'No awards granted yet.')}</p>
            )
          )}
          {grants.data?.pages
            .flatMap((page) => page.items)
            .map((grant) => (
              <article className="achievement-grant" key={grant.id}>
                <div>
                  <strong>
                    {grant.recipientId === user?.id
                      ? user.displayName
                      : t('Участник сообщества', 'Community member')}
                  </strong>
                  <p>
                    {grant.reason ||
                      t('Причина не указана', 'No reason provided')}
                  </p>
                  <span>{formatDateTime(grant.createdAt)}</span>
                </div>
                <Label>
                  {grant.revokedAt
                    ? t('Отозвана', 'Revoked')
                    : grant.visibility === 'public'
                      ? t('Видна сообществу', 'Community')
                      : t('Личная', 'Private')}
                </Label>
                {canRevoke && !grant.revokedAt && (
                  <Button
                    size="xl"
                    view="flat-danger"
                    disabled={revoke.isPending}
                    onClick={() => void withdraw(grant)}
                  >
                    {t('Отозвать', 'Revoke')}
                  </Button>
                )}
                <details>
                  <summary>
                    {t('Идентификатор участника', 'Member identifier')}
                  </summary>
                  <code>{grant.recipientId}</code>
                </details>
              </article>
            ))}
          {grants.hasNextPage && (
            <Button
              size="xl"
              loading={grants.isFetchingNextPage}
              onClick={() => void grants.fetchNextPage()}
            >
              {t('Загрузить ещё', 'Load more')}
            </Button>
          )}
        </section>
      )}
      {grantOpen && (
        <ContentDialog
          title={t('Выдать награду', 'Grant award')}
          busy={create.isPending}
          onClose={() => setGrantOpen(false)}
        >
          <form
            className="portal-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void issue();
            }}
          >
            <FormField label={t('Участник', 'Member')}>
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  value={search}
                  placeholder={t(
                    'Введите имя или username',
                    'Enter a name or username',
                  )}
                  disabled={create.isPending}
                  onUpdate={(value) => {
                    setSearch(value);
                    setRecipient('');
                  }}
                />
              )}
            </FormField>
            {!recipient && search.trim().length >= 2 && (
              <div className="gamification-search-results">
                {profiles.isLoading && (
                  <p role="status">
                    {t('Ищем участника…', 'Finding members…')}
                  </p>
                )}
                {profiles.isError && (
                  <InlineError onRetry={() => void profiles.refetch()}>
                    {t(
                      'Не удалось найти участников.',
                      'Unable to find members.',
                    )}
                  </InlineError>
                )}
                {!profiles.isLoading &&
                  !profiles.isError &&
                  !profiles.data?.length && (
                    <p>{t('Участники не найдены.', 'No members found.')}</p>
                  )}
                {profiles.data?.map((profile) => {
                  const name =
                    profile.displayName ||
                    [profile.firstName, profile.lastName]
                      .filter(Boolean)
                      .join(' ') ||
                    profile.username ||
                    t('Без имени', 'Unnamed');
                  return (
                    <button
                      className="gamification-search-item"
                      type="button"
                      key={profile.userId}
                      onClick={() => {
                        setRecipient(profile.userId);
                        setSearch(name);
                      }}
                    >
                      {name}
                      {profile.username && ` @${profile.username}`}
                    </button>
                  );
                })}
              </div>
            )}
            {recipient && (
              <p role="status">
                {t('Участник выбран:', 'Selected member:')}
                {search}
              </p>
            )}
            <FormField label={t('Причина', 'Reason')}>
              {(props) => (
                <TextArea
                  {...props}
                  rows={3}
                  value={reason}
                  disabled={create.isPending}
                  onUpdate={setReason}
                />
              )}
            </FormField>
            <FormField label={t('Видимость награды', 'Award visibility')}>
              {(props) => (
                <Select
                  {...props}
                  size="xl"
                  width="max"
                  value={[grantVisibility]}
                  disabled={create.isPending}
                  onUpdate={([value]) =>
                    setGrantVisibility(value as GrantVisibility)
                  }
                  options={[
                    {
                      value: 'public',
                      content: t(
                        'Видна участникам сообщества',
                        'Visible to community members',
                      ),
                    },
                    {
                      value: 'private',
                      content: t('Личная награда', 'Private award'),
                    },
                  ]}
                />
              )}
            </FormField>
            {grantError && <InlineError>{grantError}</InlineError>}
            <Button
              size="xl"
              view="action"
              type="submit"
              loading={create.isPending}
            >
              {t('Выдать', 'Grant')}
            </Button>
          </form>
        </ContentDialog>
      )}
    </PageLayout>
  );
}
export default AchievementDetailPage;
