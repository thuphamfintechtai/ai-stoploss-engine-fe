import React, { useState, useMemo } from 'react';
import { realPortfolioApi } from '../../services/api';
import { useMarketRules } from '../../hooks/useMarketRules';
import { OrderFieldError } from './OrderFieldError';
import { ERRORS } from '../../utils/vnStockRules';
import { resolveFeeRates, type PortfolioFeeConfig } from '../../utils/feeConstants';

interface RealOrderFormProps {
  portfolioId: string;
  availableCash: number;
  /** Portfolio fee config (D-02). Nếu null/undefined → fallback default constants. */
  portfolio?: PortfolioFeeConfig | null;
  onSuccess: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

export const RealOrderForm: React.FC<RealOrderFormProps> = ({
  portfolioId,
  availableCash,
  portfolio,
  onSuccess,
}) => {
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState<'HOSE' | 'HNX' | 'UPCOM'>('HOSE');
  // Portfolio tracking app: chỉ ghi nhận MUA, BÁN = đóng vị thế qua ClosePositionModal
  const side = 'BUY' as const;
  const [quantity, setQuantity] = useState('');
  const [filledPrice, setFilledPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [filledDate, setFilledDate] = useState(today());
  const [notes, setNotes] = useState('');
  // D-05 MAP-01: trạng thái lệnh — FILLED (mặc định) | PENDING (limit đã đặt, chưa khớp)
  const [orderStatus, setOrderStatus] = useState<'FILLED' | 'PENDING'>('FILLED');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const rules = useMarketRules(exchange);

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(filledPrice) || 0;
  const totalValue = Math.round(qty * price);

  // D-02 MAP-04: đọc fee rates từ portfolio prop, fallback default constants
  const { buyFeePct } = resolveFeeRates(portfolio);
  // MAP-05: integer VND math — Math.round trước khi hiển thị / cộng dồn
  const fee = Math.round(totalValue * buyFeePct);

  const remainingCash = availableCash - totalValue - fee;

  // Inline validation errors (null = không error)
  const qtyError = useMemo<string | null>(() => {
    if (qty <= 0) return null; // empty state — không hiển thị lỗi
    const r = rules.validateLot(qty);
    return r.ok ? null : r.reason ?? null;
  }, [qty, rules]);

  const priceError = useMemo<string | null>(() => {
    if (price <= 0) return null;
    const tick = rules.tickSize(price);
    if (price % tick !== 0) {
      return ERRORS.TICK_INVALID(tick, exchange);
    }
    return null;
  }, [price, exchange, rules]);

  const hasFieldError = qtyError !== null || priceError !== null;
  const dynamicTickStep = price > 0 ? rules.tickSize(price) : 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!symbol.trim()) { setError('Vui lòng nhập mã chứng khoán'); return; }
    if (!exchange) { setError('Vui lòng chọn sàn'); return; }
    if (qty <= 0) { setError('Số lượng phải lớn hơn 0'); return; }
    if (price <= 0) { setError('Giá khớp phải lớn hơn 0'); return; }
    if (!filledDate) { setError('Vui lòng chọn ngày khớp'); return; }
    if (hasFieldError) {
      setError('Vui lòng sửa các lỗi quy tắc sàn trước khi gửi lệnh');
      return;
    }

    setLoading(true);
    try {
      const slPrice = parseFloat(stopLoss) || undefined;
      await realPortfolioApi.createOrder(portfolioId, {
        symbol: symbol.toUpperCase().trim(),
        exchange,
        side: 'BUY',
        quantity: qty,
        filled_price: price,
        filled_date: filledDate,
        notes: notes.trim() || undefined,
        order_status: orderStatus,
        stop_loss: slPrice,
      });
      setSuccess(
        orderStatus === 'PENDING'
          ? 'Đã ghi nhận lệnh chờ khớp (tiền đã được lock)'
          : 'Ghi nhận lệnh MUA thành công!'
      );
      setSymbol('');
      setQuantity('');
      setFilledPrice('');
      setStopLoss('');
      setFilledDate(today());
      setNotes('');
      setOrderStatus('FILLED');
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
          <span className="text-[13px] font-semibold text-[var(--color-text-main)]">Ghi nhận lệnh MUA</span>
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
        <span className="text-[13px] font-semibold text-[var(--color-text-main)]">Ghi nhận lệnh MUA</span>
        <svg className="w-4 h-4 text-[var(--color-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Row 1: Mã CK + Sàn */}
        <div className="grid grid-cols-[1fr_100px] gap-2 items-end">
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

        {/* Session indicator (informational — không gate submit) */}
        <div className="text-[10px] text-[var(--color-text-dim)] px-1">
          Phiên hiện tại: <span className="font-mono">{rules.session}</span>
          {!rules.isOpen && (
            <span className="ml-2 text-[var(--color-warning)]">• Thị trường đóng cửa</span>
          )}
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
              aria-invalid={qtyError !== null}
            />
            <OrderFieldError message={qtyError} />
          </div>
          <div>
            <label className={labelCls}>Giá khớp (VND)</label>
            <input
              type="number"
              value={filledPrice}
              onChange={(e) => setFilledPrice(e.target.value)}
              min={0}
              step={dynamicTickStep}
              placeholder="72500"
              className={inputCls}
              aria-invalid={priceError !== null}
            />
            <OrderFieldError message={priceError} />
          </div>
          <div>
            <label className={labelCls}>Stop Loss (VND)</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              min={0}
              step={dynamicTickStep}
              placeholder="Tuỳ chọn"
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
            <span className="text-[var(--color-text-dim)]">
              Còn lại: <span className={`font-mono font-semibold ${remainingCash >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                {formatVND(remainingCash)}
              </span>
            </span>
          </div>
        )}

        {/* D-05 MAP-01: Radio trạng thái lệnh */}
        <div>
            <label className={labelCls}>Trạng thái lệnh</label>
            <div className="inline-flex rounded-md overflow-hidden border border-[var(--color-border-subtle)] h-[34px]">
              <button
                type="button"
                onClick={() => setOrderStatus('FILLED')}
                className={`px-3 text-[11px] font-bold transition-all ${
                  orderStatus === 'FILLED'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-background)] text-[var(--color-text-dim)] hover:text-[var(--color-accent)]'
                }`}
              >Đã khớp</button>
              <button
                type="button"
                onClick={() => setOrderStatus('PENDING')}
                className={`px-3 text-[11px] font-bold transition-all border-l border-[var(--color-border-subtle)] ${
                  orderStatus === 'PENDING'
                    ? 'bg-[var(--color-warning)] text-white'
                    : 'bg-[var(--color-background)] text-[var(--color-text-dim)] hover:text-[var(--color-warning)]'
                }`}
              >Chờ khớp</button>
            </div>
            {orderStatus === 'PENDING' && (
              <p className="text-[10px] text-[var(--color-text-dim)] mt-1">
                Lệnh limit đã đặt trên broker, chưa khớp — tiền sẽ được lock.
              </p>
            )}
        </div>

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
            disabled={loading || hasFieldError}
            className="h-[34px] px-5 rounded-md text-[12px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-positive)] hover:brightness-110"
          >
            {loading ? '...' : 'Ghi nhận MUA'}
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
