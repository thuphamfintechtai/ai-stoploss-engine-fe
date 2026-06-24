import React, { useState } from 'react';
import { useActivePortfolio } from '../../contexts/ActivePortfolioContext';
import {
  PORTFOLIO_PRESETS,
  PRESET_KEYS,
  PortfolioType,
} from '../../utils/portfolioPresets';
import { portfolioApi } from '../../services/api';
import { AiDisclaimer } from '../ui/AiDisclaimer';
import { PresetIcon } from './PresetIcon';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from '../ui/primitives';

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
 *
 * Phase 10-05: Migrated to Modal/Button/Input primitives (A-01). 3 preset
 * cards giữ raw `<button>` vì là custom visual selector (radio-card pattern
 * không có trong primitives v1).
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
    <Modal isOpen={true} onClose={onClose} size="md">
      <ModalHeader onClose={onClose}>Tạo danh mục mới</ModalHeader>
      <ModalBody>
        <p className="text-[12px] text-text-muted mb-4">
          Chọn chiến lược phù hợp — AI sẽ tư vấn SL/TP theo loại bạn chọn
        </p>

        {/* 3 preset cards — custom visual radio-card selector, primitives don't expose this pattern */}
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
                <div
                  className="mb-2"
                  style={{ color: isSel ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                >
                  <PresetIcon type={key} size={22} />
                </div>
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

        <form id="create-portfolio-form" onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="text"
            label="Tên danh mục"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Danh mục dài hạn 2026"
            maxLength={255}
            autoFocus
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Số dư khởi tạo (VND)"
            value={totalBalance}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              setTotalBalance(raw ? Number(raw).toLocaleString('vi-VN') : '');
            }}
            placeholder="100.000.000"
          />

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
        </form>
        <div className="mt-3">
          <AiDisclaimer compact />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Huỷ
        </Button>
        <Button
          variant="primary"
          type="submit"
          form="create-portfolio-form"
          loading={submitting}
        >
          Tạo danh mục
        </Button>
      </ModalFooter>
    </Modal>
  );
};
