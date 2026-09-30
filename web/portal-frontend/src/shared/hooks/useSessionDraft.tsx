import { useCallback, useEffect, useRef, useState } from 'react';
import { DraftNavigationGuard } from '../ui/portal/DraftNavigationGuard';

export function useSessionDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {const raw = sessionStorage.getItem(`portal-draft:${key}`); if (raw) {const parsed: unknown = JSON.parse(raw); if (typeof parsed === typeof initial && parsed !== null && (typeof initial !== 'object' || Object.entries(initial as Record<string, unknown>).every(([field, expected]) => typeof (parsed as Record<string, unknown>)[field] === typeof expected))) return parsed as T;}} catch { /* Drafts also work without browser storage. */ }
    return initial;
  });
  const [clean, setClean] = useState(() => JSON.stringify(initial));
  const allowed = useRef(false);
  const dirty = JSON.stringify(value) !== clean;
  const clear = useCallback((nextValue?: T) => {allowed.current = true; setClean(JSON.stringify(nextValue === undefined ? value : nextValue)); try {sessionStorage.removeItem(`portal-draft:${key}`);} catch { /* Optional storage. */ }}, [key, value]);
  useEffect(() => {
    if (!dirty) return;
    allowed.current = false;
    try {sessionStorage.setItem(`portal-draft:${key}`, JSON.stringify(value));} catch { /* Keep input in memory. */ }
  }, [key, value, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {if (!allowed.current) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return {value, setValue, clear, guard: <DraftNavigationGuard dirty={dirty} allowed={allowed} />};
}
