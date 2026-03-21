import React, { useState, useEffect, useCallback } from 'react';
import { CandlestickChart } from './charts/CandlestickChart';
import { marketApi } from '../services/api';
import { formatNumberVI, STOCK_PRICE_DISPLAY_SCALE, PRICE_LOCALE, PRICE_FRACTION_OPTIONS } from '../constants';

interface WatchItem {
  symbol: string;
  exchange: string;
}

interface SymbolQuote {
  symbol: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface Props {
  onNavigate: (view: string) => void;
  onOpenTrading?: (symbol: string, exchange: string) => void;
}

const STORAGE_KEY = 'riskguard_watchlist';

const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);

export const WatchlistView: React.FC<Props> = ({ onNavigate, onOpenTrading }) => {
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [quotes, setQuotes] = useState<Record<string, SymbolQuote>>({});
  const [selectedSymbol, setSelectedSymbol] = useState<WatchItem | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [symbolDetail, setSymbolDetail] = useState<any>(null);
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  // Fetch quotes for all watchlist items
  const fetchQuotes = useCallback(async () => {
    for (const item of watchlist) {
      try {
        const res = await marketApi.getPrice(item.symbol, item.exchange ? { exchange: item.exchange } : undefined);
        if (res.data?.success && res.data.data) {
          const d = res.data.data;
          const rawClose = Number(d.closePrice ?? d.lastPrice ?? 0);
          const close = rawClose * STOCK_PRICE_DISPLAY_SCALE;
          const ref = Number(d.referencePrice ?? d.basicPrice ?? 0) * STOCK_PRICE_DISPLAY_SCALE;
          setQuotes((prev) => ({
            ...prev,
            [item.symbol]: {
              symbol: item.symbol,
              exchange: item.exchange,
              price: close,
              change: close - ref,
              changePercent: ref > 0 ? ((close - ref) / ref) * 100 : 0,
              volume: Number(d.totalVolume ?? d.volume ?? 0),
            },
          }));
        }
      } catch { /* ignore */ }
    }
  }, [watchlist]);

  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 30_000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  // Load selected symbol chart
  useEffect(() => {
    if (!selectedSymbol) return;
    setLoadingChart(true);
    setSymbolDetail(null);
    Promise.allSettled([
      marketApi.getOHLCV(selectedSymbol.symbol, { exchange: selectedSymbol.exchange, timeframe: '1d', limit: 90 }),
      marketApi.getSymbolDetail(selectedSymbol.symbol, { exchange: selectedSymbol.exchange }),
    ]).then(([ohlcvRes, detailRes]) => {
      if (ohlcvRes.status === 'fulfilled' && ohlcvRes.value.data.success) {
        const data = ohlcvRes.value.data.data.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleDateString('vi-VN'),
          open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
          high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
          low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
          close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
          volume: parseFloat(item.volume),
        }));
        setChartData(data);
      }
      if (detailRes.status === 'fulfilled' && detailRes.value.data.success) {
        setSymbolDetail(detailRes.value.data.data);
      }
    }).finally(() => setLoadingChart(false));
  }, [selectedSymbol]);

  const addToWatchlist = async () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym) return;
    if (watchlist.find((w) => w.symbol === sym)) {
      setAddError('Mã này đã có trong danh sách');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      const res = await marketApi.getEntryInfo(sym);
      if (res.data?.success && res.data.data) {
        const newItem: WatchItem = { symbol: sym, exchange: res.data.data.exchange || '' };
        setWatchlist((prev) => [...prev, newItem]);
        setAddInput('');
        setSelectedSymbol(newItem);
      } else {
        setAddError('Không tìm thấy mã này');
      }
    } catch {
      setAddError('Không tìm thấy mã này');
    } finally {
      setAdding(false);
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));
    if (selectedSymbol?.symbol === symbol) setSelectedSymbol(null);
  };

  const detail = symbolDetail || {};

  return (
    <div className="flex gap-3 h-[calc(100vh-120px)] animate-fade-in">
      {/* LEFT: Watchlist */}
      <div className="w-72 shrink-0 panel-section flex flex-col">
        <div className="px-3 py-2.5 border-b border-border-subtle shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Danh Sách Theo Dõi</p>
          <div className="flex gap-1.5">
            <input
              value={addInput}
              onChange={(e) => { setAddInput(e.target.value.toUpperCase()); setAddError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && addToWatchlist()}
              placeholder="Thêm mã CK..."
              className="flex-1 bg-panel border border-border-standard rounded px-2 py-1.5 text-[12px] text-text-main placeholder-text-muted outline-none focus:border-accent font-mono"
            />
            <button
              onClick={addToWatchlist}
              disabled={adding || !addInput.trim()}
              className="px-3 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-[11px] font-semibold disabled:opacity-50"
            >
              {adding ? '...' : '+'}
            </button>
          </div>
          {addError && <p className="text-[10px] text-negative mt-1">{addError}</p>}
        </div>

        <div className="flex-1 overflow-y-auto dense-scroll">
          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-dim py-8">
              <svg className="w-8 h-8 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <p className="text-[11px]">Thêm mã CK để theo dõi</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0" style={{ background: 'var(--color-panel)' }}>
                <tr>
                  <th className="text-left px-3 py-2 text-[9px] font-semibold text-text-dim uppercase tracking-wide border-b border-border-subtle">Mã</th>
                  <th className="text-right px-3 py-2 text-[9px] font-semibold text-text-dim uppercase tracking-wide border-b border-border-subtle">Giá</th>
                  <th className="text-right px-3 py-2 text-[9px] font-semibold text-text-dim uppercase tracking-wide border-b border-border-subtle">%</th>
                  <th className="px-2 py-2 border-b border-border-subtle" />
                </tr>
              </thead>
              <tbody>
                {watchlist.map((item) => {
                  const q = quotes[item.symbol];
                  const isSelected = selectedSymbol?.symbol === item.symbol;
                  const chgPct = q?.changePercent ?? 0;
                  return (
                    <tr
                      key={item.symbol}
                      onClick={() => setSelectedSymbol(item)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-accent/10' : 'hover:bg-white/5'}`}
                    >
                      <td className="px-3 py-2">
                        <div className={`text-[12px] font-bold ${isSelected ? 'text-accent' : 'text-text-main'}`}>{item.symbol}</div>
                        <div className="text-[9px] text-text-dim">{item.exchange}</div>
                      </td>
                      <td className={`px-3 py-2 text-right text-[12px] font-mono ${chgPct > 0 ? 'text-positive' : chgPct < 0 ? 'text-negative' : 'text-warning'}`}>
                        {q?.price ? toPoint(q.price).toFixed(2) : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right text-[11px] font-mono ${chgPct > 0 ? 'text-positive' : chgPct < 0 ? 'text-negative' : 'text-text-muted'}`}>
                        {chgPct !== 0 ? (chgPct > 0 ? '+' : '') + chgPct.toFixed(2) + '%' : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromWatchlist(item.symbol); }}
                          className="p-0.5 rounded text-text-dim hover:text-negative transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RIGHT: Detail Panel */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {!selectedSymbol ? (
          <div className="panel-section flex-1 flex items-center justify-center text-text-dim">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
              <p className="text-[13px]">Chọn mã từ danh sách để xem chi tiết</p>
            </div>
          </div>
        ) : (
          <>
            {/* Symbol Header */}
            <div className="panel-section p-4">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-[20px] font-bold text-text-main">{selectedSymbol.symbol}</h2>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-border-standard text-text-muted">{selectedSymbol.exchange}</span>
                  </div>
                  {detail.companyName && <p className="text-[12px] text-text-muted mt-0.5">{detail.companyName}</p>}
                </div>
                {quotes[selectedSymbol.symbol] && (
                  <div className="text-right">
                    <div className={`text-[22px] font-bold font-mono ${(quotes[selectedSymbol.symbol]?.changePercent ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {toPoint(quotes[selectedSymbol.symbol].price).toFixed(2)}
                    </div>
                    <div className={`text-[12px] font-mono ${(quotes[selectedSymbol.symbol]?.changePercent ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {(quotes[selectedSymbol.symbol].changePercent >= 0 ? '▲ +' : '▼ ')}
                      {quotes[selectedSymbol.symbol].changePercent.toFixed(2)}%
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => onOpenTrading?.(selectedSymbol.symbol, selectedSymbol.exchange)}
                    className="px-4 py-2 rounded-md bg-positive text-white font-semibold text-[12px] hover:bg-green-600 transition-colors"
                  >
                    Mở Terminal
                  </button>
                </div>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4 pt-4 border-t border-border-subtle">
                {[
                  { label: 'P/E', val: detail.pe?.toFixed(2) },
                  { label: 'P/B', val: detail.pb?.toFixed(2) },
                  { label: 'ROE', val: detail.roe ? detail.roe.toFixed(2) + '%' : null },
                  { label: 'Beta', val: detail.beta?.toFixed(2) },
                  { label: 'Vốn hóa', val: detail.marketCap ? (detail.marketCap / 1000).toFixed(0) + ' tỷ' : null },
                  { label: 'KL Ngày', val: quotes[selectedSymbol.symbol] ? formatNumberVI(quotes[selectedSymbol.symbol].volume, { maximumFractionDigits: 0 }) : null },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-text-dim mb-0.5">{label}</p>
                    <p className="text-[13px] font-mono font-semibold text-text-main">{val ?? '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="panel-section flex-1 min-h-0" style={{ minHeight: 280 }}>
              <div className="px-4 py-2.5 border-b border-border-subtle">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Biểu Đồ 90 Ngày</span>
              </div>
              <div className="flex-1" style={{ height: 260 }}>
                <CandlestickChart data={chartData} loading={loadingChart} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
