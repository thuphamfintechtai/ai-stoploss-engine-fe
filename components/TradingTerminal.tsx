import React, { useState, useEffect, useCallback } from 'react';
import { CandlestickChart } from './charts/CandlestickChart';
import { marketApi, positionApi } from '../services/api';
import type { CreatePositionRequest } from '../services/api';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_FRACTION_OPTIONS, PRICE_LOCALE, formatNumberVI, formatPricePoints } from '../constants';

const TIMEFRAMES = ['1m', '1h', '1d', '1w', '1M'];

interface MarketCategory {
  code: string;
  label: string;
  group: string;
  color?: string;
}

const MARKET_CATEGORIES: MarketCategory[] = [
  // Chỉ số chính
  { code: 'VNXALL', label: 'VNXALL', group: 'Sàn' },
  { code: 'VN30',   label: 'VN30',   group: 'Sàn' },
  { code: 'VN100',  label: 'VN100',  group: 'Sàn' },
  { code: 'HOSE',   label: 'HOSE',   group: 'Sàn' },
  { code: 'HNX',    label: 'HNX',    group: 'Sàn' },
  { code: 'UPCOM',  label: 'UPCOM',  group: 'Sàn' },
  { code: 'HNX30',  label: 'HNX30',  group: 'Sàn' },
  { code: 'VNX50',  label: 'VNX50',  group: 'Sàn' },
  // Phái sinh
  { code: 'VN30F',  label: 'VN30F',  group: 'PS', color: '#A78BFA' },
  { code: 'VN100F', label: 'VN100F', group: 'PS', color: '#A78BFA' },
  // Cổ phiếu đặc biệt
  { code: 'ETF',    label: 'ETF',    group: 'CK', color: '#38BDF8' },
  { code: 'CW',     label: 'CW',     group: 'CK', color: '#38BDF8' },
];

interface Props {
  portfolioId: string | null;
  initialSymbol?: string;
  initialExchange?: string;
  sidebarWidth: number;
  onOpenPosition?: () => void;
}

const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);

