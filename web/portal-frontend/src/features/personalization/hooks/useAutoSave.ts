/**
 * useAutoSave - Hook for debounced auto-save functionality
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAutoSaveOptions<T> {
  /** Data to watch for changes */
  data: T;
  /** Save function */
  onSave: (data: T) => Promise<void>;
  /** Debounce delay in ms (default: 1000) */
  delay?: number;
  /** Enable auto-save (default: true) */
  enabled?: boolean;
}

export interface UseAutoSaveReturn {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Last save timestamp */
  lastSaved: Date | null;
  /** Save error if any */
  error: Error | null;
  /** Manually trigger save */
  save: () => Promise<void>;
  /** Mark as clean (no pending changes) */
  markClean: () => void;
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 1000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousDataRef = useRef<T>(data);
  const dataRef = useRef<T>(data);

  // Update data ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Detect changes
  useEffect(() => {
    const hasChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current);
    if (hasChanged) {
      setIsDirty(true);
      setError(null);
    }
  }, [data]);

  // Perform save
  const performSave = useCallback(async () => {
    if (!isDirty || isSaving) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      await onSave(dataRef.current);
      previousDataRef.current = dataRef.current;
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Save failed'));
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, isSaving, onSave]);

  // Debounced auto-save
  useEffect(() => {
    if (!enabled || !isDirty) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, isDirty, delay, performSave]);

  // Manual save
  const save = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    await performSave();
  }, [performSave]);

  // Mark as clean
  const markClean = useCallback(() => {
    previousDataRef.current = dataRef.current;
    setIsDirty(false);
  }, []);

  return {
    isDirty,
    isSaving,
    lastSaved,
    error,
    save,
    markClean,
  };
}
