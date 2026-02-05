import React, { useCallback, useEffect, useState } from 'react';
import { Button, Modal } from '@gravity-ui/uikit';
import { fetchHomePageModals, type HomePageModal } from '../api/personalization';
import { notifyApiError } from '../utils/apiErrorHandling';

const STORAGE_KEY = 'aef-homepage-modals-shown';

interface ShownModalsRecord {
  [modalId: number]: number; // timestamp when shown
}

const getShownModals = (): ShownModalsRecord => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const markModalAsShown = (modalId: number): void => {
  try {
    const shown = getShownModals();
    shown[modalId] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shown));
  } catch {
    // Ignore storage errors
  }
};

const shouldShowModal = (modal: HomePageModal, shownModals: ShownModalsRecord): boolean => {
  // Check if modal should only be shown once and was already shown
  if (modal.displayOnce && shownModals[modal.id]) {
    return false;
  }

  return true;
};

export const HomePageModalDisplay: React.FC = () => {
  const [modals, setModals] = useState<HomePageModal[]>([]);
  const [currentModalIndex, setCurrentModalIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadModals = async () => {
      try {
        const allModals = await fetchHomePageModals();
        const shownModals = getShownModals();

        // Filter modals based on display_once and other criteria
        const modalsToShow = allModals.filter((modal) => shouldShowModal(modal, shownModals));

        if (modalsToShow.length > 0) {
          setModals(modalsToShow);
          setIsOpen(true);
        }
      } catch (error) {
        notifyApiError(error, 'Не удалось загрузить уведомления');
      }
    };

    // Load modals after a small delay to not interrupt page load
    const timer = setTimeout(loadModals, 1000);
    return () => clearTimeout(timer);
  }, []);

  const currentModal = modals[currentModalIndex];

  const handleClose = useCallback(() => {
    if (!currentModal) return;

    // Mark current modal as shown
    if (currentModal.displayOnce) {
      markModalAsShown(currentModal.id);
    }

    // Show next modal if available
    if (currentModalIndex < modals.length - 1) {
      setCurrentModalIndex(currentModalIndex + 1);
    } else {
      setIsOpen(false);
    }
  }, [currentModal, currentModalIndex, modals.length]);

  const handleButtonClick = useCallback(() => {
    if (currentModal?.buttonUrl) {
      window.open(currentModal.buttonUrl, '_blank', 'noopener,noreferrer');
    }
    handleClose();
  }, [currentModal, handleClose]);

  if (!isOpen || !currentModal) {
    return null;
  }

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <div className="homepage-modal-content" style={{ padding: '24px', minWidth: '400px', maxWidth: '600px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>{currentModal.title}</h2>
        <div style={{ marginBottom: '24px', whiteSpace: 'pre-wrap' }}>
          {currentModal.content}
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          {currentModal.buttonUrl ? (
            <>
              <Button view="flat" size="l" onClick={handleClose}>
                Закрыть
              </Button>
              <Button view="action" size="l" onClick={handleButtonClick}>
                {currentModal.buttonText}
              </Button>
            </>
          ) : (
            <Button view="action" size="l" onClick={handleClose}>
              {currentModal.buttonText}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
