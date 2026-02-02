import React from 'react';
import { Router, RouterProvider } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { AppLoader } from '../shared/ui/AppLoader';

type PortalRouterProps = {
  router: Router;
};

export const PortalRouter: React.FC<PortalRouterProps> = ({ router }) => (
  <ErrorBoundary>
    <OfflineBanner />
    <RouterProvider router={router} fallbackElement={<AppLoader />} />
  </ErrorBoundary>
);
