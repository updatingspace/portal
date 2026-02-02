import React from 'react';
import { Avatar, Button, Card, Icon, Text } from '@gravity-ui/uikit';
import { ArrowUpRightFromSquare, Person } from '@gravity-ui/icons';

import type { UserInfo } from '../../../contexts/AuthContext';

type ProfileSectionProps = {
  user: UserInfo;
  idPortalUrl: string;
};

export const ProfileSection: React.FC<ProfileSectionProps> = ({ user, idPortalUrl }) => {
  const initials =
    user.displayName?.charAt(0).toUpperCase() ||
    user.email?.charAt(0).toUpperCase() ||
    '?';

  return (
    <Card view="filled" className="p-4 mb-4">
      <div className="d-flex align-items-center gap-2 mb-3">
        <Icon data={Person} size={18} />
        <Text variant="subheader-2">Profile</Text>
      </div>

      <div className="d-flex align-items-center gap-3 mb-3">
        <Avatar
          size="l"
          text={initials}
          title={user.displayName || user.username || 'Account'}
          aria-hidden="true"
        />
        <div>
          <Text variant="body-2" className="fw-semibold">
            {user.displayName || 'No name set'}
          </Text>
          <Text variant="body-1" color="secondary">
            {user.email}
          </Text>
        </div>
      </div>

      <Text variant="body-1" color="secondary" className="mb-3" as="p">
        Manage your profile information, display name, and preferences.
      </Text>

      <Button
        view="outlined"
        href={`${idPortalUrl}/profile`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Edit Profile
        <Icon data={ArrowUpRightFromSquare} size={14} />
      </Button>
    </Card>
  );
};
