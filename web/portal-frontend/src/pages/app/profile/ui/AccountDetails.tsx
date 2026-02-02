import React from 'react';
import { Card, Text } from '@gravity-ui/uikit';

type AccountDetailsProps = {
  userId: string;
  tenantLine?: string | null;
};

export const AccountDetails: React.FC<AccountDetailsProps> = ({ userId, tenantLine }) => (
  <Card view="filled" className="p-4 mb-4">
    <Text variant="subheader-2" className="mb-3">
      Account Details
    </Text>

    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-between">
        <Text variant="body-1" color="secondary">
          User ID
        </Text>
        <Text variant="body-1" style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {userId}
        </Text>
      </div>

      {tenantLine && (
        <div className="d-flex justify-content-between">
          <Text variant="body-1" color="secondary">
            Tenant
          </Text>
          <Text variant="body-1" style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {tenantLine}
          </Text>
        </div>
      )}
    </div>
  </Card>
);
