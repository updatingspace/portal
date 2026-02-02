import React from 'react';
import { Icon, Text } from '@gravity-ui/uikit';
import { CloudSlash } from '@gravity-ui/icons';

import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Banner that appears when the user goes offline.
 * Automatically shows/hides based on network status.
 */
export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-banner" role="alert" aria-live="polite">
      <Icon data={CloudSlash} size={18} />
      <Text variant="body-2">
        Нет подключения к интернету. Проверьте сеть и попробуйте снова.
      </Text>

      <style>{`
        .offline-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 12px 24px;
          background: var(--g-color-base-warning-heavy);
          color: var(--g-color-text-inverted-primary);
          animation: slideDown 0.3s ease-out;
        }
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
