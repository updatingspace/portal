import React, { useCallback, useEffect, useState } from 'react';
import { Button, Modal } from '@gravity-ui/uikit';

import {
  fetchHomePageModals,
  trackModalAnalyticsEvent,
  type HomePageModal,
} from '../api/personalization';
import { getLocale } from '../shared/lib/locale';
import { notifyApiError } from '../utils/apiErrorHandling';

const STORAGE_KEY = 'aef-homepage-modals-shown';
const SESSION_KEY = 'updspace-personalization-session';

interface ShownModalsRecord {
  [modalId: number]: number;
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
    // Ignore storage errors.
  }
};

const getTrackingSessionId = (): string => {
  try {
    const fromStorage = sessionStorage.getItem(SESSION_KEY);
    if (fromStorage) {
      return fromStorage;
    }
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
    return sessionId;
  } catch {
    return `${Date.now()}-fallback`;
  }
};

const shouldShowModal = (modal: HomePageModal, shownModals: ShownModalsRecord): boolean => {
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
        const modalsToShow = allModals.filter((modal) => shouldShowModal(modal, shownModals));

        if (modalsToShow.length > 0) {
          setModals(modalsToShow);
          setIsOpen(true);
        }
      } catch (error) {
        notifyApiError(
          error,
          getLocale() === 'ru' ? 'Не удалось загрузить уведомления' : 'Failed to load notifications',
        );
      }
    };

    const timer = setTimeout(loadModals, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const modal = modals[currentModalIndex];
    if (!isOpen || !modal) {
      return;
    }
    void trackModalAnalyticsEvent({
      modalId: modal.id,
      eventType: 'view',
      sessionId: getTrackingSessionId(),
    });
  }, [isOpen, modals, currentModalIndex]);

  const currentModal = modals[currentModalIndex];
  const locale = getLocale();
  const translated = currentModal?.translations?.[locale];
  const title = translated?.title || currentModal?.title || '';
  const content = translated?.content || currentModal?.content || '';
  const buttonText = translated?.button_text || currentModal?.buttonText || 'OK';

  const handleClose = useCallback(() => {
    if (!currentModal) return;

    void trackModalAnalyticsEvent({
      modalId: currentModal.id,
      eventType: 'dismiss',
      sessionId: getTrackingSessionId(),
      metadata: { index: currentModalIndex, total: modals.length },
    });

    if (currentModal.displayOnce) {
      markModalAsShown(currentModal.id);
    }

    if (currentModalIndex < modals.length - 1) {
      setCurrentModalIndex(currentModalIndex + 1);
    } else {
      setIsOpen(false);
    }
  }, [currentModal, currentModalIndex, modals.length]);

  const handleButtonClick = useCallback(() => {
    if (!currentModal) {
      return;
    }
    void trackModalAnalyticsEvent({
      modalId: currentModal.id,
      eventType: 'click',
      sessionId: getTrackingSessionId(),
      metadata: { hasUrl: !!currentModal.buttonUrl },
    });
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
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>{title}</h2>
        <div style={{ marginBottom: '24px', whiteSpace: 'pre-wrap' }}>{content}</div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          {currentModal.buttonUrl ? (
            <>
              <Button view="flat" size="l" onClick={handleClose}>
                {locale === 'ru' ? 'Закрыть' : 'Close'}
              </Button>
              <Button view="action" size="l" onClick={handleButtonClick}>
                {buttonText}
              </Button>
            </>
          ) : (
            <Button view="action" size="l" onClick={handleClose}>
              {buttonText}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
