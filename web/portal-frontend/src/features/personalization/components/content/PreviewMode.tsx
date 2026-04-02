/**
 * Preview Mode toggle for admin panel
 * Allows admins to see modals as regular users would see them
 */
import { Button, Icon, Select, Switch, Text, Tooltip } from '@gravity-ui/uikit';
import { Eye, CircleXmark } from '@gravity-ui/icons';
import { useCallback, useMemo, useState } from 'react';
import type { HomePageModal } from '../../types';
import { ModalPreview } from './ModalPreview';
import './PreviewMode.css';

interface PreviewModeProps {
  modals: HomePageModal[];
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  users?: { id: string; name: string }[];
  selectedUserId?: string | null;
  onUserSelect?: (userId: string | null) => void;
}

export function PreviewModeToggle({
  modals,
  isEnabled,
  onToggle,
  users = [],
  selectedUserId,
  onUserSelect,
}: PreviewModeProps) {
  // Get active modals for preview (that would be shown to user)
  const activeModals = useMemo(() => {
    const now = new Date();
    return modals.filter(modal => {
      if (modal.deleted_at) return false;
      if (!modal.is_active) return false;
      
      const startDate = modal.start_date ? new Date(modal.start_date) : null;
      const endDate = modal.end_date ? new Date(modal.end_date) : null;
      
      if (startDate && now < startDate) return false;
      if (endDate && now > endDate) return false;
      
      return true;
    }).sort((a, b) => a.order - b.order);
  }, [modals]);

  return (
    <div className={`preview-toggle ${isEnabled ? 'preview-toggle--active' : ''}`}>
      <div className="preview-toggle__switch">
        <Icon data={Eye} size={16} />
        <Text variant="body-1">Preview Mode</Text>
        <Switch
          checked={isEnabled}
          onUpdate={onToggle}
          size="m"
        />
      </div>

      {isEnabled && (
        <div className="preview-toggle__controls">
          {users.length > 0 && onUserSelect && (
            <Tooltip content="See modals as this user would see them">
              <Select
                value={selectedUserId ? [selectedUserId] : []}
                options={[
                  { value: '', content: 'Default user' },
                  ...users.map(u => ({ value: u.id, content: u.name }))
                ]}
                onUpdate={([value]) => onUserSelect(value || null)}
                placeholder="Select user"
                width={150}
              />
            </Tooltip>
          )}
          <Text variant="caption-1" color="secondary">
            {activeModals.length} modal{activeModals.length !== 1 ? 's' : ''} active
          </Text>
        </div>
      )}
    </div>
  );
}

/**
 * Full preview overlay showing modals as user would see them
 */
interface PreviewOverlayProps {
  modals: HomePageModal[];
  onClose: () => void;
}

export function PreviewOverlay({
  modals,
  onClose,
}: PreviewOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Get active modals for preview
  const activeModals = useMemo(() => {
    const now = new Date();
    return modals.filter(modal => {
      if (modal.deleted_at) return false;
      if (!modal.is_active) return false;
      
      const startDate = modal.start_date ? new Date(modal.start_date) : null;
      const endDate = modal.end_date ? new Date(modal.end_date) : null;
      
      if (startDate && now < startDate) return false;
      if (endDate && now > endDate) return false;
      
      return true;
    }).sort((a, b) => a.order - b.order);
  }, [modals]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentIndex < activeModals.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, activeModals.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const currentModal = activeModals[currentIndex];

  if (activeModals.length === 0) {
    return (
      <div className="preview-overlay">
        <div className="preview-overlay__empty">
          <Icon data={CircleXmark} size={48} />
          <Text variant="header-1">No Active Modals</Text>
          <Text variant="body-1" color="secondary">
            There are no modals currently scheduled to show to users.
          </Text>
          <Button view="action" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-overlay__header" onClick={e => e.stopPropagation()}>
        <div className="preview-overlay__info">
          <Icon data={Eye} />
          <Text variant="body-1">
            Preview Mode — Viewing as user
          </Text>
        </div>
        <div className="preview-overlay__pagination">
          <Text variant="body-1" color="secondary">
            {currentIndex + 1} / {activeModals.length}
          </Text>
        </div>
        <Button view="flat" onClick={onClose}>
          <Icon data={CircleXmark} />
          Exit Preview
        </Button>
      </div>

      <div className="preview-overlay__content" onClick={e => e.stopPropagation()}>
        <ModalPreview
          title={currentModal.title}
          content={currentModal.content}
          contentHtml={currentModal.content_html}
          buttonText={currentModal.button_text || 'OK'}
          buttonUrl={currentModal.button_url}
          modalType={currentModal.modal_type}
          fullscreen
          onDismiss={goNext}
        />
      </div>

      {activeModals.length > 1 && (
        <div className="preview-overlay__nav" onClick={e => e.stopPropagation()}>
          <Button
            view="outlined"
            disabled={currentIndex === 0}
            onClick={goPrev}
          >
            Previous
          </Button>
          <Button
            view="outlined"
            disabled={currentIndex === activeModals.length - 1}
            onClick={goNext}
          >
            Next
          </Button>
        </div>
      )}

      {/* Modal order indicator */}
      <div className="preview-overlay__indicators" onClick={e => e.stopPropagation()}>
        {activeModals.map((_, index) => (
          <button
            key={index}
            className={`preview-overlay__indicator ${
              index === currentIndex ? 'preview-overlay__indicator--active' : ''
            }`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Go to modal ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
