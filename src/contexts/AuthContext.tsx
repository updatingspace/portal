import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { isApiError } from '../api/client';
import type { AccountProfile } from '../services/api';
import { me as fetchProfile } from '../services/api';
import { notifyApiError } from '../utils/apiErrorHandling';
import { logger } from '../utils/logger';

export type UserInfo = {
  username: string;
  email: string | null;
  isSuperuser: boolean;
  isStaff: boolean;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
};

const mapProfileToUser = (profile: AccountProfile): UserInfo => ({
  username: profile.username,
  email: profile.email ?? null,
  isSuperuser: profile.is_superuser ?? false,
  isStaff: profile.is_staff ?? false,
  firstName: profile.first_name ?? null,
  lastName: profile.last_name ?? null,
  emailVerified: profile.email_verified ?? false,
});

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
    logger.info('Refreshing profile', {
      area: 'auth',
      event: 'refresh_profile',
    });

    try {
      const profile = await fetchProfile();
      const mapped = mapProfileToUser(profile);
      setUser(mapped);
      logger.info('Profile refreshed', {
        area: 'auth',
        event: 'refresh_profile',
        data: {
          username: mapped.username,
          emailVerified: mapped.emailVerified,
          isStaff: mapped.isStaff,
        },
      });
      return mapped;
    } catch (error) {
      if (isApiError(error)) {
        if (error.kind === 'unauthorized') {
          setUser(null);
          logger.warn('Profile refresh unauthorized, clearing session', {
            area: 'auth',
            event: 'refresh_profile',
            data: { reason: 'unauthorized' },
            error,
          });
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
