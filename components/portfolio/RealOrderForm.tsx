import React, { useState } from 'react';
import { realPortfolioApi } from '../../services/api';

interface RealOrderFormProps {
  portfolioId: string;
  availableCash: number;
  onSuccess: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

export const RealOrderForm: React.FC<RealOrderFormProps> = ({
  portfolioId,
  availableCash,
  onSuccess,
}) => {
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState<'HOSE' | 'HNX' | 'UPCOM'>('HOSE');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [filledPrice, setFilledPrice] = useState('');
  const [filledDate, setFilledDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(filledPrice) || 0;
  const totalValue = qty * price;

  const buyFeeRate = 0.0015;
  const sellFeeRate = 0.0015;
  const fee = side === 'BUY' ? totalValue * buyFeeRate : totalValue * sellFeeRate;

  const remainingCash =
    side === 'BUY' ? availableCash - totalValue - fee : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!symbol.trim()) { setError('Vui lòng nhập mã chứng khoán'); return; }
    if (!exchange) { setError('Vui lòng chọn sàn'); return; }
    if (qty <= 0) { setError('Số lượng phải lớn hơn 0'); return; }
    if (price <= 0) { setError('Giá khớp phải lớn hơn 0'); return; }
    if (!filledDate) { setError('Vui lòng chọn ngày khớp'); return; }

    setLoading(true);
    try {
      await realPortfolioApi.createOrder(portfolioId, {
        symbol: symbol.toUpperCase().trim(),
        exchange,
        side,
        quantity: qty,
        filled_price: price,
        filled_date: filledDate,
        notes: notes.trim() || undefined,
      });
      setSuccess('Ghi nhận lệnh thành công!');
      setSymbol('');
      setQuantity('');
      setFilledPrice('');
      setFilledDate(today());
      setNotes('');
      onSuccess();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Ghi nhận lệnh thất bại'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full bg-[var(--color-background)] text-[var(--color-text-main)] text-[12px] font-mono rounded-md px-3 py-2 border border-[var(--color-border-subtle)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-subtle)] transition-colors placeholder:text-[var(--color-text-disabled)]';

  const labelCls =
    'block text-[10px] font-medium text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full panel-section px-4 py-3 flex items-center justify-between hover:bg-[var(--color-panel-hover)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-[13px] font-semibold text-[var(--color-text-main)]">Ghi nhận lệnh thật</span>
        </div>
        <svg className="w-4 h-4 text-[var(--color-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    );
  }

  return (
    <div className="panel-section">
      {/* Header */}
      <button
        onClick={() => setCollapsed(true)}
        className="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--color-divider)] hover:bg-[var(--color-panel-hover)] transition-colors cursor-pointer"
      >
        <span className="text-[13px] font-semibold text-[var(--color-text-main)]">Ghi nhận lệnh thật</span>
        <svg className="w-4 h-4 text-[var(--color-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Row 1: Side toggle + Mã CK + Sàn */}
        <div className="grid grid-cols-[auto_1fr_100px] gap-2 items-end">
          {/* MUA/BÁN compact toggle */}
          <div>
            <label className={labelCls}>Lệnh</label>
            <div className="inline-flex rounded-md overflow-hidden border border-[var(--color-border-subtle)] h-[34px]">
              <button
                type="button"
                onClick={() => setSide('BUY')}
                className={`px-3 text-[11px] font-bold transition-all ${
                  side === 'BUY'
                    ? 'bg-[var(--color-positive)] text-white'
                    : 'bg-[var(--color-background)] text-[var(--color-text-dim)] hover:text-[var(--color-positive)]'
                }`}
              >MUA</button>
              <button
                type="button"
                onClick={() => setSide('SELL')}
                className={`px-3 text-[11px] font-bold transition-all border-l border-[var(--color-border-subtle)] ${
                  side === 'SELL'
                    ? 'bg-[var(--color-negative)] text-white'
                    : 'bg-[var(--color-background)] text-[var(--color-text-dim)] hover:text-[var(--color-negative)]'
                }`}
              >BÁN</button>
            </div>
          </div>

          {/* Mã CK */}
          <div>
            <label className={labelCls}>Mã CK</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="VNM"
              className={`${inputCls} uppercase`}
            />
          </div>

          {/* Sàn */}
          <div>
            <label className={labelCls}>Sàn</label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as 'HOSE' | 'HNX' | 'UPCOM')}
              className={inputCls}
            >
              <option value="HOSE">HOSE</option>
              <option value="HNX">HNX</option>
              <option value="UPCOM">UPCOM</option>
            </select>
          </div>
        </div>

        {/* Row 2: SL + Giá + Ngày */}
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Số lượng</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={100}
              step={100}
              placeholder="100"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Giá khớp (VND)</label>
            <input
              type="number"
              value={filledPrice}
              onChange={(e) => setFilledPrice(e.target.value)}
              min={0}
              step={100}
              placeholder="72500"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Ngày khớp</label>
            <input
              type="date"
              value={filledDate}
              onChange={(e) => setFilledDate(e.target.value)}
              max={today()}
              className={inputCls}
            />
          </div>
        </div>

        {/* Summary inline */}
        {totalValue > 0 && (
          <div className="flex items-center gap-4 text-[10px] px-1">
            <span className="text-[var(--color-text-dim)]">
              Giá trị: <span className="text-[var(--color-text-main)] font-mono">{formatVND(totalValue)}</span>
            </span>
            <span className="text-[var(--color-text-dim)]">
              Phí: <span className="text-[var(--color-warning)] font-mono">{formatVND(fee)}</span>
            </span>
            {remainingCash !== null && (
              <span className="text-[var(--color-text-dim)]">
                Còn lại: <span className={`font-mono font-semibold ${remainingCash >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                  {formatVND(remainingCash)}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Row 3: Ghi chú + Submit */}
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label className={labelCls}>Ghi chú</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tùy chọn..."
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`h-[34px] px-5 rounded-md text-[12px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              side === 'BUY'
                ? 'bg-[var(--color-positive)] hover:brightness-110'
                : 'bg-[var(--color-negative)] hover:brightness-110'
            }`}
          >
            {loading ? '...' : 'Ghi nhận'}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <p className="text-[var(--color-negative)] text-[10px] px-1">{error}</p>
        )}
        {success && (
          <p className="text-[var(--color-positive)] text-[10px] px-1">{success}</p>
        )}
      </form>
    </div>
  );
};
