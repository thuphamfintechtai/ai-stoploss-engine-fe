import React, { useState, useRef, useEffect } from 'react';
import { useActivePortfolio } from '../../contexts/ActivePortfolioContext';
import {
  getPresetLabel,
  PortfolioType,
} from '../../utils/portfolioPresets';
import { CreatePortfolioModal } from './CreatePortfolioModal';
import { PresetIcon } from './PresetIcon';

interface Props {
  /** Khi true → render compact mode (icon only) cho sidebar collapsed. */
  compact?: boolean;
}

/**
 * PortfolioSwitcher (Phase 8 — MP-04).
 *
 * Dropdown ở Sidebar top — list user's portfolios với badge type + "+ Tạo mới" button.
 * Click portfolio → setActivePortfolioId (context persist localStorage).
 * Compact mode (sidebar collapsed) → chỉ icon, click mở dropdown full.
 */
export const PortfolioSwitcher: React.FC<Props> = ({ compact = false }) => {
  const {
    portfolios,
    activePortfolioId,
    activePortfolio,
    setActivePortfolioId,
    isLoading,
  } = useActivePortfolio();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (isLoading) {
    return (
      <div
        className={`${compact ? 'px-1.5 py-2' : 'px-2 py-2'} text-[11px] text-text-muted`}
      >
        {compact ? '…' : 'Đang tải...'}
      </div>
    );
  }

  // Empty state — no portfolios yet (user mới hoặc đã xoá hết)
  if (portfolios.length === 0) {
    return (
      <div className={compact ? 'px-1.5 py-2' : 'px-2 py-2'}>
        <button
          type="button"
          className={`w-full ${compact ? 'p-2 justify-center' : 'px-3 py-2'} flex items-center gap-2 rounded-md text-[12px] transition-colors text-accent hover:bg-accent/10`}
          style={{ border: '1px dashed var(--color-border-standard)' }}
          onClick={() => setCreateOpen(true)}
          title="Tạo danh mục đầu tiên"
        >
          <span className="text-[14px] leading-none">+</span>
          {!compact && <span className="truncate">Tạo danh mục</span>}
        </button>
        {createOpen && <CreatePortfolioModal onClose={() => setCreateOpen(false)} />}
      </div>
    );
  }

  const activeType = activePortfolio?.portfolio_type as PortfolioType | undefined;
  const activeLabel = activePortfolio?.name ?? 'Chọn danh mục';
  const activeTypeLabel = activePortfolio
    ? getPresetLabel(activePortfolio.portfolio_type)
    : '';

  return (
    <div ref={ref} className={`relative ${compact ? 'px-1.5 py-2' : 'px-2 py-2'}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center ${compact ? 'p-2 justify-center' : 'px-2.5 py-2 gap-2 justify-between'} rounded-md transition-colors hover:bg-white/5`}
        style={{
          background: 'var(--color-panel-secondary)',
          border: '1px solid var(--color-border-subtle)',
        }}
        title={`${activeLabel} — ${activeTypeLabel}`}
      >
        {compact ? (
          <PresetIcon type={activeType} size={18} className="text-text-main" />
        ) : (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <PresetIcon type={activeType} size={16} className="text-text-main shrink-0" />
              <div className="text-left min-w-0">
                <div className="text-[12px] font-semibold text-text-main truncate leading-tight">
                  {activeLabel}
                </div>
                <div className="text-[9px] text-text-muted truncate leading-tight">
                  {activeTypeLabel}
                </div>
              </div>
            </div>
            <svg
              className={`w-3 h-3 text-text-dim shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div
          className={`absolute ${compact ? 'left-full ml-1 top-1 w-[220px]' : 'left-2 right-2 mt-1'} z-[60] rounded-md shadow-xl max-h-[320px] overflow-y-auto`}
          style={{
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border-standard)',
          }}
        >
          {portfolios.map((p) => {
            const isActive = p.id === activePortfolioId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActivePortfolioId(p.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors hover:bg-white/5 ${isActive ? 'bg-accent/10' : ''}`}
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
              >
                <PresetIcon
                  type={p.portfolio_type as PortfolioType}
                  size={16}
                  className="text-text-main shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-text-main truncate leading-tight">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-text-muted leading-tight">
                    {getPresetLabel(p.portfolio_type)}
                  </div>
                </div>
                {isActive && (
                  <svg
                    className="w-3.5 h-3.5 text-accent shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-[12px] font-medium text-accent hover:bg-accent/10 transition-colors flex items-center gap-2"
          >
            <span className="text-[14px] leading-none">+</span>
            <span>Tạo danh mục mới</span>
          </button>
        </div>
      )}

      {createOpen && <CreatePortfolioModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
};
