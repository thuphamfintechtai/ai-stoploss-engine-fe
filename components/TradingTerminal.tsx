import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CandlestickChart } from './charts/CandlestickChart';
import { marketApi, positionApi, orderApi, watchlistApi, aiApi } from '../services/api';
import type { Position } from '../services/api';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_FRACTION_OPTIONS, PRICE_LOCALE, formatNumberVI, formatPricePoints } from '../constants';
import {
  getPriceStep, snapToTickSize, stepPriceUp, stepPriceDown,
  getLotSize, isOddLotQty, getCurrentSession, getAvailableOrderTypes,
  canSubmitOrder, ORDER_TYPE_INFO, validateLOPrice,
  type Exchange, type OrderTypeCode,
} from '../utils/vnStockRules';

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
  initialStopLoss?: number;   // VND
  initialTakeProfit?: number; // VND
  initialSide?: 'LONG' | 'SHORT';
  sidebarWidth: number;
  onOpenPosition?: () => void;
  openPositions?: Position[]; // Các vị thế đang mở (để kiểm tra holdings khi BÁN)
}

const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);

export const TradingTerminal: React.FC<Props> = ({
  portfolioId,
  initialSymbol = 'ACB',
  initialExchange = 'HOSE',
  initialStopLoss,
  initialTakeProfit,
  initialSide,
  sidebarWidth,
  onOpenPosition,
  openPositions = [],
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
  const [showOrderModal, setShowOrderModal] = useState(false);

  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [searchStocks, setSearchStocks] = useState('');
  const [stockList, setStockList] = useState<any[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState('VNXALL');

  // Order entry state
  const [orderSymbol, setOrderSymbol] = useState('');
  const [orderExchange, setOrderExchange] = useState('');
  const [orderSide, setOrderSide] = useState<'MUA' | 'BAN'>('MUA');
  const [orderType, setOrderType] = useState<OrderTypeCode>('LO');
  const [isOddLotOrder, setIsOddLotOrder] = useState(false);
  const [tradingSession, setTradingSession] = useState(() => getCurrentSession(initialExchange || 'HOSE'));
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
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
  const [apiWarnings, setApiWarnings] = useState<string[]>([]);
  // ID của vị thế đang chọn để đóng (khi BÁN)
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

  // AI Suggest SL/TP
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [aiSuggestError, setAiSuggestError] = useState('');
  const [selectedSuggType, setSelectedSuggType] = useState<'aggressive' | 'moderate' | 'conservative'>('moderate');

  // AI Risk Evaluation (live, khi user điền form)
  const [riskEval, setRiskEval] = useState<any>(null);
  const [riskEvalLoading, setRiskEvalLoading] = useState(false);
  const riskEvalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived order values — declared early so useEffect can reference them
  const parseQty = () => {
    const n = parseInt(quantityInput.replace(/\s|,/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const effectiveQty = parseQty();

  const isMarketEntry = orderType !== 'LO' && ORDER_TYPE_INFO[orderType]?.requiresPrice === false; // ATO/ATC/MP dùng giá thị trường
  const getEntryPoints = () => {
    if (isMarketEntry) {
      const p = marketPrice != null ? (marketPrice >= 1000 ? marketPrice / 1000 : marketPrice) : null;
      return p != null && p > 0 ? p : null;
    }
    const n = parseFloat(entryPriceInput.replace(/,/g, '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const entryPoints = getEntryPoints();

  // AI Suggest SL/TP handler
  const handleAiSuggest = useCallback(async () => {
    const sym = orderSymbol || symbol;
    if (!sym) return;
    setAiSuggesting(true);
    setAiSuggestions(null);
    setAiSuggestError('');
    try {
      const entryPts = entryPoints;
      const res = await aiApi.suggestSLTP({
        symbol: sym,
        exchange: orderExchange || exchange || 'HOSE',
        current_price: entryPts != null ? Math.round(entryPts * 1000) : (marketPrice != null ? Math.round(marketPrice * (marketPrice >= 1000 ? 1 : 1000)) : undefined),
        rr_ratio: 2,
        side: orderSide === 'BAN' ? 'SHORT' : 'LONG',
      });
      if (res.data?.success) {
        setAiSuggestions(res.data.data);
        setSelectedSuggType(res.data.data.recommended ?? 'moderate');
      } else {
        setAiSuggestError(res.data?.message || 'AI không trả về gợi ý');
      }
    } catch (e: any) {
      setAiSuggestError(e?.response?.data?.message || 'Lỗi khi gọi AI. Thử lại sau.');
    } finally {
      setAiSuggesting(false);
    }
  }, [orderSymbol, symbol, orderExchange, exchange, marketPrice, orderSide, entryPoints]);

  const applyAiSuggestion = useCallback((type: 'aggressive' | 'moderate' | 'conservative') => {
    if (!aiSuggestions?.suggestions) return;
    const s = aiSuggestions.suggestions.find((x: any) => x.type === type);
    if (!s) return;
    const slVnd = s.stop_loss_vnd ?? s.stop_loss; // compat cả field cũ và mới
    const tpVnd = s.take_profit_vnd ?? s.take_profit;
    setStopType('FIXED');
    if (slVnd) setStopPrice(String((slVnd / 1000).toFixed(2)));
    if (tpVnd) { setTakeProfitType('FIXED'); setTakeProfitPrice(String((tpVnd / 1000).toFixed(2))); }
    setSelectedSuggType(type);
  }, [aiSuggestions]);

  // Auto risk evaluation khi form đủ dữ liệu: entry + stopLoss + qty + portfolioId
  useEffect(() => {
    if (riskEvalTimerRef.current) clearTimeout(riskEvalTimerRef.current);

    const sym = orderSymbol || symbol;
    const entryVnd = entryPoints != null ? Math.round(entryPoints * 1000) : null;
    const qty = effectiveQty;

    // Tính slVnd từ nhiều stop type khác nhau
    let slVnd: number | null = null;
    if (stopType === 'FIXED') {
      const spRaw = parseFloat(stopPrice);
      if (!isNaN(spRaw) && spRaw > 0) slVnd = Math.round(spRaw * 1000);
    } else if (stopType === 'PERCENT' && entryVnd != null) {
      const pct = parseFloat(stopPercent);
      if (!isNaN(pct) && pct > 0) {
        slVnd = orderSide === 'BAN'
          ? Math.round(entryVnd * (1 + pct / 100))
          : Math.round(entryVnd * (1 - pct / 100));
      }
    } else if (stopType === 'MAX_LOSS' && entryVnd != null && qty != null) {
      const ml = parseFloat(stopMaxLossVnd);
      if (!isNaN(ml) && ml > 0 && qty > 0) {
        slVnd = orderSide === 'BAN'
          ? Math.round(entryVnd + ml / qty)
          : Math.round(entryVnd - ml / qty);
      }
    }

    // Tính tpVnd từ nhiều TP type
    let tpVnd: number | undefined;
    if (takeProfitType === 'FIXED') {
      const tpRaw = parseFloat(takeProfitPrice);
      if (!isNaN(tpRaw) && tpRaw > 0) tpVnd = Math.round(tpRaw * 1000);
    } else if (takeProfitType === 'PERCENT' && entryVnd != null) {
      const pct = parseFloat(takeProfitPercent);
      if (!isNaN(pct) && pct > 0) {
        tpVnd = orderSide === 'BAN'
          ? Math.round(entryVnd * (1 - pct / 100))
          : Math.round(entryVnd * (1 + pct / 100));
      }
    } else if (takeProfitType === 'R_RATIO' && entryVnd != null && slVnd != null) {
      const rr = parseFloat(takeProfitRR);
      if (!isNaN(rr) && rr > 0) {
        const risk = Math.abs(entryVnd - slVnd);
        tpVnd = orderSide === 'BAN'
          ? Math.round(entryVnd - risk * rr)
          : Math.round(entryVnd + risk * rr);
      }
    }

    // Validate direction: LONG → SL < Entry, SHORT → SL > Entry
    const directionOk = slVnd != null && entryVnd != null && (
      orderSide === 'BAN' ? slVnd > entryVnd : slVnd < entryVnd
    );

    if (!portfolioId || !sym || !entryVnd || !slVnd || !qty || !directionOk) {
      setRiskEval(null);
      return;
    }

    // Debounce 800ms để tránh spam API
    riskEvalTimerRef.current = setTimeout(async () => {
      setRiskEvalLoading(true);
      try {
        const res = await aiApi.evaluateRisk({
          symbol: sym,
          exchange: orderExchange || exchange || 'HOSE',
          portfolio_id: portfolioId,
          entry_price: entryVnd,
          stop_loss: slVnd!,
          take_profit: tpVnd,
          quantity: qty,
        });
        if (res.data?.success) setRiskEval(res.data.data);
      } catch { /* silent – risk eval là optional */ } finally {
        setRiskEvalLoading(false);
      }
    }, 800);

    return () => { if (riskEvalTimerRef.current) clearTimeout(riskEvalTimerRef.current); };
  }, [portfolioId, orderSymbol, symbol, orderExchange, exchange, entryPoints, orderSide,
      stopType, stopPrice, stopPercent, stopMaxLossVnd,
      takeProfitType, takeProfitPrice, takeProfitPercent, takeProfitRR, effectiveQty]);

  // Load chart data
  const loadChart = useCallback(async (sym: string, exch: string, tf: string) => {
    if (!sym) return;
    setLoadingChart(true);
    try {
      const res = await marketApi.getOHLCV(sym, { exchange: exch, timeframe: tf, limit: 200 });
      if (res.data.success && Array.isArray(res.data.data)) {
        const isIntraday = tf === '1m' || tf === '5m' || tf === '15m' || tf === '30m' || tf === '1h';
        const data = res.data.data.map((item: any) => ({
          // lightweight-charts: intraday cần Unix seconds (number), daily cần 'yyyy-mm-dd' string
          time: isIntraday
            ? Math.floor(new Date(item.timestamp).getTime() / 1000)
            : new Date(item.timestamp).toISOString().slice(0, 10),
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
      const effExch = (exch || 'HOSE').toUpperCase();
      const [detailRes, matchRes, obRes, quoteRes] = await Promise.allSettled([
        marketApi.getSymbolDetail(sym, { exchange: exch }),
        marketApi.getMatchingHistory(sym, { pageSize: 50 }),
        marketApi.getOrderBook(sym),
        // Lấy bid/ask thời gian thực từ stockDetailByIndex (stockAdvancedInfo không trả về bid/ask)
        marketApi.getStockDetailByIndex({ indexCodes: [effExch], pageNo: 1, pageSize: 2000 }),
      ]);

      let mergedDetail: any = null;
      if (detailRes.status === 'fulfilled' && detailRes.value.data.success) {
        mergedDetail = { ...detailRes.value.data.data };
      }

      // Merge bid/ask thực từ stockDetailByIndex
      if (quoteRes.status === 'fulfilled' && quoteRes.value.data.success) {
        const stockItem = (quoteRes.value.data.data || []).find(
          (s: any) => (s.symbol || '').toUpperCase() === sym.toUpperCase()
        );
        if (stockItem) {
          if (mergedDetail == null) mergedDetail = {};
          // Ghi đè bid/ask nếu từ stockDetailByIndex có dữ liệu
          if (stockItem.gia1 != null) mergedDetail.gia1 = stockItem.gia1;
          if (stockItem.kl1 != null) mergedDetail.kl1 = stockItem.kl1;
          if (stockItem.gia2 != null) mergedDetail.gia2 = stockItem.gia2;
          if (stockItem.kl2 != null) mergedDetail.kl2 = stockItem.kl2;
          if (stockItem.gia3 != null) mergedDetail.gia3 = stockItem.gia3;
          if (stockItem.kl3 != null) mergedDetail.kl3 = stockItem.kl3;
          if (stockItem.askPrice1 != null) mergedDetail.askPrice1 = stockItem.askPrice1;
          if (stockItem.askVol1 != null) mergedDetail.askVol1 = stockItem.askVol1;
          if (stockItem.askPrice2 != null) mergedDetail.askPrice2 = stockItem.askPrice2;
          if (stockItem.askVol2 != null) mergedDetail.askVol2 = stockItem.askVol2;
          if (stockItem.askPrice3 != null) mergedDetail.askPrice3 = stockItem.askPrice3;
          if (stockItem.askVol3 != null) mergedDetail.askVol3 = stockItem.askVol3;
          // Cũng cập nhật matchPrice nếu thiếu closePrice
          if (mergedDetail.closePrice == null && stockItem.matchPrice != null) mergedDetail.closePrice = stockItem.matchPrice;
          // TC/Trần/Sàn
          if (mergedDetail.reference == null && stockItem.tc != null) mergedDetail.reference = stockItem.tc;
          if (mergedDetail.ceiling == null && stockItem.tran != null) mergedDetail.ceiling = stockItem.tran;
          if (mergedDetail.floor == null && stockItem.san != null) mergedDetail.floor = stockItem.san;
        }
      }

      if (mergedDetail) setSymbolDetail(mergedDetail);
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
        let res;
        if (selectedIndex === 'ETF') {
          res = await marketApi.getStockEFDetail({ pageSize: 500 });
        } else if (selectedIndex === 'CW') {
          res = await marketApi.getStockCWDetail({ pageSize: 500 });
        } else {
          res = await marketApi.getStockDetailByIndex({ indexCodes: [selectedIndex], pageNo: 1, pageSize: 200 });
        }
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

  // Auto-detect lệnh rỗ: khi qty nhập < 1 lô thì tự động là lệnh rỗ
  useEffect(() => {
    const qty = parseInt(quantityInput.replace(/\s|,/g, ''), 10);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const exch = (orderExchange || exchange || 'HOSE') as Exchange;
    const lot = getLotSize(exch);
    setIsOddLotOrder(lot > 1 && qty < lot);
  }, [quantityInput, orderExchange, exchange]);

  // Initial load
  useEffect(() => {
    loadChart(symbol, exchange, timeframe);
    loadSymbolData(symbol, exchange);
    setOrderSymbol(symbol);
    setOrderExchange(exchange);
    // Áp dụng giá trị khởi tạo từ WatchlistView nếu có
    if (initialSide) setOrderSide(initialSide === 'SHORT' ? 'BAN' : 'MUA');
    if (initialStopLoss != null && initialStopLoss > 0) {
      setStopType('FIXED');
      setStopPrice((initialStopLoss >= 1000 ? initialStopLoss / 1000 : initialStopLoss).toFixed(2));
    }
    if (initialTakeProfit != null && initialTakeProfit > 0) {
      setTakeProfitType('FIXED');
      setTakeProfitPrice((initialTakeProfit >= 1000 ? initialTakeProfit / 1000 : initialTakeProfit).toFixed(2));
    }
  }, []);

  // Cập nhật phiên giao dịch theo giờ thực
  useEffect(() => {
    const tick = () => setTradingSession(getCurrentSession((orderExchange || exchange || 'HOSE') as Exchange));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [orderExchange, exchange]);

  // Auto-refresh symbolDetail khi modal mở (để bid/ask cập nhật real-time)
  useEffect(() => {
    if (!showOrderModal) return;
    const sym = orderSymbol || symbol;
    const exch = orderExchange || exchange;
    if (!sym) return;
    const refresh = () => loadSymbolData(sym, exch);
    const id = setInterval(refresh, 10_000); // 10 giây
    return () => clearInterval(id);
  }, [showOrderModal, orderSymbol, symbol, orderExchange, exchange, loadSymbolData]);

  // Kiểm tra symbol có trong watchlist không
  const checkWatchlist = useCallback(async (sym: string) => {
    try {
      const res = await watchlistApi.getAll();
      if (res.data?.success) {
        const found = (res.data.data || []).some((i: any) => i.symbol === sym);
        setInWatchlist(found);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { checkWatchlist(symbol); }, [symbol]);

  const toggleWatchlist = async () => {
    if (watchlistLoading) return;
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        await watchlistApi.remove(symbol);
        setInWatchlist(false);
      } else {
        await watchlistApi.add(symbol, exchange || 'HOSE');
        setInWatchlist(true);
      }
    } catch { /* ignore */ }
    finally { setWatchlistLoading(false); }
  };

  const handleSymbolSelect = (sym: string, exch: string) => {
    setSymbol(sym);
    setExchange(exch);
    setSymbolInput(sym);
    loadChart(sym, exch, timeframe);
    loadSymbolData(sym, exch);
    setOrderSymbol(sym);
    setOrderExchange(exch);
    setMarketPrice(null); // reset giá cũ trước khi fetch mới
    fetchOrderEntry(sym);
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

  // Giá Trần/Cơ sở/Sàn từ symbolDetail
  const refPriceRaw = detail.reference ?? detail.referencePrice ?? detail.basicPrice;
  const ceilPriceRaw = detail.ceiling ?? detail.ceilingPrice;
  const floorPriceRaw = detail.floor ?? detail.floorPrice;
  const refPrice = refPriceRaw != null ? toPoint(Number(refPriceRaw) * STOCK_PRICE_DISPLAY_SCALE) : null;
  const ceilPrice = ceilPriceRaw != null ? toPoint(Number(ceilPriceRaw) * STOCK_PRICE_DISPLAY_SCALE) : null;
  const floorPrice = floorPriceRaw != null ? toPoint(Number(floorPriceRaw) * STOCK_PRICE_DISPLAY_SCALE) : null;

  // Cảnh báo khối lượng (lô = 100 CP cho HOSE/HNX)
  const currExch = (orderExchange || exchange || 'HOSE') as Exchange;
  const lotSize = getLotSize(currExch);
  const qtyLotWarning = effectiveQty != null && !isOddLotOrder && isOddLotQty(effectiveQty, currExch)
    ? `Khối lượng nên là bội số của ${lotSize} (1 lô = ${lotSize} CP)` : null;

  // Loại lệnh hợp lệ theo phiên + sàn
  const availableOrderTypes = getAvailableOrderTypes(currExch, tradingSession, isOddLotOrder);
  // Reset orderType nếu không còn hợp lệ
  const effectiveOrderType: OrderTypeCode = availableOrderTypes.includes(orderType) ? orderType : (availableOrderTypes[0] ?? 'LO');

  // Holdings cho mã CK hiện tại (vị thế LONG đang mở — để kiểm tra khi BÁN)
  const symbolHoldings = openPositions.filter(
    (p) => p.symbol?.toUpperCase() === (orderSymbol || symbol).toUpperCase()
      && (p.side ?? 'LONG').toUpperCase() === 'LONG'
      && p.status === 'OPEN'
  );
  const totalHeldQty = symbolHoldings.reduce((s, p) => s + Number(p.quantity ?? 0), 0);
  const selectedHolding = symbolHoldings.find((p) => p.id === selectedPositionId) ?? symbolHoldings[0] ?? null;

  // Auto-select vị thế đầu tiên khi chuyển sang BÁN hoặc đổi symbol
  useEffect(() => {
    if (orderSide === 'BAN' && symbolHoldings.length > 0) {
      setSelectedPositionId(symbolHoldings[0].id);
      // Auto-fill qty = số lượng của vị thế được chọn
      setQuantityInput(String(Number(symbolHoldings[0].quantity ?? 0)));
    }
    if (orderSide === 'MUA') {
      setSelectedPositionId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSide, orderSymbol]);

  const handleSubmitOrder = async () => {
    if (!portfolioId) { setOrderMsg({ type: 'err', text: 'Chưa có portfolio.' }); return; }
    if (!orderSymbol) { setOrderMsg({ type: 'err', text: 'Chưa chọn mã CK.' }); return; }

    // ── BÁN: đóng vị thế đang chọn ──
    if (orderSide === 'BAN') {
      if (!selectedHolding) {
        setOrderMsg({ type: 'err', text: `Không có vị thế MUA nào cho ${orderSymbol} đang mở.` });
        return;
      }
      if (!effectiveQty || effectiveQty <= 0) { setOrderMsg({ type: 'err', text: 'Nhập khối lượng bán.' }); return; }
      const holdingQty = Number(selectedHolding.quantity ?? 0);
      if (effectiveQty > holdingQty) {
        setOrderMsg({ type: 'err', text: `Số CP bán (${effectiveQty}) vượt số đang nắm (${holdingQty}).` }); return;
      }
      // Giá bán: LO cần nhập giá, market orders thì để server dùng giá thị trường
      const closedPriceVnd = isMarketEntry ? undefined : (entryPoints != null ? Math.round(entryPoints * 1000) : undefined);
      if (!isMarketEntry && !closedPriceVnd) { setOrderMsg({ type: 'err', text: 'Nhập giá bán hợp lệ.' }); return; }
      setSubmitting(true); setOrderMsg(null);
      try {
        await positionApi.close(portfolioId, selectedHolding.id, {
          reason: 'CLOSED_MANUAL',
          use_market_price: isMarketEntry,
          ...(closedPriceVnd ? { closed_price: closedPriceVnd } : {}),
        } as any);
        setOrderMsg({ type: 'ok', text: `Đã bán ${effectiveQty} CP ${orderSymbol} thành công!` });
        onOpenPosition?.();
      } catch (e: any) {
        setOrderMsg({ type: 'err', text: e?.response?.data?.message || 'Đặt lệnh bán thất bại.' });
      } finally { setSubmitting(false); }
      return;
    }

    // ── MUA: đặt lệnh qua order API ──
    if (!effectiveQty || effectiveQty <= 0) { setOrderMsg({ type: 'err', text: 'Nhập khối lượng hợp lệ.' }); return; }
    if (effectiveOrderType === 'LO' && (!entryPoints || entryPoints <= 0)) {
      setOrderMsg({ type: 'err', text: 'Nhập giá vào hợp lệ cho lệnh LO.' }); return;
    }

    const entryVnd = entryPoints != null ? Math.round(entryPoints * 1000) : 0;

    // Validate Stop Loss direction (client-side, BE cũng validate)
    if (stopType === 'FIXED') {
      const sl = parseFloat(stopPrice);
      if (isNaN(sl) || sl <= 0) { setOrderMsg({ type: 'err', text: 'Nhập giá dừng lỗ hợp lệ.' }); return; }
      const slVnd = Math.round(sl * 1000);
      if (entryVnd > 0 && slVnd >= entryVnd) {
        setOrderMsg({ type: 'err', text: `Dừng lỗ (${sl.toFixed(2)}) phải thấp hơn giá vào (${entryPoints!.toFixed(2)}) khi MUA.` }); return;
      }
    }
    if (takeProfitType === 'FIXED') {
      const tp = parseFloat(takeProfitPrice);
      if (!isNaN(tp) && tp > 0 && entryVnd > 0 && Math.round(tp * 1000) <= entryVnd) {
        setOrderMsg({ type: 'err', text: `Chốt lời (${tp.toFixed(2)}) phải cao hơn giá vào (${entryPoints!.toFixed(2)}) khi MUA.` }); return;
      }
    }

    // Xây dựng body cho order API
    const orderBody: import('../services/api').CreateOrderRequest = {
      symbol:      orderSymbol.trim(),
      exchange:    (orderExchange || 'HOSE') as any,
      side:        'BUY',
      order_type:  effectiveOrderType as any,
      quantity:    effectiveQty,
      simulation_mode: 'INSTANT',
    };

    // Giá limit chỉ cho LO (điểm × 1000 = VND)
    if (effectiveOrderType === 'LO' && entryPoints != null) {
      orderBody.limit_price = Math.round(entryPoints * 1000);
    }

    // Stop Loss
    if (stopType === 'FIXED') {
      const sp = parseFloat(stopPrice);
      if (!isNaN(sp) && sp > 0) { orderBody.stop_price = Math.round(sp * 1000); orderBody.stop_type = 'FIXED'; }
    } else if (stopType === 'PERCENT') {
      const pct = parseFloat(stopPercent);
      if (!isNaN(pct) && pct > 0) { orderBody.stop_type = 'PERCENT'; orderBody.stop_params = { percent: pct }; }
    } else if (stopType === 'MAX_LOSS') {
      const ml = parseFloat(stopMaxLossVnd);
      if (!isNaN(ml) && ml > 0) { orderBody.stop_type = 'MAX_LOSS'; orderBody.stop_params = { max_loss_vnd: ml }; }
    }

    // Take Profit
    if (takeProfitType === 'FIXED') {
      const tp = parseFloat(takeProfitPrice);
      if (!isNaN(tp) && tp > 0) { orderBody.take_profit_price = Math.round(tp * 1000); orderBody.take_profit_type = 'FIXED'; }
    } else if (takeProfitType === 'PERCENT') {
      const pct = parseFloat(takeProfitPercent);
      if (!isNaN(pct) && pct > 0) { orderBody.take_profit_type = 'PERCENT'; orderBody.stop_params = { ...orderBody.stop_params, tp_percent: pct }; }
    } else if (takeProfitType === 'R_RATIO') {
      const rr = parseFloat(takeProfitRR);
      if (!isNaN(rr) && rr > 0) { orderBody.take_profit_type = 'R_RATIO'; orderBody.stop_params = { ...orderBody.stop_params, risk_reward_ratio: rr }; }
    }

    setSubmitting(true);
    setOrderMsg(null);
    setApiWarnings([]);
    try {
      const res = await orderApi.create(portfolioId, orderBody);
      const { order, position } = res.data.data;
      const warns = res.data.warnings ?? [];
      setApiWarnings(warns);

      const statusText = position
        ? `Lệnh khớp ngay — vị thế #${position.id?.slice(0, 8)} đã mở`
        : `Lệnh ${order.id?.slice(0, 8)} đặt thành công, chờ khớp`;
      setOrderMsg({ type: 'ok', text: `${orderSide} ${orderSymbol}: ${statusText}` });
      onOpenPosition?.();

      if (!inWatchlist) {
        watchlistApi.add(orderSymbol, orderExchange || 'HOSE')
          .then(() => { if (orderSymbol === symbol) setInWatchlist(true); })
          .catch(() => {});
      }
      // Reset form
      setQuantityInput('');
      setStopPrice('');
      setStopPercent('');
      setStopMaxLossVnd('');
      setEntryPriceInput('');
      setTakeProfitPrice('');
      setTakeProfitPercent('');
      setTakeProfitRR('');
      setAiSuggestions(null);
      setRiskEval(null);
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

        {/* Add to Watchlist btn */}
        <div className="flex items-center border-l border-border-standard h-full px-3 shrink-0">
          <button
            onClick={toggleWatchlist}
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
            onClick={() => setShowOrderModal(true)}
            className={`flex items-center gap-1.5 px-3 h-7 rounded text-[11px] font-black tracking-wide transition-all active:scale-95 ${
              orderSide === 'MUA'
                ? 'bg-positive text-white hover:brightness-110'
                : 'bg-negative text-white hover:brightness-110'
            }`}
            style={{ boxShadow: orderSide === 'MUA' ? '0 0 12px rgba(34,197,94,0.3)' : '0 0 12px rgba(239,68,68,0.3)' }}
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
                      const close = Number(s.matchPrice ?? s.closePrice ?? s.lastPrice ?? 0) * STOCK_PRICE_DISPLAY_SCALE;
                      const ref = Number(s.tc ?? s.referencePrice ?? s.basicPrice ?? 0) * STOCK_PRICE_DISPLAY_SCALE;
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

        {/* RIGHT: Matching / Order book / Valuation / Order Entry */}
        <div
          className="flex flex-col border-l border-border-standard shrink-0"
          style={{ width: 290, background: 'var(--color-panel-secondary)' }}
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

      {/* ĐẶT LỆNH MODAL */}
      {showOrderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowOrderModal(false); setOrderMsg(null); } }}
        >
          <div
            className="flex rounded-xl border border-border-standard overflow-hidden"
            style={{ width: 620, maxHeight: '90vh', background: 'var(--color-panel-secondary)' }}
          >
            {/* ── CỘT TRÁI: Bảng giá ── */}
            <div className="flex flex-col shrink-0 border-r border-border-standard" style={{ width: 200 }}>
              {/* Header trái */}
              <div className="px-3 py-2.5 border-b border-border-subtle">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-black text-text-main">{orderSymbol || symbol}</span>
                  <span className="text-[9px] font-mono text-text-dim bg-background px-1.5 py-0.5 rounded">{currExch}</span>
                </div>
                {currentPrice > 0 && (
                  <div className="flex items-center gap-2">
                    <span className={`text-[16px] font-mono font-black ${isNegative ? 'text-negative' : 'text-positive'}`}>{currentPrice.toFixed(2)}</span>
                    {priceChange !== 0 && (
                      <span className={`text-[10px] font-mono ${isNegative ? 'text-negative' : 'text-positive'}`}>
                        {isNegative ? '▼' : '▲'}{Math.abs(priceChange).toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{Number(priceChangePercent).toFixed(2)}%)
                      </span>
                    )}
                  </div>
                )}
                <div className={`text-[8px] font-bold mt-1 ${tradingSession.colorCls}`}>{tradingSession.label}</div>
              </div>

              {/* Trần / TC / Sàn */}
              <div className="grid grid-cols-3 border-b border-border-subtle text-center">
                {ceilPrice != null && (
                  <div className="py-1.5 border-r border-border-subtle">
                    <div className="text-[7px] text-purple-400 font-bold">TRẦN</div>
                    <div className="text-[11px] font-mono font-black text-purple-300">{ceilPrice.toFixed(2)}</div>
                  </div>
                )}
                {refPrice != null && (
                  <div className="py-1.5 border-r border-border-subtle">
                    <div className="text-[7px] text-warning font-bold">TC</div>
                    <div className="text-[11px] font-mono font-black text-warning">{refPrice.toFixed(2)}</div>
                  </div>
                )}
                {floorPrice != null && (
                  <div className="py-1.5">
                    <div className="text-[7px] text-cyan-400 font-bold">SÀN</div>
                    <div className="text-[11px] font-mono font-black text-cyan-300">{floorPrice.toFixed(2)}</div>
                  </div>
                )}
              </div>

              {/* Bảng giá 3 cấp */}
              <div className="flex-1 overflow-y-auto">
                {(() => {
                  const priceCls = (p: number | null) => {
                    if (p == null) return 'text-text-dim';
                    if (ceilPrice != null && Math.abs(p - ceilPrice) < 0.001) return 'text-purple-400';
                    if (floorPrice != null && Math.abs(p - floorPrice) < 0.001) return 'text-cyan-400';
                    if (refPrice != null && p > refPrice + 0.001) return 'text-positive';
                    if (refPrice != null && p < refPrice - 0.001) return 'text-negative';
                    return 'text-warning';
                  };

                  const asks = [3, 2, 1].map((i) => {
                    const pRaw = detail[`askPrice${i}`] ?? detail.raw?.[`askPrice${i}`];
                    const vRaw = detail[`askVol${i}`] ?? detail.raw?.[`askVol${i}`];
                    return { p: pRaw != null ? toPoint(Number(pRaw) * STOCK_PRICE_DISPLAY_SCALE) : null, v: vRaw != null ? Number(vRaw) : null, label: `G${i}B` };
                  });
                  const bids = [1, 2, 3].map((i) => {
                    const pRaw = detail[`gia${i}`] ?? detail.raw?.[`gia${i}`];
                    const vRaw = detail[`kl${i}`] ?? detail.raw?.[`kl${i}`];
                    return { p: pRaw != null ? toPoint(Number(pRaw) * STOCK_PRICE_DISPLAY_SCALE) : null, v: vRaw != null ? Number(vRaw) : null, label: `G${i}M` };
                  });
                  const maxAsk = Math.max(...asks.map((a) => a.v ?? 0), 1);
                  const maxBid = Math.max(...bids.map((b) => b.v ?? 0), 1);

                  return (
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-border-subtle" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <th className="py-1 px-2 text-right text-negative font-bold text-[8px]">KL Bán</th>
                          <th className="py-1 text-center text-text-dim font-bold text-[8px]">Giá</th>
                          <th className="py-1 px-2 text-left text-positive font-bold text-[8px]">KL Mua</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asks.map(({ p, v, label }) => (
                          <tr
                            key={label}
                            className={`border-b border-border-subtle/30 relative ${effectiveOrderType === 'LO' && p != null ? 'cursor-pointer hover:bg-negative/8' : ''}`}
                            onClick={() => { if (p != null && effectiveOrderType === 'LO') setEntryPriceInput(p.toFixed(2)); }}
                          >
                            <td className="py-1.5 px-2 text-right font-mono text-negative relative">
                              <div className="absolute inset-y-0 left-0 bg-negative/10 rounded-r" style={{ width: `${((v ?? 0) / maxAsk) * 80}%` }} />
                              <span className="relative">{v != null && v > 0 ? (v / 100).toFixed(1) : '—'}</span>
                            </td>
                            <td className={`py-1.5 text-center font-mono font-bold ${priceCls(p)}`}>
                              {p != null ? p.toFixed(2) : '—'}
                              <div className="text-[7px] text-text-dim/50 font-normal">{label}</div>
                            </td>
                            <td className="py-1.5 px-2 text-left text-text-dim/30">—</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'rgba(234,179,8,0.07)', borderTop: '1px solid rgba(234,179,8,0.25)', borderBottom: '1px solid rgba(234,179,8,0.25)' }}>
                          <td className="py-1 text-center text-text-dim/30 text-[8px]">—</td>
                          <td className="py-1 text-center font-mono font-black text-warning text-[12px]">
                            {refPrice != null ? refPrice.toFixed(2) : '—'}
                            <div className="text-[7px] text-warning/60 font-bold">TC</div>
                          </td>
                          <td className="py-1 text-center text-text-dim/30 text-[8px]">—</td>
                        </tr>
                        {bids.map(({ p, v, label }) => (
                          <tr
                            key={label}
                            className={`border-b border-border-subtle/30 relative ${effectiveOrderType === 'LO' && p != null ? 'cursor-pointer hover:bg-positive/8' : ''}`}
                            onClick={() => { if (p != null && effectiveOrderType === 'LO') setEntryPriceInput(p.toFixed(2)); }}
                          >
                            <td className="py-1.5 px-2 text-right text-text-dim/30">—</td>
                            <td className={`py-1.5 text-center font-mono font-bold ${priceCls(p)}`}>
                              {p != null ? p.toFixed(2) : '—'}
                              <div className="text-[7px] text-text-dim/50 font-normal">{label}</div>
                            </td>
                            <td className="py-1.5 px-2 text-left font-mono text-positive relative">
                              <div className="absolute inset-y-0 right-0 bg-positive/10 rounded-l" style={{ width: `${((v ?? 0) / maxBid) * 80}%` }} />
                              <span className="relative">{v != null && v > 0 ? (v / 100).toFixed(1) : '—'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
                {effectiveOrderType === 'LO' && (
                  <p className="text-[8px] text-text-dim/60 text-center py-2">↑ Bấm vào giá để chọn</p>
                )}
              </div>

              {/* Thống kê nhanh */}
              <div className="border-t border-border-subtle px-3 py-2 space-y-1">
                {[
                  { l: 'KL khớp', v: detail.totalTrading ? formatNumberVI(Number(detail.totalTrading), { maximumFractionDigits: 0 }) : null },
                  { l: 'Cao/Thấp', v: (detail.highestPrice ?? detail.raw?.high) && (detail.lowestPrice ?? detail.raw?.low)
                    ? `${toPoint(Number(detail.highestPrice ?? detail.raw?.high) * STOCK_PRICE_DISPLAY_SCALE).toFixed(2)} / ${toPoint(Number(detail.lowestPrice ?? detail.raw?.low) * STOCK_PRICE_DISPLAY_SCALE).toFixed(2)}`
                    : null },
                ].filter((r) => r.v).map(({ l, v }) => (
                  <div key={l} className="flex justify-between text-[9px]">
                    <span className="text-text-dim">{l}</span>
                    <span className="font-mono text-text-muted">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CỘT PHẢI: Form đặt lệnh ── */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* Header phải: close btn */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle shrink-0">
                <span className="text-[11px] font-semibold text-text-dim">Đặt lệnh</span>
                <button
                  onClick={() => { setShowOrderModal(false); setOrderMsg(null); }}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-text-dim hover:text-text-main text-[14px] transition-colors"
                >✕</button>
              </div>

              <div className="flex-1 overflow-y-auto dense-scroll px-4 py-3 space-y-3">

                {/* 1. Loại lệnh: tự động detect từ khối lượng nhập */}
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={`px-2 py-1 rounded font-bold ${isOddLotOrder ? 'bg-warning/15 text-warning border border-warning/25' : 'bg-accent/10 text-accent border border-accent/20'}`}>
                    {isOddLotOrder ? `⚠ Lệnh Rỗ (<${lotSize} CP)` : 'Lệnh Thường'}
                  </span>
                  {isOddLotOrder && (
                    <span className="text-text-dim text-[9px]">Chỉ khớp phiên Thỏa thuận</span>
                  )}
                </div>

                {/* 2. MUA / BÁN */}
                <div className="flex rounded-xl overflow-hidden border-2 border-border-standard">
                  <button
                    onClick={() => setOrderSide('MUA')}
                    className={`flex-1 py-3.5 text-[16px] font-black tracking-widest transition-all ${orderSide === 'MUA' ? 'bg-positive text-white' : 'text-text-dim/60 hover:text-positive hover:bg-positive/8'}`}
                    style={orderSide === 'MUA' ? { boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2)' } : {}}
                  >MUA</button>
                  <button
                    onClick={() => setOrderSide('BAN')}
                    className={`flex-1 py-3.5 text-[16px] font-black tracking-widest transition-all border-l border-border-standard ${orderSide === 'BAN' ? 'bg-negative text-white' : 'text-text-dim/60 hover:text-negative hover:bg-negative/8'}`}
                    style={orderSide === 'BAN' ? { boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2)' } : {}}
                  >BÁN</button>
                </div>

                {/* 2b. Holdings khi BÁN */}
                {orderSide === 'BAN' && (
                  <div className={`rounded-lg border p-2.5 ${symbolHoldings.length > 0 ? 'border-negative/25 bg-negative/5' : 'border-warning/30 bg-warning/5'}`}>
                    {symbolHoldings.length === 0 ? (
                      <div className="flex items-center gap-2 text-[10px] text-warning">
                        <span>⚠</span>
                        <span>Không có vị thế MUA nào cho <strong>{orderSymbol || symbol}</strong> đang mở trong hệ thống. Không thể bán.</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-[8px] font-bold uppercase tracking-wider text-text-dim mb-1.5">
                          Vị thế đang nắm — {totalHeldQty.toLocaleString()} CP tổng cộng
                        </div>
                        <div className="space-y-1">
                          {symbolHoldings.map((pos) => {
                            const entryPts = toPoint(Number(pos.entry_price ?? 0) / 1000);
                            const qty = Number(pos.quantity ?? 0);
                            const isSel = selectedPositionId === pos.id || (!selectedPositionId && pos === symbolHoldings[0]);
                            return (
                              <button
                                key={pos.id}
                                onClick={() => {
                                  setSelectedPositionId(pos.id);
                                  setQuantityInput(String(qty));
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[10px] border transition-all ${isSel ? 'border-negative/50 bg-negative/10 text-text-main' : 'border-border-subtle bg-background text-text-dim hover:border-border-standard'}`}
                              >
                                <span className="font-bold">{pos.symbol}</span>
                                <span className="font-mono">{qty.toLocaleString()} CP @ {entryPts > 0 ? entryPts.toFixed(2) : '—'}</span>
                                {isSel && <span className="text-negative text-[8px] font-bold">✓ Chọn</span>}
                              </button>
                            );
                          })}
                        </div>
                        {selectedHolding && (
                          <p className="text-[8px] text-text-dim mt-1.5">
                            Số CP tối đa được bán: <span className="text-text-muted font-mono font-bold">{Number(selectedHolding.quantity ?? 0).toLocaleString()}</span>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 3. Loại lệnh */}
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-text-dim mb-1.5">Loại lệnh</div>
                  <div className="flex gap-1 flex-wrap">
                    {availableOrderTypes.map((t) => {
                      const info = ORDER_TYPE_INFO[t];
                      const sel = effectiveOrderType === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setOrderType(t)}
                          title={info.desc}
                          className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all ${sel ? 'bg-accent text-white' : 'bg-background border border-border-standard text-text-dim hover:border-accent/40 hover:text-text-muted'}`}
                        >
                          <span className="text-[11px] font-black">{info.label}</span>
                          <span className={`text-[7px] font-normal ${sel ? 'text-white/70' : 'text-text-dim'}`}>
                            {t === 'LO' ? 'Giới hạn' : t === 'ATO' ? 'Mở cửa' : t === 'ATC' ? 'Đóng cửa' : t === 'MP' ? 'Thị trường' : t === 'MOK' ? 'Hết/hủy' : 'Một phần'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Giá đặt */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[8px] font-bold uppercase tracking-wider text-text-dim">Giá đặt (nghìn ₫)</div>
                    {/* Progress bar Sàn→Trần */}
                    {entryPoints != null && entryPoints > 0 && ceilPrice != null && floorPrice != null && (
                      <div className="flex items-center gap-1.5 text-[8px] font-mono">
                        <span className="text-cyan-400">{floorPrice.toFixed(2)}</span>
                        <div className="w-16 h-1 rounded-full bg-border-subtle relative overflow-hidden">
                          <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{
                            width: `${Math.min(100, Math.max(0, ((entryPoints - floorPrice) / (ceilPrice - floorPrice)) * 100))}%`,
                            background: entryPoints >= ceilPrice - 0.001 ? '#A855F7' : entryPoints <= floorPrice + 0.001 ? '#22D3EE' : (orderSide === 'MUA' ? '#22C55E' : '#EF4444'),
                          }} />
                        </div>
                        <span className="text-purple-400">{ceilPrice.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  {isMarketEntry ? (
                    <div className="h-11 flex items-center justify-center bg-background/50 border border-border-subtle rounded-xl text-[12px] font-mono text-text-dim">
                      {effectiveOrderType === 'ATO' ? 'Giá mở cửa (ATO)' : effectiveOrderType === 'ATC' ? 'Giá đóng cửa (ATC)' : 'Giá thị trường (MP)'}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { const c = parseFloat(entryPriceInput) || (marketPrice ?? refPrice ?? 0); if (c > 0) setEntryPriceInput(stepPriceDown(c, currExch).toFixed(2)); }}
                          className="w-10 h-11 rounded-xl bg-background border border-border-standard text-[18px] font-light text-text-muted hover:text-text-main hover:border-border-standard transition-colors flex items-center justify-center shrink-0"
                        >−</button>
                        <input
                          value={entryPriceInput}
                          onChange={(e) => setEntryPriceInput(e.target.value)}
                          onBlur={() => { const v = parseFloat(entryPriceInput); if (!isNaN(v) && v > 0) setEntryPriceInput(snapToTickSize(v, currExch).toFixed(2)); }}
                          placeholder={marketPrice != null ? marketPrice.toFixed(2) : refPrice != null ? refPrice.toFixed(2) : '0.00'}
                          className="flex-1 bg-background border border-border-standard rounded-xl px-3 h-11 text-[16px] font-mono font-bold text-text-main outline-none focus:border-accent text-center"
                        />
                        <button
                          onClick={() => { const c = parseFloat(entryPriceInput) || (marketPrice ?? refPrice ?? 0); if (c > 0) setEntryPriceInput(stepPriceUp(c, currExch).toFixed(2)); }}
                          className="w-10 h-11 rounded-xl bg-background border border-border-standard text-[18px] font-light text-text-muted hover:text-text-main hover:border-border-standard transition-colors flex items-center justify-center shrink-0"
                        >+</button>
                      </div>
                      {/* Quick fill từ giá thị trường */}
                      <div className="flex gap-1 mt-1.5">
                        {marketPrice != null && (
                          <button onClick={() => setEntryPriceInput(marketPrice.toFixed(2))} className="flex-1 py-1 rounded-md bg-background border border-border-subtle text-[8px] font-bold text-text-dim hover:text-accent hover:border-accent/40 transition-colors">
                            Giá TT: {marketPrice.toFixed(2)}
                          </button>
                        )}
                        {refPrice != null && (
                          <button onClick={() => setEntryPriceInput(refPrice.toFixed(2))} className="flex-1 py-1 rounded-md bg-background border border-border-subtle text-[8px] font-bold text-text-dim hover:text-warning hover:border-warning/40 transition-colors">
                            TC: {refPrice.toFixed(2)}
                          </button>
                        )}
                        {ceilPrice != null && (
                          <button onClick={() => setEntryPriceInput(ceilPrice.toFixed(2))} className="flex-1 py-1 rounded-md bg-background border border-border-subtle text-[8px] font-bold text-text-dim hover:text-purple-400 hover:border-purple-400/40 transition-colors">
                            Trần: {ceilPrice.toFixed(2)}
                          </button>
                        )}
                      </div>
                      {/* Price validation */}
                      {entryPoints != null && entryPoints > 0 && (() => {
                        const val = validateLOPrice(entryPoints, currExch, floorPrice, ceilPrice);
                        if (!val.valid && val.error) return <p className="text-[9px] text-negative mt-1">⚠ {val.error}</p>;
                        if (!val.valid && val.warning) return (
                          <p className="text-[9px] text-warning mt-1 cursor-pointer" onClick={() => val.snapTo != null && setEntryPriceInput(val.snapTo!.toFixed(2))}>
                            ⚠ {val.warning} — <span className="underline">bấm để tự sửa</span>
                          </p>
                        );
                        return null;
                      })()}
                    </>
                  )}
                </div>

                {/* 5. Khối lượng */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[8px] font-bold uppercase tracking-wider text-text-dim">Khối lượng (CP)</div>
                    {isOddLotOrder && <span className="text-[8px] text-warning">Dưới 1 lô ({lotSize} CP)</span>}
                  </div>
                  <div className="flex gap-1 mb-1.5">
                    <button
                      onClick={() => { const c = parseInt(quantityInput) || 0; const s = isOddLotOrder ? 1 : lotSize; if (c >= s) setQuantityInput(String(c - s)); }}
                      className="w-10 h-11 rounded-xl bg-background border border-border-standard text-[18px] font-light text-text-muted hover:text-text-main transition-colors flex items-center justify-center shrink-0"
                    >−</button>
                    <input
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder={isOddLotOrder ? '50' : String(lotSize * 10)}
                      className={`flex-1 bg-background border rounded-xl px-3 h-11 text-[16px] font-mono font-bold text-text-main outline-none focus:border-accent text-center ${qtyLotWarning ? 'border-warning/60' : 'border-border-standard'}`}
                    />
                    <button
                      onClick={() => { const c = parseInt(quantityInput) || 0; const s = isOddLotOrder ? 1 : lotSize; setQuantityInput(String(c + s)); }}
                      className="w-10 h-11 rounded-xl bg-background border border-border-standard text-[18px] font-light text-text-muted hover:text-text-main transition-colors flex items-center justify-center shrink-0"
                    >+</button>
                  </div>
                  {!isOddLotOrder && (
                    <div className="flex gap-1">
                      {[1, 5, 10, 20].map((n) => (
                        <button
                          key={n}
                          onClick={() => setQuantityInput(String((parseInt(quantityInput) || 0) + n * lotSize))}
                          className="flex-1 py-1.5 rounded-lg bg-background border border-border-subtle text-[9px] font-bold text-text-dim hover:text-accent hover:border-accent/40 transition-colors"
                        >+{n}L</button>
                      ))}
                      <button
                        onClick={() => setQuantityInput('')}
                        className="px-2 py-1.5 rounded-lg bg-background border border-border-subtle text-[9px] font-bold text-text-dim hover:text-negative/70 hover:border-negative/30 transition-colors"
                        title="Xóa"
                      >✕</button>
                    </div>
                  )}
                  {qtyLotWarning && <p className="text-[9px] text-warning mt-1">⚠ {qtyLotWarning}</p>}
                </div>

                {/* 6. Giá trị lệnh */}
                {entryPoints != null && effectiveQty != null && (
                  <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${orderSide === 'MUA' ? 'border-positive/20 bg-positive/5' : 'border-negative/20 bg-negative/5'}`}>
                    <span className="text-[10px] text-text-dim">Giá trị lệnh</span>
                    <span className={`text-[15px] font-mono font-black ${orderSide === 'MUA' ? 'text-positive' : 'text-negative'}`}>
                      {formatNumberVI(Math.round(entryPoints * 1000 * effectiveQty))} ₫
                    </span>
                  </div>
                )}

                {/* 7. Quản lý rủi ro (collapsible) — chỉ hiện khi MUA */}
                {orderSide === 'MUA' && <div className="rounded-xl border border-border-subtle overflow-hidden">
                  <button
                    onClick={() => setShowRiskPanel(!showRiskPanel)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/3 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-text-dim">Quản lý rủi ro SL/TP</span>
                      <span className="text-[7px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold">Ứng dụng</span>
                      {(stopPrice || stopPercent || stopMaxLossVnd) && (
                        <span className="text-[7px] bg-negative/15 text-negative px-1.5 py-0.5 rounded font-bold">SL đã đặt</span>
                      )}
                      {(takeProfitPrice || takeProfitPercent || takeProfitRR) && (
                        <span className="text-[7px] bg-positive/15 text-positive px-1.5 py-0.5 rounded font-bold">TP đã đặt</span>
                      )}
                    </div>
                    <span className="text-text-dim text-[10px]">{showRiskPanel ? '▲' : '▼'}</span>
                  </button>

                  {showRiskPanel && (
                    <div className="px-3 pb-3 border-t border-border-subtle space-y-3">
                      {/* Stop Loss */}
                      <div className="pt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-bold text-negative">Cắt lỗ (SL)</span>
                          <div className="flex gap-0.5">
                            {(['FIXED', 'PERCENT', 'MAX_LOSS'] as const).map((t) => (
                              <button key={t} onClick={() => setStopType(t)}
                                className={`px-2 py-0.5 rounded text-[7px] font-bold transition-colors ${stopType === t ? 'bg-negative/50 text-white' : 'text-text-dim hover:text-negative/70 border border-border-subtle'}`}>
                                {t === 'FIXED' ? 'Giá' : t === 'PERCENT' ? '%' : 'Max VNĐ'}
                              </button>
                            ))}
                          </div>
                        </div>
                        {stopType === 'FIXED' && <input value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder={`SL giá — VD: ${entryPoints != null ? (entryPoints * (orderSide === 'BAN' ? 1.05 : 0.95)).toFixed(2) : '0.00'}`} className="w-full bg-background border border-negative/30 rounded-lg px-3 h-9 text-[11px] font-mono text-negative outline-none focus:border-negative" />}
                        {stopType === 'PERCENT' && <input value={stopPercent} onChange={(e) => setStopPercent(e.target.value)} placeholder="VD: 5 (nghĩa là 5%)" className="w-full bg-background border border-negative/30 rounded-lg px-3 h-9 text-[11px] font-mono text-negative outline-none focus:border-negative" />}
                        {stopType === 'MAX_LOSS' && <input value={stopMaxLossVnd} onChange={(e) => setStopMaxLossVnd(e.target.value)} placeholder="Lỗ tối đa chấp nhận (VNĐ)" className="w-full bg-background border border-negative/30 rounded-lg px-3 h-9 text-[11px] font-mono text-negative outline-none focus:border-negative" />}
                      </div>

                      {/* Take Profit */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-bold text-positive">Chốt lời (TP)</span>
                          <div className="flex gap-0.5">
                            {(['' , 'FIXED', 'PERCENT', 'R_RATIO'] as const).map((t) => (
                              <button key={t} onClick={() => setTakeProfitType(t)}
                                className={`px-2 py-0.5 rounded text-[7px] font-bold transition-colors ${takeProfitType === t ? 'bg-positive/50 text-white' : 'text-text-dim hover:text-positive/70 border border-border-subtle'}`}>
                                {t === '' ? 'Không' : t === 'FIXED' ? 'Giá' : t === 'PERCENT' ? '%' : 'R:R'}
                              </button>
                            ))}
                          </div>
                        </div>
                        {takeProfitType === 'FIXED' && <input value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} placeholder={`TP giá — VD: ${entryPoints != null ? (entryPoints * (orderSide === 'BAN' ? 0.92 : 1.08)).toFixed(2) : '0.00'}`} className="w-full bg-background border border-positive/30 rounded-lg px-3 h-9 text-[11px] font-mono text-positive outline-none focus:border-positive" />}
                        {takeProfitType === 'PERCENT' && <input value={takeProfitPercent} onChange={(e) => setTakeProfitPercent(e.target.value)} placeholder="VD: 10 (nghĩa là 10%)" className="w-full bg-background border border-positive/30 rounded-lg px-3 h-9 text-[11px] font-mono text-positive outline-none focus:border-positive" />}
                        {takeProfitType === 'R_RATIO' && <input value={takeProfitRR} onChange={(e) => setTakeProfitRR(e.target.value)} placeholder="VD: 2.0 (R:R = 1:2)" className="w-full bg-background border border-positive/30 rounded-lg px-3 h-9 text-[11px] font-mono text-positive outline-none focus:border-positive" />}
                      </div>

                      {/* AI suggest */}
                      <button
                        onClick={handleAiSuggest}
                        disabled={aiSuggesting || !(orderSymbol || symbol)}
                        className="w-full h-8 rounded-lg text-[9px] font-bold bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        {aiSuggesting ? <><div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />Đang phân tích...</> : <>✦ AI tự động gợi ý SL/TP tối ưu</>}
                      </button>
                      {aiSuggestError && !aiSuggestions && <p className="text-[9px] text-negative">{aiSuggestError}</p>}
                      {aiSuggestions && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-accent font-bold uppercase tracking-wider">AI gợi ý cho {aiSuggestions.symbol}</span>
                              {aiSuggestions.technical_score != null && (
                                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded ${
                                  aiSuggestions.technical_score >= 70 ? 'bg-positive/15 text-positive'
                                  : aiSuggestions.technical_score >= 50 ? 'bg-warning/15 text-warning'
                                  : 'bg-negative/15 text-negative'
                                }`}>
                                  {aiSuggestions.technical_label === 'HOP_LY' ? 'Hợp Lý' : aiSuggestions.technical_label === 'TRUNG_BINH' ? 'Trung Bình' : 'Yếu'} {aiSuggestions.technical_score}/100
                                </span>
                              )}
                            </div>
                            <button onClick={() => { setAiSuggestions(null); setAiSuggestError(''); }} className="text-[9px] text-text-dim">✕</button>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {['aggressive', 'moderate', 'conservative'].map((type) => {
                              const s = aiSuggestions.suggestions?.find((x: any) => x.type === type);
                              if (!s) return null;
                              return (
                                <button key={type} onClick={() => applyAiSuggestion(type as any)}
                                  className={`p-2 rounded-lg border text-left transition-all ${selectedSuggType === type ? 'border-accent bg-accent/10' : 'border-border-standard bg-background hover:border-accent/40'}`}>
                                  <p className={`text-[7px] font-black mb-1 ${type === 'aggressive' ? 'text-negative' : type === 'moderate' ? 'text-accent' : 'text-positive'}`}>
                                    {type === 'aggressive' ? 'Tích Cực' : type === 'moderate' ? 'Cân Bằng' : 'Thận Trọng'}{aiSuggestions.recommended === type ? ' ★' : ''}
                                  </p>
                                  <p className="text-[9px] font-mono">SL <span className="text-negative font-bold">{(s.stop_loss_vnd / 1000).toFixed(2)}</span></p>
                                  <p className="text-[9px] font-mono">TP <span className="text-positive font-bold">{s.take_profit_vnd ? (s.take_profit_vnd / 1000).toFixed(2) : '—'}</span></p>
                                  <p className="text-[7px] text-text-dim">R:R {s.rr_ratio?.toFixed(1) ?? '—'}</p>
                                </button>
                              );
                            })}
                          </div>
                          {/* AI phân tích text */}
                          {aiSuggestions.analysis_text && (
                            <p className="text-[9px] text-text-muted leading-relaxed px-0.5">{aiSuggestions.analysis_text}</p>
                          )}
                          {/* Disclaimer bắt buộc */}
                          {aiSuggestions.disclaimer && (
                            <div className="px-2 py-1.5 rounded bg-warning/5 border border-warning/20">
                              <p className="text-[7.5px] text-warning/80 leading-relaxed">{aiSuggestions.disclaimer}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Risk eval */}
                      {(riskEval || riskEvalLoading) && (
                        <div className="p-2.5 rounded-lg border border-border-subtle bg-background/50 flex items-center gap-2 flex-wrap">
                          {riskEvalLoading && <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />}
                          {riskEval && !riskEvalLoading && (
                            <>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${riskEval.risk_level === 'LOW' ? 'text-positive bg-positive/10' : riskEval.risk_level === 'MEDIUM' ? 'text-warning bg-warning/10' : 'text-negative bg-negative/10'}`}>
                                {riskEval.risk_level === 'LOW' ? 'RỦI RO THẤP' : riskEval.risk_level === 'MEDIUM' ? 'TRUNG BÌNH' : 'CAO'}
                              </span>
                              {riskEval.risk_reward_ratio > 0 && <span className="text-[9px] font-mono text-text-dim">R:R <span className={riskEval.risk_reward_ratio >= 2 ? 'text-positive' : 'text-warning'}>{riskEval.risk_reward_ratio.toFixed(1)}</span></span>}
                              {riskEval.risk_percent_of_portfolio > 0 && <span className="text-[9px] font-mono text-text-dim">Rủi ro <span className={riskEval.risk_percent_of_portfolio > 3 ? 'text-negative' : 'text-text-main'}>{riskEval.risk_percent_of_portfolio.toFixed(1)}%</span> vốn</span>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>}

                {/* Cảnh báo từ API (tick size, price band) */}
                {apiWarnings.length > 0 && (
                  <div className="space-y-1">
                    {apiWarnings.map((w, i) => (
                      <div key={i} className="px-2.5 py-1.5 rounded-lg text-[9px] text-warning bg-warning/8 border border-warning/20 flex items-start gap-1.5">
                        <span className="shrink-0">⚠</span><span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Thông báo */}
                {orderMsg && (
                  <div className={`px-3 py-2 rounded-lg text-[10px] font-medium border ${orderMsg.type === 'ok' ? 'text-positive bg-positive/10 border-positive/20' : 'text-negative bg-negative/10 border-negative/20'}`}>
                    {orderMsg.text}
                  </div>
                )}

              </div>

              {/* ── Submit (sticky bottom) ── */}
              <div className="shrink-0 border-t border-border-subtle px-4 py-3">
                {!canSubmitOrder(tradingSession, isOddLotOrder, effectiveOrderType) && (
                  <div className="mb-2 px-3 py-1.5 rounded-lg text-[9px] text-warning bg-warning/8 border border-warning/15 flex items-center gap-1.5">
                    <span>⏸</span><span><strong>{tradingSession.label}</strong> — không thể đặt lệnh {effectiveOrderType}</span>
                  </div>
                )}
                {!portfolioId && (
                  <div className="mb-2 text-[9px] text-text-dim text-center">Chưa chọn danh mục đầu tư</div>
                )}
                {orderSide === 'BAN' && symbolHoldings.length === 0 && portfolioId && (
                  <div className="mb-2 px-3 py-1.5 rounded-lg text-[9px] text-negative bg-negative/8 border border-negative/15 flex items-center gap-1.5">
                    <span>⚠</span><span>Không có vị thế MUA nào đang mở cho <strong>{orderSymbol || symbol}</strong></span>
                  </div>
                )}
                <button
                  onClick={() => setShowConfirmOrder(true)}
                  disabled={submitting || !portfolioId || !canSubmitOrder(tradingSession, isOddLotOrder, effectiveOrderType) || !effectiveQty || (!isMarketEntry && !entryPoints) || (orderSide === 'BAN' && symbolHoldings.length === 0)}
                  className={`w-full h-12 rounded-xl font-black text-[14px] tracking-widest transition-all active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed ${
                    orderSide === 'MUA' ? 'bg-positive text-white hover:brightness-110' : 'bg-negative text-white hover:brightness-110'
                  }`}
                  style={{ boxShadow: orderSide === 'MUA' ? '0 4px 16px rgba(34,197,94,0.3)' : '0 4px 16px rgba(239,68,68,0.3)' }}
                >
                  {submitting ? 'ĐANG GỬI...' : `${orderSide === 'MUA' ? 'MUA' : 'BÁN'} ${orderSymbol || symbol}${!isMarketEntry && entryPoints ? ` — ${entryPoints.toFixed(2)}` : ''}${effectiveQty ? ` × ${(effectiveQty / 100).toFixed(0)}L` : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirmOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl border border-border-standard p-5 w-72" style={{ background: 'var(--color-panel-secondary)' }}>
            <div className={`text-[12px] font-black mb-3 ${orderSide === 'MUA' ? 'text-positive' : 'text-negative'}`}>
              Xác nhận {orderSide} {orderSymbol || symbol}
            </div>
            <div className="space-y-1.5 mb-4 bg-background/50 rounded-lg p-3 text-[10px] border border-border-subtle">
              <div className="flex justify-between"><span className="text-text-dim">Loại lệnh</span><span className="font-bold">{effectiveOrderType}{isOddLotOrder ? ' · Lệnh Rỗ' : ''}</span></div>
              <div className="flex justify-between"><span className="text-text-dim">Giá</span><span className="font-mono font-bold">{isMarketEntry ? `Giá ${effectiveOrderType}` : (entryPoints?.toFixed(2) ?? '—')}</span></div>
              <div className="flex justify-between"><span className="text-text-dim">Khối lượng</span><span className="font-mono">{effectiveQty?.toLocaleString() ?? '—'} CP</span></div>
              {entryPoints != null && effectiveQty != null && (
                <div className="flex justify-between border-t border-border-subtle pt-1.5 mt-1">
                  <span className="text-text-dim font-semibold">Giá trị</span>
                  <span className={`font-mono font-bold ${orderSide === 'MUA' ? 'text-positive' : 'text-negative'}`}>{formatNumberVI(Math.round(entryPoints * 1000 * effectiveQty))} ₫</span>
                </div>
              )}
              {stopType === 'FIXED' && stopPrice && <div className="flex justify-between border-t border-border-subtle pt-1.5"><span className="text-text-dim">Cắt lỗ</span><span className="font-mono text-negative">{stopPrice}</span></div>}
              {takeProfitType === 'FIXED' && takeProfitPrice && <div className="flex justify-between"><span className="text-text-dim">Chốt lời</span><span className="font-mono text-positive">{takeProfitPrice}</span></div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirmOrder(false)} className="flex-1 h-10 rounded-lg border border-border-standard text-[10px] font-semibold text-text-dim hover:text-text-muted transition-colors">Hủy</button>
              <button
                onClick={() => { setShowConfirmOrder(false); handleSubmitOrder(); }}
                disabled={submitting}
                className={`flex-1 h-10 rounded-lg text-[11px] font-black disabled:opacity-40 transition-all ${orderSide === 'MUA' ? 'bg-positive text-white' : 'bg-negative text-white'}`}
              >{submitting ? 'ĐANG GỬI...' : `XÁC NHẬN ${orderSide}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
