import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { fetchProfile } from '../api/auth';
import type { UserInfo } from '../api/auth';
import { isApiError } from '../api/client';
import { notifyApiError } from '../utils/apiErrorHandling';

type AuthContextValue = {
  user: UserInfo | null;
  isLoading: boolean;
  isInitialized: boolean;
  refreshProfile: () => Promise<UserInfo | null>;
  setUser: (nextUser: UserInfo | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const setUser = useCallback((nextUser: UserInfo | null) => {
    setUserState(nextUser);
    setIsInitialized(true);
  }, []);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);

    try {
      const profile = await fetchProfile();
      setUser(profile.user);
      return profile.user;
    } catch (error) {
      if (isApiError(error)) {
        if (error.kind === 'unauthorized') {
          setUser(null);
        } else {
          notifyApiError(error, 'Не получилось обновить профиль');
        }
      } else {
        notifyApiError(error, 'Не получилось обновить профиль');
      }
      return null;
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [setUser]);

  useEffect(() => {
    if (!isInitialized) {
      refreshProfile();
    }
  }, [isInitialized, refreshProfile]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isInitialized,
      refreshProfile,
      setUser,
    }),
    [isInitialized, isLoading, refreshProfile, setUser, user],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
