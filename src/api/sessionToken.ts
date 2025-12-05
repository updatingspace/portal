const STORAGE_KEY = 'aef_session_token';

export const getSessionToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
};

export const setSessionToken = (token: string | null | undefined): void => {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};

export const clearSessionToken = (): void => setSessionToken(null);
export const SESSION_TOKEN_STORAGE_KEY = STORAGE_KEY;
