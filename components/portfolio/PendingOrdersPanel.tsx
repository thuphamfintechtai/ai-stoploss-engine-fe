import React, { useState, useEffect, useCallback } from 'react';
import { realPortfolioApi } from '../../services/api';

interface PendingOrder {
  id: string;
  symbol: string;
  exchange: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  limit_price: number;
  status: string;
  placed_at: string;
}

interface Props {
  portfolioId: string;
  onConfirmed?: () => void;
}

const formatVND = (v: number | string) =>
  Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 });

const todayIso = (): string => {
  // ISO yyyy-mm-dd at noon local — tránh timezone shift sang ngày trước
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

export const PendingOrdersPanel: React.FC<Props> = ({ portfolioId, onConfirmed }) => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [formOrder, setFormOrder] = useState<PendingOrder | null>(null);
  const [actualPrice, setActualPrice] = useState('');
  const [actualDate, setActualDate] = useState(todayIso());
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    try {
      const res = await realPortfolioApi.listPendingOrders(portfolioId);
      if (res.data?.success) {
        const data = res.data.data ?? [];
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      // silent: empty list is acceptable
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => { load(); }, [load]);

  const openConfirm = (order: PendingOrder) => {
    setFormOrder(order);
    setActualPrice(String(order.limit_price ?? ''));
    setActualDate(todayIso());
    setError('');
  };

  const submitConfirm = async () => {
    if (!formOrder) return;
    const price = Number(actualPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError('Giá khớp phải > 0');
      return;
    }
    setConfirming(formOrder.id);
    setError('');
    try {
      await realPortfolioApi.confirmOrderFill(portfolioId, formOrder.id, {
        actual_price: price,
        actual_date: actualDate,
      });
      setFormOrder(null);
      await load();
      onConfirmed?.();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Lỗi khi xác nhận khớp');
    } finally {
      setConfirming(null);
    }
  };

  if (!loading && orders.length === 0) return null;

  return (
    <div className="panel-section">
      <div className="px-4 py-2.5 border-b border-[var(--color-divider)] flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Lệnh chờ khớp
          {orders.length > 0 && (
            <span className="ml-2 text-[10px] text-[var(--color-warning)]">({orders.length})</span>
          )}
        </span>
        <button
          onClick={load}
          className="text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-text-main)]"
          title="Làm mới"
        >
          ⟳
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-[var(--color-text-disabled)] text-[11px] animate-pulse">Đang tải...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-terminal w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Mã</th>
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Bên</th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">SL</th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Giá đặt</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-[var(--color-divider)] hover:bg-[var(--color-panel-hover)]">
                  <td className="px-3 py-2.5 font-bold text-[var(--color-text-main)] font-mono">{o.symbol}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      o.side === 'BUY' ? 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]'
                                       : 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]'
                    }`}>
                      {o.side === 'BUY' ? 'MUA' : 'BÁN'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[var(--color-text-muted)]">
                    {Number(o.quantity).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[var(--color-text-muted)]">
                    {formatVND(o.limit_price)}đ
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => openConfirm(o)}
                      className="text-[9px] font-semibold bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 px-2 py-1 rounded transition-colors"
                    >
                      Xác nhận khớp
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setFormOrder(null)}
        >
          <div
            className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl p-5 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-bold text-[var(--color-text-main)] mb-1">
              Xác nhận khớp lệnh
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)] mb-4">
              {formOrder.symbol} · {formOrder.side === 'BUY' ? 'MUA' : 'BÁN'} {Number(formOrder.quantity).toLocaleString()} CP @ {formatVND(formOrder.limit_price)}đ (giá đặt)
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">
                  Giá khớp thực tế (VND)
                </label>
                <input
                  type="number"
                  value={actualPrice}
                  onChange={(e) => setActualPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg)] text-[var(--color-text-main)] text-[12px]"
                  placeholder="VD: 25000"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">
                  Ngày khớp
                </label>
                <input
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg)] text-[var(--color-text-main)] text-[12px]"
                />
              </div>
              {error && <p className="text-[11px] text-[var(--color-negative)]">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setFormOrder(null)}
                disabled={confirming != null}
                className="px-3 py-1.5 rounded-md text-[11px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-panel-hover)]"
              >
                Huỷ
              </button>
              <button
                onClick={submitConfirm}
                disabled={confirming != null}
                className="px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {confirming ? 'Đang xác nhận...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
