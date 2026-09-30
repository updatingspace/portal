import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToasterComponent, ToasterProvider } from '@gravity-ui/uikit';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

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
import './modules/voting/styles/voting-v2.css';
import './shared/ui/portal/portal.css';

import { toaster } from './toaster';
import { AuthProvider } from './contexts/AuthContext';
import { AuthUIProvider } from './contexts/AuthUIContext';
import {AccountTenantScope} from './app/providers/AccountTenantScope';
import { I18nProvider } from './app/providers/I18nProvider';
import { ThemeModeProvider } from './app/providers/ThemeModeProvider';
import { applyLegacyTenantAliasRedirect } from './app/bootstrap/legacyTenantAlias';
import { createAppRouter } from './app/routes';
import { PortalRouter } from './app/PortalRouter';

if (!applyLegacyTenantAliasRedirect()) {
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
      <I18nProvider>
        <ThemeModeProvider>
          <QueryClientProvider client={queryClient}>
            <ToasterProvider toaster={toaster}>
              <AuthProvider>
                <AccountTenantScope>
                  <AuthUIProvider>
                      <PortalRouter router={router} />
                    <ToasterComponent />
                  </AuthUIProvider>
                </AccountTenantScope>
              </AuthProvider>
            </ToasterProvider>
          </QueryClientProvider>
        </ThemeModeProvider>
      </I18nProvider>
    </React.StrictMode>,
  );
}
