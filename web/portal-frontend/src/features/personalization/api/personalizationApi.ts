/**
 * API client for user preferences
 */
import { request, requestResult } from '../../../api/client';
import type {
  DefaultPreferences,
  PreferencesUpdatePayload,
  UserPreferences,
} from '../types';

const PREFERENCES_BASE = '/personalization/preferences';

/**
 * Fetch current user preferences
 * Creates default preferences if they don't exist
 */
export async function fetchPreferences(): Promise<UserPreferences> {
  return request<UserPreferences>(PREFERENCES_BASE);
}

/**
 * Update user preferences (partial update supported)
 */
export async function updatePreferences(
  payload: PreferencesUpdatePayload
): Promise<UserPreferences> {
  return request<UserPreferences>(PREFERENCES_BASE, {
    method: 'PUT',
    body: payload,
  });
}

/**
 * Get default preferences structure
 */
export async function fetchDefaultPreferences(): Promise<DefaultPreferences> {
  return request<DefaultPreferences>(`${PREFERENCES_BASE}/defaults`);
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(): Promise<UserPreferences> {
  return request<UserPreferences>(`${PREFERENCES_BASE}/reset`, {
    method: 'POST',
  });
}

/**
 * Update appearance settings only
 */
export async function updateAppearance(
  appearance: PreferencesUpdatePayload['appearance']
): Promise<UserPreferences> {
  return updatePreferences({ appearance });
}

/**
 * Update localization settings only
 */
export async function updateLocalization(
  localization: PreferencesUpdatePayload['localization']
): Promise<UserPreferences> {
  return updatePreferences({ localization });
}

/**
 * Update notification settings only
 */
export async function updateNotifications(
  notifications: PreferencesUpdatePayload['notifications']
): Promise<UserPreferences> {
  return updatePreferences({ notifications });
}

/**
 * Update privacy settings only
 */
export async function updatePrivacy(
  privacy: PreferencesUpdatePayload['privacy']
): Promise<UserPreferences> {
  return updatePreferences({ privacy });
}

/**
 * Try to fetch preferences without throwing on 401/403
 * Useful for initial app load
 */
export async function tryFetchPreferences(): Promise<UserPreferences | null> {
  const result = await requestResult<UserPreferences>(PREFERENCES_BASE);
  if (result.ok) {
    return result.data;
  }
  return null;
}
