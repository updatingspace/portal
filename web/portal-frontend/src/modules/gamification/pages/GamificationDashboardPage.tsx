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

const achievementStatus = {
  draft: 'Черновик',
  published: 'Опубликовано',
  hidden: 'Скрыто',
  active: 'Активно',
};
export function GamificationDashboardPage() {
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
        'Не удалось изменить статус. Обновите данные перед повтором.',
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
    return <PageState kind="forbidden" title="Достижения недоступны" />;
  return (
    <PageLayout
      title="Достижения"
      actions={
        canCreate && (
          <Button
            size="xl"
            view="action"
            onClick={() => navigate(`${base}/gamification/achievements/new`)}
          >
            Создать
          </Button>
        )
      }
    >
      <SectionTabs
        label="Витрина достижений"
        value={view}
        onChange={setView}
        items={[
          { id: 'catalog', label: 'Каталог' },
          { id: 'earned', label: 'Мои награды' },
        ]}
      />
      <div className="achievement-search">
        <TextInput
          size="xl"
          aria-label="Поиск достижений"
          placeholder="Поиск по названию"
          value={search}
          onUpdate={setSearch}
        />
        <Button size="xl" view="outlined" onClick={() => setFiltersOpen(true)}>
          Фильтры{hasFilters ? ' •' : ''}
        </Button>
      </div>
      {isError && (
        <InlineError onRetry={() => void refetch()}>
          Не удалось загрузить достижения.
        </InlineError>
      )}
      {actionError && <InlineError>{actionError}</InlineError>}
      {isLoading && <PageState kind="loading" title="Загружаем достижения" />}
      {!isLoading && !isError && !items.length && (
        <PageState
          kind="empty"
          title={
            search || hasFilters
              ? 'Ничего не найдено'
              : view === 'earned'
                ? 'У вас пока нет наград'
                : 'Достижений пока нет'
          }
          description={
            search || hasFilters
              ? 'Измените поиск или сбросьте фильтры.'
              : undefined
          }
          action={
            (search || hasFilters) && (
              <Button onClick={reset}>Сбросить фильтры</Button>
            )
          }
        />
      )}
      <div className="achievement-catalog">
        {items.map((item) => {
          const title = item.nameI18n.ru || item.nameI18n.en || 'Без названия';
          const actions: DropdownMenuItem[] = [];
          if (canEdit && item.canEdit !== false)
            actions.push({
              text: 'Редактировать',
              action: () =>
                navigate(`${base}/gamification/achievements/${item.id}/edit`),
            });
          if (canPublish && item.canPublish)
            actions.push({
              text: 'Опубликовать',
              disabled: isPending,
              action: () => void changeStatus(item, 'published'),
            });
          if (canHide && item.canHide)
            actions.push({
              text: 'Скрыть',
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
                  {view === 'earned' && <Label theme="success">Получено</Label>}
                  {manager && (
                    <Label>
                      {achievementStatus[item.status] || 'Статус уточняется'}
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
          Загрузить ещё
        </Button>
      )}
      {filtersOpen && (
        <ContentDialog
          title="Фильтры достижений"
          onClose={() => setFiltersOpen(false)}
        >
          <div className="portal-stack">
            {categories.isError && (
              <InlineError onRetry={() => void categories.refetch()}>
                Не удалось загрузить категории.
              </InlineError>
            )}
            <FormField label="Категория">
              {(props) => (
                <Select
                  {...props}
                  size="xl"
                  width="max"
                  value={[category]}
                  onUpdate={([value]) => setCategory(value)}
                  options={[
                    { value: 'all', content: 'Все категории' },
                    ...(categories.data?.items ?? []).map((item) => ({
                      value: item.id,
                      content: item.nameI18n.ru || item.nameI18n.en || item.id,
                    })),
                  ]}
                />
              )}
            </FormField>
            {manager && (
              <>
                <FormField label="Статус">
                  {(props) => (
                    <Select
                      {...props}
                      size="xl"
                      width="max"
                      value={[status]}
                      onUpdate={([value]) => setStatus(value)}
                      options={[
                        { value: 'all', content: 'Все статусы' },
                        ...Object.entries(achievementStatus).map(
                          ([value, content]) => ({ value, content }),
                        ),
                      ]}
                    />
                  )}
                </FormField>
                <FormField label="Автор">
                  {(props) => (
                    <Select
                      {...props}
                      size="xl"
                      width="max"
                      value={[ownership]}
                      onUpdate={([value]) => setOwnership(value)}
                      options={[
                        { value: 'all', content: 'Все' },
                        { value: 'me', content: 'Созданные мной' },
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
                Показать достижения
              </Button>
              <Button size="xl" view="flat" onClick={reset}>
                Сбросить
              </Button>
            </div>
          </div>
        </ContentDialog>
      )}
    </PageLayout>
  );
}
export default GamificationDashboardPage;
