import { useFormatters } from '../../../shared/hooks/useFormatters';
import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DropdownMenu,
  Label,
  Select,
  TextInput,
  type DropdownMenuItem,
} from '@gravity-ui/uikit';
import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import {
  useAchievementsList,
  useCategories,
  useUpdateAchievement,
} from '../../../hooks/useGamification';
import type {
  Achievement,
  AchievementStatus,
} from '../../../types/gamification';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import {
  PageLayout,
  PageState,
  InlineError,
  FormField,
} from '../../../shared/ui/portal/PortalUI';
import { ContentDialog } from '../../../shared/ui/portal/ContentDialog';
import { SectionTabs } from '../../../shared/ui/portal/SectionTabs';
import { MediaFallback } from '../../../shared/ui/portal/MediaFallback';
import './gamification.css';

export function GamificationDashboardPage() {
  const t = useUITranslation();
  const achievementStatus = {
    draft: t('Черновик', 'Draft'),
    published: t('Опубликовано', 'Published'),
    hidden: t('Скрыто', 'Hidden'),
    active: t('Активно', 'Active'),
  };
  const { locale } = useFormatters();
  const { user } = useAuth();
  const base = useRouteBase();
  const navigate = useNavigate();
  const [view, setView] = useState<'catalog' | 'earned'>('catalog');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [ownership, setOwnership] = useState('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const canCreate = can(user, 'gamification.achievements.create');
  const canEdit = can(user, 'gamification.achievements.edit');
  const canPublish = can(user, 'gamification.achievements.publish');
  const canHide = can(user, 'gamification.achievements.hide');
  const manager = canCreate || canEdit || canPublish || canHide;
  const categories = useCategories();
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useAchievementsList({
    earned: view === 'earned',
    q: search || undefined,
    status: status === 'all' ? undefined : [status],
    category: category === 'all' ? undefined : [category],
    created_by: ownership === 'me' ? 'me' : 'any',
    limit: 20,
  });
  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const { mutateAsync: update, isPending } = useUpdateAchievement();
  const changeStatus = async (item: Achievement, next: AchievementStatus) => {
    if (isPending) return;
    setActionError(null);
    try {
      await update({ id: item.id, payload: { status: next } });
    } catch {
      setActionError(
        t(
          'Не удалось изменить статус. Обновите данные перед повтором.',
          'Unable to change status. Refresh before trying again.',
        ),
      );
    }
  };
  const hasFilters =
    status !== 'all' || category !== 'all' || ownership !== 'all';
  const reset = () => {
    setSearch('');
    setStatus('all');
    setCategory('all');
    setOwnership('all');
  };
  if (!user)
    return (
      <PageState
        kind="forbidden"
        title={t('Достижения недоступны', 'Achievements unavailable')}
      />
    );
  return (
    <PageLayout
      title={t('Достижения', 'Achievements')}
      actions={
        canCreate && (
          <Button
            size="xl"
            view="action"
            onClick={() => navigate(`${base}/gamification/achievements/new`)}
          >
            {t('Создать', 'Create')}
          </Button>
        )
      }
    >
      <SectionTabs
        label={t('Витрина достижений', 'Achievements')}
        value={view}
        onChange={setView}
        items={[
          { id: 'catalog', label: t('Каталог', 'Catalog') },
          { id: 'earned', label: t('Мои награды', 'My awards') },
        ]}
      />
      <div className="achievement-search">
        <TextInput
          size="xl"
          aria-label={t('Поиск достижений', 'Search achievements')}
          placeholder={t('Поиск по названию', 'Search by name')}
          value={search}
          onUpdate={setSearch}
        />
        <Button size="xl" view="outlined" onClick={() => setFiltersOpen(true)}>
          {t('Фильтры', 'Filters')}
          {hasFilters ? ' •' : ''}
        </Button>
      </div>
      {isError && (
        <InlineError onRetry={() => void refetch()}>
          {t(
            'Не удалось загрузить достижения.',
            'Unable to load achievements.',
          )}
        </InlineError>
      )}
      {actionError && <InlineError>{actionError}</InlineError>}
      {isLoading && (
        <PageState
          kind="loading"
          title={t('Загружаем достижения', 'Loading achievements')}
        />
      )}
      {!isLoading && !isError && !items.length && (
        <PageState
          kind="empty"
          title={
            search || hasFilters
              ? t('Ничего не найдено', 'No matches')
              : view === 'earned'
                ? t('У вас пока нет наград', 'No awards yet')
                : t('Достижений пока нет', 'No achievements yet')
          }
          description={
            search || hasFilters
              ? t(
                  'Измените поиск или сбросьте фильтры.',
                  'Try a different search or clear the filters.',
                )
              : undefined
          }
          action={
            (search || hasFilters) && (
              <Button onClick={reset}>
                {t('Сбросить фильтры', 'Clear filters')}
              </Button>
            )
          }
        />
      )}
      <div className="achievement-catalog">
        {items.map((item) => {
          const title =
            item.nameI18n[locale] ||
            item.nameI18n.en ||
            item.nameI18n.ru ||
            t('Без названия', 'Untitled');
          const actions: DropdownMenuItem[] = [];
          if (canEdit && item.canEdit !== false)
            actions.push({
              text: t('Редактировать', 'Edit'),
              action: () =>
                navigate(`${base}/gamification/achievements/${item.id}/edit`),
            });
          if (canPublish && item.canPublish)
            actions.push({
              text: t('Опубликовать', 'Publish'),
              disabled: isPending,
              action: () => void changeStatus(item, 'published'),
            });
          if (canHide && item.canHide)
            actions.push({
              text: t('Скрыть', 'Hide'),
              disabled: isPending,
              action: () => void changeStatus(item, 'hidden'),
            });
          return (
            <article key={item.id} className="achievement-catalog__item">
              <MediaFallback
                src={item.images?.medium || item.images?.small}
                alt={title}
              />
              <div className="achievement-catalog__content">
                <h2>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`${base}/gamification/achievements/${item.id}`)
                    }
                  >
                    {title}
                  </button>
                </h2>
                {item.description && <p>{item.description}</p>}
                <div className="achievement-catalog__meta">
                  {view === 'earned' && (
                    <Label theme="success">{t('Получено', 'Awarded')}</Label>
                  )}
                  {manager && (
                    <Label>
                      {achievementStatus[item.status] ||
                        t('Статус уточняется', 'Status unavailable')}
                    </Label>
                  )}
                </div>
              </div>
              {actions.length > 0 && (
                <DropdownMenu
                  items={actions}
                  defaultSwitcherProps={{
                    size: 'xl',
                    'aria-label': `Действия с достижением «${title}»`,
                  }}
                />
              )}
            </article>
          );
        })}
      </div>
      {hasNextPage && (
        <Button
          size="xl"
          disabled={isFetchingNextPage}
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {t('Загрузить ещё', 'Load more')}
        </Button>
      )}
      {filtersOpen && (
        <ContentDialog
          title={t('Фильтры достижений', 'Achievement filters')}
          onClose={() => setFiltersOpen(false)}
        >
          <div className="portal-stack">
            {categories.isError && (
              <InlineError onRetry={() => void categories.refetch()}>
                {t(
                  'Не удалось загрузить категории.',
                  'Unable to load categories.',
                )}
              </InlineError>
            )}
            <FormField label={t('Категория', 'Category')}>
              {(props) => (
                <Select
                  {...props}
                  size="xl"
                  width="max"
                  value={[category]}
                  onUpdate={([value]) => setCategory(value)}
                  options={[
                    {
                      value: 'all',
                      content: t('Все категории', 'All categories'),
                    },
                    ...(categories.data?.items ?? []).map((item) => ({
                      value: item.id,
                      content:
                        item.nameI18n[locale] ||
                        item.nameI18n.en ||
                        item.nameI18n.ru ||
                        item.id,
                    })),
                  ]}
                />
              )}
            </FormField>
            {manager && (
              <>
                <FormField label={t('Статус', 'Status')}>
                  {(props) => (
                    <Select
                      {...props}
                      size="xl"
                      width="max"
                      value={[status]}
                      onUpdate={([value]) => setStatus(value)}
                      options={[
                        {
                          value: 'all',
                          content: t('Все статусы', 'All statuses'),
                        },
                        ...Object.entries(achievementStatus).map(
                          ([value, content]) => ({ value, content }),
                        ),
                      ]}
                    />
                  )}
                </FormField>
                <FormField label={t('Автор', 'Creator')}>
                  {(props) => (
                    <Select
                      {...props}
                      size="xl"
                      width="max"
                      value={[ownership]}
                      onUpdate={([value]) => setOwnership(value)}
                      options={[
                        { value: 'all', content: t('Все', 'All') },
                        {
                          value: 'me',
                          content: t('Созданные мной', 'Created by me'),
                        },
                      ]}
                    />
                  )}
                </FormField>
              </>
            )}
            <div className="portal-actions">
              <Button
                size="xl"
                view="action"
                onClick={() => setFiltersOpen(false)}
              >
                {t('Показать достижения', 'Show achievements')}
              </Button>
              <Button size="xl" view="flat" onClick={reset}>
                {t('Сбросить', 'Reset')}
              </Button>
            </div>
          </div>
        </ContentDialog>
      )}
    </PageLayout>
  );
}
export default GamificationDashboardPage;
