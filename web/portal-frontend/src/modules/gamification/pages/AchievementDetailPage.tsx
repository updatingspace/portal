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
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const base = useRouteBase();
  const navigate = useNavigate();
  const { formatDateTime } = useFormatters();
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
    achievement?.nameI18n.ru || achievement?.nameI18n.en || 'Достижение';
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
      setGrantError('Выберите участника из результатов поиска.');
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
      setNotice('Награда выдана.');
    } catch {
      setGrantError(
        'Не удалось выдать награду. Выбранный участник и причина сохранены.',
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
        'Не удалось подтвердить отзыв награды. Обновите историю перед повтором.',
      );
    }
  };
  if (isLoading && !achievement)
    return <PageState kind="loading" title="Загружаем достижение" />;
  if (!achievement)
    return (
      <PageState
        kind={isError ? 'error' : 'not-found'}
        title={
          isError ? 'Не удалось загрузить достижение' : 'Достижение не найдено'
        }
        action={
          <Button size="xl" onClick={() => navigate(`${base}/gamification`)}>
            К достижениям
          </Button>
        }
        secondaryAction={
          isError &&
          (error as { status?: number })?.status !== 404 && (
            <Button onClick={() => void refetch()}>Повторить</Button>
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
            Назад
          </Button>
          {canAssign && (
            <Button size="xl" view="action" onClick={() => setGrantOpen(true)}>
              Выдать награду
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
                Редактировать
              </Button>
            )}
        </>
      }
    >
      {confirmationDialog}
      {isError && (
        <InlineError onRetry={() => void refetch()}>
          Не удалось обновить достижение.
        </InlineError>
      )}
      {notice && <p role="status">{notice}</p>}
      <SectionTabs
        label="Разделы достижения"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'about', label: 'О награде' },
          { id: 'history', label: 'История выдач' },
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
            <p>{achievement.description || 'Описание пока не добавлено.'}</p>
            <details className="portal-disclosure">
              <summary>Подробности</summary>
              <p>
                Статус:{' '}
                {{
                  draft: 'Черновик',
                  published: 'Опубликовано',
                  active: 'Активно',
                  hidden: 'Скрыто',
                }[achievement.status] || 'Уточняется'}
              </p>
              <p>Обновлено: {formatDateTime(achievement.updatedAt)}</p>
            </details>
          </div>
        </section>
      ) : (
        <section className="achievement-history">
          <Select
            size="xl"
            aria-label="Видимость выдач"
            value={[visibility]}
            onUpdate={([value]) => setVisibility(value)}
            options={[
              { value: 'all', content: 'Все выдачи' },
              { value: 'public', content: 'Видимые сообществу' },
              { value: 'private', content: 'Личные' },
            ]}
          />
          {grants.isError && (
            <InlineError onRetry={() => void grants.refetch()}>
              Не удалось загрузить историю выдач.
            </InlineError>
          )}
          {actionError && <InlineError>{actionError}</InlineError>}
          {grants.isLoading ? (
            <p role="status">Загружаем историю…</p>
          ) : (
            !grants.isError &&
            !grants.data?.pages.some((page) => page.items.length) && (
              <p>Пока нет выдач.</p>
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
                      : 'Участник сообщества'}
                  </strong>
                  <p>{grant.reason || 'Причина не указана'}</p>
                  <span>{formatDateTime(grant.createdAt)}</span>
                </div>
                <Label>
                  {grant.revokedAt
                    ? 'Отозвана'
                    : grant.visibility === 'public'
                      ? 'Видна сообществу'
                      : 'Личная'}
                </Label>
                {canRevoke && !grant.revokedAt && (
                  <Button
                    size="xl"
                    view="flat-danger"
                    disabled={revoke.isPending}
                    onClick={() => void withdraw(grant)}
                  >
                    Отозвать
                  </Button>
                )}
                <details>
                  <summary>Идентификатор участника</summary>
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
              Загрузить ещё
            </Button>
          )}
        </section>
      )}
      {grantOpen && (
        <ContentDialog
          title="Выдать награду"
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
            <FormField label="Участник">
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  value={search}
                  placeholder="Введите имя или username"
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
                {profiles.isLoading && <p role="status">Ищем участника…</p>}
                {profiles.isError && (
                  <InlineError onRetry={() => void profiles.refetch()}>
                    Не удалось найти участников.
                  </InlineError>
                )}
                {!profiles.isLoading &&
                  !profiles.isError &&
                  !profiles.data?.length && <p>Участники не найдены.</p>}
                {profiles.data?.map((profile) => {
                  const name =
                    profile.displayName ||
                    [profile.firstName, profile.lastName]
                      .filter(Boolean)
                      .join(' ') ||
                    profile.username ||
                    'Без имени';
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
            {recipient && <p role="status">Участник выбран: {search}</p>}
            <FormField label="Причина">
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
            <FormField label="Видимость награды">
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
                    { value: 'public', content: 'Видна участникам сообщества' },
                    { value: 'private', content: 'Личная награда' },
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
              Выдать
            </Button>
          </form>
        </ContentDialog>
      )}
    </PageLayout>
  );
}
export default AchievementDetailPage;
