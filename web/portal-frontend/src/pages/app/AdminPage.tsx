import React from 'react';

import { AdminApplicationsPage } from '../../modules/portal/pages/AdminApplicationsPage';
import { RequireAuth } from '../../components/RequireAuth';

export const AdminPage: React.FC = () => {
  return (
    <RequireAuth superuserOnly>
      <AdminApplicationsPage />
    </RequireAuth>
  );
};
