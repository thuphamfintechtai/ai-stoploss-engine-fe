import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from './primitives';

/**
 * Phase 10 C-02 — Typed wrapper trên `<Modal>` primitive cho destructive flows.
 *
 * Replaces native `window.confirm` (no styling, blocks render thread, ignores
 * theme tokens). Future destructive actions MUST use this primitive.
 *
 * Variants:
 * - `danger`  — irreversible destructive (delete portfolio, clear data)
 * - `warning` — reversible-but-impactful (close position, cancel order)
 * - `info`    — neutral confirmation (toggle setting, mark read)
 */
export type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  variant = 'info',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  // Map variant → Button variant (Button primitive supports primary/secondary/ghost/danger/success)
  const confirmButtonVariant: 'danger' | 'primary' =
    variant === 'danger' ? 'danger' : 'primary';

  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm" closeOnOverlayClick={!loading} closeOnEsc={!loading}>
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>
        {typeof message === 'string' ? (
          <p className="text-body text-text-main">{message}</p>
        ) : (
          message
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={confirmButtonVariant} onClick={onConfirm} loading={loading} autoFocus>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
