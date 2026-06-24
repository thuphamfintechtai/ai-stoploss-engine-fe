import { useState, useEffect, useCallback, useRef } from 'react';
import { marketApi, positionApi, orderApi, realPortfolioApi, watchlistApi, aiApi, getPositionSizing } from '../../services/api';
import type { Position, PositionSizingResult, CreateRealOrderRequest } from '../../services/api';
import { STOCK_PRICE_DISPLAY_SCALE } from '../../constants';
import {
  getPriceStep, snapToTickSize, stepPriceUp, stepPriceDown,
  getLotSize, isOddLotQty, getCurrentSession, getAvailableOrderTypes,
  ORDER_TYPE_INFO,
  type Exchange, type OrderTypeCode,
} from '../../utils/vnStockRules';

export interface TradingTerminalState {
  symbol: string;
  exchange: string;
  timeframe: string;
  chartData: any[];
  loadingChart: boolean;
  symbolDetail: any;
  loadingDetail: boolean;
  matchingHistory: any;
  orderBook: any;
  loadingSidebar: boolean;
  inWatchlist: boolean;
  watchlistLoading: boolean;
  stockList: any[];
  loadingStocks: boolean;
  selectedIndex: string;
  showOrderModal: boolean;
  showLeftPanel: boolean;
  sidebarTab: 'matching' | 'orderbook' | 'valuation';
}

export interface OrderFormState {
  orderSymbol: string;
  orderExchange: string;
  orderSide: 'MUA' | 'BAN';
  orderType: OrderTypeCode;
  isOddLotOrder: boolean;
  tradingSession: ReturnType<typeof getCurrentSession>;
  marketPrice: number | null;
  entryPriceInput: string;
  quantityInput: string;
  stopType: 'FIXED' | 'PERCENT' | 'MAX_LOSS';
  stopPrice: string;
  stopPercent: string;
  stopMaxLossVnd: string;
  takeProfitType: 'FIXED' | 'PERCENT' | 'R_RATIO' | '';
  takeProfitPrice: string;
  takeProfitPercent: string;
  takeProfitRR: string;
  submitting: boolean;
  orderMsg: { type: 'ok' | 'err'; text: string } | null;
  apiWarnings: string[];
  selectedPositionId: string | null;
  showAdvanced: boolean;
  showRiskPanel: boolean;
}

export interface AIState {
  aiSuggesting: boolean;
  aiSuggestions: any;
  aiSuggestError: string;
  selectedSuggType: 'aggressive' | 'moderate' | 'conservative';
  riskEval: any;
  riskEvalLoading: boolean;
  positionSizing: PositionSizingResult | null;
  positionSizingLoading: boolean;
}

interface UseTradingTerminalProps {
  portfolioId: string | null;
  initialSymbol?: string;
  initialExchange?: string;
  initialStopLoss?: number;
  initialTakeProfit?: number;
  initialSide?: 'LONG' | 'SHORT';
  openPositions?: Position[];
  onOpenPosition?: () => void;
}

export const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);

