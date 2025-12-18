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
  if (modal.display_once && shownModals[modal.id]) {
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
    if (currentModal.display_once) {
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
    if (currentModal?.button_url) {
      window.open(currentModal.button_url, '_blank', 'noopener,noreferrer');
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
        <div
          style={{ marginBottom: '24px', whiteSpace: 'pre-wrap' }}
          dangerouslySetInnerHTML={{ __html: currentModal.content }}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          {currentModal.button_url ? (
            <>
              <Button view="flat" size="l" onClick={handleClose}>
                Закрыть
              </Button>
              <Button view="action" size="l" onClick={handleButtonClick}>
                {currentModal.button_text}
              </Button>
            </>
          ) : (
            <Button view="action" size="l" onClick={handleClose}>
              {currentModal.button_text}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
