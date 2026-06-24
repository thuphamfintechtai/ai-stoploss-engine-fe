import React, { useState, useMemo, useRef } from 'react';
import { realPortfolioApi } from '../../services/api';
import { useMarketRules } from '../../hooks/useMarketRules';
import { OrderFieldError } from './OrderFieldError';
import { ERRORS } from '../../utils/vnStockRules';
import { resolveFeeRates, type PortfolioFeeConfig } from '../../utils/feeConstants';
import { ORDER_FORM_ERRORS } from '../../utils/orderFormErrors';
import { Button, Input, Select } from '../ui/primitives';

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

const EXCHANGE_OPTIONS = [
  { value: 'HOSE', label: 'HOSE' },
  { value: 'HNX', label: 'HNX' },
  { value: 'UPCOM', label: 'UPCOM' },
];

export const RealOrderForm: React.FC<RealOrderFormProps> = ({
  portfolioId,
  availableCash,
  portfolio,
  onSuccess,
}) => {
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState<'HOSE' | 'HNX' | 'UPCOM'>('HOSE');
  // Portfolio tracking app: chỉ ghi nhận MUA, BÁN = đóng vị thế qua inline form trong bảng vị thế
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

  // C-05 field-level focus on submit error
  const symbolRef = useRef<HTMLInputElement>(null);
  const exchangeRef = useRef<HTMLSelectElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

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

    // C-05: typed error constants + field-level focus on first invalid input
    if (!symbol.trim()) {
      setError(ORDER_FORM_ERRORS.MISSING_SYMBOL);
      symbolRef.current?.focus();
      return;
    }
    if (!exchange) {
      setError(ORDER_FORM_ERRORS.MISSING_EXCHANGE);
      exchangeRef.current?.focus();
      return;
    }
    if (qty <= 0) {
      setError(ORDER_FORM_ERRORS.INVALID_QUANTITY);
      quantityRef.current?.focus();
      return;
    }
    if (price <= 0) {
      setError(ORDER_FORM_ERRORS.INVALID_PRICE);
      priceRef.current?.focus();
      return;
    }
    if (!filledDate) {
      setError(ORDER_FORM_ERRORS.MISSING_DATE);
      dateRef.current?.focus();
      return;
    }
    if (hasFieldError) {
      setError(ORDER_FORM_ERRORS.RULE_ERROR_PRESENT);
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

  const labelCls =
    'block text-[10px] font-medium text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

  if (collapsed) {
    // Custom expand-toggle — primitives don't expose this full-bleed icon-row pattern in Phase 10
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
      {/* Header — custom collapse toggle, primitives don't expose this pattern in Phase 10 */}
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
          <Input
            ref={symbolRef}
            type="text"
            label="Mã CK"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="VNM"
            className="uppercase"
          />

          {/* Sàn */}
          <Select
            ref={exchangeRef}
            label="Sàn"
            value={exchange}
            onChange={(e) => setExchange(e.target.value as 'HOSE' | 'HNX' | 'UPCOM')}
            options={EXCHANGE_OPTIONS}
          />
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
            <Input
              ref={quantityRef}
              type="number"
              label="Số lượng"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={100}
              step={100}
              placeholder="100"
              aria-invalid={qtyError !== null}
              error={qtyError !== null}
            />
            <OrderFieldError message={qtyError} />
          </div>
          <div>
            <Input
              ref={priceRef}
              type="number"
              label="Giá khớp (VND)"
              value={filledPrice}
              onChange={(e) => setFilledPrice(e.target.value)}
              min={0}
              step={dynamicTickStep}
              placeholder="72500"
              aria-invalid={priceError !== null}
              error={priceError !== null}
            />
            <OrderFieldError message={priceError} />
          </div>
          <Input
            type="number"
            label="Stop Loss (VND)"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            min={0}
            step={dynamicTickStep}
            placeholder="Tuỳ chọn"
          />
          <Input
            ref={dateRef}
            type="date"
            label="Ngày khớp"
            value={filledDate}
            onChange={(e) => setFilledDate(e.target.value)}
            max={today()}
          />
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

        {/* D-05 MAP-01: Radio trạng thái lệnh — Custom segmented control, primitives don't expose this pattern in Phase 10 */}
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
          <Input
            type="text"
            label="Ghi chú"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tùy chọn..."
          />
          <Button
            type="submit"
            variant="success"
            disabled={hasFieldError}
            loading={loading}
          >
            Ghi nhận MUA
          </Button>
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
