import React, { useState, useEffect, useCallback } from 'react';
import { realPortfolioApi } from '../../services/api';
import type { RealOrder } from '../../services/api';

interface TransactionHistoryProps {
  portfolioId: string;
}

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ portfolioId }) => {
  const [orders, setOrders] = useState<RealOrder[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const LIMIT = 50;

  const fetchOrders = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    try {
      const res = await realPortfolioApi.getTransactionHistory(portfolioId, page, LIMIT);
      if (res.data?.success) {
        setOrders(res.data.data?.orders ?? res.data.data ?? []);
        setTotal(res.data.data?.total ?? 0);
      }
    } catch {
      // fallback to empty
    } finally {
      setLoading(false);
    }
  }, [portfolioId, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="panel-section">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-divider)]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Lịch sử giao dịch</span>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-text-main)] transition-colors disabled:opacity-40"
        >
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-dim)] text-[11px] animate-pulse">
          Đang tải...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-dim)] text-[11px]">
          Chưa có giao dịch nào
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-terminal w-full text-[11px]">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)]">
                  <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Ngày</th>
                  <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Loại</th>
                  <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Mã CK</th>
                  <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Sàn</th>
                  <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">SL</th>
                  <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Giá</th>
                  <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Tổng GT</th>
                  <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">Phí</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isBuy = order.side === 'BUY';
                  const totalValue = Number(order.quantity) * Number(order.filled_price);
                  const fee = order.fee ?? totalValue * (isBuy ? 0.0015 : 0.0025);
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-[var(--color-divider)] hover:bg-[var(--color-panel-hover)] transition-colors"
                    >
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">
                        {formatDate(order.filled_date || order.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                            isBuy
                              ? 'bg-[var(--color-positive)]/10 text-[var(--color-positive)]'
                              : 'bg-[var(--color-negative)]/10 text-[var(--color-negative)]'
                          }`}
                        >
                          {isBuy ? 'MUA' : 'BÁN'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-[var(--color-text-main)] font-mono">{order.symbol}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{order.exchange}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[var(--color-text-muted)]">
                        {Number(order.quantity).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[var(--color-text-muted)]">
                        {formatVND(Number(order.filled_price))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[var(--color-text-muted)]">
                        {formatVND(totalValue)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[var(--color-text-dim)]">
                        {formatVND(fee)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-divider)]">
              <span className="text-[10px] text-[var(--color-text-dim)]">
                Trang {page} / {totalPages} ({total} giao dịch)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!hasPrev || loading}
                  className="text-[10px] font-semibold px-3 py-1 rounded bg-[var(--color-panel)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-panel-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Trước
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNext || loading}
                  className="text-[10px] font-semibold px-3 py-1 rounded bg-[var(--color-panel)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-panel-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Tiếp
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
