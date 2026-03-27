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

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(filledPrice) || 0;
  const totalValue = qty * price;

  // Phi giao dich: mua 0.15%, ban 0.15% + 0.1% thue
  const buyFeeRate = 0.0015;
  const sellFeeRate = 0.0025;
  const fee = side === 'BUY' ? totalValue * buyFeeRate : totalValue * sellFeeRate;

  const remainingCash =
    side === 'BUY' ? availableCash - totalValue - fee : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!symbol.trim()) { setError('Vui long nhap ma chung khoan'); return; }
    if (!exchange) { setError('Vui long chon san'); return; }
    if (qty <= 0) { setError('So luong phai lon hon 0'); return; }
    if (price <= 0) { setError('Gia khop phai lon hon 0'); return; }
    if (!filledDate) { setError('Vui long chon ngay khop'); return; }

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
      setSuccess('Ghi nhan lenh thanh cong!');
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
        'Ghi nhan lenh that bai'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-5">
      <h3 className="text-sm font-bold text-white mb-4">Ghi Nhan Lenh That</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Ma CK + San */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              Ma Chung Khoan
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="VD: VNM"
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none uppercase placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              San Giao Dich
            </label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as 'HOSE' | 'HNX' | 'UPCOM')}
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="HOSE">HOSE</option>
              <option value="HNX">HNX</option>
              <option value="UPCOM">UPCOM</option>
            </select>
          </div>
        </div>

        {/* Loai lenh */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-400 mb-1">
            Loai Lenh
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSide('BUY')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                side === 'BUY'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              MUA
            </button>
            <button
              type="button"
              onClick={() => setSide('SELL')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                side === 'SELL'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              BAN
            </button>
          </div>
        </div>

        {/* So luong + Gia khop */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              So Luong
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={100}
              step={100}
              placeholder="100"
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              Gia Khop (VND)
            </label>
            <input
              type="number"
              value={filledPrice}
              onChange={(e) => setFilledPrice(e.target.value)}
              min={0}
              step={100}
              placeholder="0"
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Ngay khop */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-400 mb-1">
            Ngay Khop
          </label>
          <input
            type="date"
            value={filledDate}
            onChange={(e) => setFilledDate(e.target.value)}
            max={today()}
            className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Auto-calculate summary */}
        {totalValue > 0 && (
          <div className="bg-gray-750 rounded-lg p-3 space-y-1.5 border border-gray-700">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">Tong gia tri:</span>
              <span className="text-white font-mono">{formatVND(totalValue)} VND</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">
                Phi ({side === 'BUY' ? '0.15%' : '0.25%'}):
              </span>
              <span className="text-yellow-400 font-mono">{formatVND(fee)} VND</span>
            </div>
            {remainingCash !== null && (
              <div className="flex justify-between text-[11px] border-t border-gray-700 pt-1.5">
                <span className="text-gray-400">Con lai sau GD:</span>
                <span
                  className={`font-mono font-bold ${
                    remainingCash >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {formatVND(remainingCash)} VND
                </span>
              </div>
            )}
          </div>
        )}

        {/* Ghi chu */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-400 mb-1">
            Ghi Chu (tuy chon)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chu them..."
            className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Error / Success */}
        {error && (
          <p className="text-red-400 text-[11px] bg-red-900/20 rounded px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-green-400 text-[11px] bg-green-900/20 rounded px-3 py-2">{success}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
            side === 'BUY'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {loading ? 'Dang ghi nhan...' : 'Ghi Nhan Lenh'}
        </button>
      </form>
    </div>
  );
};
