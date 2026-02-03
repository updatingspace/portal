import React, { useCallback, useMemo, useState } from 'react';
import { Avatar, Button, Card, Label, Switch, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import { normalizeIdAccountUrl } from './model/normalizeIdAccountUrl';
import { useProfileSession } from './model/useProfileSession';
import './profile.css';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { sessionInfo, isLoading, error, refresh } = useProfileSession();
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'likes' | 'achievements' | 'privacy' | 'settings'>('overview');

  const tenantMembership = useMemo(() => {
    if (!sessionInfo) return null;
    if (sessionInfo.tenant_membership) return sessionInfo.tenant_membership;
    const memberships = sessionInfo.id_profile?.memberships;
    if (!Array.isArray(memberships) || memberships.length === 0) {
      return null;
    }
    const tenantId = sessionInfo.tenant?.id;
    const tenantSlug = sessionInfo.tenant?.slug;
    return (
      memberships.find((membership) => {
        const matchesTenantId = tenantId && String(membership?.tenant_id) === String(tenantId);
        const matchesTenantSlug = tenantSlug && String(membership?.tenant_slug) === String(tenantSlug);
        return matchesTenantId || matchesTenantSlug;
      }) ?? null
    );
  }, [sessionInfo]);

  const isSystemAdmin = useMemo(() => {
    const flags = sessionInfo?.user?.master_flags as Record<string, unknown> | undefined;
    const fromFlags = flags?.system_admin === true;
    return Boolean(fromFlags) || Boolean(user?.isSuperuser);
  }, [sessionInfo?.user?.master_flags, user?.isSuperuser]);

  const tenantRole = useMemo(() => {
    const roleValue = tenantMembership?.base_role;
    if (typeof roleValue === 'string' && roleValue.trim()) {
      return roleValue;
    }
    if (roleValue !== undefined && roleValue !== null) {
      return String(roleValue);
    }
    return null;
  }, [tenantMembership?.base_role]);

  const isTenantAdmin = useMemo(() => {
    const role = (tenantRole || '').toString().toLowerCase();
    return isSystemAdmin || role === 'admin' || role === 'owner';
  }, [isSystemAdmin, tenantRole]);

  const tenantStatus = useMemo(() => {
    const status = tenantMembership?.status;
    return status && typeof status === 'string' ? status : null;
  }, [tenantMembership?.status]);

  const tenantLine = useMemo(() => {
    if (!sessionInfo?.tenant) return null;
    const { slug, id } = sessionInfo.tenant;
    if (slug && id) {
      return `${slug} (${id})`;
    }
    if (slug) {
      return slug;
    }
    if (id) {
      return id;
    }
    return null;
  }, [sessionInfo?.tenant]);

  const displayName = useMemo(() => user?.displayName || user?.username || 'No name set', [user]);
  const initials = useMemo(
    () =>
      displayName?.charAt(0).toUpperCase() ||
      user?.email?.charAt(0).toUpperCase() ||
      'U',
    [displayName, user?.email],
  );

  const idAccountUrl = useMemo(
    () => normalizeIdAccountUrl(sessionInfo?.id_frontend_base_url),
    [sessionInfo?.id_frontend_base_url],
  );

  const handleSettings = useCallback(() => {
    navigate('/app/settings');
  }, [navigate]);

  if (!user) {
    return null;
  }

  const idProfileUser = sessionInfo?.id_profile?.user as Record<string, unknown> | undefined;
  const portalProfile = sessionInfo?.portal_profile as Record<string, unknown> | undefined;
  const avatarUrl = user.avatarUrl || (typeof idProfileUser?.avatar_url === 'string' ? idProfileUser.avatar_url : null);
  const firstName =
    (typeof portalProfile?.first_name === 'string' && portalProfile.first_name) ||
    (typeof idProfileUser?.first_name === 'string' && idProfileUser.first_name) ||
    null;
  const lastName =
    (typeof portalProfile?.last_name === 'string' && portalProfile.last_name) ||
    (typeof idProfileUser?.last_name === 'string' && idProfileUser.last_name) ||
    null;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const headline = fullName || displayName;
  const username = user.username || (typeof idProfileUser?.username === 'string' ? idProfileUser.username : null);
  const bio = typeof portalProfile?.bio === 'string' ? portalProfile.bio : null;
  const language = typeof idProfileUser?.language === 'string' ? idProfileUser.language : null;
  const timezone = typeof idProfileUser?.timezone === 'string' ? idProfileUser.timezone : null;
  const birthDate = typeof idProfileUser?.birth_date === 'string' ? idProfileUser.birth_date : null;
  const isOwner = Boolean(sessionInfo?.user?.id && String(sessionInfo.user.id) === String(user.id));

  const tabs = [
    { id: 'overview', label: 'Обзор', public: true },
    { id: 'posts', label: 'Посты', public: true },
    { id: 'likes', label: 'Лайки', public: true },
    { id: 'achievements', label: 'Ачивки', public: true },
    { id: 'privacy', label: 'Приватность', public: false },
    { id: 'settings', label: 'Настройки', public: false },
  ] as const;

  const visibleTabs = tabs.filter((tab) => tab.public || isOwner);

  const showLoading = isLoading && !sessionInfo;

  return (
    <div className="profile-page">
      {error && (
        <Card view="filled" className="p-3 mb-3">
          <Text variant="body-1" color="danger" className="mb-2">
            Не удалось загрузить информацию профиля.
          </Text>
          <Button view="outlined" size="s" onClick={refresh}>
            Повторить
          </Button>
        </Card>
      )}

      <Card view="filled" className="profile-hero">
        <div className="profile-hero__main">
          <Avatar size="xl" text={initials} imgUrl={avatarUrl ?? undefined} />
          <div className="profile-hero__meta">
            <div className="profile-hero__title">
              <Text variant="header-1">{showLoading ? 'Загружаем профиль…' : headline}</Text>
              <div className="profile-hero__badges">
                {isSystemAdmin && <Label theme="danger" size="s">System admin</Label>}
                {isTenantAdmin && <Label theme="success" size="s">Tenant admin</Label>}
                {tenantRole && <Label theme="normal" size="s">{tenantRole}</Label>}
                {tenantStatus && <Label theme="info" size="s">{tenantStatus}</Label>}
              </div>
            </div>
            <div className="profile-hero__subtitle">
              <Text variant="body-2" color="secondary">@{username || 'unknown'}</Text>
              {user.email ? <Text variant="body-2" color="secondary">{user.email}</Text> : null}
            </div>
            {bio ? (
              <Text variant="body-2" className="profile-hero__bio">
                {bio}
              </Text>
            ) : (
              <Text variant="body-2" color="secondary" className="profile-hero__bio">
                Нет описания профиля
              </Text>
            )}
          </div>
        </div>
        <div className="profile-hero__actions">
          {isOwner && (
            <>
              <Button view="outlined" size="m" onClick={handleSettings}>Настройки</Button>
              {idAccountUrl ? (
                <Button view="action" size="m" href={`${idAccountUrl}/profile`}>ID профиль</Button>
              ) : null}
            </>
          )}
          {!isOwner && <Button view="action" size="m">Подписаться</Button>}
        </div>
      </Card>

      <div className="profile-tabs">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.id}
            view={activeTab === tab.id ? 'action' : 'outlined'}
            size="s"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="profile-grid">
          <Card view="filled" className="profile-card">
            <Text variant="subheader-2" className="mb-2">Публичная информация</Text>
            <div className="profile-list">
              <div>
                <Text variant="body-2" color="secondary">Тенант</Text>
                <Text variant="body-1">{tenantLine || '—'}</Text>
              </div>
              <div>
                <Text variant="body-2" color="secondary">Язык</Text>
                <Text variant="body-1">{language || '—'}</Text>
              </div>
              <div>
                <Text variant="body-2" color="secondary">Часовой пояс</Text>
                <Text variant="body-1">{timezone || '—'}</Text>
              </div>
              <div>
                <Text variant="body-2" color="secondary">Дата рождения</Text>
                <Text variant="body-1">{birthDate || '—'}</Text>
              </div>
            </div>
          </Card>

          <Card view="filled" className="profile-card">
            <Text variant="subheader-2" className="mb-2">Последние ачивки</Text>
            <div className="achievements-strip">
              {[1, 2, 3].map((item) => (
                <div key={item} className="achievement-chip">
                  <div className="achievement-chip__icon" />
                  <div>
                    <Text variant="body-2">Achievement #{item}</Text>
                    <Text variant="caption-1" color="secondary">Event · 2 дня назад</Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card view="filled" className="profile-card">
            <Text variant="subheader-2" className="mb-2">Активность</Text>
            <Text variant="body-2" color="secondary">
              Здесь будут новости, посты и публичные обновления пользователя.
            </Text>
          </Card>
        </div>
      )}

      {activeTab === 'posts' && (
        <Card view="filled" className="profile-card">
          <Text variant="subheader-2" className="mb-2">Посты пользователя</Text>
          <Text variant="body-2" color="secondary">
            Нет опубликованных постов. Здесь будут появляться новости и обновления профиля.
          </Text>
        </Card>
      )}

      {activeTab === 'likes' && (
        <Card view="filled" className="profile-card">
          <Text variant="subheader-2" className="mb-2">Понравившиеся</Text>
          <Text variant="body-2" color="secondary">
            Пока здесь пусто. Лайкнутые посты появятся автоматически.
          </Text>
        </Card>
      )}

      {activeTab === 'achievements' && (
        <div className="profile-grid">
          <Card view="filled" className="profile-card">
            <div className="card-header">
              <Text variant="subheader-2">Мои ачивки</Text>
              {isOwner && <Button view="outlined" size="s">Создать ачивку</Button>}
            </div>
            <div className="achievements-grid">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="achievement-card">
                  <div className="achievement-card__media">
                    <div className="achievement-card__art achievement-card__art--lg" />
                    <div className="achievement-card__art achievement-card__art--md" />
                    <div className="achievement-card__art achievement-card__art--sm" />
                  </div>
                  <div>
                    <Text variant="body-2">Crystal Quest #{item}</Text>
                    <Text variant="caption-1" color="secondary">Тип: ивентовая</Text>
                  </div>
                  <div className="achievement-card__actions">
                    <Button view="outlined" size="s" disabled>Страница ачивки</Button>
                    {isOwner && <Button view="action" size="s">Выдать</Button>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card view="filled" className="profile-card">
            <Text variant="subheader-2" className="mb-2">Кому выдавать</Text>
            <Text variant="body-2" color="secondary" className="mb-3">
              Выберите игрока и зафиксируйте факт владения ачивкой.
            </Text>
            <Button view="outlined" size="m" disabled>Открыть выдачу</Button>
          </Card>
        </div>
      )}

      {activeTab === 'privacy' && (
        <Card view="filled" className="profile-card">
          <Text variant="subheader-2" className="mb-2">Приватность профиля</Text>
          <div className="privacy-list">
            <div className="privacy-row">
              <div>
                <Text variant="body-2">Показывать ачивки</Text>
                <Text variant="caption-1" color="secondary">
                  Отображать в публичной карточке последние достижения.
                </Text>
              </div>
              <Switch size="m" checked />
            </div>
            <div className="privacy-row">
              <div>
                <Text variant="body-2">Показывать лайки</Text>
                <Text variant="caption-1" color="secondary">
                  Делать список понравившихся постов публичным.
                </Text>
              </div>
              <Switch size="m" />
            </div>
            <div className="privacy-row">
              <div>
                <Text variant="body-2">Показывать статистику</Text>
                <Text variant="caption-1" color="secondary">
                  Публичные цифры активности и участия в событиях.
                </Text>
              </div>
              <Switch size="m" checked />
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'settings' && (
        <div className="profile-grid">
          <Card view="filled" className="profile-card">
            <Text variant="subheader-2" className="mb-2">Настройки профиля</Text>
            <Text variant="body-2" color="secondary" className="mb-3">
              Управляйте публичной информацией, языком и внешним видом профиля.
            </Text>
            <Button view="action" size="m" onClick={handleSettings}>Открыть настройки</Button>
          </Card>
          <Card view="filled" className="profile-card">
            <Text variant="subheader-2" className="mb-2">ID аккаунт</Text>
            <Text variant="body-2" color="secondary" className="mb-3">
              Перейти в ID, чтобы обновить пароль, 2FA или аватар.
            </Text>
            {idAccountUrl ? (
              <Button view="outlined" size="m" href={`${idAccountUrl}/profile`}>Открыть ID</Button>
            ) : (
              <Button view="outlined" size="m" disabled>ID недоступен</Button>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
