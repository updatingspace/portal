/**
 * SettingsSection - Reusable settings group container
 */
import { Card, Text } from '@gravity-ui/uikit';
import { useMediaQuery } from '../../../../shared/hooks/useMediaQuery';
import type { ReactNode } from 'react';

import './settings.css';

export interface SettingsSectionProps {
  title: string;
  collapseOnMobile?: boolean;
  description?: string;
  children: ReactNode;
  testId?: string;
}

export function SettingsSection({
  title,
  collapseOnMobile = false,
  description,
  children,
  testId,
}: SettingsSectionProps) {
  const mobile = useMediaQuery('(max-width: 719px)');
  if (mobile && collapseOnMobile)
    return (
      <details className="settings-disclosure" data-testid={testId}>
        <summary>
          <span>{title}</span>
        </summary>
        {description && (
          <p className="settings-disclosure__description">{description}</p>
        )}
        <div className="settings-section__content">{children}</div>
      </details>
    );
  return (
    <Card className="settings-section" data-testid={testId}>
      <div className="settings-section__header">
        <Text variant="subheader-2" as="h3" className="settings-section__title">
          {title}
        </Text>
        {description && (
          <Text
            variant="body-1"
            color="secondary"
            className="settings-section__description"
          >
            {description}
          </Text>
        )}
      </div>
      <div className="settings-section__content">{children}</div>
    </Card>
  );
}
