import { useContext } from 'react';

import { PreferencesContext } from './preferencesStoreContext';
import type { PreferencesContextValue } from './PreferencesContext.tsx';

export function usePreferencesContext(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferencesContext must be used within a PreferencesProvider');
  }
  return context;
}

export function usePreferencesContextSafe(): PreferencesContextValue | null {
  return useContext(PreferencesContext);
}
