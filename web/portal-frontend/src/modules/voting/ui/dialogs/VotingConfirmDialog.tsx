import React from 'react';
import { Dialog, Text } from '@gravity-ui/uikit';

export interface VotingConfirmAction {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  mode?: 'normal' | 'danger';
  onConfirm: () => void;
}

interface VotingConfirmDialogProps {
  open: boolean;
  action: VotingConfirmAction | null;
  onClose: () => void;
  loading?: boolean;
}

export const VotingConfirmDialog: React.FC<VotingConfirmDialogProps> = ({
  open,
  action,
  onClose,
  loading = false,
}) => {
  if (!action) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="m"
      hasCloseButton
    >
      <Dialog.Header caption={action.title} />
      <Dialog.Body>
        {action.description ? (
          <Text variant="body-2" color="secondary">
            {action.description}
          </Text>
        ) : null}
      </Dialog.Body>
      <Dialog.Footer
        textButtonCancel={action.cancelLabel ?? 'Отмена'}
        textButtonApply={action.confirmLabel}
        onClickButtonCancel={onClose}
        onClickButtonApply={action.onConfirm}
        loading={loading}
        propsButtonApply={{
          view: action.mode === 'danger' ? 'outlined-danger' : 'action',
        }}
      />
    </Dialog>
  );
};
