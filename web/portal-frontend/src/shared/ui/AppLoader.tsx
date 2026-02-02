import React from 'react';
import { Loader } from '@gravity-ui/uikit';

export const AppLoader: React.FC = () => (
  <div
    className="app-loader"
    aria-busy="true"
    aria-live="polite"
    style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}
  >
    <Loader size="l" />
  </div>
);
