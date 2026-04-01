/**
 * SettingsSection - Reusable settings group container
 */
import { Card, Text } from '@gravity-ui/uikit';
import type { ReactNode } from 'react';

import './settings.css';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  testId?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  testId,
}: SettingsSectionProps) {
  return (
    <Card className="settings-section" data-testid={testId}>
      <div className="settings-section__header">
        <Text variant="subheader-2" as="h3" className="settings-section__title">
          {title}
        </Text>
        {description && (
          <Text variant="body-1" color="secondary" className="settings-section__description">
            {description}
          </Text>
        )}
      </div>
      <div className="settings-section__content">{children}</div>
    </Card>
  );
}
