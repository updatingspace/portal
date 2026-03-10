/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, type ReactElement } from 'react';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToasterComponent, ToasterProvider } from '@gravity-ui/uikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { toaster } from '../toaster';
import { AuthProvider, useAuth, type UserInfo } from '../contexts/AuthContext';
import { AuthUIProvider } from '../contexts/AuthUIContext';
import { TenantProvider } from '../contexts/TenantContext';
import { I18nProvider } from '../app/providers/I18nProvider';
import { ThemeModeProvider } from '../app/providers/ThemeModeProvider';

type RenderOptions = {
  route?: string;
  authUser?: UserInfo | null;
  initialEntries?: string[];
  wrapRouter?: boolean;
};

const AuthInitializer: React.FC<{ user?: UserInfo | null }> = ({ user }) => {
  const { setUser } = useAuth();

  useEffect(() => {
    if (user !== undefined) {
      setUser(user);
    }
  }, [setUser, user]);

  return null;
};

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    authUser = null,
    initialEntries,
    wrapRouter = true,
  }: RenderOptions = {},
) {
  const entries = initialEntries ?? [route];
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  if (!wrapRouter && typeof window !== 'undefined' && entries.length) {
    window.history.replaceState({}, '', entries[0]);
  }

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ThemeModeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <ToasterProvider toaster={toaster}>
            {wrapRouter ? (
              <MemoryRouter initialEntries={entries}>
                <AuthProvider bootstrap={false}>
                  <TenantProvider>
                    <AuthUIProvider>
                      <AuthInitializer user={authUser} />
                      {children}
                      <ToasterComponent />
                    </AuthUIProvider>
                  </TenantProvider>
                </AuthProvider>
              </MemoryRouter>
            ) : (
              <AuthProvider bootstrap={false}>
                <TenantProvider>
                  <AuthUIProvider>
                    <AuthInitializer user={authUser} />
                    {children}
                    <ToasterComponent />
                  </AuthUIProvider>
                </TenantProvider>
              </AuthProvider>
            )}
          </ToasterProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeModeProvider>
  );

  return render(ui, { wrapper: Wrapper });
}

export { render, screen, within, waitFor, act, userEvent };
