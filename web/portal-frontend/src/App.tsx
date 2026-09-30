import React, { useMemo } from 'react';

import { createAppRouter } from './app/routes';
import { PortalRouter } from './app/PortalRouter';

const App: React.FC = () => {
  const router = useMemo(() => createAppRouter(), []);

  return (
      <PortalRouter router={router} />
  );
};

export default App;
