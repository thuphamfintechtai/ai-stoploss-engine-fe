import React, { useState } from 'react';
import { orderApi } from '../services/api';
import type { Order } from '../services/api';
import { formatNumberVI } from '../constants';

interface PaperOrderManagerProps {
  portfolioId: string;
  orders: Order[];
  onRefresh: () => void;
}

const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);

export const PaperOrderManager: React.FC<PaperOrderManagerProps> = ({
  portfolioId,
  orders,
  onRefresh,
}) => {
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editLimitPrice, setEditLimitPrice] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const pendingOrders = orders.filter(
    (o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'
  );

  const handleOpenEdit = (order: Order) => {
    setEditError('');
    const limitPts = order.limit_price != null ? toPoint(Number(order.limit_price)).toFixed(2) : '';
    setEditLimitPrice(limitPts);
    setEditQuantity(String(order.quantity));
    setEditingOrder(order);
  };

  const handleCloseEdit = () => {
    setEditingOrder(null);
    setEditError('');
  };

  const handleSubmitEdit = async () => {
    if (!editingOrder) return;
    // Confirmation dialog per D-04: nhắc nhở đây là giao dịch mo phong
    const confirmed = window.confirm('Đây là giao dịch mô phỏng. Không ảnh hưởng tới portfolio. Bạn có muốn tiếp tục?');
    if (!confirmed) return;
    const data: { limit_price?: number; quantity?: number } = {};

    if (editLimitPrice.trim()) {
      const price = parseFloat(editLimitPrice);
      if (isNaN(price) || price <= 0) {
        setEditError('Giá lệnh phải là số dương');
        return;
      }
      // Convert từ điểm sang đơn vị gốc (nếu cần)
      data.limit_price = price;
    }

    if (editQuantity.trim()) {
      const qty = parseInt(editQuantity, 10);
      if (isNaN(qty) || qty <= 0) {
        setEditError('Khối lượng phải là số nguyên dương');
        return;
      }
      data.quantity = qty;
    }

    if (!data.limit_price && !data.quantity) {
      setEditError('Nhập ít nhất giá lệnh hoặc khối lượng để cập nhật');
      return;
    }

    setEditLoading(true);
    setEditError('');
    try {
      await orderApi.editPaperOrder(portfolioId, editingOrder.id, data);
      setEditingOrder(null);
      onRefresh();
    } catch (e: any) {
      setEditError(e?.response?.data?.message || 'Cập nhật lệnh thất bại');
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmCancel = (orderId: string) => {
    setConfirmCancelId(orderId);
  };

  const handleCancelOrder = async (orderId: string) => {
    setCancellingId(orderId);
    setConfirmCancelId(null);
    try {
      await orderApi.cancel(portfolioId, orderId);
      onRefresh();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Hủy lệnh thất bại');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="panel-section p-4 border-l-4 border-violet-600">
      {/* Badge Mô Phỏng */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-violet-600/10 text-violet-400">
          MO PHONG
        </span>
        <span className="text-[10px] text-text-muted">Giao dịch mô phỏng — Không ảnh hưởng portfolio thật</span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-black text-text-main">Lệnh Chờ Khớp (Paper)</h3>
          <p className="text-[10px] text-text-muted mt-0.5">
            Lệnh LO đang chờ giá thị trường chạm vào — có thể sửa hoặc hủy
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="text-[10px] text-accent hover:underline"
        >
          ↻ Làm mới
        </button>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="text-center py-8 text-text-muted text-[11px]">
          Không có lệnh chờ nào. Đặt lệnh LO (Limit Order) trong chế độ REALISTIC để xem tại đây.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-terminal w-full">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-text-dim">Mã</th>
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-text-dim">Lệnh</th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-text-dim">Giá Lệnh</th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-text-dim">Khối Lượng</th>
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-text-dim">Trạng Thái</th>
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-text-dim">Đặt Lúc</th>
                <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-text-dim text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((order) => {
                const isBuy = order.side === 'BUY';
                const limitPts = order.limit_price != null ? toPoint(Number(order.limit_price)) : null;
                const placedAt = new Date(order.created_at).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                });

                return (
                  <tr key={order.id} className="border-b border-border-subtle/30 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5">
                      <span className="text-[12px] font-bold text-text-main font-mono">{order.symbol}</span>
                      <span className="ml-1 text-[9px] text-text-dim">{order.exchange}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold mr-1.5 ${isBuy ? 'text-positive' : 'text-negative'}`}>
                        {isBuy ? 'MUA' : 'BÁN'}
                      </span>
                      <span className="text-[9px] text-text-muted bg-white/5 px-1 py-0.5 rounded">
                        {order.order_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px]">
                      {limitPts != null ? (
                        <span className="text-text-main">{limitPts.toFixed(2)}</span>
                      ) : (
                        <span className="text-text-dim">Giá TT</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px]">
                      <span>{formatNumberVI(order.quantity, { maximumFractionDigits: 0 })}</span>
                      {Number(order.filled_quantity) > 0 && (
                        <span className="text-text-dim ml-1 text-[9px]">
                          (KH: {formatNumberVI(order.filled_quantity, { maximumFractionDigits: 0 })})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                        order.status === 'PARTIALLY_FILLED'
                          ? 'text-warning bg-warning/10'
                          : 'text-accent bg-accent/10'
                      }`}>
                        {order.status === 'PARTIALLY_FILLED' ? 'Khớp Một Phần' : 'Chờ Khớp'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[9px] text-text-muted">{placedAt}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleOpenEdit(order)}
                          className="px-2 py-1 rounded text-[9px] font-semibold bg-accent/15 text-accent hover:bg-accent/30 transition-colors"
                        >
                          Sửa
                        </button>
                        {confirmCancelId === order.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={cancellingId === order.id}
                              className="px-2 py-1 rounded text-[9px] font-semibold bg-negative text-white hover:bg-red-600 transition-colors disabled:opacity-40"
                            >
                              {cancellingId === order.id ? '...' : 'Xác nhận'}
                            </button>
                            <button
                              onClick={() => setConfirmCancelId(null)}
                              className="px-2 py-1 rounded text-[9px] font-semibold bg-white/10 text-text-muted hover:bg-white/20 transition-colors"
                            >
                              Bỏ
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConfirmCancel(order.id)}
                            disabled={cancellingId === order.id}
                            className="px-2 py-1 rounded text-[9px] font-semibold bg-negative/15 text-negative hover:bg-negative/30 transition-colors disabled:opacity-40"
                          >
                            Hủy
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-panel-surface border border-border-standard rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h4 className="text-[13px] font-black text-text-main mb-1">
              Sửa Lệnh — {editingOrder.symbol}
            </h4>
            <p className="text-[10px] text-text-muted mb-4">
              {editingOrder.side === 'BUY' ? 'MUA' : 'BÁN'} {editingOrder.order_type} •{' '}
              {editingOrder.status === 'PARTIALLY_FILLED' ? 'Khớp Một Phần' : 'Chờ Khớp'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-text-muted mb-1 block">
                  Giá Lệnh (điểm)
                </label>
                <input
                  type="number"
                  value={editLimitPrice}
                  onChange={(e) => setEditLimitPrice(e.target.value)}
                  placeholder="Ví dụ: 25.5"
                  step="0.05"
                  min="0"
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-border-standard text-[12px] text-text-main focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-text-muted mb-1 block">
                  Khối Lượng
                </label>
                <input
                  type="number"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  placeholder="Ví dụ: 100"
                  step="100"
                  min="100"
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-border-standard text-[12px] text-text-main focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {editError && (
              <p className="mt-3 text-[10px] text-negative bg-negative/10 rounded px-3 py-2">
                {editError}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSubmitEdit}
                disabled={editLoading}
                className="flex-1 px-4 py-2 rounded-md text-[12px] font-semibold bg-accent text-white hover:bg-blue-500 transition-colors disabled:opacity-40"
              >
                {editLoading ? 'Đang lưu...' : 'Cập Nhật'}
              </button>
              <button
                onClick={handleCloseEdit}
                disabled={editLoading}
                className="px-4 py-2 rounded-md text-[12px] font-semibold border border-border-standard text-text-muted hover:text-text-main hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
