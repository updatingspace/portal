import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  DropdownMenu,
  Icon,
  Label,
  Select,
  Table,
  Text,
  TextInput,
  type DropdownMenuItem,
  type TableColumnConfig,
} from '@gravity-ui/uikit';
import { Plus } from '@gravity-ui/icons';

import { useAuth } from '../../../contexts/AuthContext';
import { createClientAccessDeniedError } from '../../../api/accessDenied';
import { AccessDeniedScreen } from '../../../features/access-denied';
import { can } from '../../../features/rbac/can';
import { useAchievementsList, useCategories, useUpdateAchievement } from '../../../hooks/useGamification';
import type { Achievement, AchievementStatus } from '../../../types/gamification';
import { formatDateTime } from '@/shared/lib/formatters';
import './gamification.css';

type StatusFilter = 'all' | AchievementStatus;

const STATUS_OPTIONS: { value: StatusFilter; content: string }[] = [
  { value: 'all', content: 'Все статусы' },
  { value: 'draft', content: 'Черновик' },
  { value: 'published', content: 'Опубликовано' },
  { value: 'hidden', content: 'Скрыто' },
  { value: 'active', content: 'Активно' },
];

const statusLabelMap: Record<AchievementStatus, { text: string; theme: 'info' | 'success' | 'warning' | 'unknown' }> = {
  draft: { text: 'Черновик', theme: 'warning' },
  published: { text: 'Опубликовано', theme: 'success' },
  hidden: { text: 'Скрыто', theme: 'unknown' },
  active: { text: 'Активно', theme: 'info' },
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDateTime(date);
};

const getAchievementTitle = (achievement: Achievement) =>
  achievement.nameI18n.ru ?? achievement.nameI18n.en ?? 'Без названия';

