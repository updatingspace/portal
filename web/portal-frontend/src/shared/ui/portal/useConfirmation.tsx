import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog, useUITranslation } from './PortalUI';
export function useConfirmation() {
  const [description, setDescription] = useState<string | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const t = useUITranslation();
  const finish = useCallback((value: boolean) => {resolveRef.current?.(value); resolveRef.current = null; setDescription(null);}, []);
  useEffect(() => () => {resolveRef.current?.(false);}, []);
  const confirm = useCallback((message: string) => new Promise<boolean>((resolve) => {
    resolveRef.current?.(false); resolveRef.current = resolve; setDescription(message);
  }), []);
  return {confirm, confirmationDialog: <ConfirmDialog open={description !== null} title={t('Подтвердите действие', 'Confirm action')} description={description ?? ''} confirmLabel={t('Подтвердить', 'Confirm')} onConfirm={() => finish(true)} onClose={() => finish(false)} />};
}