export const TradingTerminal: React.FC<Props> = ({
  portfolioId,
  initialSymbol = 'ACB',
  initialExchange = 'HOSE',
  sidebarWidth,
  onOpenPosition,
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [exchange, setExchange] = useState(initialExchange);
  const [symbolInput, setSymbolInput] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState('1d');

  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [symbolDetail, setSymbolDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [matchingHistory, setMatchingHistory] = useState<any>(null);
  const [orderBook, setOrderBook] = useState<any>(null);
  const [loadingSidebar, setLoadingSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'matching' | 'orderbook' | 'valuation'>('matching');

  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [searchStocks, setSearchStocks] = useState('');
  const [stockList, setStockList] = useState<any[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState('VNXALL');

  // Order entry state
  const [orderSymbol, setOrderSymbol] = useState('');
  const [orderExchange, setOrderExchange] = useState('');
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [useMarketPrice, setUseMarketPrice] = useState(true);
  const [entryPriceInput, setEntryPriceInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [stopType, setStopType] = useState<'FIXED' | 'PERCENT' | 'MAX_LOSS'>('FIXED');
  const [stopPrice, setStopPrice] = useState('');
  const [stopPercent, setStopPercent] = useState('');
  const [stopMaxLossVnd, setStopMaxLossVnd] = useState('');
  const [takeProfitType, setTakeProfitType] = useState<'FIXED' | 'PERCENT' | 'R_RATIO' | ''>('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [takeProfitPercent, setTakeProfitPercent] = useState('');
  const [takeProfitRR, setTakeProfitRR] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Load chart data
  const loadChart = useCallback(async (sym: string, exch: string, tf: string) => {
    if (!sym) return;
    setLoadingChart(true);
    try {
      const res = await marketApi.getOHLCV(sym, { exchange: exch, timeframe: tf, limit: 200 });
      if (res.data.success && Array.isArray(res.data.data)) {
        const data = res.data.data.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleDateString('vi-VN'),
          open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
          high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
          low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
          close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
          volume: parseFloat(item.volume),
        }));
        setChartData(data);
      }
    } catch (e) {
      console.error('Load chart error:', e);
    } finally {
      setLoadingChart(false);
    }
  }, []);

  // Load symbol detail + order book + matching
  const loadSymbolData = useCallback(async (sym: string, exch: string) => {
    if (!sym) return;
    setLoadingDetail(true);
    setLoadingSidebar(true);
    try {
      const [detailRes, matchRes, obRes] = await Promise.allSettled([
        marketApi.getSymbolDetail(sym, { exchange: exch }),
        marketApi.getMatchingHistory(sym, { pageSize: 50 }),
        marketApi.getOrderBook(sym),
      ]);
      if (detailRes.status === 'fulfilled' && detailRes.value.data.success) {
        setSymbolDetail(detailRes.value.data.data);
      }
      if (matchRes.status === 'fulfilled' && matchRes.value.data.success) {
        setMatchingHistory(matchRes.value.data.data);
      }
      if (obRes.status === 'fulfilled' && obRes.value.data.success) {
        setOrderBook(obRes.value.data.data);
      }
    } catch (e) {
      console.error('Load symbol data error:', e);
    } finally {
      setLoadingDetail(false);
      setLoadingSidebar(false);
    }
  }, []);

  // Load stock list for left panel
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoadingStocks(true);
      setStockList([]);
      try {
        const res = await marketApi.getStockDetailByIndex({ indexCodes: [selectedIndex], pageNo: 1, pageSize: 100 });
        if (res.data?.success && Array.isArray(res.data.data)) {
          setStockList(res.data.data);
        }
      } catch {
        // fallback empty
      } finally {
        setLoadingStocks(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  // Initial load
  useEffect(() => {
    loadChart(symbol, exchange, timeframe);
    loadSymbolData(symbol, exchange);
    setOrderSymbol(symbol);
    setOrderExchange(exchange);
  }, []);

  const handleSymbolSelect = (sym: string, exch: string) => {
    setSymbol(sym);
    setExchange(exch);
    setSymbolInput(sym);
    loadChart(sym, exch, timeframe);
    loadSymbolData(sym, exch);
    setOrderSymbol(sym);
    setOrderExchange(exch);
  };

  const handleSymbolSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const sym = symbolInput.trim().toUpperCase();
      if (sym) handleSymbolSelect(sym, '');
    }
  };

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    loadChart(symbol, exchange, tf);
  };

  // Derived price values
  const detail = symbolDetail || {};
  const rawClose = detail.closePrice != null ? Number(detail.closePrice) : null;
  const currentPriceRaw = rawClose != null ? rawClose * STOCK_PRICE_DISPLAY_SCALE : (chartData[chartData.length - 1]?.close ?? 0);
  const priceChangeRaw = (Number(detail.change) || 0) * STOCK_PRICE_DISPLAY_SCALE;
  const priceChangePercent = detail.percentChange ?? 0;
  const currentPrice = toPoint(currentPriceRaw);
  const priceChange = toPoint(priceChangeRaw);
  const isNegative = priceChange < 0;
  const latestCandle = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // Order form helpers
  const fetchOrderEntry = async (sym: string) => {
    if (!sym.trim()) return;
    try {
      const res = await marketApi.getEntryInfo(sym.trim());
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setOrderExchange(d.exchange || '');
        const raw = typeof d.market_price === 'number' ? d.market_price : null;
        const pts = raw != null ? (raw >= 1000 ? raw / 1000 : raw) : null;
        setMarketPrice(pts);
      }
    } catch { /* ignore */ }
  };

  const parseQty = () => {
    const n = parseInt(quantityInput.replace(/\s|,/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const effectiveQty = parseQty();

  const getEntryPoints = () => {
    if (useMarketPrice) {
      const p = marketPrice != null ? (marketPrice >= 1000 ? marketPrice / 1000 : marketPrice) : null;
      return p != null && p > 0 ? p : null;
    }
    const n = parseFloat(entryPriceInput.replace(/,/g, '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const entryPoints = getEntryPoints();

  const handleSubmitOrder = async () => {
    if (!portfolioId) { setOrderMsg({ type: 'err', text: 'Chưa có portfolio.' }); return; }
    if (!orderSymbol) { setOrderMsg({ type: 'err', text: 'Chưa chọn mã CK.' }); return; }
    if (!effectiveQty || effectiveQty <= 0) { setOrderMsg({ type: 'err', text: 'Nhập khối lượng hợp lệ.' }); return; }
    if (!entryPoints || entryPoints <= 0) { setOrderMsg({ type: 'err', text: 'Nhập giá vào hợp lệ.' }); return; }

    const body: CreatePositionRequest = {
      symbol: orderSymbol.trim(),
      exchange: orderExchange,
      use_market_entry: useMarketPrice,
      ...(useMarketPrice ? {} : { entry_price: Math.round(entryPoints * 1000) }),
      use_market_quantity: false,
      quantity: effectiveQty,
      stop_type: stopType,
      stop_params: {},
    };

    if (stopType === 'FIXED') {
      const sp = parseFloat(stopPrice);
      if (isNaN(sp)) { setOrderMsg({ type: 'err', text: 'Nhập giá dừng lỗ.' }); return; }
      body.stop_price = Math.round(sp * 1000);
    } else if (stopType === 'PERCENT') {
      const pct = parseFloat(stopPercent);
      if (isNaN(pct)) { setOrderMsg({ type: 'err', text: 'Nhập % dừng lỗ.' }); return; }
      body.stop_params = { percent: pct };
    } else if (stopType === 'MAX_LOSS') {
      const ml = parseFloat(stopMaxLossVnd);
      if (isNaN(ml) || ml <= 0) { setOrderMsg({ type: 'err', text: 'Nhập mức lỗ tối đa.' }); return; }
      body.stop_params = { max_loss_vnd: ml };
    }

    if (takeProfitType === 'FIXED') {
      const tp = parseFloat(takeProfitPrice);
      if (!isNaN(tp)) { body.take_profit_type = 'FIXED'; body.take_profit_price = Math.round(tp * 1000); }
    } else if (takeProfitType === 'PERCENT') {
      const pct = parseFloat(takeProfitPercent);
      if (!isNaN(pct)) { body.take_profit_type = 'PERCENT'; body.take_profit_params = { percent: pct }; }
    } else if (takeProfitType === 'R_RATIO') {
      const rr = parseFloat(takeProfitRR);
      if (!isNaN(rr) && rr > 0) { body.take_profit_type = 'R_RATIO'; body.take_profit_params = { risk_reward_ratio: rr }; }
    }

    setSubmitting(true);
    setOrderMsg(null);
    try {
      await positionApi.create(portfolioId, body);
      setOrderMsg({ type: 'ok', text: `Đặt lệnh ${orderSymbol} thành công!` });
      onOpenPosition?.();
      setQuantityInput('');
      setStopPrice('');
      setEntryPriceInput('');
    } catch (e: any) {
      setOrderMsg({ type: 'err', text: e?.response?.data?.message || 'Đặt lệnh thất bại.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter stock list
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
    <div className="flex flex-col w-full h-full" style={{ background: 'var(--color-background)' }}>

      {/* ── TOP BAR ── */}
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
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            onKeyDown={handleSymbolSearch}
            placeholder="Nhập mã CK..."
            className="bg-transparent outline-none text-[12px] font-bold text-text-main placeholder-text-dim w-full font-mono tracking-wide"
          />
        </div>

        {/* Timeframe buttons */}
        <div className="flex items-center border-r border-border-standard h-full px-2 gap-0.5 shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
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
            {detail.companyName && (
              <span className="text-[11px] text-text-dim hidden xl:inline truncate max-w-[160px]">{detail.companyName}</span>
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

        {/* Toggle panel btn */}
        <div className="flex items-center border-l border-border-standard h-full px-3 shrink-0">
          <button
            onClick={() => setShowLeftPanel(!showLeftPanel)}
            className={`p-1.5 rounded transition-colors ${showLeftPanel ? 'text-accent bg-accent/10' : 'text-text-dim hover:text-text-main hover:bg-white/5'}`}
            title="Ẩn/hiện danh sách mã"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Symbol list */}
        {showLeftPanel && (
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
                        const activeColor = cat.color ?? '#3B82F6';
                        return (
                          <button
                            key={cat.code}
                            onClick={() => setSelectedIndex(cat.code)}
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
                onChange={(e) => setSearchStocks(e.target.value.toUpperCase())}
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
                      const close = Number(s.closePrice ?? s.lastPrice ?? 0) * STOCK_PRICE_DISPLAY_SCALE;
                      const ref = Number(s.referencePrice ?? s.basicPrice ?? 0) * STOCK_PRICE_DISPLAY_SCALE;
                      const chgPct = s.percentChange ?? s.changePercent ?? 0;
                      const isActive = s.symbol === symbol;
                      return (
                        <tr
                          key={s.symbol}
                          onClick={() => handleSymbolSelect(s.symbol, s.exchange ?? '')}
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
        )}

        {/* CENTER: Chart */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="flex-1 min-h-0">
            <CandlestickChart data={chartData} loading={loadingChart} bgColor="#080D1A" />
          </div>
        </div>

        {/* RIGHT: Matching / Order book / Valuation */}
        <div
          className="flex flex-col border-l border-border-standard shrink-0"
          style={{ width: 265, background: 'var(--color-panel-secondary)' }}
        >
          {/* Tabs */}
          <div className="flex border-b border-border-standard shrink-0">
            {(['matching', 'orderbook', 'valuation'] as const).map((tab) => {
              const labels: Record<string, string> = { matching: 'Khớp lệnh', orderbook: 'Bước giá', valuation: 'Định giá' };
              return (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-2.5 text-[10px] font-semibold tracking-wide transition-colors relative ${
                    sidebarTab === tab
                      ? 'text-accent'
                      : 'text-text-dim hover:text-text-muted'
                  }`}
                >
                  {labels[tab]}
                  {sidebarTab === tab && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto dense-scroll">
            {/* Matching history */}
            {sidebarTab === 'matching' && (
              <>
                {matchingHistory && (
                  <div className="grid grid-cols-3 border-b border-border-subtle">
                    <div className="px-2 py-2 border-r border-border-subtle">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-text-dim">KL</p>
                      <p className="text-[10px] font-mono text-text-muted mt-0.5">{formatNumberVI(matchingHistory.totalTradingVolume ?? matchingHistory.data?.totalTradingVolume ?? 0, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="px-2 py-2 border-r border-border-subtle">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-text-dim">M+</p>
                      <p className="text-[10px] font-mono text-positive mt-0.5">{formatNumberVI(matchingHistory.buyUpVolume ?? matchingHistory.data?.buyUpVolume ?? 0, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="px-2 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-text-dim">B-</p>
                      <p className="text-[10px] font-mono text-negative mt-0.5">{formatNumberVI(matchingHistory.sellDownVolume ?? matchingHistory.data?.sellDownVolume ?? 0, { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                )}
                {loadingSidebar ? (
                  <div className="text-center py-6 text-text-dim text-[10px] animate-pulse">Đang tải...</div>
                ) : (
                  <table className="table-terminal w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Giá</th>
                        <th>KL</th>
                        <th>Giờ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(matchingHistory?.arrayList ?? matchingHistory?.data?.arrayList ?? []).slice(0, 60).map((t: any, i: number) => {
                        const price = Number(t.matchPrice ?? t.price ?? 0);
                        const vol = Number(t.tradingVolume ?? t.volume ?? 0);
                        const side = t.style ?? t.side ?? '';
                        return (
                          <tr key={i}>
                            <td className={`text-left font-mono ${side === 'B' ? 'text-positive' : side === 'S' ? 'text-negative' : 'text-warning'}`}>
                              {(price * STOCK_PRICE_DISPLAY_SCALE) > 0 ? toPoint(price * STOCK_PRICE_DISPLAY_SCALE).toFixed(2) : '—'}
                            </td>
                            <td className="text-text-muted">{vol > 0 ? (vol / 100).toFixed(1) : '—'}</td>
                            <td className="text-text-dim">{String(t.time ?? t.matchTime ?? '').substring(0, 5)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* Order book */}
            {sidebarTab === 'orderbook' && (
              <>
                {loadingSidebar ? (
                  <div className="text-center py-6 text-text-dim text-[10px] animate-pulse">Đang tải...</div>
                ) : (orderBook?.priceStatistic ?? orderBook?.data?.priceStatistic)?.length > 0 ? (
                  <table className="table-terminal w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Giá</th>
                        <th className="text-positive">Mua</th>
                        <th className="text-negative">Bán</th>
                        <th>Tổng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orderBook?.priceStatistic ?? orderBook?.data?.priceStatistic ?? []).map((step: any, i: number) => {
                        const stepPrice = Number(step.priceStep ?? step.price ?? 0);
                        const buyVol = Number(step.buyUpVolume ?? step.buyVolume ?? 0);
                        const sellVol = Number(step.sellDownVolume ?? step.sellVolume ?? 0);
                        const totalVol = Number(step.stepVolume ?? step.totalVolume ?? 0);
                        return (
                          <tr key={i}>
                            <td className="text-left text-warning font-mono">{toPoint(stepPrice * STOCK_PRICE_DISPLAY_SCALE).toFixed(2)}</td>
                            <td className="text-positive">{buyVol ? (buyVol / 100).toFixed(1) : '–'}</td>
                            <td className="text-negative">{sellVol ? (sellVol / 100).toFixed(1) : '–'}</td>
                            <td className="text-text-muted">{totalVol ? (totalVol / 100).toFixed(1) : '–'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-text-dim text-[11px]">Chưa có dữ liệu</div>
                )}
              </>
            )}

            {/* Valuation */}
            {sidebarTab === 'valuation' && (
              <div className="divide-y divide-border-subtle/50">
                {[
                  { label: 'P/E', val: detail.pe?.toFixed(2) },
                  { label: 'P/B', val: detail.pb?.toFixed(2) },
                  { label: 'EPS', val: detail.eps != null ? formatNumberVI(Number(detail.eps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : null },
                  { label: 'ROE', val: detail.roe ? detail.roe.toFixed(2) + '%' : null, positive: true },
                  { label: 'ROA', val: detail.roa ? detail.roa.toFixed(2) + '%' : null, positive: true },
                  { label: 'Beta', val: detail.beta?.toFixed(2) },
                  { label: 'Vốn hóa', val: detail.marketCap ? (detail.marketCap / 1000).toFixed(0) + ' tỷ' : null },
                  { label: '1 tuần', val: detail.raw?.stockPercentChange1w ? detail.raw.stockPercentChange1w.toFixed(2) + '%' : null, pct: detail.raw?.stockPercentChange1w },
                  { label: '1 tháng', val: detail.raw?.stockPercentChange1m ? detail.raw.stockPercentChange1m.toFixed(2) + '%' : null, pct: detail.raw?.stockPercentChange1m },
                  { label: '3 tháng', val: detail.raw?.stockPercentChange3m ? detail.raw.stockPercentChange3m.toFixed(2) + '%' : null, pct: detail.raw?.stockPercentChange3m },
                ].map(({ label, val, positive, pct }) => (
                  <div key={label} className="flex justify-between items-center px-3 py-2 text-[11px]">
                    <span className="text-text-dim">{label}</span>
                    <span className={`font-mono font-medium ${pct != null ? (pct >= 0 ? 'text-positive' : 'text-negative') : positive ? 'text-positive' : 'text-text-main'}`}>
                      {val ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ORDER ENTRY PANEL ── */}
      <div
        className="shrink-0 border-t border-border-standard"
        style={{ background: 'var(--color-panel-secondary)' }}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">

          {/* Symbol */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold uppercase tracking-widest text-text-dim mb-1">Mã CK</span>
              <div className="flex items-center gap-1.5">
                <input
                  value={orderSymbol}
                  onChange={(e) => setOrderSymbol(e.target.value.toUpperCase())}
                  onBlur={() => fetchOrderEntry(orderSymbol)}
                  placeholder="ACB"
                  className="bg-background border border-border-standard rounded px-2 h-8 w-20 text-[12px] font-bold text-text-main font-mono outline-none focus:border-accent"
                />
                <span className="text-[10px] text-text-dim font-mono bg-background/50 border border-border-subtle rounded px-1.5 h-8 flex items-center">{orderExchange || 'HOSE'}</span>
              </div>
            </div>
          </div>

          <div className="w-px h-10 bg-border-standard shrink-0" />

          {/* Entry price */}
          <div className="flex flex-col shrink-0">
            <span className="text-[8px] font-bold uppercase tracking-widest text-text-dim mb-1">Giá vào</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setUseMarketPrice(true)} className={`h-8 px-2.5 rounded text-[10px] font-bold transition-colors ${useMarketPrice ? 'bg-accent text-white' : 'bg-background border border-border-standard text-text-dim hover:text-text-muted'}`}>Sàn</button>
              <button onClick={() => setUseMarketPrice(false)} className={`h-8 px-2.5 rounded text-[10px] font-bold transition-colors ${!useMarketPrice ? 'bg-accent text-white' : 'bg-background border border-border-standard text-text-dim hover:text-text-muted'}`}>Giá</button>
              {!useMarketPrice ? (
                <input value={entryPriceInput} onChange={(e) => setEntryPriceInput(e.target.value)} placeholder="23.50" className="bg-background border border-border-standard rounded px-2 h-8 w-20 text-[11px] font-mono text-text-main outline-none focus:border-accent" />
              ) : marketPrice != null ? (
                <span className="text-[11px] font-mono text-accent font-bold px-2">{(marketPrice >= 1000 ? marketPrice / 1000 : marketPrice).toFixed(2)}</span>
              ) : null}
            </div>
          </div>

          <div className="w-px h-10 bg-border-standard shrink-0" />

          {/* Quantity */}
          <div className="flex flex-col shrink-0">
            <span className="text-[8px] font-bold uppercase tracking-widest text-text-dim mb-1">KL (CP)</span>
            <input value={quantityInput} onChange={(e) => setQuantityInput(e.target.value.replace(/[^\d]/g, ''))} placeholder="1000" className="bg-background border border-border-standard rounded px-2 h-8 w-24 text-[12px] font-mono text-text-main outline-none focus:border-accent" />
          </div>

          <div className="w-px h-10 bg-border-standard shrink-0" />

          {/* Stop loss */}
          <div className="flex flex-col shrink-0">
            <span className="text-[8px] font-bold uppercase tracking-widest text-text-dim mb-1">Dừng lỗ</span>
            <div className="flex items-center gap-1">
              {(['FIXED', 'PERCENT', 'MAX_LOSS'] as const).map((t) => (
                <button key={t} onClick={() => setStopType(t)} className={`h-8 px-2.5 rounded text-[10px] font-bold transition-colors ${stopType === t ? 'bg-negative/80 text-white' : 'bg-background border border-border-standard text-text-dim hover:text-text-muted'}`}>
                  {t === 'FIXED' ? 'Giá' : t === 'PERCENT' ? '%' : 'VND'}
                </button>
              ))}
              {stopType === 'FIXED' && <input value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder="SL giá" className="bg-background border border-negative/40 rounded px-2 h-8 w-20 text-[11px] font-mono text-negative outline-none focus:border-negative" />}
              {stopType === 'PERCENT' && <input value={stopPercent} onChange={(e) => setStopPercent(e.target.value)} placeholder="SL %" className="bg-background border border-negative/40 rounded px-2 h-8 w-16 text-[11px] font-mono text-negative outline-none focus:border-negative" />}
              {stopType === 'MAX_LOSS' && <input value={stopMaxLossVnd} onChange={(e) => setStopMaxLossVnd(e.target.value)} placeholder="Max VND" className="bg-background border border-negative/40 rounded px-2 h-8 w-24 text-[11px] font-mono text-negative outline-none focus:border-negative" />}
            </div>
          </div>

          <div className="w-px h-10 bg-border-standard shrink-0" />

          {/* Take profit */}
          <div className="flex flex-col shrink-0">
            <span className="text-[8px] font-bold uppercase tracking-widest text-text-dim mb-1">Chốt lời</span>
            <div className="flex items-center gap-1">
              {(['' , 'FIXED', 'PERCENT', 'R_RATIO'] as const).map((t) => (
                <button key={t} onClick={() => setTakeProfitType(t)} className={`h-8 px-2.5 rounded text-[10px] font-bold transition-colors ${takeProfitType === t ? 'bg-positive/80 text-white' : 'bg-background border border-border-standard text-text-dim hover:text-text-muted'}`}>
                  {t === '' ? '–' : t === 'FIXED' ? 'Giá' : t === 'PERCENT' ? '%' : 'R:R'}
                </button>
              ))}
              {takeProfitType === 'FIXED' && <input value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} placeholder="TP giá" className="bg-background border border-positive/40 rounded px-2 h-8 w-20 text-[11px] font-mono text-positive outline-none focus:border-positive" />}
              {takeProfitType === 'PERCENT' && <input value={takeProfitPercent} onChange={(e) => setTakeProfitPercent(e.target.value)} placeholder="TP %" className="bg-background border border-positive/40 rounded px-2 h-8 w-16 text-[11px] font-mono text-positive outline-none focus:border-positive" />}
              {takeProfitType === 'R_RATIO' && <input value={takeProfitRR} onChange={(e) => setTakeProfitRR(e.target.value)} placeholder="2.0" className="bg-background border border-positive/40 rounded px-2 h-8 w-16 text-[11px] font-mono text-positive outline-none focus:border-positive" />}
            </div>
          </div>

          {/* Thành tiền */}
          {entryPoints && effectiveQty && (
            <>
              <div className="w-px h-10 bg-border-standard shrink-0" />
              <div className="flex flex-col shrink-0">
                <span className="text-[8px] font-bold uppercase tracking-widest text-text-dim mb-1">Thành tiền</span>
                <span className="text-[12px] font-mono font-bold text-text-main h-8 flex items-center">
                  {formatNumberVI(Math.round(entryPoints * 1000 * effectiveQty))} ₫
                </span>
              </div>
            </>
          )}

          {/* Submit */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {orderMsg && (
              <span className={`text-[10px] font-medium ${orderMsg.type === 'ok' ? 'text-positive' : 'text-negative'}`}>
                {orderMsg.text}
              </span>
            )}
            <button
              onClick={handleSubmitOrder}
              disabled={submitting || !portfolioId}
              className="h-10 px-8 rounded font-bold text-[12px] tracking-wide transition-all bg-positive text-white hover:bg-green-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
              style={{ boxShadow: '0 0 20px rgba(34,197,94,0.25)' }}
            >
              {submitting ? 'ĐANG ĐẶT...' : 'ĐẶT LỆNH MUA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