export const GamificationDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = can(user, 'gamification.achievements.create');
  const canEdit = can(user, 'gamification.achievements.edit');
  const canPublish = can(user, 'gamification.achievements.publish');
  const canHide = can(user, 'gamification.achievements.hide');
  const hasAccess = Boolean(user);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState<'all' | 'me'>('all');

  const { data: categoriesData } = useCategories();
  const categoryOptions = useMemo(
    () => [
      { value: 'all', content: 'Все категории' },
      ...(categoriesData?.items ?? []).map((cat) => ({
        value: cat.id,
        content: cat.nameI18n.ru ?? cat.nameI18n.en ?? cat.id,
      })),
    ],
    [categoriesData?.items],
  );

  const statusParam = statusFilter === 'all' ? undefined : [statusFilter];
  const categoryParam = categoryFilter === 'all' ? undefined : [categoryFilter];

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useAchievementsList({
    status: statusParam,
    category: categoryParam,
    q: search || undefined,
    created_by: ownership === 'me' ? 'me' : 'any',
    limit: 20,
  });

  const { mutateAsync: updateAchievement, isPending: isUpdating } = useUpdateAchievement();

  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const handleStatusChange = useCallback(
    async (achievement: Achievement, nextStatus: AchievementStatus) => {
      await updateAchievement({
        id: achievement.id,
        payload: { status: nextStatus },
      });
    },
    [updateAchievement],
  );

  const kpis = useMemo(() => {
    const total = items.length;
    const published = items.filter((item) => item.status === 'published').length;
    const drafts = items.filter((item) => item.status === 'draft').length;
    const active = items.filter((item) => item.status === 'active').length;
    return [
      { key: 'total', title: 'Всего ачивок', value: total, hint: 'В текущей выборке' },
      { key: 'published', title: 'Опубликовано', value: published, hint: 'Готовы к выдаче' },
      { key: 'drafts', title: 'Черновики', value: drafts, hint: 'Требуют ревью' },
      { key: 'active', title: 'Активные', value: active, hint: 'Используются в сценариях' },
    ];
  }, [items]);

  const columns = useMemo<TableColumnConfig<Achievement>[]>(
    () => [
      {
        id: 'title',
        name: 'Ачивка',
        template: (item) => (
          <div className="gamification-table-title">
            <Text variant="body-2">{getAchievementTitle(item)}</Text>
            <Text variant="caption-2" color="secondary">
              {item.category || 'Без категории'}
            </Text>
          </div>
        ),
      },
      {
        id: 'status',
        name: 'Статус',
        template: (item) => {
          const meta = statusLabelMap[item.status];
          return (
            <Label size="xs" theme={meta.theme}>
              {meta.text}
            </Label>
          );
        },
      },
      {
        id: 'updated',
        name: 'Обновлено',
        template: (item) => <Text variant="caption-2">{formatDate(item.updatedAt)}</Text>,
      },
      {
        id: 'actions',
        name: '',
        align: 'end',
        template: (item) => {
          const actions: DropdownMenuItem[] = [
            {
              text: 'Открыть',
              action: () => navigate(`/app/gamification/achievements/${item.id}`),
            },
            {
              text: 'Редактировать',
              action: () => navigate(`/app/gamification/achievements/${item.id}/edit`),
              disabled: !canEdit || item.canEdit === false,
            },
          ];
          if (canPublish && item.canPublish) {
            actions.push({
              text: 'Опубликовать',
              action: () => handleStatusChange(item, 'published'),
            });
          }
          if (canHide && item.canHide) {
            actions.push({
              text: 'Скрыть',
              action: () => handleStatusChange(item, 'hidden'),
            });
          }
          return <DropdownMenu items={actions} />;
        },
      },
    ],
    [canEdit, canHide, canPublish, handleStatusChange, navigate],
  );

  return (
    <div className="gamification-page" data-qa="gamification-page">
      {!hasAccess ? (
        <AccessDeniedScreen
          error={createClientAccessDeniedError({
            requiredPermission: 'gamification.achievements.*',
            tenant: user?.tenant,
            reason: 'Ой... мы и сами в шоке, но у вашего аккаунта нет прав на раздел геймификации.',
          })}
        />
      ) : (
        <>
          <div className="gamification-header">
            <div className="gamification-header__text">
              <Text variant="header-1">Центр геймификации</Text>
              <Text variant="body-2" color="secondary">
                Управляйте жизненным циклом ачивок: от идеи и ревью до публикации и выдач.
              </Text>
            </div>
            <div className="gamification-toolbar">
              {canCreate && (
                <Button view="action" size="m" onClick={() => navigate('/app/gamification/achievements/new')}>
                  <Icon data={Plus} />
                  Создать ачивку
                </Button>
              )}
            </div>
          </div>

          <div className="gamification-kpis">
            {kpis.map((kpi) => (
              <Card key={kpi.key} view="filled" className="gamification-kpi-card">
                <Text variant="caption-2" color="secondary">
                  {kpi.title}
                </Text>
                <Text variant="header-2">{kpi.value}</Text>
                <Text variant="caption-2" color="secondary">
                  {kpi.hint}
                </Text>
              </Card>
            ))}
          </div>

          <Card view="filled">
            <div className="gamification-scenarios">
              <Text variant="subheader-2">Базовые сценарии работы</Text>
              <ul className="gamification-scenarios__list">
                <li>Контент-менеджер создаёт черновик и заполняет медиа/локализации.</li>
                <li>Модератор переводит готовые карточки в published/active.</li>
                <li>Оператор отслеживает статусы и переходит в детальную карточку для выдач.</li>
              </ul>
            </div>
          </Card>

          <Card view="filled">
            <div className="gamification-filters">
              <TextInput value={search} onUpdate={(value) => setSearch(value)} placeholder="Поиск по названию" />
              <Select
                options={STATUS_OPTIONS}
                value={[statusFilter]}
                onUpdate={(values) => setStatusFilter((values[0] as StatusFilter) ?? 'all')}
              />
              <Select
                options={categoryOptions}
                value={[categoryFilter]}
                onUpdate={(values) => setCategoryFilter((values[0] as string) ?? 'all')}
              />
              <Select
                options={[
                  { value: 'all', content: 'Все' },
                  { value: 'me', content: 'Мои' },
                ]}
                value={[ownership]}
                onUpdate={(values) => setOwnership((values[0] as 'all' | 'me') ?? 'all')}
              />
              <Button
                view="flat"
                size="m"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setOwnership('all');
                }}
              >
                Сбросить
              </Button>
            </div>
          </Card>

          <Card view="filled">
            <Table
              columns={columns}
              data={items}
              emptyMessage={isLoading ? 'Загружаем...' : 'Пока нет ачивок'}
              getRowDescriptor={(row) => ({ id: row.id })}
              width="max"
            />
            {hasNextPage && (
              <div className="gamification-empty">
                <Button
                  view="flat"
                  size="m"
                  loading={isFetchingNextPage}
                  disabled={isUpdating}
                  onClick={() => fetchNextPage()}
                >
                  Загрузить ещё
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default GamificationDashboardPage;
