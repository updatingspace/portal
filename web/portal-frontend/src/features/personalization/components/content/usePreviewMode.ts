import { useCallback, useState } from 'react';

export function usePreviewMode() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const togglePreviewMode = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    if (enabled) {
      setShowOverlay(true);
    }
  }, []);

  const closeOverlay = useCallback(() => {
    setShowOverlay(false);
    setIsEnabled(false);
  }, []);

  const selectUser = useCallback((userId: string | null) => {
    setSelectedUserId(userId);
  }, []);

  return {
    isEnabled,
    selectedUserId,
    showOverlay,
    togglePreviewMode,
    closeOverlay,
    selectUser,
  };
}
