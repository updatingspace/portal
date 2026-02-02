import React, { useCallback, useMemo } from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import { normalizeIdAccountUrl } from './model/normalizeIdAccountUrl';
import { useProfileSession } from './model/useProfileSession';
import { AccountDetails } from './ui/AccountDetails';
import { AccountDetailsSkeleton } from './ui/AccountDetailsSkeleton';
import { ProfileHero } from './ui/ProfileHero';
import { ProfileHeroSkeleton } from './ui/ProfileHeroSkeleton';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { sessionInfo, isLoading, error, refresh } = useProfileSession();

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

  return (
    <div className="container-fluid" style={{ maxWidth: 900 }}>
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

      {isLoading ? (
        <ProfileHeroSkeleton />
      ) : (
        <ProfileHero
          displayName={displayName}
          initials={initials}
          email={user.email}
          isSystemAdmin={isSystemAdmin}
          isTenantAdmin={isTenantAdmin}
          tenantRole={tenantRole}
          tenantStatus={tenantStatus}
          idAccountUrl={idAccountUrl}
          onSettings={handleSettings}
        />
      )}

      {isLoading ? (
        <AccountDetailsSkeleton />
      ) : (
        <AccountDetails userId={user.id} tenantLine={tenantLine} />
      )}
    </div>
  );
};
