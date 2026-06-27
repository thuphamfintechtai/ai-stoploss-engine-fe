import React from 'react';
import { createPortal } from 'react-dom';

// ─── Toast Notification System ─────────────────────────────────────────────
export interface ToastItem { id: string; title: string; message: string; severity: string; }

export const ToastContainer = ({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) => {
  const colors: Record<string, string> = {
    SUCCESS: 'border-green-500/40 bg-green-500/10 text-green-300',
    WARNING: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
    DANGER:  'border-red-500/40 bg-red-500/10 text-red-300',
    INFO:    'border-blue-500/40 bg-blue-500/10 text-blue-300',
  };
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[999] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex gap-2.5 p-3 rounded-lg border text-[13px] shadow-lg animate-fade-in ${colors[t.severity] ?? colors.INFO}`}
          style={{ background: 'var(--color-panel)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-snug text-text-main">{t.title}</p>
            <p className="text-[12px] text-text-muted mt-0.5 leading-snug">{t.message}</p>
          </div>
          <button onClick={() => onDismiss(t.id)} className="shrink-0 mt-0.5 opacity-50 hover:opacity-100 text-text-muted">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
};
