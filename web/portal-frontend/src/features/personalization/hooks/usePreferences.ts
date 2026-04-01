/**
 * usePreferences - Hook for managing user preferences
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  fetchPreferences,
  updatePreferences,
  resetPreferences,
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

const PREFERENCES_KEY = ['preferences'];
const DEFAULTS_KEY = ['preferences', 'defaults'];

export interface UsePreferencesOptions {
  enabled?: boolean;
}

export interface UsePreferencesReturn {
  // Data
  preferences: UserPreferences | undefined;
  defaults: UserPreferences['appearance'] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  
  // Mutations
  updateAppearance: (appearance: Partial<AppearanceSettings>) => Promise<void>;
  updateLocalization: (localization: Partial<LocalizationSettings>) => Promise<void>;
  updateNotifications: (notifications: Partial<NotificationSettings>) => Promise<void>;
  updatePrivacy: (privacy: Partial<PrivacySettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  
  // State
  isSaving: boolean;
  isResetting: boolean;
}

export function usePreferences(options: UsePreferencesOptions = {}): UsePreferencesReturn {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch current preferences
  const {
    data: preferences,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: fetchPreferences,
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  // Fetch defaults (for reset functionality)
  const { data: defaultsData } = useQuery({
    queryKey: DEFAULTS_KEY,
    queryFn: fetchDefaultPreferences,
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Update mutation with optimistic updates
  const updateMutation = useMutation({
    mutationFn: updatePreferences,
    onMutate: async (payload: PreferencesUpdatePayload) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: PREFERENCES_KEY });

      // Snapshot previous value
      const previousPreferences = queryClient.getQueryData<UserPreferences>(PREFERENCES_KEY);

      // Optimistically update
      if (previousPreferences) {
        queryClient.setQueryData<UserPreferences>(PREFERENCES_KEY, {
          ...previousPreferences,
          appearance: payload.appearance
            ? { ...previousPreferences.appearance, ...payload.appearance }
            : previousPreferences.appearance,
          localization: payload.localization
            ? { ...previousPreferences.localization, ...payload.localization }
            : previousPreferences.localization,
          notifications: payload.notifications
            ? { ...previousPreferences.notifications, ...payload.notifications }
            : previousPreferences.notifications,
          privacy: payload.privacy
            ? { ...previousPreferences.privacy, ...payload.privacy }
            : previousPreferences.privacy,
        });
      }

      return { previousPreferences };
    },
    onError: (_error, _payload, context) => {
      // Rollback on error
      if (context?.previousPreferences) {
        queryClient.setQueryData(PREFERENCES_KEY, context.previousPreferences);
      }
    },
    onSettled: () => {
      // Refetch to ensure we have the latest
      queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: resetPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(PREFERENCES_KEY, data);
    },
  });

  // Convenience methods
  const updateAppearance = useCallback(
    async (appearance: Partial<AppearanceSettings>) => {
      await updateMutation.mutateAsync({ appearance });
    },
    [updateMutation]
  );

  const updateLocalization = useCallback(
    async (localization: Partial<LocalizationSettings>) => {
      await updateMutation.mutateAsync({ localization });
    },
    [updateMutation]
  );

  const updateNotifications = useCallback(
    async (notifications: Partial<NotificationSettings>) => {
      await updateMutation.mutateAsync({ notifications });
    },
    [updateMutation]
  );

  const updatePrivacy = useCallback(
    async (privacy: Partial<PrivacySettings>) => {
      await updateMutation.mutateAsync({ privacy });
    },
    [updateMutation]
  );

  const resetToDefaults = useCallback(async () => {
    await resetMutation.mutateAsync();
  }, [resetMutation]);

  return useMemo(
    () => ({
      preferences,
      defaults: defaultsData?.appearance,
      isLoading,
      isError,
      error: error as Error | null,
      updateAppearance,
      updateLocalization,
      updateNotifications,
      updatePrivacy,
      resetToDefaults,
      isSaving: updateMutation.isPending,
      isResetting: resetMutation.isPending,
    }),
    [
      preferences,
      defaultsData,
      isLoading,
      isError,
      error,
      updateAppearance,
      updateLocalization,
      updateNotifications,
      updatePrivacy,
      resetToDefaults,
      updateMutation.isPending,
      resetMutation.isPending,
    ]
  );
}
