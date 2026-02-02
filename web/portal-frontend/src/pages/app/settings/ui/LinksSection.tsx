import React from 'react';
import { Card, Icon, Link, Text } from '@gravity-ui/uikit';
import { ArrowUpRightFromSquare } from '@gravity-ui/icons';

type LinksSectionProps = {
  idPortalUrl: string;
};

export const LinksSection: React.FC<LinksSectionProps> = ({ idPortalUrl }) => (
  <Card view="filled" className="p-4">
    <Text variant="subheader-2" className="mb-3">
      More Options
    </Text>
    <div className="d-flex flex-column gap-2">
      <Link href={`${idPortalUrl}/email`} target="_blank" rel="noopener noreferrer">
        Change Email Address
        <Icon data={ArrowUpRightFromSquare} size={12} />
      </Link>
      <Link href={`${idPortalUrl}/integrations`} target="_blank" rel="noopener noreferrer">
        Connected Accounts & Integrations
        <Icon data={ArrowUpRightFromSquare} size={12} />
      </Link>
    </div>
  </Card>
);