export function useTradingTerminal({
  portfolioId,
  initialSymbol = 'ACB',
  initialExchange = 'HOSE',
  initialStopLoss,
  initialTakeProfit,
  initialSide,
  openPositions = [],
  onOpenPosition,
}: UseTradingTerminalProps) {
  // Terminal state
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

  // Order form state
  const [orderSymbol, setOrderSymbol] = useState('');
  const [orderExchange, setOrderExchange] = useState('');
  const [orderSide, setOrderSide] = useState<'MUA' | 'BAN'>('MUA');
  const [orderType, setOrderType] = useState<OrderTypeCode>('LO');
  const [isOddLotOrder, setIsOddLotOrder] = useState(false);
  const [tradingSession, setTradingSession] = useState(() => getCurrentSession(initialExchange || 'HOSE'));
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
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRiskPanel, setShowRiskPanel] = useState(false);

  // AI state
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [aiSuggestError, setAiSuggestError] = useState('');
  const [selectedSuggType, setSelectedSuggType] = useState<'aggressive' | 'moderate' | 'conservative'>('moderate');
  const [riskEval, setRiskEval] = useState<any>(null);
  const [riskEvalLoading, setRiskEvalLoading] = useState(false);
  const [positionSizing, setPositionSizing] = useState<PositionSizingResult | null>(null);
  const [positionSizingLoading, setPositionSizingLoading] = useState(false);

  const riskEvalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived values
  const parseQty = () => {
    const n = parseInt(quantityInput.replace(/\s|,/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const effectiveQty = parseQty();

  const isMarketEntry = orderType !== 'LO' && ORDER_TYPE_INFO[orderType]?.requiresPrice === false;

  const getEntryPoints = () => {
    if (isMarketEntry) {
      const p = marketPrice != null ? (marketPrice >= 1000 ? marketPrice / 1000 : marketPrice) : null;
      return p != null && p > 0 ? p : null;
    }
    const n = parseFloat(entryPriceInput.replace(/,/g, '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const entryPoints = getEntryPoints();

  const currExch = (orderExchange || exchange || 'HOSE') as Exchange;
  const lotSize = getLotSize(currExch);
  const availableOrderTypes = getAvailableOrderTypes(currExch, tradingSession, isOddLotOrder);
  const effectiveOrderType: OrderTypeCode = availableOrderTypes.includes(orderType) ? orderType : (availableOrderTypes[0] ?? 'LO');

  // Holdings for current symbol
  const symbolHoldings = openPositions.filter(
    (p) => p.symbol?.toUpperCase() === (orderSymbol || symbol).toUpperCase()
      && (p.side ?? 'LONG').toUpperCase() === 'LONG'
      && p.status === 'OPEN'
  );
  const totalHeldQty = symbolHoldings.reduce((s, p) => s + Number(p.quantity ?? 0), 0);
  const selectedHolding = symbolHoldings.find((p) => p.id === selectedPositionId) ?? symbolHoldings[0] ?? null;

  // Load chart data
  const loadChart = useCallback(async (sym: string, exch: string, tf: string) => {
    if (!sym) return;
    setLoadingChart(true);
    try {
      const res = await marketApi.getOHLCV(sym, { exchange: exch, timeframe: tf, limit: 200 });
      if (res.data.success && Array.isArray(res.data.data)) {
        const isIntraday = tf === '1m' || tf === '5m' || tf === '15m' || tf === '30m' || tf === '1h';
        const data = res.data.data.map((item: any) => ({
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
      if (import.meta.env.DEV) console.error('Load chart error:', e);
    } finally {
      setLoadingChart(false);
    }
  }, []);

  // Load symbol detail
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
        marketApi.getStockDetailByIndex({ indexCodes: [effExch], pageNo: 1, pageSize: 2000 }),
      ]);

      let mergedDetail: any = null;
      if (detailRes.status === 'fulfilled' && detailRes.value.data.success) {
        mergedDetail = { ...detailRes.value.data.data };
      }

      if (quoteRes.status === 'fulfilled' && quoteRes.value.data.success) {
        const stockItem = (quoteRes.value.data.data || []).find(
          (s: any) => (s.symbol || '').toUpperCase() === sym.toUpperCase()
        );
        if (stockItem) {
          if (mergedDetail == null) mergedDetail = {};
          ['gia1', 'kl1', 'gia2', 'kl2', 'gia3', 'kl3', 'askPrice1', 'askVol1', 'askPrice2', 'askVol2', 'askPrice3', 'askVol3'].forEach(key => {
            if (stockItem[key] != null) mergedDetail[key] = stockItem[key];
          });
          if (mergedDetail.closePrice == null && stockItem.matchPrice != null) mergedDetail.closePrice = stockItem.matchPrice;
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
      if (import.meta.env.DEV) console.error('Load symbol data error:', e);
    } finally {
      setLoadingDetail(false);
      setLoadingSidebar(false);
    }
  }, []);

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
    } catch {}
  };

  const handleSymbolSelect = (sym: string, exch: string) => {
    setSymbol(sym);
    setExchange(exch);
    setSymbolInput(sym);
    loadChart(sym, exch, timeframe);
    loadSymbolData(sym, exch);
    setOrderSymbol(sym);
    setOrderExchange(exch);
    setMarketPrice(null);
    fetchOrderEntry(sym);
  };

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    loadChart(symbol, exchange, tf);
  };

  // Watchlist
  const checkWatchlist = useCallback(async (sym: string) => {
    try {
      const res = await watchlistApi.getAll();
      if (res.data?.success) {
        const found = (res.data.data || []).some((i: any) => i.symbol === sym);
        setInWatchlist(found);
      }
    } catch {}
  }, []);

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
    } catch {}
    finally { setWatchlistLoading(false); }
  };

  // AI Suggestions
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
        rr_ratio: parseFloat(localStorage.getItem('default_rr') ?? '2'),
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
    const slVnd = s.stop_loss_vnd ?? s.stop_loss;
    const tpVnd = s.take_profit_vnd ?? s.take_profit;
    setStopType('FIXED');
    if (slVnd) setStopPrice(String((slVnd / 1000).toFixed(2)));
    if (tpVnd) { setTakeProfitType('FIXED'); setTakeProfitPrice(String((tpVnd / 1000).toFixed(2))); }
    setSelectedSuggType(type);
  }, [aiSuggestions]);

  const resetOrderForm = () => {
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
  };

  // Effects
  useEffect(() => {
    loadChart(symbol, exchange, timeframe);
    loadSymbolData(symbol, exchange);
    setOrderSymbol(symbol);
    setOrderExchange(exchange);
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

  useEffect(() => { checkWatchlist(symbol); }, [symbol, checkWatchlist]);

  useEffect(() => {
    const tick = () => setTradingSession(getCurrentSession(currExch));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [currExch]);

  useEffect(() => {
    const qty = parseInt(quantityInput.replace(/\s|,/g, ''), 10);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const lot = getLotSize(currExch);
    setIsOddLotOrder(lot > 1 && qty < lot);
  }, [quantityInput, currExch]);

  useEffect(() => {
    if (orderSide === 'BAN' && symbolHoldings.length > 0) {
      setSelectedPositionId(symbolHoldings[0].id);
      setQuantityInput(String(Number(symbolHoldings[0].quantity ?? 0)));
    }
    if (orderSide === 'MUA') {
      setSelectedPositionId(null);
    }
  }, [orderSide, orderSymbol]);

  useEffect(() => {
    if (!portfolioId) {
      setPositionSizing(null);
      return;
    }
    setPositionSizingLoading(true);
    getPositionSizing(portfolioId)
      .then(data => setPositionSizing(data))
      .catch(() => setPositionSizing(null))
      .finally(() => setPositionSizingLoading(false));
  }, [portfolioId]);

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
      } catch {}
      finally { setLoadingStocks(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  return {
    // Terminal state
    symbol, setSymbol,
    exchange, setExchange,
    symbolInput, setSymbolInput,
    timeframe,
    chartData,
    loadingChart,
    symbolDetail,
    loadingDetail,
    matchingHistory,
    orderBook,
    loadingSidebar,
    sidebarTab, setSidebarTab,
    showOrderModal, setShowOrderModal,
    showLeftPanel, setShowLeftPanel,
    inWatchlist,
    watchlistLoading,
    stockList,
    loadingStocks,
    selectedIndex, setSelectedIndex,
    searchStocks, setSearchStocks,

    // Order form state
    orderSymbol, setOrderSymbol,
    orderExchange, setOrderExchange,
    orderSide, setOrderSide,
    orderType, setOrderType,
    isOddLotOrder,
    tradingSession,
    marketPrice, setMarketPrice,
    entryPriceInput, setEntryPriceInput,
    quantityInput, setQuantityInput,
    stopType, setStopType,
    stopPrice, setStopPrice,
    stopPercent, setStopPercent,
    stopMaxLossVnd, setStopMaxLossVnd,
    takeProfitType, setTakeProfitType,
    takeProfitPrice, setTakeProfitPrice,
    takeProfitPercent, setTakeProfitPercent,
    takeProfitRR, setTakeProfitRR,
    submitting, setSubmitting,
    orderMsg, setOrderMsg,
    apiWarnings, setApiWarnings,
    selectedPositionId, setSelectedPositionId,
    showAdvanced, setShowAdvanced,
    showRiskPanel, setShowRiskPanel,

    // AI state
    aiSuggesting,
    aiSuggestions,
    aiSuggestError,
    selectedSuggType, setSelectedSuggType,
    riskEval, setRiskEval,
    riskEvalLoading, setRiskEvalLoading,
    positionSizing,
    positionSizingLoading,

    // Derived values
    effectiveQty,
    entryPoints,
    isMarketEntry,
    currExch,
    lotSize,
    availableOrderTypes,
    effectiveOrderType,
    symbolHoldings,
    totalHeldQty,
    selectedHolding,

    // Actions
    handleSymbolSelect,
    handleTimeframeChange,
    toggleWatchlist,
    handleAiSuggest,
    applyAiSuggestion,
    resetOrderForm,
    loadSymbolData,
    fetchOrderEntry,
  };
}
