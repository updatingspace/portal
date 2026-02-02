import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToasterComponent, ToasterProvider } from '@gravity-ui/uikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';

import '@gravity-ui/markdown-editor/styles/styles.css';
import '@gravity-ui/markdown-editor/styles/markdown.css';

import '@diplodoc/transform/dist/css/yfm.css';
import '@diplodoc/transform/dist/js/yfm';

import {configure} from '@gravity-ui/markdown-editor';
configure({lang: 'ru'});

// Bootstrap: grid + utilities only (avoid reboot/base conflicts with Gravity UI)

import 'bootstrap/dist/css/bootstrap-grid.min.css';
import 'bootstrap/dist/css/bootstrap-utilities.min.css';
import './index.css';

import { toaster } from './toaster';
import { AuthProvider } from './contexts/AuthContext';
import { AuthUIProvider } from './contexts/AuthUIContext';
import { I18nProvider } from './app/providers/I18nProvider';
import { ThemeModeProvider } from './app/providers/ThemeModeProvider';
import { createAppRouter } from './app/routes';
import { AuthLoadingGuard } from './app/guards/AuthLoadingGuard';
import { PortalRouter } from './app/PortalRouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const router = createAppRouter();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <ToasterProvider toaster={toaster}>
            <AuthProvider>
              <AuthUIProvider>
                <AuthLoadingGuard>
                  <PortalRouter router={router} />
                </AuthLoadingGuard>
                <ToasterComponent />
              </AuthUIProvider>
            </AuthProvider>
          </ToasterProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeModeProvider>
  </React.StrictMode>,
);
