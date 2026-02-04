import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Label,
  Select,
  Table,
  Text,
  TextInput,
  TextArea,
  type TableColumnConfig,
} from '@gravity-ui/uikit';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import { useAchievement, useCreateGrant, useGrantsList, useRevokeGrant } from '../../../hooks/useGamification';
import type { Grant, GrantVisibility } from '../../../types/gamification';
import { fetchPortalProfiles } from '../../portal/api';
import './gamification.css';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const VISIBILITY_OPTIONS: { value: 'all' | GrantVisibility; content: string }[] = [
  { value: 'all', content: 'Все' },
  { value: 'public', content: 'Публичные' },
  { value: 'private', content: 'Приватные' },
];

export const AchievementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAssign = can(user, 'gamification.achievements.assign');
  const canRevoke = can(user, 'gamification.achievements.revoke');
  const hasAccess =
    Boolean(user?.isSuperuser) ||
    Boolean(
      user?.capabilities?.some((cap) => cap.startsWith('gamification.achievements.')) ||
        user?.roles?.some((role) => role.startsWith('gamification.achievements.')),
    );

  const { data: achievement, isLoading } = useAchievement(id);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | GrantVisibility>('all');

  const grantsQuery = useGrantsList(id ?? '', {
    visibility: visibilityFilter === 'all' ? undefined : visibilityFilter,
    limit: 20,
  });

  const grants = grantsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const { mutateAsync: createGrant, isPending: isGranting } = useCreateGrant();
  const { mutateAsync: revokeGrant, isPending: isRevoking } = useRevokeGrant();

  const [recipientId, setRecipientId] = useState('');
  const [reason, setReason] = useState('');
  const [grantVisibility, setGrantVisibility] = useState<GrantVisibility>('public');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const columns = useMemo<TableColumnConfig<Grant>[]>(
    () => [
      {
        id: 'recipient',
        name: 'Пользователь',
        template: (item) => <Text variant="body-2">{item.recipientId}</Text>,
      },
      {
        id: 'issued',
        name: 'Выдано',
        template: (item) => <Text variant="caption-2">{formatDate(item.createdAt)}</Text>,
      },
      {
        id: 'visibility',
        name: 'Видимость',
        template: (item) => (
          <Label size="xs" theme={item.visibility === 'public' ? 'success' : 'warning'}>
            {item.visibility}
          </Label>
        ),
      },
      {
        id: 'actions',
        name: '',
        align: 'right',
        template: (item) =>
          canRevoke ? (
            <Button
              view="flat"
              size="s"
              loading={isRevoking}
              onClick={() => revokeGrant({ grantId: item.id })}
            >
              Отозвать
            </Button>
          ) : null,
      },
    ],
    [canRevoke, isRevoking, revokeGrant],
  );

  const handleGrant = async () => {
    setGrantError(null);
    if (!id) return;
    if (!recipientId.trim()) {
      setGrantError('Укажите user_id получателя.');
      return;
    }
    await createGrant({
      achievementId: id,
      payload: {
        recipientId: recipientId.trim(),
        reason: reason.trim() || undefined,
        visibility: grantVisibility,
      },
    });
    setRecipientId('');
    setReason('');
  };

  const { data: profiles = [], isLoading: isSearching } = useQuery({
    queryKey: ['portal', 'profiles', searchQuery],
    queryFn: () => fetchPortalProfiles({ q: searchQuery.trim(), limit: 10 }),
    enabled: canAssign && searchQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const formatProfileName = (profile: {
    firstName: string;
    lastName: string;
    displayName?: string | null;
    username?: string | null;
  }) =>
    profile.displayName?.trim() ||
    [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
    profile.username?.trim() ||
    'Без имени';

  return (
    <div className="gamification-page" data-qa="achievement-detail-page">
      {!hasAccess ? (
        <Card view="filled" className="gamification-empty">
          <Text variant="subheader-2">Недостаточно прав для доступа к ачивке.</Text>
          <Text variant="body-2" color="secondary">
            Запросите доступ у администратора тенанта.
          </Text>
        </Card>
      ) : (
        <>
          <div className="gamification-header">
            <div className="gamification-header__text">
              <Text variant="header-1">Achievement</Text>
              <Text variant="body-2" color="secondary">
                Детальная карточка и выдачи.
              </Text>
            </div>
            <div className="gamification-toolbar">
              <Button view="flat" size="m" onClick={() => navigate('/app/gamification')}>
                Назад
              </Button>
              {achievement?.canEdit && (
                <Button
                  view="action"
                  size="m"
                  onClick={() => navigate(`/app/gamification/achievements/${achievement.id}/edit`)}
                >
                  Редактировать
                </Button>
              )}
            </div>
          </div>

          <Card view="filled">
            {isLoading ? (
              <Text variant="body-2">Загрузка...</Text>
            ) : achievement ? (
              <div className="gamification-form">
                <div className="gamification-form__main">
                  <Text variant="subheader-2">
                    {achievement.nameI18n.ru ?? achievement.nameI18n.en ?? 'Untitled'}
                  </Text>
                  <Text variant="body-2" color="secondary">
                    {achievement.description || 'Описание отсутствует.'}
                  </Text>
                  <div className="gamification-media-grid">
                    {achievement.images?.small && (
                      <img className="gamification-media-preview" src={achievement.images.small} alt="small" />
                    )}
                    {achievement.images?.medium && (
                      <img className="gamification-media-preview" src={achievement.images.medium} alt="medium" />
                    )}
                    {achievement.images?.large && (
                      <img className="gamification-media-preview" src={achievement.images.large} alt="large" />
                    )}
                  </div>
                </div>
                <div className="gamification-form__aside">
                  <Label size="s">{achievement.status}</Label>
                  <Text variant="caption-2" color="secondary">
                    Category: {achievement.category}
                  </Text>
                  <Text variant="caption-2" color="secondary">
                    Updated: {formatDate(achievement.updatedAt)}
                  </Text>
                </div>
              </div>
            ) : (
              <Text variant="body-2">Ачивка не найдена.</Text>
            )}
          </Card>

          {canAssign && (
            <Card view="filled">
              <Text variant="subheader-2">Выдать ачивку</Text>
              <div className="gamification-form__main">
                <div className="gamification-field">
                  <Text variant="body-2">Поиск участника</Text>
                  <TextInput
                    value={searchQuery}
                    onUpdate={setSearchQuery}
                    placeholder="Введите имя или username"
                  />
                  {isSearching && (
                    <Text variant="caption-2" color="secondary">
                      Поиск...
                    </Text>
                  )}
                  {profiles.length > 0 && (
                    <div className="gamification-search-results">
                      {profiles.map((profile) => (
                        <button
                          key={profile.userId}
                          type="button"
                          className="gamification-search-item"
                          onClick={() => {
                            setRecipientId(profile.userId);
                            setSearchQuery(formatProfileName(profile));
                          }}
                        >
                          <Text variant="body-2">{formatProfileName(profile)}</Text>
                          <Text variant="caption-2" color="secondary">
                            {profile.username ? `@${profile.username}` : profile.userId}
                          </Text>
                        </button>
                      ))}
                    </div>
                  )}
                  <TextInput
                    value={recipientId}
                    onUpdate={setRecipientId}
                    placeholder="UUID получателя"
                  />
                </div>
                <div className="gamification-field">
                  <Text variant="body-2">Причина</Text>
                  <TextArea rows={3} value={reason} onUpdate={setReason} />
                </div>
                <div className="gamification-field">
                  <Text variant="body-2">Видимость</Text>
                  <Select
                    value={[grantVisibility]}
                    options={[
                      { value: 'public', content: 'Публично' },
                      { value: 'private', content: 'Приватно' },
                    ]}
                    onUpdate={(values) => setGrantVisibility((values[0] as GrantVisibility) ?? 'public')}
                  />
                </div>
                {grantError && (
                  <Text variant="caption-2" color="danger">
                    {grantError}
                  </Text>
                )}
                <Button view="action" size="m" loading={isGranting} onClick={handleGrant}>
                  Выдать
                </Button>
              </div>
            </Card>
          )}

          <Card view="filled">
            <div className="gamification-toolbar">
              <Text variant="subheader-2">Grants</Text>
              <Select
                value={[visibilityFilter]}
                options={VISIBILITY_OPTIONS}
                onUpdate={(values) => setVisibilityFilter((values[0] as 'all' | GrantVisibility) ?? 'all')}
              />
            </div>
            <Table
              columns={columns}
              data={grants}
              emptyMessage={grantsQuery.isLoading ? 'Загрузка...' : 'Пока нет выдач'}
              getRowDescriptor={(row) => ({ id: row.id })}
              width="max"
            />
            {grantsQuery.hasNextPage && (
              <div className="gamification-empty">
                <Button
                  view="flat"
                  size="m"
                  loading={grantsQuery.isFetchingNextPage}
                  onClick={() => grantsQuery.fetchNextPage()}
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

export default AchievementDetailPage;
