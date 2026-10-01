/**
 * usePreferences - Hook for managing user preferences
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import {
  fetchPreferences,
  fetchDefaultPreferences,
} from '../api/personalizationApi';
import type {
  AppearanceSettings,
  LocalizationSettings,
  NotificationSettings,
  PreferencesUpdatePayload,
  PrivacySettings,
  UserPreferences,
} from '../types';

import {
  getPreferencePersistence,
  PREFERENCES_KEY,
} from './preferencePersistence';
const DEFAULTS_KEY = ['preferences', 'defaults'];
export const PERSONALIZATION_PREFERENCES_CACHE_KEY =
  'personalization-preferences-cache-v1';
export const PERSONALIZATION_PREFERENCES_UPDATED_EVENT =
  'updspace:preferences-updated';

export function readCachedPreferences(
  userId?: string,
  tenantId?: string,
): UserPreferences | undefined {
  if (typeof localStorage === 'undefined') {
    return undefined;
  }

  try {
    const raw = localStorage.getItem(PERSONALIZATION_PREFERENCES_CACHE_KEY);
    if (!raw) {
      return undefined;
    }
    const cached = JSON.parse(raw) as UserPreferences;
    if (
      (userId && cached.user_id !== userId) ||
      (tenantId && cached.tenant_id !== tenantId)
    )
      return undefined;
    return cached;
  } catch {
    return undefined;
  }
}

export interface UsePreferencesOptions {
  enabled?: boolean;
  userId?: string;
  tenantId?: string;
}

export interface UsePreferencesReturn {
  // Data
  preferences: UserPreferences | undefined;
  defaults: UserPreferences['appearance'] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  reload: () => Promise<unknown>;

  // Mutations
  savePreferences: (payload: PreferencesUpdatePayload) => Promise<void>;
  updateAppearance: (appearance: Partial<AppearanceSettings>) => Promise<void>;
  updateLocalization: (
    localization: Partial<LocalizationSettings>,
  ) => Promise<void>;
  updateNotifications: (
    notifications: Partial<NotificationSettings>,
  ) => Promise<void>;
  updatePrivacy: (privacy: Partial<PrivacySettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;

  // State
  saveError: Error | null;
  retrySave: () => Promise<void>;
  isSaving: boolean;
  isResetting: boolean;
}

export function usePreferences(
  options: UsePreferencesOptions = {},
): UsePreferencesReturn {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const persistence = getPreferencePersistence(queryClient);
  const saveState = useSyncExternalStore(
    persistence.subscribe,
    persistence.getSnapshot,
  );

  // Fetch current preferences
  const {
    data: preferences,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: async () => persistence.overlay(await fetchPreferences()),
    enabled,
    initialData: () => readCachedPreferences(options.userId, options.tenantId),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  const cachePreferences = useCallback((data: UserPreferences) => {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(
        PERSONALIZATION_PREFERENCES_CACHE_KEY,
        JSON.stringify(data),
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<UserPreferences>(
            PERSONALIZATION_PREFERENCES_UPDATED_EVENT,
            {
              detail: data,
            },
          ),
        );
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  // Fetch defaults (for reset functionality)
  const { data: defaultsData } = useQuery({
    queryKey: DEFAULTS_KEY,
    queryFn: fetchDefaultPreferences,
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  useEffect(() => {
    if (preferences) {
      cachePreferences(preferences);
    }
  }, [preferences, cachePreferences]);

  const savePreferences = persistence.save;
  const updateAppearance = useCallback(
    (appearance: Partial<AppearanceSettings>) =>
      savePreferences({ appearance }),
    [savePreferences],
  );
  const updateLocalization = useCallback(
    (localization: Partial<LocalizationSettings>) =>
      savePreferences({ localization }),
    [savePreferences],
  );
  const updateNotifications = useCallback(
    (notifications: Partial<NotificationSettings>) =>
      savePreferences({ notifications }),
    [savePreferences],
  );
  const updatePrivacy = useCallback(
    (privacy: Partial<PrivacySettings>) => savePreferences({ privacy }),
    [savePreferences],
  );
  const resetToDefaults = persistence.reset;

  return useMemo(
    () => ({
      preferences,
      defaults: defaultsData?.appearance,
      isLoading,
      isError,
      error: error as Error | null,
      reload: refetch,
      savePreferences,
      updateAppearance,
      updateLocalization,
      updateNotifications,
      updatePrivacy,
      resetToDefaults,
      isSaving: saveState.isSaving,
      saveError: saveState.error,
      retrySave: persistence.retry,
      isResetting: saveState.isResetting,
    }),
    [
      preferences,
      defaultsData,
      isLoading,
      isError,
      error,
      refetch,
      savePreferences,
      updateAppearance,
      updateLocalization,
      updateNotifications,
      updatePrivacy,
      resetToDefaults,
      saveState,
      persistence,
    ],
  );
}
