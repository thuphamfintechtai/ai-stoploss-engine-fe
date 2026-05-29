import React from 'react';
import { PRICE_LOCALE, PRICE_FRACTION_OPTIONS } from '../../constants';
import { toPoint } from './useTradingTerminal';

const TIMEFRAMES = ['1m', '1h', '1d', '1w', '1M'];

interface SymbolHeaderProps {
  symbol: string;
  symbolInput: string;
  onSymbolInputChange: (value: string) => void;
  onSymbolSearch: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  companyName?: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  latestCandle: { open: number; high: number; low: number; close: number } | null;
  loadingDetail: boolean;
  inWatchlist: boolean;
  watchlistLoading: boolean;
  onToggleWatchlist: () => void;
  orderSide: 'MUA' | 'BAN';
  onOpenOrderModal: () => void;
  showLeftPanel: boolean;
  onToggleLeftPanel: () => void;
}

export const SymbolHeader: React.FC<SymbolHeaderProps> = ({
  symbol,
  symbolInput,
  onSymbolInputChange,
  onSymbolSearch,
  timeframe,
  onTimeframeChange,
  companyName,
  currentPrice,
  priceChange,
  priceChangePercent,
  latestCandle,
  loadingDetail,
  inWatchlist,
  watchlistLoading,
  onToggleWatchlist,
  orderSide,
  onOpenOrderModal,
  showLeftPanel,
  onToggleLeftPanel,
}) => {
  const isNegative = priceChange < 0;

  return (
    <div
      className="flex items-center gap-0 px-0 shrink-0 border-b border-border-standard"
      style={{ height: 44, background: 'var(--color-panel-secondary)' }}
    >
      {/* Symbol search */}
      <div className="flex items-center gap-2 border-r border-border-standard px-3 h-full w-44 shrink-0">
        <svg className="w-3 h-3 text-text-dim shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={symbolInput}
          onChange={(e) => onSymbolInputChange(e.target.value.toUpperCase())}
          onKeyDown={onSymbolSearch}
          placeholder="Nhập mã CK..."
          className="bg-transparent outline-none text-[12px] font-bold text-text-main placeholder-text-dim w-full font-mono tracking-wide"
        />
      </div>

      {/* Timeframe buttons */}
      <div className="flex items-center border-r border-border-standard h-full px-2 gap-0.5 shrink-0">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-2.5 h-7 rounded text-[10px] font-bold tracking-wide transition-colors ${
              timeframe === tf
                ? 'text-accent bg-accent/15'
                : 'text-text-dim hover:text-text-main hover:bg-white/5'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Symbol info */}
      <div className="flex items-center gap-5 px-4 flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-bold text-text-main font-mono tracking-wide">{symbol}</span>
          {companyName && (
            <span className="text-[11px] text-text-dim hidden xl:inline truncate max-w-[160px]">{companyName}</span>
          )}
        </div>
        {!loadingDetail && currentPrice > 0 && (
          <>
            <span className={`font-mono font-bold text-[16px] leading-none ${isNegative ? 'text-negative' : 'text-positive'}`}>
              {currentPrice.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}
            </span>
            {priceChange !== 0 && (
              <span className={`font-mono text-[11px] ${isNegative ? 'text-negative' : 'text-positive'}`}>
                {isNegative ? '▼' : '▲'} {Math.abs(priceChange).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
              </span>
            )}
            {latestCandle && (
              <span className="text-text-dim text-[10px] font-mono hidden 2xl:flex gap-3">
                <span>O <span className="text-text-muted">{toPoint(latestCandle.open).toFixed(2)}</span></span>
                <span>H <span className="text-positive">{toPoint(latestCandle.high).toFixed(2)}</span></span>
                <span>L <span className="text-negative">{toPoint(latestCandle.low).toFixed(2)}</span></span>
                <span>C <span className="text-text-muted">{toPoint(latestCandle.close).toFixed(2)}</span></span>
              </span>
            )}
          </>
        )}
      </div>

      {/* Add to Watchlist btn */}
      <div className="flex items-center border-l border-border-standard h-full px-3 shrink-0">
        <button
          onClick={onToggleWatchlist}
          disabled={watchlistLoading}
          title={inWatchlist ? 'Xóa khỏi danh sách theo dõi' : 'Thêm vào danh sách theo dõi'}
          className={`flex items-center gap-1.5 px-2.5 h-7 rounded text-[11px] font-semibold transition-colors disabled:opacity-50 ${
            inWatchlist
              ? 'text-warning bg-warning/15 hover:bg-warning/25'
              : 'text-text-dim hover:text-accent hover:bg-accent/10'
          }`}
        >
          {watchlistLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill={inWatchlist ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          )}
          <span className="hidden sm:inline">{inWatchlist ? 'Đang theo dõi' : 'Theo dõi'}</span>
        </button>
      </div>

      {/* ĐẶT LỆNH button */}
      <div className="flex items-center border-l border-border-standard h-full px-3 gap-2 shrink-0">
        <button
          onClick={onOpenOrderModal}
          className={`flex items-center gap-1.5 px-3 h-7 rounded text-[11px] font-black tracking-wide transition-all active:scale-95 ${
            orderSide === 'MUA'
              ? 'bg-positive text-white hover:brightness-110'
              : 'bg-negative text-white hover:brightness-110'
          }`}
          style={{ boxShadow: orderSide === 'MUA' ? '0 0 12px color-mix(in srgb, var(--color-positive) 30%, transparent)' : '0 0 12px color-mix(in srgb, var(--color-negative) 30%, transparent)' }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          ĐẶT LỆNH
        </button>
      </div>

      {/* Toggle panel btn */}
      <div className="flex items-center border-l border-border-standard h-full px-3 shrink-0">
        <button
          onClick={onToggleLeftPanel}
          className={`p-1.5 rounded transition-colors ${showLeftPanel ? 'text-accent bg-accent/10' : 'text-text-dim hover:text-text-main hover:bg-white/5'}`}
          title="Ẩn/hiện danh sách mã"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
