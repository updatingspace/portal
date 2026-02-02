import React from 'react';
import { Alert, Button, Card, Icon, Label, Text } from '@gravity-ui/uikit';
import { Clock } from '@gravity-ui/icons';

import type { Session } from '../../../../api/account';

type SessionsSectionProps = {
  sessions: Session[];
  isLoading: boolean;
  error: Error | null;
  revokingId: string | null;
  onRevoke: (sessionId: string) => void;
  onRetry: () => void;
};

export const SessionsSection: React.FC<SessionsSectionProps> = ({
  sessions,
  isLoading,
  error,
  revokingId,
  onRevoke,
  onRetry,
}) => (
  <Card view="filled" className="p-4 mb-4">
    <div className="d-flex align-items-center gap-2 mb-3">
      <Icon data={Clock} size={18} />
      <Text variant="subheader-2">Active Sessions</Text>
    </div>

    {error && (
      <div className="mb-3">
        <Alert theme="warning" message="Unable to load sessions" className="mb-2" />
        <Button view="flat" size="s" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )}

    {!isLoading && sessions.length === 0 && !error && (
      <Text variant="body-1" color="secondary">
        No active sessions found.
      </Text>
    )}

    {!isLoading && sessions.length > 0 && (
      <div className="d-flex flex-column gap-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="d-flex justify-content-between align-items-center p-2"
            style={{
              background: session.is_current
                ? 'var(--g-color-base-positive-light)'
                : 'var(--g-color-base-generic)',
              borderRadius: 8,
            }}
          >
            <div>
              <div className="d-flex align-items-center gap-2">
                <Text variant="body-1">
                  {session.user_agent ? truncateUserAgent(session.user_agent) : 'Unknown device'}
                </Text>
                {session.is_current && (
                  <Label theme="success" size="xs">
                    Current
                  </Label>
                )}
              </div>
              <Text variant="body-1" color="secondary">
                {session.ip || 'Unknown IP'} • {formatDate(session.last_used_at || session.created_at)}
              </Text>
            </div>
            {!session.is_current && (
              <Button
                view="flat-danger"
                size="s"
                loading={revokingId === session.id}
                onClick={() => onRevoke(session.id)}
              >
                Revoke
              </Button>
            )}
          </div>
        ))}
      </div>
    )}
  </Card>
);

function truncateUserAgent(ua: string): string {
  if (ua.length <= 50) return ua;
  const match = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
  if (match) return match[0];
  return `${ua.slice(0, 47)}...`;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
