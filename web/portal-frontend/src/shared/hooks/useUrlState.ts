import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
export function useUrlState<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, Dispatch<SetStateAction<T>>] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key) as T | null;
  const value = raw !== null && (!allowed || allowed.includes(raw)) ? raw : fallback;
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((next) => setParams((previous) => {
    const copy = new URLSearchParams(previous);
    const resolved = typeof next === 'function' ? next(value) : next;
    if (resolved === fallback) copy.delete(key); else copy.set(key, resolved);
    return copy;
  }, {replace: true}), [fallback, key, setParams, value]);
  return [value, setValue];
}
