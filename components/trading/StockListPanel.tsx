import React from 'react';
import { STOCK_PRICE_DISPLAY_SCALE } from '../../constants';
import { toPoint } from './useTradingTerminal';

interface MarketCategory {
  code: string;
  label: string;
  group: string;
  color?: string;
}

const MARKET_CATEGORIES: MarketCategory[] = [
  { code: 'VNXALL', label: 'VNXALL', group: 'Sàn' },
  { code: 'VN30',   label: 'VN30',   group: 'Sàn' },
  { code: 'VN100',  label: 'VN100',  group: 'Sàn' },
  { code: 'HOSE',   label: 'HOSE',   group: 'Sàn' },
  { code: 'HNX',    label: 'HNX',    group: 'Sàn' },
  { code: 'UPCOM',  label: 'UPCOM',  group: 'Sàn' },
  { code: 'HNX30',  label: 'HNX30',  group: 'Sàn' },
  { code: 'VNX50',  label: 'VNX50',  group: 'Sàn' },
  { code: 'VN30F',  label: 'VN30F',  group: 'PS', color: 'var(--color-secondary-hover)' },
  { code: 'VN100F', label: 'VN100F', group: 'PS', color: 'var(--color-secondary-hover)' },
  { code: 'ETF',    label: 'ETF',    group: 'CK', color: 'var(--color-info)' },
  { code: 'CW',     label: 'CW',     group: 'CK', color: 'var(--color-info)' },
];

interface StockListPanelProps {
  selectedIndex: string;
  onSelectIndex: (code: string) => void;
  searchStocks: string;
  onSearchChange: (value: string) => void;
  stockList: any[];
  loadingStocks: boolean;
  currentSymbol: string;
  onSelectStock: (symbol: string, exchange: string) => void;
}

export const StockListPanel: React.FC<StockListPanelProps> = ({
  selectedIndex,
  onSelectIndex,
  searchStocks,
  onSearchChange,
  stockList,
  loadingStocks,
  currentSymbol,
  onSelectStock,
}) => {
  const filteredStocks = stockList.filter((s) =>
    !searchStocks || s.symbol?.toLowerCase().includes(searchStocks.toLowerCase())
  ).slice(0, 80);

  const priceColorCls = (price: number, ref: number) => {
    if (!ref) return 'text-text-main';
    if (price > ref) return 'text-positive';
    if (price < ref) return 'text-negative';
    return 'text-warning';
  };

  return (
    <div
      className="flex flex-col border-r border-border-standard shrink-0"
      style={{ width: 195, background: 'var(--color-panel-secondary)' }}
    >
      {/* Market category selector */}
      <div className="shrink-0 border-b border-border-standard px-2 py-1.5" style={{ background: 'var(--color-background)' }}>
        {(['Sàn', 'PS', 'CK'] as const).map((group) => {
          const cats = MARKET_CATEGORIES.filter((c) => c.group === group);
          const groupLabel: Record<string, string> = { Sàn: 'CHỈ SỐ', PS: 'PHÁI SINH', CK: 'ĐẶC BIỆT' };
          return (
            <div key={group} className="mb-1.5 last:mb-0">
              <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-text-dim mb-0.5">{groupLabel[group]}</p>
              <div className="flex flex-wrap gap-0.5">
                {cats.map((cat) => {
                  const isActive = selectedIndex === cat.code;
                  const activeColor = cat.color ?? 'var(--color-accent)';
                  return (
                    <button
                      key={cat.code}
                      onClick={() => onSelectIndex(cat.code)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide transition-all leading-none"
                      style={{
                        background: isActive ? `${activeColor}20` : 'rgba(255,255,255,0.04)',
                        color: isActive ? activeColor : 'var(--color-text-muted)',
                        border: `1px solid ${isActive ? activeColor : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-2 py-2 border-b border-border-standard shrink-0">
        <input
          value={searchStocks}
          onChange={(e) => onSearchChange(e.target.value.toUpperCase())}
          placeholder="Tìm mã..."
          className="w-full bg-background border border-border-subtle rounded px-2 py-1.5 text-[11px] text-text-main placeholder-text-dim outline-none focus:border-accent font-mono"
        />
      </div>

      <div className="flex-1 overflow-y-auto dense-scroll">
        {loadingStocks ? (
          <div className="text-center py-4 text-text-dim text-[10px] animate-pulse">Đang tải...</div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10" style={{ background: 'var(--color-panel-secondary)' }}>
              <tr className="border-b border-border-subtle">
                <th className="text-left px-2 py-1.5 text-[8px] font-bold text-text-dim uppercase tracking-widest">Mã</th>
                <th className="text-right px-2 py-1.5 text-[8px] font-bold text-text-dim uppercase tracking-widest">Giá</th>
                <th className="text-right px-1 py-1.5 text-[8px] font-bold text-text-dim uppercase tracking-widest">%</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((s) => {
                const close = Number(s.matchPrice ?? s.closePrice ?? s.lastPrice ?? 0) * STOCK_PRICE_DISPLAY_SCALE;
                const ref = Number(s.tc ?? s.referencePrice ?? s.basicPrice ?? 0) * STOCK_PRICE_DISPLAY_SCALE;
                const chgPct = s.percentChange ?? s.changePercent ?? 0;
                const isActive = s.symbol === currentSymbol;
                return (
                  <tr
                    key={s.symbol}
                    onClick={() => onSelectStock(s.symbol, s.exchange ?? '')}
                    className={`cursor-pointer transition-colors border-b border-border-subtle/30 ${isActive ? 'bg-accent/10' : 'hover:bg-white/[0.04]'}`}
                  >
                    <td className={`px-2 py-1 text-[11px] font-bold ${isActive ? 'text-accent' : 'text-text-main'}`}>{s.symbol}</td>
                    <td className={`px-2 py-1 text-right text-[10px] font-mono ${priceColorCls(close, ref)}`}>
                      {close > 0 ? toPoint(close).toFixed(2) : '—'}
                    </td>
                    <td className={`px-1 py-1 text-right text-[10px] font-mono ${chgPct > 0 ? 'text-positive' : chgPct < 0 ? 'text-negative' : 'text-text-dim'}`}>
                      {chgPct !== 0 ? `${chgPct > 0 ? '+' : ''}${Number(chgPct).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
