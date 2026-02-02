import React from 'react';
import { Alert, Button, Card, Icon, Label, Text } from '@gravity-ui/uikit';
import { ArrowUpRightFromSquare, Key, Shield, Smartphone } from '@gravity-ui/icons';

import type { MfaStatus } from '../../../../api/account';

type SecuritySectionProps = {
  idPortalUrl: string;
  mfaStatus: MfaStatus | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
};

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  idPortalUrl,
  mfaStatus,
  isLoading,
  error,
  onRetry,
}) => (
  <Card view="filled" className="p-4 mb-4">
    <div className="d-flex align-items-center gap-2 mb-3">
      <Icon data={Shield} size={18} />
      <Text variant="subheader-2">Security</Text>
    </div>

    {error && (
      <div className="mb-3">
        <Alert
          theme="warning"
          message="Unable to load security status"
          className="mb-2"
        />
        <Button view="flat" size="s" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )}

    {!isLoading && mfaStatus && (
      <div className="mb-3">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <div className="d-flex align-items-center gap-2">
            <Icon data={Smartphone} size={14} />
            <Text variant="body-1">TOTP:</Text>
            <Label theme={mfaStatus.totp_enabled ? 'success' : 'unknown'} size="s">
              {mfaStatus.totp_enabled ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Icon data={Key} size={14} />
            <Text variant="body-1">Passkeys:</Text>
            <Label theme={mfaStatus.webauthn_enabled ? 'success' : 'unknown'} size="s">
              {mfaStatus.webauthn_enabled
                ? `${mfaStatus.authenticators.length} configured`
                : 'None'}
            </Label>
          </div>
        </div>
        {mfaStatus.recovery_codes_available > 0 && (
          <Text variant="body-1" color="secondary">
            Recovery codes available: {mfaStatus.recovery_codes_available}
          </Text>
        )}
      </div>
    )}

    {!isLoading && !mfaStatus && !error && (
      <Alert theme="warning" message="Security status is unavailable" className="mb-3" />
    )}

    <Text variant="body-1" color="secondary" className="mb-3" as="p">
      Manage passkeys, two-factor authentication (TOTP), and recovery codes.
    </Text>

    <Button
      view="action"
      href={`${idPortalUrl}/security`}
      target="_blank"
      rel="noopener noreferrer"
    >
      Manage Security
      <Icon data={ArrowUpRightFromSquare} size={14} />
    </Button>
  </Card>
);
