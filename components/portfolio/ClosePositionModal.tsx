import React, { useState, useEffect } from 'react';
import { realPortfolioApi } from '../../services/api';
import type { RealPosition } from '../../services/api';

interface ClosePositionModalProps {
  position: RealPosition | null;
  portfolioId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

export const ClosePositionModal: React.FC<ClosePositionModalProps> = ({
  position,
  portfolioId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSellPrice('');
      setSellDate(today());
      setNotes('');
      setError('');
    }
  }, [isOpen, position]);

  if (!isOpen || !position) return null;

  const entryPrice = Number(position.entry_price);
  const quantity = Number(position.quantity);
  const sell = parseFloat(sellPrice) || 0;

  // P&L calculations
  const grossPnl = (sell - entryPrice) * quantity;
  const buyCost = entryPrice * quantity;
  const sellRevenue = sell * quantity;
  const buyFee = buyCost * 0.0015;
  const sellFee = sellRevenue * 0.0015;
  const sellTax = sellRevenue * 0.0010;
  const netPnl = grossPnl - buyFee - sellFee - sellTax;

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
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Đóng vị thế thất bại'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-sm font-bold text-white">
            Đóng vị thế{' '}
            <span className="text-blue-400 font-mono">{position.symbol}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Position Info */}
          <div className="bg-gray-700/50 rounded-lg p-3 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-gray-400">Giá vào:</span>
              <span className="ml-2 text-white font-mono">{formatVND(entryPrice)} VND</span>
            </div>
            <div>
              <span className="text-gray-400">Số lượng:</span>
              <span className="ml-2 text-white font-mono">{quantity.toLocaleString()}</span>
            </div>
          </div>

          {/* Gia ban */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
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
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Ngay ban */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              Ngày Bán
            </label>
            <input
              type="date"
              value={sellDate}
              onChange={(e) => setSellDate(e.target.value)}
              max={today()}
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* P&L Preview */}
          {sell > 0 && (
            <div className="bg-gray-750 rounded-lg p-3 space-y-1.5 border border-gray-700 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Gross P&L:</span>
                <span className={`font-mono ${grossPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {grossPnl >= 0 ? '+' : ''}{formatVND(grossPnl)} VND
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phi mua (0.15%):</span>
                <span className="font-mono text-yellow-400">-{formatVND(buyFee)} VND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phi ban (0.15%):</span>
                <span className="font-mono text-yellow-400">-{formatVND(sellFee)} VND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Thue ban (0.1%):</span>
                <span className="font-mono text-yellow-400">-{formatVND(sellTax)} VND</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-1.5">
                <span className="text-gray-300 font-semibold">Net P&L:</span>
                <span
                  className={`font-mono font-bold text-[13px] ${
                    netPnl >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {netPnl >= 0 ? '+' : ''}{formatVND(netPnl)} VND
                </span>
              </div>
            </div>
          )}

          {/* Ghi chu */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              Ghi Chú (tùy chọn)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lý do đóng vị thế..."
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-red-400 text-[11px] bg-red-900/20 rounded px-3 py-2">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-400 border border-gray-600 hover:border-gray-500 hover:text-gray-300 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Đang đóng...' : 'Xác Nhận Đóng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
