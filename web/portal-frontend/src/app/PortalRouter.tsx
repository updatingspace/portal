import React from 'react';
import { RouterProvider } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';

type PortalRouterProps = {
  router: Parameters<typeof RouterProvider>[0]['router'];
};

export const PortalRouter: React.FC<PortalRouterProps> = ({ router }) => (
  <ErrorBoundary>
    <OfflineBanner />
    <RouterProvider router={router} />
  </ErrorBoundary>
);
