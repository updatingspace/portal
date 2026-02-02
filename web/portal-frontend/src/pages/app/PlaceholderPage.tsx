import React from 'react';
import { Card } from '@gravity-ui/uikit';

export const PlaceholderPage: React.FC<{ title: string; description?: string }> = ({ title, description }) => {
  return (
    <div className="container-fluid">
      <div className="text-muted small">Coming soon</div>
      <h1 className="h3 fw-semibold mb-3">{title}</h1>
      <Card view="filled" className="p-4">
        <div className="text-muted">{description ?? 'This section will be implemented in the next iterations.'}</div>
      </Card>
    </div>
  );
};
