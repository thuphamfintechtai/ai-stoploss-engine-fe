import React, { useState, useEffect } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { formatNumberVI } from '../../constants';

export interface PortfolioSetupModalStandaloneProps {
  isOpen: boolean;
  onClose: () => void;
  initialBalance: number;
  initialRisk: number;
  initialExpectedReturn?: number;
  onSave: (balance: number, riskPercent: number, expectedReturnPercent: number) => void | Promise<void>;
  portfolioId?: string | null;
  onDelete?: () => void | Promise<void>;
}

// Modal cấu hình danh mục — khai báo ngoài MainApp để tránh re-mount mỗi khi parent re-render (gây giựt sau F5).
export function PortfolioSetupModalStandalone({
  isOpen,
  onClose,
  initialBalance,
  initialRisk,
  initialExpectedReturn,
  onSave,
  portfolioId,
  onDelete,
}: PortfolioSetupModalStandaloneProps) {
  const [localBalance, setLocalBalance] = useState(initialBalance.toString());
  const [localRisk, setLocalRisk] = useState(initialRisk);
  const [localExpectedReturn, setLocalExpectedReturn] = useState(initialExpectedReturn ?? 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Phase 10 C-02 — replace native window.confirm with ConfirmDialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Cập nhật state local khi props đổi (vd. mở lại modal với giá trị mới)
  useEffect(() => {
    if (isOpen) {
      setLocalBalance(initialBalance.toString());
      setLocalRisk(initialRisk);
      setLocalExpectedReturn(initialExpectedReturn ?? 0);
    }
  }, [isOpen, initialBalance, initialRisk, initialExpectedReturn]);

  const calcMaxLoss = () => {
    const bal = parseFloat(localBalance) || 0;
    return (bal * localRisk) / 100;
  };

  const handleSave = async () => {
    const bal = parseFloat(localBalance);
    if (isNaN(bal) || bal < 0) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(bal, localRisk, localExpectedReturn));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete || !portfolioId) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await Promise.resolve(onDelete());
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const riskLevel = localRisk <= 2 ? 'Bảo toàn (Safe)' : localRisk <= 5 ? 'Tiêu chuẩn (Standard)' : 'Mạo hiểm (High Risk)';
  const riskColor = localRisk <= 2 ? 'text-positive' : localRisk <= 5 ? 'text-accent' : 'text-negative';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md flex flex-col" style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border-standard)', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-standard shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-text-main">Cấu Hình Danh Mục</h2>
            <p className="text-[11px] text-text-dim mt-0.5">Thiết lập vốn và giới hạn rủi ro</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded text-text-dim hover:text-text-main hover:bg-white/5 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">

          {/* Vốn ban đầu */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-text-dim block mb-1.5">Vốn Ban Đầu (VND)</label>
            <input
              type="number"
              value={localBalance}
              onChange={(e) => setLocalBalance(e.target.value)}
              placeholder="Ví dụ: 100000000"
              className="w-full px-3 py-2.5 rounded font-mono text-[14px] font-semibold text-text-main outline-none focus:border-accent transition-colors"
              style={{ background: 'var(--color-background)', border: '1px solid var(--color-border-standard)' }}
            />
            {parseFloat(localBalance) > 0 && (
              <p className="text-[10px] text-text-dim mt-1 font-mono">{formatNumberVI(parseFloat(localBalance))} VND</p>
            )}
          </div>

          {/* Giới hạn rủi ro */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-text-dim">Giới Hạn Rủi Ro</label>
              <span className={`text-[11px] font-bold ${riskColor}`}>{riskLevel}</span>
            </div>
            <div className="rounded p-3 space-y-3" style={{ background: 'var(--color-background)', border: '1px solid var(--color-border-subtle)' }}>
              <input
                type="range"
                min="1"
                max="30"
                step="0.5"
                value={Math.min(30, Math.max(1, localRisk))}
                onChange={(e) => setLocalRisk(parseFloat(e.target.value))}
                className="w-full cursor-pointer accent-blue-500"
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <div className="flex justify-between items-center">
                <div>
                  <span className={`text-[22px] font-bold font-mono ${riskColor}`}>{localRisk}%</span>
                  <span className="text-[10px] text-text-dim ml-1">/ lệnh</span>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-text-dim">Mất Tối Đa</p>
                  <p className="text-[13px] font-mono font-semibold text-negative mt-0.5">{formatNumberVI(calcMaxLoss())}</p>
                </div>
              </div>
              <div className="flex justify-between text-[9px] text-text-dim">
                <span>1% — An toàn</span>
                <span>30% — Mạo hiểm</span>
              </div>
            </div>
          </div>

          {/* Lãi kỳ vọng */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-text-dim block mb-1.5">Lãi Kỳ Vọng / Kỳ (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="-100"
                max="100"
                step="0.5"
                value={localExpectedReturn}
                onChange={(e) => setLocalExpectedReturn(parseFloat(e.target.value) || 0)}
                className="w-24 px-3 py-2.5 rounded font-mono text-[13px] font-semibold text-text-main outline-none focus:border-accent"
                style={{ background: 'var(--color-background)', border: '1px solid var(--color-border-standard)' }}
              />
              <span className="text-[12px] text-text-dim">% / kỳ</span>
              {parseFloat(localBalance) > 0 && localExpectedReturn !== 0 && (
                <span className="text-[11px] font-mono text-positive ml-auto">
                  ≈ {formatNumberVI(parseFloat(localBalance) * localExpectedReturn / 100)} VND
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 space-y-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded font-bold text-[13px] tracking-wide text-white transition-all disabled:opacity-50"
            style={{ background: 'var(--color-accent)' }}
          >
            {saving ? 'Đang lưu...' : 'Xác Nhận Cấu Hình'}
          </button>
          {portfolioId && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="w-full py-2 rounded text-[11px] font-semibold text-negative transition-colors disabled:opacity-50 hover:bg-negative/5"
              style={{ border: '1px solid var(--color-border-subtle)' }}
            >
              {deleting ? 'Đang xóa...' : 'Xóa Danh Mục'}
            </button>
          )}
        </div>
      </div>

      {/* Phase 10 C-02 — branded confirm replaces native window.confirm */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        variant="danger"
        title="Xóa danh mục"
        message="Bạn có chắc muốn xóa danh mục này? Dữ liệu liên quan có thể bị ảnh hưởng."
        confirmLabel="Xóa danh mục"
        cancelLabel="Huỷ"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

export default PortfolioSetupModalStandalone;
