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
    <div className="bg-gray-800 rounded-xl shadow-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Lich Su Giao Dich</h3>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-40"
        >
          {loading ? 'Dang tai...' : 'Lam moi'}
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-[11px] animate-pulse">
          Dang tai...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-[11px]">
          Chua co giao dich nao
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Ngay</th>
                  <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Loai</th>
                  <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Ma CK</th>
                  <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">San</th>
                  <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">SL</th>
                  <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Gia</th>
                  <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Tong GT</th>
                  <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Phi</th>
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
                      className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-gray-400">
                        {formatDate(order.filled_date || order.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                            isBuy
                              ? 'bg-green-900/40 text-green-400'
                              : 'bg-red-900/40 text-red-400'
                          }`}
                        >
                          {isBuy ? 'MUA' : 'BAN'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-white font-mono">{order.symbol}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400">{order.exchange}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                        {Number(order.quantity).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                        {formatVND(Number(order.filled_price))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                        {formatVND(totalValue)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-yellow-400">
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
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
              <span className="text-[10px] text-gray-500">
                Trang {page} / {totalPages} ({total} giao dich)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!hasPrev || loading}
                  className="text-[10px] font-semibold px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Truoc
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNext || loading}
                  className="text-[10px] font-semibold px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Tiep
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
