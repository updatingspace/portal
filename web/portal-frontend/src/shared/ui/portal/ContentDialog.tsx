import type { ReactNode } from 'react';
import { Button, Dialog, Icon } from '@gravity-ui/uikit';
import { Xmark } from '@gravity-ui/icons';
import { useUITranslation } from './PortalUI';
import './content-dialog.css';

/** A focused task, with a full-screen presentation on phones. */
export function ContentDialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const t = useUITranslation();
  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      hasCloseButton={false}
      aria-label={title}
      size="s"
      className="portal-content-dialog"
      modalClassName="portal-content-modal"
    >
      <header className="portal-content-dialog__header">
        <h2>{title}</h2>
        <Button
          size="xl"
          view="flat"
          disabled={busy}
          aria-label={t('Закрыть', 'Close')}
          onClick={onClose}
        >
          <Icon data={Xmark} size={20} />
        </Button>
      </header>
      <div className="portal-content-dialog__body">{children}</div>
    </Dialog>
  );
}
