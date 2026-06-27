import React, { useState, useEffect } from 'react';
import { realPortfolioApi } from '../../services/api';
import type { RealPosition } from '../../services/api';
import { PriceFreshness } from '../ui/PriceFreshness';
import { resolveFeeRates, type PortfolioFeeConfig } from '../../utils/feeConstants';

interface RealPositionsTableProps {
  positions: RealPosition[];
  portfolioId: string;
  portfolio?: PortfolioFeeConfig | null;
  onPositionClosed: () => void;
  loading?: boolean;
  /**
   * MDI-04 — map symbol → timestamp (ms) lần cuối nhận price từ WS.
   */
  priceReceivedAtBySymbol?: Record<string, number>;
  /**
   * MDI-04 — tick counter từ parent để force re-render định kỳ.
   */
  ageTick?: number;
}

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const today = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────────────────
// Inline close-position form rendered inside an expanded table row.
// Replaces the modal flow — keeps user in data context, no overlay.
// ─────────────────────────────────────────────────────────────────────────────
const InlineCloseForm: React.FC<{
  position: RealPosition;
  portfolioId: string;
  portfolio?: PortfolioFeeConfig | null;
  onCancel: () => void;
  onSuccess: () => void;
}> = ({ position, portfolioId, portfolio, onCancel, onSuccess }) => {
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const entryPrice = Number(position.entry_price);
  const quantity = Number(position.quantity);
  const sell = parseFloat(sellPrice) || 0;
  const { buyFeePct, sellFeePct, sellTaxPct } = resolveFeeRates(portfolio);

  const buyCost = Math.round(entryPrice * quantity);
  const sellRevenue = Math.round(sell * quantity);
  const grossPnl = sellRevenue - buyCost;
  const buyFee = Math.round(buyCost * buyFeePct);
  const sellFee = Math.round(sellRevenue * sellFeePct);
  const sellTax = Math.round(sellRevenue * sellTaxPct);
  const netPnl = grossPnl - buyFee - sellFee - sellTax;
  const netPnlPercent = buyCost > 0 ? (netPnl / buyCost) * 100 : 0;
  const totalFees = buyFee + sellFee + sellTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!sell || sell <= 0) { setError('Vui lòng nhập giá bán hợp lệ'); return; }
    if (!sellDate) { setError('Vui lòng chọn ngày bán'); return; }
    setLoading(true);
    try {
      await realPortfolioApi.closePosition(portfolioId, position.id, {
        sell_price: sell,
        sell_date: sellDate,
        notes: notes.trim() || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Ghi nhận lệnh bán thất bại'
      );
    } finally {
      setLoading(false);
    }
  };

  const pnlColor = netPnl >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]';
  const sellValid = sell > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-background)] border-l-2 border-[var(--color-accent)] p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-[var(--color-text-main)]">
          Ghi nhận đã bán{' '}
          <span className="text-[var(--color-accent)] font-mono">{position.symbol}</span>
          <span className="ml-2 text-[10px] text-[var(--color-text-dim)] font-normal">
            (Giá vào: {formatVND(entryPrice)}đ · SL: {quantity.toLocaleString()})
          </span>
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-[var(--color-text-dim)] hover:text-[var(--color-text-main)] transition-colors p-1"
          title="Đóng (ESC)"
          aria-label="Đóng"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            Giá Bán (VND)
          </label>
          <input
            type="number"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            min={0}
            step={100}
            placeholder="Nhập giá bán"
            required
            autoFocus
            className="w-full bg-[var(--color-panel)] text-[var(--color-text-main)] text-[13px] rounded-lg px-3 py-2 border border-[var(--color-border-standard)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-subtle)] transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            Ngày Bán
          </label>
          <input
            type="date"
            value={sellDate}
            onChange={(e) => setSellDate(e.target.value)}
            max={today()}
            className="w-full bg-[var(--color-panel)] text-[var(--color-text-main)] text-[13px] rounded-lg px-3 py-2 border border-[var(--color-border-standard)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-subtle)] transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            Ghi Chú (tùy chọn)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lý do bán..."
            className="w-full bg-[var(--color-panel)] text-[var(--color-text-main)] text-[13px] rounded-lg px-3 py-2 border border-[var(--color-border-standard)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-subtle)] transition-colors"
          />
        </div>
      </div>

      {/* P&L Preview pills — always-on */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] pt-2 border-t border-[var(--color-border-subtle)]">
        <span className="text-[var(--color-text-dim)]">Dự kiến:</span>
        <span className={`px-2 py-1 rounded font-mono ${
          sellValid
            ? grossPnl >= 0 ? 'bg-[var(--color-positive-bg)] text-[var(--color-positive)]' : 'bg-[var(--color-negative-bg)] text-[var(--color-negative)]'
            : 'bg-[var(--color-panel)] text-[var(--color-text-disabled)]'
        }`}>
          Gross: {sellValid ? `${grossPnl >= 0 ? '+' : ''}${formatVND(grossPnl)}đ` : '—'}
        </span>
        <span className={`px-2 py-1 rounded font-mono ${
          sellValid ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' : 'bg-[var(--color-panel)] text-[var(--color-text-disabled)]'
        }`}
          title={sellValid ? `Phí mua ${(buyFeePct * 100).toFixed(2)}% + Phí bán ${(sellFeePct * 100).toFixed(2)}% + Thuế ${(sellTaxPct * 100).toFixed(2)}%` : ''}
        >
          Phí + Thuế: {sellValid ? `-${formatVND(totalFees)}đ` : '—'}
        </span>
        <span className={`px-2.5 py-1 rounded font-mono font-bold ${
          sellValid
            ? netPnl >= 0 ? 'bg-[var(--color-positive-bg)] text-[var(--color-positive)]' : 'bg-[var(--color-negative-bg)] text-[var(--color-negative)]'
            : 'bg-[var(--color-panel)] text-[var(--color-text-disabled)]'
        }`}>
          Net P&amp;L: {sellValid ? (
            <>
              {netPnl >= 0 ? '+' : ''}{formatVND(netPnl)}đ
              <span className={`ml-1.5 text-[10px] font-normal ${pnlColor}`}>
                ({netPnl >= 0 ? '+' : ''}{netPnlPercent.toFixed(2)}%)
              </span>
            </>
          ) : '—'}
        </span>
      </div>

      {error && (
        <p className="text-[var(--color-negative)] text-[11px] bg-[var(--color-negative-bg)] rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[var(--color-text-muted)] border border-[var(--color-border-standard)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[var(--color-negative)] hover:brightness-110 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Đang lưu...' : 'Ghi nhận BÁN'}
        </button>
      </div>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Memoized position row — D-04 perf: only re-renders when position data or
// expansion state changes. Default shallow comparison covers most cases.
// ─────────────────────────────────────────────────────────────────────────────
interface PositionRowProps {
  pos: RealPosition;
  portfolioId: string;
  portfolio?: PortfolioFeeConfig | null;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onPositionClosed: () => void;
  ageMs: number;
}

const PositionRowInner: React.FC<PositionRowProps> = ({
  pos,
  portfolioId,
  portfolio,
  isExpanded,
  onToggleExpand,
  onPositionClosed,
  ageMs,
}) => {
  const pnl = pos.unrealized_pnl ?? 0;
  const hasPnl = pos.current_price != null;
  const pnlPct = pos.current_price != null && Number(pos.entry_price) > 0
    ? ((Number(pos.current_price) - Number(pos.entry_price)) / Number(pos.entry_price)) * 100
    : null;

  return (
    <React.Fragment>
      <tr
        className={`border-b border-[var(--color-divider)] transition-colors ${
          isExpanded ? 'bg-[var(--color-panel-hover)]' : 'hover:bg-[var(--color-panel-hover)]'
        }`}
      >
        <td className="px-3 py-2.5">
          <div className="flex flex-col">
            <span className="font-bold text-[var(--color-text-main)] font-mono text-[13px]">
              {pos.symbol}
            </span>
            <span className="lg:hidden text-[10px] text-[var(--color-text-dim)] mt-0.5">
              {pos.exchange} · {Number(pos.quantity).toLocaleString()} CP
            </span>
            <span className="md:hidden text-[10px] text-[var(--color-text-dim)]">
              {formatDate(pos.created_at)}
            </span>
          </div>
        </td>
        <td className="hidden lg:table-cell px-3 py-2.5">
          <span className="text-[var(--color-text-muted)] text-[11px]">{pos.exchange}</span>
        </td>
        <td className="px-3 py-2.5 text-right font-mono">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[var(--color-text-muted)] text-[11px]">
              {formatVND(Number(pos.entry_price))}
            </span>
            {pos.current_price != null ? (
              <div className="inline-flex items-center gap-1">
                <span className="text-[var(--color-text-main)] font-semibold">
                  {formatVND(Number(pos.current_price))}
                </span>
                <PriceFreshness
                  ageMs={ageMs}
                  staleReason={(pos as any).stale_reason}
                />
              </div>
            ) : (
              <span className="text-[var(--color-text-disabled)]">—</span>
            )}
          </div>
        </td>
        <td className="hidden sm:table-cell px-3 py-2.5 text-right font-mono text-[var(--color-text-muted)]">
          {Number(pos.quantity).toLocaleString()}
        </td>
        <td className="px-3 py-2.5 text-right font-mono">
          {hasPnl ? (
            <div className="flex flex-col items-end">
              <span
                className={`font-semibold ${
                  pnl >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                }`}
              >
                {pnl >= 0 ? '+' : ''}
                {formatVND(pnl)}
              </span>
              {pnlPct != null && (
                <span
                  className={`text-[10px] ${
                    pnl >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                  }`}
                >
                  {pnlPct >= 0 ? '+' : ''}
                  {pnlPct.toFixed(2)}%
                </span>
              )}
            </div>
          ) : (
            <span className="text-[var(--color-text-disabled)]">—</span>
          )}
        </td>
        <td className="hidden md:table-cell px-3 py-2.5 text-[var(--color-text-muted)] text-[11px]">
          {formatDate(pos.created_at)}
        </td>
        <td className="px-3 py-2.5 text-right">
          <button
            onClick={() => onToggleExpand(pos.id)}
            className={`text-[10px] font-semibold px-2.5 py-1.5 rounded transition-colors whitespace-nowrap ${
              isExpanded
                ? 'bg-[var(--color-text-dim)] text-white'
                : 'bg-[var(--color-negative-bg)] text-[var(--color-negative)] hover:bg-[var(--color-negative)] hover:text-white'
            }`}
            title={isExpanded ? 'Đóng form' : 'Ghi nhận đã bán vị thế này'}
          >
            {isExpanded ? 'Hủy' : 'Bán'}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-[var(--color-border-subtle)]">
          <td colSpan={7} className="p-0">
            <InlineCloseForm
              position={pos}
              portfolioId={portfolioId}
              portfolio={portfolio}
              onCancel={() => onToggleExpand(pos.id)}
              onSuccess={() => {
                onToggleExpand(pos.id);
                onPositionClosed();
              }}
            />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

/** D-04: Memoized row — skips re-render when position data and UI state are stable. */
const PositionRow = React.memo(PositionRowInner);

// ─────────────────────────────────────────────────────────────────────────────
// Main table component
// ─────────────────────────────────────────────────────────────────────────────
export const RealPositionsTable: React.FC<RealPositionsTableProps> = ({
  positions,
  portfolioId,
  portfolio,
  onPositionClosed,
  loading = false,
  priceReceivedAtBySymbol,
  ageTick: _ageTick,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const now = Date.now();
  const ageFor = (symbol: string): number => {
    const received = priceReceivedAtBySymbol?.[symbol];
    if (!received || !Number.isFinite(received)) return 0;
    return Math.max(0, now - received);
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-[var(--color-text-disabled)] text-[11px] animate-pulse">
        Đang tải...
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-disabled)] text-[12px]">
        Chưa có vị thế nào
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 -my-4">
      <table className="table-terminal w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)]">
            <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
              Mã CK
            </th>
            <th className="hidden lg:table-cell text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
              Sàn
            </th>
            <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
              Giá vào / HT
            </th>
            <th className="hidden sm:table-cell text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
              Số lượng
            </th>
            <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
              P&amp;L
            </th>
            <th className="hidden md:table-cell text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
              Ngày mở
            </th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <PositionRow
              key={pos.id}
              pos={pos}
              portfolioId={portfolioId}
              portfolio={portfolio}
              isExpanded={expandedId === pos.id}
              onToggleExpand={(id) => setExpandedId(prev => prev === id ? null : id)}
              onPositionClosed={onPositionClosed}
              ageMs={ageFor(pos.symbol)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
