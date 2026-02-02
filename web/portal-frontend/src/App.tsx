import React, { useMemo } from 'react';

import { createAppRouter } from './app/routes';
import { AuthLoadingGuard } from './app/guards/AuthLoadingGuard';
import { PortalRouter } from './app/PortalRouter';

const App: React.FC = () => {
  const router = useMemo(() => createAppRouter(), []);

  return (
    <AuthLoadingGuard>
      <PortalRouter router={router} />
    </AuthLoadingGuard>
  );
};

export default App;
