import React from 'react';
import { Avatar, Button, Card, Icon, Label, Text } from '@gravity-ui/uikit';
import { CircleCheck, Envelope, Pencil } from '@gravity-ui/icons';

type ProfileHeroProps = {
  displayName: string;
  initials: string;
  email?: string | null;
  isSystemAdmin: boolean;
  isTenantAdmin: boolean;
  tenantRole?: string | null;
  tenantStatus?: string | null;
  idAccountUrl?: string | null;
  onSettings: () => void;
};

export const ProfileHero: React.FC<ProfileHeroProps> = ({
  displayName,
  initials,
  email,
  isSystemAdmin,
  isTenantAdmin,
  tenantRole,
  tenantStatus,
  idAccountUrl,
  onSettings,
}) => (
  <Card view="filled" className="p-4 mb-4">
    <div className="d-flex align-items-start gap-4">
      <Avatar size="xl" text={initials} title={displayName} />

      <div className="flex-grow-1">
        <Text variant="header-1" className="mb-1">
          {displayName}
        </Text>

        {email && (
          <div className="d-flex align-items-center gap-2 mb-3">
            <Icon data={Envelope} size={14} />
            <Text variant="body-1" color="secondary">
              {email}
            </Text>
          </div>
        )}

        <div className="d-flex flex-wrap gap-2 mb-3">
          <Label theme="success" size="s" icon={<Icon data={CircleCheck} size={12} />}>
            Email verified
          </Label>
          {isSystemAdmin && (
            <Label theme="warning" size="s">
              System Admin
            </Label>
          )}
          {isTenantAdmin && (
            <Label theme="info" size="s">
              Tenant Admin
            </Label>
          )}
          {!isTenantAdmin && tenantRole && (
            <Label theme="normal" size="s">
              Role: {tenantRole}
            </Label>
          )}
          {tenantStatus && tenantStatus !== 'active' && (
            <Label theme="danger" size="s">
              Status: {tenantStatus}
            </Label>
          )}
        </div>

        <div className="d-flex flex-wrap gap-2">
          {idAccountUrl && (
            <Button
              view="outlined-info"
              size="m"
              href={idAccountUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon data={Pencil} size={14} />
              Manage in ID
            </Button>
          )}
          <Button view="outlined" size="m" onClick={onSettings}>
            Account Settings
          </Button>
        </div>
      </div>
    </div>
  </Card>
);
