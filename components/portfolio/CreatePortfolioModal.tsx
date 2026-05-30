import React, { useState } from 'react';
import { useActivePortfolio } from '../../contexts/ActivePortfolioContext';
import {
  PORTFOLIO_PRESETS,
  PRESET_KEYS,
  PortfolioType,
} from '../../utils/portfolioPresets';
import { portfolioApi } from '../../services/api';

interface Props {
  onClose: () => void;
  /** Optional callback fired after portfolio created (e.g. close parent dropdown). */
  onCreated?: (newPortfolioId: string) => void;
}

/**
 * CreatePortfolioModal — Phase 8 (MP-04).
 *
 * UX:
 * 1. 3 preset cards (LONG_TERM/SWING/DAY_TRADE) — user chọn chiến lược.
 * 2. Form: name + total_balance (VND, thousand separators).
 * 3. Submit → POST /api/portfolios { name, totalBalance, portfolioType } —
 *    BE auto-fill max_risk_percent + expected_return_percent từ preset (D-03).
 * 4. Refresh context → switch sang portfolio mới.
 */
export const CreatePortfolioModal: React.FC<Props> = ({ onClose, onCreated }) => {
  const { refreshPortfolios, setActivePortfolioId } = useActivePortfolio();
  const [selectedType, setSelectedType] = useState<PortfolioType>('SWING');
  const [name, setName] = useState('');
  const [totalBalance, setTotalBalance] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const balanceNum = Number(totalBalance.replace(/[^0-9]/g, ''));
    if (!name.trim()) {
      setError('Vui lòng nhập tên danh mục');
      return;
    }
    if (!balanceNum || balanceNum < 1_000_000) {
      setError('Số dư khởi tạo phải ≥ 1.000.000 VND');
      return;
    }

    setSubmitting(true);
    try {
      const res = await portfolioApi.create({
        name: name.trim(),
        totalBalance: balanceNum,
        portfolioType: selectedType,
      });
      const created = res?.data?.data;
      if (res?.data?.success && created?.id) {
        await refreshPortfolios();
        setActivePortfolioId(created.id);
        if (onCreated) onCreated(created.id);
        onClose();
      } else {
        setError(res?.data?.message || 'Không tạo được danh mục');
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi tạo danh mục',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl max-w-[520px] w-full p-6 shadow-2xl"
        style={{
          background: 'var(--color-panel)',
          border: '1px solid var(--color-border-standard)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="text-[16px] font-bold text-text-main mb-1">Tạo danh mục mới</h2>
          <p className="text-[12px] text-text-muted">
            Chọn chiến lược phù hợp — AI sẽ tư vấn SL/TP theo loại bạn chọn
          </p>
        </div>

        {/* 3 preset cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {PRESET_KEYS.map((key) => {
            const preset = PORTFOLIO_PRESETS[key];
            const isSel = selectedType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedType(key)}
                className={`p-3 rounded-lg text-left transition-colors`}
                style={{
                  border: isSel
                    ? '1.5px solid var(--color-accent)'
                    : '1px solid var(--color-border-standard)',
                  background: isSel
                    ? 'var(--color-accent-subtle)'
                    : 'var(--color-panel-secondary)',
                }}
              >
                <div className="text-[22px] mb-1.5 leading-none">{preset.icon}</div>
                <div className="text-[12px] font-semibold text-text-main">{preset.label}</div>
                <div className="text-[10px] text-text-muted mt-1 leading-snug min-h-[28px]">
                  {preset.description}
                </div>
                <div className="text-[10px] mt-1.5" style={{ color: 'var(--color-accent)' }}>
                  {preset.risk_label} ~{preset.max_risk_percent}%
                </div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] text-text-muted mb-1">Tên danh mục</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Danh mục dài hạn 2026"
              maxLength={255}
              autoFocus
              className="w-full px-3 py-2 text-[13px] rounded-md text-text-main outline-none focus:ring-2"
              style={{
                background: 'var(--color-panel-secondary)',
                border: '1px solid var(--color-border-standard)',
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] text-text-muted mb-1">
              Số dư khởi tạo (VND)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={totalBalance}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setTotalBalance(raw ? Number(raw).toLocaleString('vi-VN') : '');
              }}
              placeholder="100.000.000"
              className="w-full px-3 py-2 text-[13px] rounded-md text-text-main outline-none focus:ring-2"
              style={{
                background: 'var(--color-panel-secondary)',
                border: '1px solid var(--color-border-standard)',
              }}
            />
          </div>

          {error && (
            <div
              className="text-[11px] px-3 py-2 rounded-md"
              style={{
                color: 'var(--color-negative-text)',
                background: 'var(--color-negative-bg)',
                border: '1px solid var(--color-negative)',
              }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-[12px] rounded-md text-text-muted hover:text-text-main transition-colors"
              style={{ border: '1px solid var(--color-border-standard)' }}
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-[12px] rounded-md font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: 'var(--color-accent)' }}
            >
              {submitting ? 'Đang tạo...' : 'Tạo danh mục'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
