import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEsc) {
      onClose();
    }
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, [closeOnEsc, onClose]);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 0);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className={`modal modal-${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

interface ModalHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  onClose,
  className = '',
}) => (
  <div className={`modal-header ${className}`}>
    <h2 className="text-heading text-main">{children}</h2>
    {onClose && (
      <button
        onClick={onClose}
        className="btn btn-ghost btn-sm !p-1.5"
        aria-label="Đóng"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className = '' }) => (
  <div className={`modal-body ${className}`}>{children}</div>
);

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => (
  <div className={`modal-footer ${className}`}>{children}</div>
);

export const ConfirmModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'primary',
  loading = false,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} size="sm">
    <ModalHeader onClose={onClose}>{title}</ModalHeader>
    <ModalBody>
      <p className="text-body text-muted">{message}</p>
    </ModalBody>
    <ModalFooter>
      <button className="btn btn-secondary btn-md" onClick={onClose} disabled={loading}>
        {cancelText}
      </button>
      <button
        className={`btn btn-${variant} btn-md`}
        onClick={onConfirm}
        disabled={loading}
      >
        {loading && <span className="spinner spinner-sm" />}
        {confirmText}
      </button>
    </ModalFooter>
  </Modal>
);
