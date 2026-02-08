import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import { Avatar, Button, Card, Loader, Text } from '@gravity-ui/uikit';

import { fetchPortalProfiles } from '../../../modules/portal/api';
import { isApiError } from '../../../api/client';
import './profile.css';

const buildDisplayName = (profile: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  userId: string;
}) => {
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  return full || profile.displayName || profile.username || profile.userId;
};

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? 'U';
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
};

export const UserProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const routeBase = useRouteBase();
  const normalized = (username ?? '').trim().toLowerCase();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'profile', normalized],
    queryFn: () => fetchPortalProfiles({ q: normalized, limit: 50 }),
    enabled: normalized.length > 0,
    staleTime: 30_000,
  });

  const profile = useMemo(() => {
    if (!data || normalized.length === 0) return null;
    return data.find((entry) => (entry.username ?? '').toLowerCase() === normalized) ?? null;
  }, [data, normalized]);

  if (!normalized) {
    return (
      <div className="profile-page">
        <Card view="filled" className="profile-card">
          <Text variant="subheader-2">Невалидная ссылка профиля</Text>
          <Button view="outlined" href={`${routeBase}/feed`}>Вернуться в ленту</Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="profile-page">
        <Card view="filled" className="profile-card">
          <Loader size="m" />
        </Card>
      </div>
    );
  }

  if (error) {
    const forbidden = isApiError(error) && error.kind === 'forbidden';
    return (
      <div className="profile-page">
        <Card view="filled" className="profile-card">
          <Text variant="subheader-2">
            {forbidden ? 'Недостаточно прав для просмотра профилей' : 'Не удалось загрузить профиль'}
          </Text>
          <Button view="outlined" onClick={() => void refetch()}>
            Повторить
          </Button>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <Card view="filled" className="profile-card">
          <Text variant="subheader-2">Пользователь @{normalized} не найден</Text>
          <Button view="outlined" href={`${routeBase}/feed`}>Вернуться в ленту</Button>
        </Card>
      </div>
    );
  }

  const displayName = buildDisplayName(profile);
  const initials = getInitials(displayName);

  return (
    <div className="profile-page">
      <Card view="filled" className="profile-hero">
        <div className="profile-hero__main">
          <Avatar size="xl" text={initials} />
          <div className="profile-hero__meta">
            <div className="profile-hero__title">
              <Text variant="header-1">{displayName}</Text>
              <Text variant="body-2" color="secondary">
                @{profile.username || 'unknown'}
              </Text>
            </div>
            {profile.bio ? (
              <Text variant="body-2" className="profile-hero__bio">
                {profile.bio}
              </Text>
            ) : (
              <Text variant="body-2" color="secondary" className="profile-hero__bio">
                Пользователь пока не добавил описание.
              </Text>
            )}
            <Text variant="caption-2" color="secondary">
              user_id: {profile.userId}
            </Text>
          </div>
        </div>
        <div className="profile-hero__actions">
          <Button view="outlined" href={`${routeBase}/feed`}>Вернуться в ленту</Button>
          <Button view="flat" href={`${routeBase}/profile`}>Мой профиль</Button>
        </div>
      </Card>
    </div>
  );
};

