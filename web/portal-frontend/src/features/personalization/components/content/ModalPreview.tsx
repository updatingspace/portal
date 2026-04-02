/**
 * Modal preview component - shows how modal will look to users
 */
import { Button, Card, Icon, Text } from '@gravity-ui/uikit';
import {
  CircleInfo,
  TriangleExclamation,
  CircleCheck,
  Megaphone,
  Xmark,
} from '@gravity-ui/icons';
import type { ModalType } from '../../types';
import './ModalPreview.css';

interface ModalPreviewProps {
  title: string;
  content: string;
  contentHtml?: string;
  buttonText: string;
  buttonUrl?: string;
  modalType: ModalType;
  fullscreen?: boolean;
  onClose?: () => void;
  onDismiss?: () => void;
  onButtonClick?: () => void;
}

const MODAL_TYPE_ICONS = {
  info: CircleInfo,
  warning: TriangleExclamation,
  success: CircleCheck,
  promo: Megaphone,
};

const MODAL_TYPE_COLORS = {
  info: 'var(--g-color-base-info-light)',
  warning: 'var(--g-color-base-warning-light)',
  success: 'var(--g-color-base-positive-light)',
  promo: 'var(--g-color-base-utility-light)',
};

const MODAL_TYPE_ICON_COLORS = {
  info: 'var(--g-color-text-info)',
  warning: 'var(--g-color-text-warning)',
  success: 'var(--g-color-text-positive)',
  promo: 'var(--g-color-text-utility)',
};

export function ModalPreview({
  title,
  content,
  contentHtml,
  buttonText,
  buttonUrl,
  modalType,
  fullscreen,
  onClose,
  onDismiss,
  onButtonClick,
}: ModalPreviewProps) {
  const IconComponent = MODAL_TYPE_ICONS[modalType] || CircleInfo;
  const backgroundColor = MODAL_TYPE_COLORS[modalType] || MODAL_TYPE_COLORS.info;
  const iconColor = MODAL_TYPE_ICON_COLORS[modalType] || MODAL_TYPE_ICON_COLORS.info;

  const handleButtonClick = () => {
    if (onButtonClick) {
      onButtonClick();
    }
    if (buttonUrl) {
      window.open(buttonUrl, '_blank', 'noopener,noreferrer');
    }
    // Dismiss after button click
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    // Also call dismiss on close
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Card
      className={`modal-preview ${fullscreen ? 'modal-preview--fullscreen' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with icon and close button */}
      <div
        className="modal-preview__header"
        style={{ backgroundColor }}
      >
        <div className="modal-preview__icon" style={{ color: iconColor }}>
          <Icon data={IconComponent} size={24} />
        </div>
        <button
          className="modal-preview__close"
          onClick={handleClose}
          aria-label="Close modal"
        >
          <Icon data={Xmark} size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="modal-preview__body">
        <Text variant="header-1" className="modal-preview__title">
          {title || 'Untitled Modal'}
        </Text>

        {contentHtml ? (
          <div
            className="modal-preview__content modal-preview__content--html"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        ) : (
          <Text
            variant="body-1"
            className="modal-preview__content"
            color="secondary"
          >
            {content || 'No content provided'}
          </Text>
        )}
      </div>

      {/* Footer with button */}
      <div className="modal-preview__footer">
        <Button
          view="action"
          size="l"
          width="max"
          onClick={handleButtonClick}
        >
          {buttonText || 'OK'}
        </Button>
      </div>
    </Card>
  );
}
