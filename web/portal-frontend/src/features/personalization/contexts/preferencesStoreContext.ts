import { createContext } from 'react';

import type { PreferencesContextValue } from './PreferencesContext.tsx';

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);
