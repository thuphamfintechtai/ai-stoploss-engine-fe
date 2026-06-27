import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PRICE_FRACTION_OPTIONS, PRICE_LOCALE, formatNumberVI } from '../../constants';

export interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  exchange: string;
  data: any[];
  loading: boolean;
  stocks: any[];
  onSymbolChange: (symbol: string, exchange: string) => void;
}

// --- Chart Modal Component ---
export const ChartModal = ({ isOpen, onClose, symbol, exchange, data, loading, stocks, onSymbolChange }: ChartModalProps) => {
  if (!isOpen) return null;

  const latestPrice = data.length > 0 ? data[data.length - 1]?.close : 0;
  const previousPrice = data.length > 1 ? data[data.length - 2]?.close : 0;
  const priceChange = latestPrice - previousPrice;
  const priceChangePercent = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-border-standard space-y-4">
          {/* Top row - Icon, Title, Close button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">

              {/* Symbol Dropdown */}
              <div className="relative">
                <select
                  value={`${symbol}-${exchange}`}
                  onChange={(e) => {
                    const [newSymbol, newExchange] = e.target.value.split('-');
                    onSymbolChange(newSymbol, newExchange);
                  }}
                  className="appearance-none bg-panel border border-border-standard rounded-lg pl-4 pr-4 py-2.5 text-lg font-bold text-text-main hover:border-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 cursor-pointer transition-all"
                >
                  {stocks.map((stock) => (
                    <option key={`${stock.symbol}-${stock.exchange ?? 'NA'}`} value={`${stock.symbol}-${stock.exchange ?? 'NA'}`}>
                      {stock.symbol} ({stock.exchange})
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-sm text-text-muted">30 NGÀY GẦN NHẤT</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-panel rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Bottom row - Price info */}
          {!loading && data.length > 0 && (
            <div className="flex items-center gap-6 pl-16">
              <div>
                <p className="text-xs text-text-muted mb-1">Giá hiện tại</p>
                <p className="text-3xl font-bold text-text-main font-mono">{latestPrice.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">Thay đổi</p>
                <p className={`text-xl font-semibold ${priceChange >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Chart Body */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-border-standard border-t-[#1E3A5F] rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-text-muted">Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-96">
              <p className="text-text-muted">Không có dữ liệu</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Price Chart */}
              <div>
                <h3 className="text-sm font-semibold text-text-muted mb-4 uppercase">Biểu Đồ Giá</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      tickLine={{ stroke: '#E5E7EB' }}
                    />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      tickLine={{ stroke: '#E5E7EB' }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#1E3A5F"
                      strokeWidth={2}
                      dot={false}
                      name="Giá đóng cửa"
                    />
                    <Line
                      type="monotone"
                      dataKey="high"
                      stroke="#0B6E4B"
                      strokeWidth={1.5}
                      dot={false}
                      name="Giá cao nhất"
                      strokeDasharray="5 5"
                    />
                    <Line
                      type="monotone"
                      dataKey="low"
                      stroke="#A63D3D"
                      strokeWidth={1.5}
                      dot={false}
                      name="Giá thấp nhất"
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Volume Chart */}
              <div>
                <h3 className="text-sm font-semibold text-text-muted mb-4 uppercase">Khối Lượng Giao Dịch</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      tickLine={{ stroke: '#E5E7EB' }}
                    />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      tickLine={{ stroke: '#E5E7EB' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="volume"
                      stroke="#6B7280"
                      strokeWidth={2}
                      dot={false}
                      name="Khối lượng"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border-standard">
                <div className="bg-panel p-4 rounded-lg border border-border-standard">
                  <p className="text-xs text-text-muted mb-1">Mở cửa</p>
                  <p className="text-lg font-bold text-text-main font-mono">{data[data.length - 1]?.open.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</p>
                </div>
                <div className="bg-panel p-4 rounded-lg border border-border-standard">
                  <p className="text-xs text-text-muted mb-1">Cao nhất</p>
                  <p className="text-lg font-bold text-positive font-mono">{data[data.length - 1]?.high.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</p>
                </div>
                <div className="bg-panel p-4 rounded-lg border border-border-standard">
                  <p className="text-xs text-text-muted mb-1">Thấp nhất</p>
                  <p className="text-lg font-bold text-negative font-mono">{data[data.length - 1]?.low.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</p>
                </div>
                <div className="bg-panel p-4 rounded-lg border border-border-standard">
                  <p className="text-xs text-text-muted mb-1">Khối lượng</p>
                  <p className="text-lg font-bold text-text-main font-mono">{data[data.length - 1]?.volume != null ? formatNumberVI(data[data.length - 1].volume, { maximumFractionDigits: 0 }) : '—'} CP</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-border-standard bg-panel">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-border-standard rounded-lg text-sm font-semibold text-text-main hover:bg-panel transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
