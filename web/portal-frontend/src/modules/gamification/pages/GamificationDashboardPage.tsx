import React, { useMemo, useState } from 'react';
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
  draft: { text: 'Draft', theme: 'warning' },
  published: { text: 'Published', theme: 'success' },
  hidden: { text: 'Hidden', theme: 'unknown' },
  active: { text: 'Active', theme: 'info' },
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

export const GamificationDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = can(user, 'gamification.achievements.create');
  const canEdit = can(user, 'gamification.achievements.edit');
  const canPublish = can(user, 'gamification.achievements.publish');
  const canHide = can(user, 'gamification.achievements.hide');
  const hasAccess =
    Boolean(user?.isSuperuser) ||
    Boolean(
      user?.capabilities?.some((cap) => cap.startsWith('gamification.achievements.')) ||
        user?.roles?.some((role) => role.startsWith('gamification.achievements.')),
    );

  if (!hasAccess) {
    return (
      <AccessDeniedScreen
        error={createClientAccessDeniedError({
          requiredPermission: 'gamification.achievements.*',
          tenant: user?.tenant,
          reason: 'Ой... мы и сами в шоке, но у вашего аккаунта нет прав на раздел геймификации.',
        })}
      />
    );
  }

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState<'all' | 'me'>('all');

  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.items ?? [];
  const categoryOptions = useMemo(
    () => [
      { value: 'all', content: 'Все категории' },
      ...categories.map((cat) => ({
        value: cat.id,
        content: cat.nameI18n.ru ?? cat.nameI18n.en ?? cat.id,
      })),
    ],
    [categories],
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

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const handleStatusChange = async (achievement: Achievement, nextStatus: AchievementStatus) => {
    await updateAchievement({
      id: achievement.id,
      payload: {
        status: nextStatus,
      },
    });
  };

  const columns = useMemo<TableColumnConfig<Achievement>[]>(
    () => [
      {
        id: 'title',
        name: 'Achievement',
        template: (item) => (
          <div>
            <Text variant="body-2">{item.nameI18n.ru ?? item.nameI18n.en ?? 'Untitled'}</Text>
            <Text variant="caption-2" color="secondary">
              {item.category}
            </Text>
          </div>
        ),
      },
      {
        id: 'status',
        name: 'Status',
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
        name: 'Updated',
        template: (item) => <Text variant="caption-2">{formatDate(item.updatedAt)}</Text>,
      },
      {
        id: 'actions',
        name: '',
        align: 'right',
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
    [canEdit, canHide, canPublish, navigate, updateAchievement],
  );

  return (
    <div className="gamification-page" data-qa="gamification-page">
      <div className="gamification-header">
        <div className="gamification-header__text">
          <Text variant="header-1">Gamification</Text>
          <Text variant="body-2" color="secondary">
            Управление ачивками и выдачами.
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

      <Card view="filled">
        <div className="gamification-filters">
          <TextInput
            value={search}
            onUpdate={(value) => setSearch(value)}
            placeholder="Поиск по названию"
          />
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
          <Button view="flat" size="m" onClick={() => {
            setSearch('');
            setStatusFilter('all');
            setCategoryFilter('all');
            setOwnership('all');
          }}>
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
            <Button view="flat" size="m" loading={isFetchingNextPage} disabled={isUpdating} onClick={() => fetchNextPage()}>
              Загрузить ещё
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default GamificationDashboardPage;
