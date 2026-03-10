import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useRouteBase } from '../../shared/hooks/useRouteBase';

export const BrandLink: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const routeBase = useRouteBase();
  const label = user?.tenant?.slug ? `AEF · ${user.tenant.slug}` : 'AEF Portal';

  return (
    <button type="button" className="app-shell__brand" onClick={() => navigate(routeBase)}>
      {label}
    </button>
  );
};
