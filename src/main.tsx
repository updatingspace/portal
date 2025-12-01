import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
  ThemeProvider,
  ToasterComponent,
  ToasterProvider,
} from '@gravity-ui/uikit';

import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';

import App from './App';
import { toaster } from './toaster';
import { AuthProvider } from './contexts/AuthContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme="light">
      <ToasterProvider toaster={toaster}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ToasterComponent />
          </AuthProvider>
        </BrowserRouter>
      </ToasterProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
