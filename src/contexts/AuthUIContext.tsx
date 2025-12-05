import React, { createContext, useContext, useMemo, useState } from 'react';

type AuthUIMode = 'login' | 'signup';

type AuthUIValue = {
  openAuthModal: (mode?: AuthUIMode) => void;
  closeAuthModal: () => void;
  isAuthModalOpen: boolean;
  authMode: AuthUIMode;
  setAuthMode: (mode: AuthUIMode) => void;
};

const AuthUIContext = createContext<AuthUIValue | undefined>(undefined);

export const AuthUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthUIMode>('login');

  const value = useMemo<AuthUIValue>(
    () => ({
      isAuthModalOpen: isOpen,
      authMode: mode,
      openAuthModal: (nextMode = 'login') => {
        setMode(nextMode);
        setOpen(true);
      },
      closeAuthModal: () => setOpen(false),
      setAuthMode: (nextMode) => setMode(nextMode),
    }),
    [isOpen, mode],
  );

  return <AuthUIContext.Provider value={value}>{children}</AuthUIContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthUI = (): AuthUIValue => {
  const ctx = useContext(AuthUIContext);
  if (!ctx) {
    throw new Error('useAuthUI must be used within AuthUIProvider');
  }
  return ctx;
};
