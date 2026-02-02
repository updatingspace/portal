/**
 * AccountLinkCard Component
 *
 * Card for displaying and managing external account links.
 */

import React from 'react';
import { Card, Button, Label } from '@gravity-ui/uikit';
import type { AccountLinkDetail, SourceType, AccountLinkStatus } from '../../../types/activity';

// Source type configuration
const SOURCE_CONFIG: Record<SourceType, { icon: string; name: string; color: string }> = {
  steam: { icon: '🎮', name: 'Steam', color: '#1b2838' },
  minecraft: { icon: '⛏️', name: 'Minecraft', color: '#62b47a' },
  discord: { icon: '💬', name: 'Discord', color: '#5865f2' },
  custom: { icon: '🔗', name: 'Custom', color: '#6b7280' },
};

// Status configuration
const STATUS_CONFIG: Record<AccountLinkStatus, { theme: 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
  active: { theme: 'success', label: 'Активно' },
  pending: { theme: 'warning', label: 'Ожидание' },
  disabled: { theme: 'info', label: 'Отключено' },
  error: { theme: 'danger', label: 'Ошибка' },
};

export interface AccountLinkCardProps {
  link: AccountLinkDetail;
  onSync?: (linkId: number) => void;
  onDisconnect?: (linkId: number) => void;
  isLoading?: boolean;
}

export const AccountLinkCard: React.FC<AccountLinkCardProps> = ({
  link,
  onSync,
  onDisconnect,
  isLoading = false,
}) => {
  const sourceConfig = SOURCE_CONFIG[link.sourceType as SourceType] ?? SOURCE_CONFIG.custom;
  const statusConfig = STATUS_CONFIG[link.status as AccountLinkStatus] ?? STATUS_CONFIG.pending;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Никогда';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: sourceConfig.color + '20' }}
        >
          {sourceConfig.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{sourceConfig.name}</h3>
            <Label theme={statusConfig.theme} size="xs">
              {statusConfig.label}
            </Label>
          </div>

          {/* External ID */}
          {link.externalIdentityRef && (
            <div className="text-sm text-gray-500 truncate">
              ID: {link.externalIdentityRef}
            </div>
          )}

          {/* Settings preview */}
          {link.settingsJson && Object.keys(link.settingsJson).length > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              {Object.entries(link.settingsJson)
                .slice(0, 2)
                .map(([key, value]) => `${key}: ${String(value)}`)
                .join(' • ')}
            </div>
          )}

          {/* Sync info */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>
              Последняя синхр.: {formatDate(link.lastSyncAt)}
            </span>
            {link.lastError && (
              <span className="text-red-500 truncate max-w-[200px]" title={link.lastError}>
                ⚠️ {link.lastError}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {onSync && link.status === 'active' && (
            <Button
              view="outlined"
              size="s"
              loading={isLoading}
              onClick={() => onSync(link.id)}
            >
              Синхронизировать
            </Button>
          )}
          {onDisconnect && (
            <Button
              view="flat-danger"
              size="s"
              loading={isLoading}
              onClick={() => onDisconnect(link.id)}
            >
              Отключить
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

/**
 * AccountLinkList Component
 *
 * List of account links with empty state.
 */
export interface AccountLinkListProps {
  links: AccountLinkDetail[];
  onSync?: (linkId: number) => void;
  onDisconnect?: (linkId: number) => void;
  onConnect?: () => void;
  isLoading?: boolean;
}

export const AccountLinkList: React.FC<AccountLinkListProps> = ({
  links,
  onSync,
  onDisconnect,
  onConnect,
  isLoading = false,
}) => {
  if (links.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-4xl mb-2">🔗</div>
        <h3 className="font-semibold mb-1">Нет привязанных аккаунтов</h3>
        <p className="text-sm text-gray-500 mb-4">
          Привяжите внешние аккаунты для синхронизации активности
        </p>
        {onConnect && (
          <Button view="action" onClick={onConnect}>
            Привязать аккаунт
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {links.map((link) => (
        <AccountLinkCard
          key={link.id}
          link={link}
          onSync={onSync}
          onDisconnect={onDisconnect}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
};
