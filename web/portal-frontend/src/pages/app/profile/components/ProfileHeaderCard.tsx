import React, { useMemo, useState } from 'react';
import { Avatar, Button, Card, DropdownMenu, Label, Text, type DropdownMenuItem } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import { useRouteBase } from '../../../../shared/hooks/useRouteBase';
import { toaster } from '../../../../toaster';
import type { ProfileOwnerVM } from '../model/types';
import { profileHubStrings } from '../strings/ru';

type ProfileHeaderCardProps = {
  owner: ProfileOwnerVM;
  isSelf: boolean;
  canEditProfile: boolean;
};

export const ProfileHeaderCard: React.FC<ProfileHeaderCardProps> = ({
  owner,
  isSelf,
  canEditProfile,
}) => {
  const navigate = useNavigate();
  const routeBase = useRouteBase();
  const [expanded, setExpanded] = useState(false);

  const initials = useMemo(() => owner.tenantDisplayName.charAt(0).toUpperCase() || 'U', [owner.tenantDisplayName]);
  const bio = owner.bio || profileHubStrings.bioMissing;
  const collapsed = bio.length > 120 && !expanded;
  const bioText = collapsed ? `${bio.slice(0, 120)}...` : bio;

  const copyProfileLink = async () => {
    const href = typeof window === 'undefined' ? `${routeBase}/profile` : window.location.href;
    try {
      await navigator.clipboard.writeText(href);
      toaster.add({
        name: `profile-link-${Date.now()}`,
        title: profileHubStrings.common.copied,
        theme: 'success',
      });
    } catch {
      toaster.add({
        name: `profile-link-failed-${Date.now()}`,
        title: profileHubStrings.common.copyFailed,
        theme: 'danger',
      });
    }
  };

  const menuItems: DropdownMenuItem[] = [
    {
      text: profileHubStrings.common.copyLink,
      action: () => {
        void copyProfileLink();
      },
    },
    ...(isSelf
      ? [
          {
            text: profileHubStrings.common.privacySettings,
            action: () => navigate(`${routeBase}/settings`),
          } satisfies DropdownMenuItem,
        ]
      : []),
  ];

  return (
    <Card view="filled" className="profile-hub__header-card">
      <div className="profile-hub__header-main">
        <Avatar imgUrl={owner.avatarUrl} size="xl" text={initials} />
        <div className="profile-hub__header-meta">
          <h1 className="profile-hub__title">{owner.tenantDisplayName}</h1>
          <div className="profile-hub__badges">
            {owner.roleBadge && <Label size="s">{owner.roleBadge}</Label>}
            {owner.statusBadge && <Label size="s" theme="info">{owner.statusBadge}</Label>}
            {owner.handle && <Text variant="body-2" color="secondary">@{owner.handle}</Text>}
          </div>
          <Text variant="body-2" className="profile-hub__bio">{bioText}</Text>
          {bio.length > 120 && (
            <Button view="flat" size="s" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? profileHubStrings.collapse : profileHubStrings.showMore}
            </Button>
          )}
        </div>
      </div>
      <div className="profile-hub__header-actions">
        {isSelf && canEditProfile && (
          <Button view="outlined" size="m" onClick={() => navigate(`${routeBase}/settings`)}>
            {profileHubStrings.common.editProfile}
          </Button>
        )}
        <DropdownMenu
          items={menuItems}
          renderSwitcher={(props) => (
            <Button {...props} view="flat" size="m" aria-label="Меню профиля">
              ...
            </Button>
          )}
        />
      </div>
    </Card>
  );
};
