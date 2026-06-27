import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ComposedChart } from 'recharts';
import { TraderProfile, AiAnalysis } from '../types';
import { RiskProgressBar } from './RiskProgressBar';
import { TraderCard } from './TraderCard';
import { Sidebar } from './Sidebar';
import { HomeView } from './HomeView';
import { DashboardView } from './DashboardView';
import { TradingTerminal } from './TradingTerminal';
import { PortfolioView } from './PortfolioView';
import { PortfoliosOverviewView } from './PortfoliosOverviewView';
import { WatchlistView } from './WatchlistView';
import { AiSignalsView } from './AiSignalsView';
import { NotificationsView } from './NotificationsView';
import { SettingsView } from './SettingsView';
import { MobileBottomNav } from './ui/MobileBottomNav';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { OnboardingWizard } from './OnboardingWizard';
import { TradingModal } from './trading/TradingModal';
import { ChartModal } from './trading/ChartModal';
import { ToastContainer } from './ui/ToastContainer';
import type { ToastItem } from './ui/ToastContainer';
import { OpenPositionModal } from './portfolio/OpenPositionModal';
import { PortfolioSetupModalStandalone } from './portfolio/PortfolioSetupModalStandalone';
import { analyzeTrader } from '../services/geminiService';
import { portfolioApi, positionApi, realPortfolioApi, marketApi, authApi } from '../services/api';
import type { Position as PositionType, CreatePositionRequest } from '../services/api';
import wsService from '../services/websocket';
import { useActivePortfolio } from '../contexts/ActivePortfolioContext';
import { useHashRoute } from '../hooks/useHashRoute';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_FRACTION_OPTIONS, PRICE_LOCALE, EXCHANGES, formatNumberVI, formatPricePoints, MARKET_INDEX_CODES_BANG_GIA, INDUSTRY_CODES, SINGLE_CHOICE_GROUPS } from '../constants';
import { createPortal } from 'react-dom';

// Toast counter — module-level to persist between renders
let toastIdCounter = 0;

// Icon chấm than + tooltip giải thích cho người không chuyên (dùng trong modal Đặt lệnh)
function ExplainIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex align-middle ml-1 group">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/50"
        aria-label="Giải thích"
      >
        !
      </button>
      {show && (
        <span
          className="absolute left-0 bottom-full mb-1 w-64 p-2.5 text-left text-xs font-normal text-text-main bg-panel border border-border-standard rounded-lg shadow-lg z-[110] pointer-events-none"
          role="tooltip"
        >
          {text}
        </span>
      )}
    </span>
  );
}

// Modal Đặt lệnh (SL: giá cố định / % / thua lỗ tối đa; TP: cố định / % / R:R)

/** Rủi ro VND của một position: ưu tiên tính từ giá điểm để tránh hiển thị sai khi DB lưu cũ (entry từng bị ×1000). */
function getPositionRiskVnd(pos: any): number {
  const p = pos;
  const entry = p.entry_price_points != null ? Number(p.entry_price_points) : Number(p.entry_price);
  const stop = p.stop_loss_points != null ? Number(p.stop_loss_points) : Number(p.stop_loss);
  const entryPoints = (typeof entry === 'number' && entry >= 1000) ? entry / 1000 : entry;
  const stopPoints = (typeof stop === 'number' && stop >= 1000) ? stop / 1000 : stop;
  const qty = Number(p.quantity) || 0;
  if (entryPoints != null && stopPoints != null && qty > 0 && entryPoints > stopPoints) {
    return Math.round((entryPoints - stopPoints) * 1000 * qty);
  }
  return Number(p.risk_value_vnd) || 0;
}

// ─── Toast Notification System ─────────────────────────────────────────────

export function MainApp({ onLogout }: { onLogout: () => void | Promise<void> }) {
  // Phase 10 B-03 — hash-based routing replaces local view state.
  // setCurrentView keeps same call signature; navigation now triggered via window.location.hash.
  const [currentView, setCurrentView] = useHashRoute();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('sidebar_default') !== 'closed');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [wsDisconnected, setWsDisconnected] = useState(false);
  // Phase 10 C-02 — replace native window.confirm for close-position flow
  const [closePositionConfirm, setClosePositionConfirm] = useState<{ position: PositionType } | null>(null);
  const [closingPosition, setClosingPosition] = useState(false);

  // Onboarding wizard — show once for new users
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('tradeguard_onboarding_complete');
  });

  const handleOnboardingComplete = () => {
    localStorage.setItem('tradeguard_onboarding_complete', 'true');
    setShowOnboarding(false);
  };

  // Phase 8 (MP-04): Active portfolio từ Context — thay thế hardcoded portfolios[0]
  const {
    activePortfolio,
    activePortfolioId,
    portfolios: ctxPortfolios,
    refreshPortfolios,
    setActivePortfolioId,
    isLoading: portfoliosLoading,
  } = useActivePortfolio();

  // Core State — `portfolio` mirror activePortfolio để giữ tương thích với callsites cũ.
  // setPortfolio (cũ) chỉ còn dùng cho local override sau khi PUT/POST; sync chính qua effect bên dưới.
  const [portfolio, setPortfolio] = useState<any>(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [maxRiskPercent, setMaxRiskPercent] = useState(5);
  const [expectedReturnPercent, setExpectedReturnPercent] = useState(0);
  const [signals] = useState<any[]>([]); // BE đã bỏ /signals – giữ state rỗng tránh ReferenceError
  const [marketData, setMarketData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stock List State
  const [stocks, setStocks] = useState<any[]>([]);
  const [stocksTotal, setStocksTotal] = useState(0);
  const [stocksPage, setStocksPage] = useState(1);
  const [stocksSearch, setStocksSearch] = useState('');
  const [stocksExchange, setStocksExchange] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('ACB');
  const [selectedExchange, setSelectedExchange] = useState('HOSE');
  const [terminalInitSL, setTerminalInitSL] = useState<number | undefined>(undefined);
  const [terminalInitTP, setTerminalInitTP] = useState<number | undefined>(undefined);
  const [terminalInitSide, setTerminalInitSide] = useState<'LONG' | 'SHORT' | undefined>(undefined);
  const [previousPrices, setPreviousPrices] = useState<{ [key: string]: number }>({});
  const [priceChanges, setPriceChanges] = useState<{ [key: string]: 'up' | 'down' | null }>({});

  // Bảng thị trường theo index (VPBS stockDetailByIndex) – chọn nhiều index
  const [indexDetailList, setIndexDetailList] = useState<any[]>([]);
  const [indexCodes, setIndexCodes] = useState<string[]>(['VNXALL']);
  const indexCode = indexCodes[0] ?? 'VNXALL'; // tương thích nếu có chỗ còn dùng indexCode
  const [indexSearch, setIndexSearch] = useState('');
  const [loadingIndexDetail, setLoadingIndexDetail] = useState(false);
  const [indexDropdownOpen, setIndexDropdownOpen] = useState(false);
  const [marketTableFullscreen, setMarketTableFullscreen] = useState(false);
  const [bondDetailSymbol, setBondDetailSymbol] = useState<string | null>(null);
  const [bondDetailData, setBondDetailData] = useState<any>(null);
  const [loadingBondDetail, setLoadingBondDetail] = useState(false);
  /** Thỏa thuận: Chào mua / Chào bán (Khớp lệnh dùng indexDetailList). */
  const [ptBidList, setPtBidList] = useState<any[]>([]);
  const [ptAskList, setPtAskList] = useState<any[]>([]);

  // UI State
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [insightTrader, setInsightTrader] = useState<TraderProfile | null>(null);
  const [insightContent, setInsightContent] = useState<AiAnalysis | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Chart Modal State
  const [showChartModal, setShowChartModal] = useState(false);
  const [chartModalSymbol, setChartModalSymbol] = useState('');
  const [chartModalExchange, setChartModalExchange] = useState('');
  const [chartModalData, setChartModalData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  // Position State (vị thế mở/đóng)
  const [positions, setPositions] = useState<PositionType[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [showOpenPositionModal, setShowOpenPositionModal] = useState(false);

  // Derived: rủi ro đã dùng = tổng rủi ro (tính từ điểm khi có, tránh số cũ sai)
  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const currentRiskUsed = openPositions.reduce((s, p) => s + getPositionRiskVnd(p), 0);
  const maxRiskAmount = totalBalance > 0 ? (totalBalance * maxRiskPercent) / 100 : 0;
  const riskUsagePercent = maxRiskAmount > 0 ? (currentRiskUsed / maxRiskAmount) * 100 : 0;

  const availableRisk = maxRiskAmount;
  const riskData = [
    { name: 'Đã dùng', value: currentRiskUsed, color: '#1E3A5F' },
    { name: 'Khả dụng', value: availableRisk, color: '#E5E7EB' },
  ];
  const chartRiskPercentage = maxRiskAmount > 0 ? Math.round((currentRiskUsed / maxRiskAmount) * 100) : 0;

  // Load data from API
  useEffect(() => {
    loadData();
    connectWebSocket();

    // Load unread notification count
    import('../services/api').then(({ notificationsApi }) => {
      notificationsApi.getUnreadCount().then(res => {
        if (res.data.success) setUnreadNotifications(res.data.data.count ?? 0);
      }).catch(() => {});
    });

    return () => {
      wsService.disconnect();
    };
  }, []);

  // Phase 8 (MP-04): Sync local portfolio + derived numerics khi activePortfolio đổi.
  // Replace hardcoded portfolios[0] hydration — context handles persistence + selection.
  useEffect(() => {
    if (activePortfolio) {
      setPortfolio(activePortfolio);
      setTotalBalance(parseFloat(activePortfolio.total_balance as any) || 0);
      setMaxRiskPercent(parseFloat(activePortfolio.max_risk_percent as any) || 5);
      setExpectedReturnPercent(parseFloat(activePortfolio.expected_return_percent as any) || 0);
    } else if (!portfoliosLoading && ctxPortfolios.length === 0) {
      // User mới chưa có portfolio nào — show setup modal
      setPortfolio(null);
      setTotalBalance(0);
      setMaxRiskPercent(5);
      setExpectedReturnPercent(0);
      setShowSetupModal(true);
    }
  }, [activePortfolio?.id, activePortfolio?.total_balance, activePortfolio?.max_risk_percent, activePortfolio?.expected_return_percent, portfoliosLoading, ctxPortfolios.length]);

  // Phase 8 (MP-04): WS subscribe lại khi activePortfolioId đổi — unsubscribe old, subscribe new.
  useEffect(() => {
    if (!activePortfolioId) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    wsService.subscribeToPortfolio(activePortfolioId);
    return () => {
      wsService.unsubscribeFromPortfolio(activePortfolioId);
    };
  }, [activePortfolioId]);

  // Listen WebSocket disconnect/reconnect events để hiện banner
  useEffect(() => {
    const handleWsDisconnected = () => setWsDisconnected(true);
    const handleWsReconnected = () => setWsDisconnected(false);
    window.addEventListener('ws:disconnected', handleWsDisconnected);
    window.addEventListener('ws:reconnected', handleWsReconnected);
    return () => {
      window.removeEventListener('ws:disconnected', handleWsDisconnected);
      window.removeEventListener('ws:reconnected', handleWsReconnected);
    };
  }, []);

  // Load stocks when on home (tổng quan) so "Tất cả mã chứng khoán" has data
  useEffect(() => {
    if (currentView === 'home') {
      loadStocks();
    }
  }, [currentView]);

  // Reload stocks when filters change + Auto refresh every 5s for real-time updates
  const stocksLoadingRef = useRef(false);
  useEffect(() => {
    loadStocks();
    const interval = setInterval(() => {
      if (!stocksLoadingRef.current) {
        loadStocks();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [stocksPage, stocksSearch, stocksExchange]);

  const FU_STOCK_TYPES = ['FUVN30', 'FUVN100', 'FUGB'];
  /** Trái phiếu riêng lẻ, chứng quyền, ETF, Phái sinh, Thỏa thuận, Lô lẻ, CP ngành: chỉ được chọn 1 option, không chọn kết hợp. */
  const isSingleOnlyIndexCode = (code: string) =>
    code === 'BOND' || code === 'CQ' || code === 'EF' || FU_STOCK_TYPES.includes(code) || String(code).startsWith('PT_') || String(code).startsWith('OL_') || String(code).startsWith('INDUSTRY_');

  const toggleIndexCode = (code: string, current: string[]) => {
    const singleOnly = isSingleOnlyIndexCode(code);
    const isSelected = current.includes(code);
    if (singleOnly) {
      if (isSelected) return ['VNXALL'];
      return [code];
    }
    if (isSelected) return current.length > 1 ? current.filter((c) => c !== code) : ['VNXALL'];
    const hasSingleOnly = current.some((c) => isSingleOnlyIndexCode(c));
    if (hasSingleOnly) return [code];
    return [...current, code].sort();
  };

  const isBondView = indexCodes.length === 1 && indexCodes[0] === 'BOND';
  const isCWView = indexCodes.length === 1 && indexCodes[0] === 'CQ';
  const isEFView = indexCodes.length === 1 && indexCodes[0] === 'EF';
  const isPTView = indexCodes.length === 1 && String(indexCodes[0]).startsWith('PT_');
  const ptMarketCode = isPTView ? String(indexCodes[0]).replace(/^PT_/, '') : '';
  const isOddLotView = indexCodes.length === 1 && String(indexCodes[0]).startsWith('OL_');
  const oddLotMarketCode = isOddLotView ? String(indexCodes[0]).replace(/^OL_/, '') : '';
  const isFUView = indexCodes.length === 1 && FU_STOCK_TYPES.includes(indexCodes[0]);
  const fuStockType = isFUView ? indexCodes[0] : '';
  const isIndustryView = indexCodes.length === 1 && String(indexCodes[0]).startsWith('INDUSTRY_');
  const industryCode = isIndustryView ? String(indexCodes[0]).replace(/^INDUSTRY_/, '') : '';
  const industryName = industryCode ? (INDUSTRY_CODES.find((i) => i.code === industryCode)?.name ?? industryCode) : '';

  /** Label ngắn hiển thị trên nút Danh mục */
  const indexSelectionLabel =
    indexCodes.length === 0 || (indexCodes.length === 1 && indexCodes[0] === 'VNXALL')
      ? 'VNXALL'
      : indexCodes.length === 1 && indexCodes[0] === 'BOND'
        ? 'Trái phiếu riêng lẻ'
        : indexCodes.length === 1 && indexCodes[0] === 'CQ'
          ? 'Chứng quyền'
          : indexCodes.length === 1 && indexCodes[0] === 'EF'
            ? 'ETF'
            : indexCodes.length === 1 && isPTView
              ? `Thỏa thuận (${ptMarketCode})`
              : indexCodes.length === 1 && isOddLotView
                ? `Lô lẻ ${oddLotMarketCode === 'UPCOM' ? 'Upcom' : oddLotMarketCode}`
                : indexCodes.length === 1 && isFUView
                  ? (MARKET_INDEX_CODES_BANG_GIA.find((x) => x.code === fuStockType)?.name ?? fuStockType)
                  : indexCodes.length === 1 && isIndustryView
                    ? `Ngành: ${industryName}`
                    : indexCodes.length <= 2
                      ? indexCodes.map((c) => MARKET_INDEX_CODES_BANG_GIA.find((x) => x.code === c)?.name ?? c).join(', ')
                      : `${indexCodes.length} danh mục`;

  async function loadIndexDetail() {
    setLoadingIndexDetail(true);
    if (!isPTView) {
      setPtBidList([]);
      setPtAskList([]);
    }
    try {
      if (isBondView) {
        const res = await marketApi.getCorpBondList({ symbols: 'ALL' });
        setIndexDetailList(Array.isArray(res.data?.data) ? res.data.data : []);
      } else if (isCWView) {
        const res = await marketApi.getStockCWDetail({ stockType: 'CW', pageNo: 1, pageSize: 5000 });
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setIndexDetailList(res.data.data);
        } else {
          setIndexDetailList([]);
        }
      } else if (isEFView) {
        const res = await marketApi.getStockEFDetail({ stockType: 'EF', pageNo: 1, pageSize: 5000 });
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setIndexDetailList(res.data.data);
        } else {
          setIndexDetailList([]);
        }
      } else if (isIndustryView && industryCode) {
        const res = await marketApi.getStockDetailByIndustry({ industryCode, pageNo: 1, pageSize: 5000 });
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setIndexDetailList(res.data.data);
        } else {
          setIndexDetailList([]);
        }
      } else if (isPTView && ptMarketCode) {
        const [matchRes, bidRes, askRes] = await Promise.all([
          marketApi.getPtStockMatch({ marketCode: ptMarketCode }),
          marketApi.getPtStockBid({ marketCode: ptMarketCode }),
          marketApi.getPtStockAsk({ marketCode: ptMarketCode }),
        ]);
        setIndexDetailList(matchRes.data?.success && Array.isArray(matchRes.data?.data) ? matchRes.data.data : []);
        setPtBidList(bidRes.data?.success && Array.isArray(bidRes.data?.data) ? bidRes.data.data : []);
        setPtAskList(askRes.data?.success && Array.isArray(askRes.data?.data) ? askRes.data.data : []);
      } else if (isOddLotView && oddLotMarketCode) {
        setPtBidList([]);
        setPtAskList([]);
        const res = await marketApi.getOddLotStockDetail({ marketCode: oddLotMarketCode, pageNo: 1, pageSize: 5000 });
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setIndexDetailList(res.data.data);
        } else {
          setIndexDetailList([]);
        }
      } else if (isFUView && fuStockType) {
        setPtBidList([]);
        setPtAskList([]);
        const res = await marketApi.getStockFUDetail({ stockType: fuStockType, pageNo: 1, pageSize: 5000 });
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setIndexDetailList(res.data.data);
        } else {
          setIndexDetailList([]);
        }
      } else {
        setPtBidList([]);
        setPtAskList([]);
        const res = await marketApi.getStockDetailByIndex({ indexCodes: indexCodes.length ? indexCodes : ['VNXALL'], pageNo: 1, pageSize: 500 });
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setIndexDetailList(res.data.data);
        } else {
          setIndexDetailList([]);
        }
      }
    } catch {
      setIndexDetailList([]);
    } finally {
      setLoadingIndexDetail(false);
    }
  }

  useEffect(() => {
    if (currentView === 'home') loadIndexDetail();
  }, [currentView, indexCodes.join(',')]);

  useEffect(() => {
    if (!bondDetailSymbol) {
      setBondDetailData(null);
      return;
    }
    setLoadingBondDetail(true);
    setBondDetailData(null);
    marketApi.getCorpBondInfo(bondDetailSymbol)
      .then((res) => { setBondDetailData(res.data?.data ?? res.data); })
      .catch(() => setBondDetailData(null))
      .finally(() => setLoadingBondDetail(false));
  }, [bondDetailSymbol]);

  // Load positions khi có portfolio
  async function loadPositions() {
    if (!portfolio?.id) return;
    setLoadingPositions(true);
    try {
      const res = await realPortfolioApi.getOpenPositions(portfolio.id);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setPositions(res.data.data);
      }
    } catch (e: any) {
      // 404 = portfolio không tồn tại hoặc API positions chưa sẵn sàng → coi như danh sách rỗng
      if (e?.response?.status === 404) {
        setPositions([]);
      } else {
        console.error('Load positions error:', e);
      }
    } finally {
      setLoadingPositions(false);
    }
  }

  useEffect(() => {
    if (portfolio?.id) loadPositions();
  }, [portfolio?.id]);

  // Phase 10 C-02 — close-position confirm flow (replaces native window.confirm)
  const handleConfirmClosePosition = async () => {
    if (!closePositionConfirm || !portfolio) return;
    const pos = closePositionConfirm.position;
    setClosingPosition(true);
    try {
      await positionApi.close(portfolio.id, pos.id, {
        reason: 'CLOSED_MANUAL',
        use_market_price: true,
      });
      setClosePositionConfirm(null);
      await loadPositions();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Đóng lệnh thất bại.');
      setClosePositionConfirm(null);
    } finally {
      setClosingPosition(false);
    }
  };

  async function loadData() {
    try {
      setLoading(true);

      // Phase 8 (MP-04): Portfolio loading + selection handled bởi ActivePortfolioContext.
      // Context fetches on mount khi có auth_token; sync vào local state qua useEffect.
      // KHÔNG còn portfolios[0] hardcode — user pick via PortfolioSwitcher (Sidebar top).

      // Load market data for VNINDEX
      await loadMarketData();

      // Load all stocks
      await loadStocks();

    } catch (error) {
      console.error('Load data error:', error);
      // Auth error is handled by axios interceptor (will reload page)
    } finally {
      setLoading(false);
    }
  }

  async function loadMarketData() {
    try {
      // Note: VNINDEX not available in DB, using ACB stock as market data example
      const res = await marketApi.getOHLCV('ACB', { exchange: 'HOSE', timeframe: '1d', limit: 30 });

      if (res.data.success && Array.isArray(res.data.data)) {
        const data = res.data.data.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleDateString(),
          open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
          high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
          low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
          close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
          volume: parseFloat(item.volume)
        }));
        setMarketData(data);
      } else {
        console.warn('No market data available');
        setMarketData([]);
      }
    } catch (error: any) {
      if (error?.response?.status === 503) {
        console.warn('Market data temporarily unavailable (data provider may be down).');
      } else {
        console.error('Load market data error:', error);
      }
      setMarketData([]); // Set empty array on error
    }
  }


  async function loadStocks() {
    if (stocksLoadingRef.current) return;
    stocksLoadingRef.current = true;
    try {
      const res = await marketApi.getStocks(
        {
          page: stocksPage,
          limit: 50,
          search: stocksSearch || undefined,
          exchange: stocksExchange || undefined,
          sort: 'symbol',
          order: 'ASC'
        },
        { timeout: 60000 }
      );

      if (res.data.success) {
        const newStocks = res.data.data;

        // Detect price changes for flash effect (chỉ khi có giá hợp lệ)
        const changes: { [key: string]: 'up' | 'down' | null } = {};
        const prices: { [key: string]: number } = {};
        newStocks.forEach((stock: any) => {
          const key = `${stock.symbol}-${stock.exchange}`;
          const newPrice = Number(stock.price);
          const oldPrice = previousPrices[key];
          if (Number.isFinite(newPrice)) {
            prices[key] = newPrice;
            if (oldPrice !== undefined && Number.isFinite(oldPrice) && oldPrice !== newPrice) {
              changes[key] = newPrice > oldPrice ? 'up' : 'down';
            }
          }
        });

        setStocks(newStocks);
        setStocksTotal(res.data.pagination.total);
        setPriceChanges(changes);
        setPreviousPrices(prices);

        // Clear flash after 1 second
        setTimeout(() => {
          setPriceChanges({});
        }, 1000);
      }
    } catch (error: any) {
      if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
        console.warn('Cannot connect to server. Is the backend running at localhost:3000?');
      } else {
        console.error('Load stocks error:', error);
      }
    } finally {
      stocksLoadingRef.current = false;
    }
  }

  async function handleStockClick(symbol: string, exchange: string) {
    setChartModalSymbol(symbol);
    setChartModalExchange(exchange);
    setShowChartModal(true);
    loadChartData(symbol, exchange, '1d');
  }

  async function loadChartData(symbol: string, exchange: string, timeframe: string) {
    setLoadingChart(true);
    setChartModalData([]);

    // Determine limit based on timeframe
    let limit = 90;
    if (timeframe === '1m') limit = 500;
    else if (timeframe === '1d') limit = 90;
    else if (timeframe === '1w') limit = 52;
    else if (timeframe === '1M') limit = 24;

    try {
      const res = await marketApi.getOHLCV(symbol, { exchange, timeframe, limit });
      if (res.data.success && Array.isArray(res.data.data)) {
        const data = res.data.data.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleDateString('vi-VN'),
          open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
          high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
          low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
          close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
          volume: parseFloat(item.volume)
        }));
        setChartModalData(data);
      }
    } catch (error: any) {
      // 404 thường gặp với 1m (dữ liệu intraday chỉ có trong giờ giao dịch)
      if (error?.response?.status === 404 && timeframe === '1m') {
        console.warn('1m chart not available (market closed or no intraday data)');
      } else {
        console.error('Load chart error:', error?.response?.data || error?.message);
      }
    } finally {
      setLoadingChart(false);
    }
  }

  async function handleSymbolChangeInModal(symbol: string, exchange: string) {
    setChartModalSymbol(symbol);
    setChartModalExchange(exchange);
    setLoadingChart(true);
    setChartModalData([]);

    // Load chart data for new symbol
    try {
      const res = await marketApi.getOHLCV(symbol, { exchange, timeframe: '1d', limit: 90 });
      if (res.data.success && Array.isArray(res.data.data)) {
        const data = res.data.data.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleDateString('vi-VN'),
          open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
          high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
          low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
          close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
          volume: parseFloat(item.volume)
        }));
        setChartModalData(data);
      }
    } catch (error) {
      console.error('Load chart error:', error);
    } finally {
      setLoadingChart(false);
    }
  }
  function connectWebSocket() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('No auth token, skipping WebSocket');
      return;
    }

    wsService.connect();

    // Phase 8 (MP-04): Portfolio subscription handled bởi effect riêng theo activePortfolioId
    // (auto unsubscribe old + subscribe new khi user switch danh mục).

    wsService.onRiskUpdate((data) => {
      if (portfolio) {
        loadData();
      }
    });

    wsService.onNotification((data) => {
      // Tăng badge unread
      setUnreadNotifications(prev => prev + 1);
      // Hiện toast nhỏ ở góc màn hình
      const id = `toast_${++toastIdCounter}`;
      setToasts(prev => [...prev.slice(-4), { id, title: data.title ?? 'Thông báo', message: data.message ?? '', severity: data.severity ?? 'INFO' }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    });
  }

  const handleAiCheck = async (trader: TraderProfile) => {
    setAnalyzingId(trader.id);
    const marketContext = "Bitcoin (BTC) is trading around 50k support. Market sentiment is cautious. Expect volatility.";
    const result = await analyzeTrader(trader, marketContext);
    if (result) {
      setInsightTrader(trader);
      setInsightContent(result);
    } else {
      alert("Không thể phân tích. Vui lòng thử lại.");
    }
    setAnalyzingId(null);
  };

  const closeInsightModal = () => {
    setInsightContent(null);
    setInsightTrader(null);
  };

  return (
    <div className="flex min-h-screen overflow-hidden font-sans text-text-main bg-panel selection:bg-accent/10">

      {/* Banner mất kết nối WebSocket */}
      {wsDisconnected && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-[12px] font-semibold text-white"
          style={{ background: '#d97706' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Mất kết nối server. Đang thử kết nối lại... Dữ liệu có thể không được cập nhật.
          <button
            onClick={() => setWsDisconnected(false)}
            className="ml-2 text-white/70 hover:text-white"
            aria-label="Đóng banner"
          >
            ✕
          </button>
        </div>
      )}

      <PortfolioSetupModalStandalone
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        initialBalance={totalBalance}
        initialRisk={maxRiskPercent}
        initialExpectedReturn={expectedReturnPercent}
        portfolioId={portfolio?.id}
        onSave={async (balance, riskPercent, expectedReturn) => {
          try {
            if (portfolio) {
              const res = await portfolioApi.update(portfolio.id, {
                name: portfolio.name,
                totalBalance: balance,
                maxRiskPercent: riskPercent,
                expectedReturnPercent: expectedReturn,
              });
              if (res.data?.data) {
                // Phase 8 (MP-04): refresh context để switcher + local state sync
                await refreshPortfolios();
              }
            } else {
              // D-21 backward compat: lần đầu tạo portfolio → default SWING preset.
              const res = await portfolioApi.create({
                name: 'Danh mục mặc định',
                totalBalance: balance,
                portfolioType: 'SWING',
                maxRiskPercent: riskPercent,
                expectedReturnPercent: expectedReturn,
              });
              if (res.data?.data?.id) {
                await refreshPortfolios();
                setActivePortfolioId(res.data.data.id);
              }
            }
            setShowSetupModal(false);
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Lưu thất bại. Vui lòng thử lại.';
            alert(msg);
          }
        }}
        onDelete={portfolio ? async () => {
          try {
            await portfolioApi.delete(portfolio.id);
            // Phase 8 (MP-04): refresh context — auto-select portfolio đầu tiên còn lại
            // (hoặc clear nếu hết). Local state sync qua useEffect.
            await refreshPortfolios();
            setShowSetupModal(false);
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Xóa thất bại. Vui lòng thử lại.';
            alert(msg);
          }
        } : undefined}
      />

      {/* Phase 10 C-02 — close-position confirm (replaces native window.confirm) */}
      <ConfirmDialog
        isOpen={closePositionConfirm !== null}
        variant="warning"
        title="Đóng vị thế"
        message={
          closePositionConfirm
            ? `Đóng lệnh ${closePositionConfirm.position.symbol} theo giá thị trường hiện tại (VPBS)?`
            : ''
        }
        confirmLabel="Đóng vị thế"
        cancelLabel="Huỷ"
        loading={closingPosition}
        onConfirm={handleConfirmClosePosition}
        onCancel={() => setClosePositionConfirm(null)}
      />

      <TradingModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        symbol={chartModalSymbol}
        exchange={chartModalExchange}
        data={chartModalData}
        loading={loadingChart}
        onTimeframeChange={loadChartData}
      />

      {/* Modal chi tiết trái phiếu */}
      {bondDetailSymbol != null && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4" onClick={() => setBondDetailSymbol(null)}>
          <div className="bg-panel rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-standard bg-panel">
              <h2 className="text-lg font-semibold text-text-main">Chi tiết trái phiếu — {bondDetailSymbol}</h2>
              <button type="button" onClick={() => setBondDetailSymbol(null)} className="p-2 rounded-lg hover:bg-panel-hover text-text-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {loadingBondDetail ? (
                <p className="text-text-muted text-sm">Đang tải...</p>
              ) : bondDetailData ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {typeof bondDetailData === 'object' && !Array.isArray(bondDetailData) && Object.entries(bondDetailData).map(([key, val]) => (
                    <div key={key} className="border-b border-border-standard/50 pb-2">
                      <dt className="text-text-muted font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                      <dd className="text-text-main mt-0.5 font-mono">{val != null && typeof val === 'object' ? JSON.stringify(val) : String(val)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-text-muted text-sm">Không có dữ liệu chi tiết.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {portfolio?.id && (
        <OpenPositionModal
          isOpen={showOpenPositionModal}
          onClose={() => setShowOpenPositionModal(false)}
          portfolioId={portfolio.id}
          onSuccess={loadPositions}
        />
      )}

      <ChartModal
        isOpen={false}
        onClose={() => setShowChartModal(false)}
        symbol={chartModalSymbol}
        exchange={chartModalExchange}
        data={chartModalData}
        loading={loadingChart}
        stocks={stocks}
        onSymbolChange={handleSymbolChangeInModal}
      />

      <Sidebar
        currentView={currentView}
        onChangeView={setCurrentView}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onLogout={onLogout}
        unreadNotifications={unreadNotifications}
      />
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      <MobileBottomNav currentView={currentView} onChangeView={setCurrentView} unreadNotifications={unreadNotifications} />

      {/* ── NEW FULL-SCREEN VIEWS (no padding) ── */}
      {(currentView === 'terminal') && (
        <div className={`fixed top-0 bottom-0 right-0 left-0 transition-all duration-200 ${isSidebarOpen ? 'lg:left-[200px]' : 'lg:left-[52px]'}`}>
          <TradingTerminal
            portfolioId={portfolio?.id ?? null}
            initialSymbol={selectedSymbol}
            initialExchange={selectedExchange}
            initialStopLoss={terminalInitSL}
            initialTakeProfit={terminalInitTP}
            initialSide={terminalInitSide}
            sidebarWidth={isSidebarOpen ? 200 : 52}
            openPositions={openPositions}
            onOpenPosition={loadPositions}
            onNavigate={setCurrentView}
          />
        </div>
      )}

      {/* ── STANDARD VIEWS (with padding) ── */}
      {currentView !== 'terminal' && (
      <main
        className={`flex-1 p-4 md:p-5 overflow-y-auto h-screen scroll-smooth relative pb-24 lg:pb-6 transition-all duration-200 ${isSidebarOpen ? 'lg:ml-[200px]' : 'lg:ml-[52px]'}`}
      >

        {/* Cross-Portfolio Overview (Phase 8 — MP-05) */}
        {currentView === 'overview' && (
          <PortfoliosOverviewView onNavigateToDashboard={() => setCurrentView('dashboard')} />
        )}

        {/* Dashboard (home / dashboard) */}
        {(currentView === 'dashboard' || currentView === 'home') && (
          <DashboardView
            portfolioId={portfolio?.id ?? null}
            totalBalance={totalBalance}
            openPositions={openPositions}
            riskUsed={currentRiskUsed}
            maxRisk={maxRiskAmount}
            onNavigate={setCurrentView}
          />
        )}

        {/* Portfolio View */}
        {currentView === 'portfolio' && (
          <PortfolioView
            portfolioId={portfolio?.id ?? null}
            totalBalance={totalBalance}
            maxRiskPercent={maxRiskPercent}
            expectedReturnPercent={expectedReturnPercent}
            openPositions={openPositions}
            onNavigate={setCurrentView}
            onRefreshPositions={loadPositions}
            onOpenSetup={() => setShowSetupModal(true)}
          />
        )}

        {/* Watchlist View */}
        {currentView === 'watchlist' && (
          <WatchlistView
            onNavigate={setCurrentView}
            onOpenTrading={(sym, exch, opts) => {
              setSelectedSymbol(sym);
              setSelectedExchange(exch);
              setTerminalInitSL(opts?.stopLoss);
              setTerminalInitTP(opts?.takeProfit);
              setTerminalInitSide(opts?.side);
              setCurrentView('terminal');
            }}
          />
        )}

        {/* AI Signals View */}
        {currentView === 'signals' && (
          <AiSignalsView
            traders={[]}
            onAiCheck={handleAiCheck}
            analyzingId={analyzingId}
            insightContent={insightContent}
            insightTrader={insightTrader}
            onNavigate={setCurrentView}
          />
        )}

        {/* Bảng giá (home_legacy view ID retired in Phase 10 B-03 — 'market' only) */}
        {currentView === 'market' && (
          <div className="w-full animate-fade-in">
            <HomeView
              totalBalance={totalBalance}
              activePositionsCount={openPositions.length}
              riskUsed={currentRiskUsed}
              maxRisk={maxRiskAmount}
              onNavigate={setCurrentView}
              marketDataContent={
                /* Bảng dữ liệu thị trường — toolbar responsive, bảng scroll ngang trên mobile */
                <>
                  <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center border border-border-subtle rounded px-3 py-1.5 w-full sm:w-40 min-w-0 bg-transparent">
                      <svg className="w-3.5 h-3.5 text-text-dim shrink-0 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input type="text" placeholder="Tìm mã..." value={indexSearch} onChange={(e) => setIndexSearch(e.target.value)} className="bg-transparent border-0 outline-none text-text-main text-[12px] placeholder-text-dim w-full min-w-0" />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:justify-end min-w-0">
                      <div className="relative flex-1 min-w-0 sm:flex-initial">
                        <button type="button" onClick={() => setIndexDropdownOpen((o) => !o)} className="w-full sm:w-auto flex items-center px-3 py-1.5 rounded text-[11px] font-semibold text-text-main border border-border-subtle hover:border-accent/40 transition-colors min-w-0 sm:min-w-[120px]">
                          <span className="truncate">{indexSelectionLabel}</span>
                        </button>
                        {indexDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIndexDropdownOpen(false)} aria-hidden />
                            <div className="absolute right-0 top-full mt-1 z-50 w-[280px] max-h-[70vh] overflow-y-auto rounded-md bg-bg-panel border border-border-subtle shadow-lg py-1.5">
                              <div className="px-3 py-1.5 border-b border-border-subtle flex gap-2 flex-wrap">
                                <button type="button" onClick={() => { setIndexCodes(['VNXALL']); setIndexDropdownOpen(false); }} className="text-[11px] font-medium text-accent hover:bg-accent/10 px-2 py-1 rounded">Mặc định</button>
                                <button type="button" onClick={() => { setIndexCodes(MARKET_INDEX_CODES_BANG_GIA.filter((x) => !isSingleOnlyIndexCode(x.code)).map((x) => x.code)); setIndexDropdownOpen(false); }} className="text-[11px] font-medium text-text-muted hover:bg-panel-hover px-2 py-1 rounded">Tất cả</button>
                              </div>
                              <div className="py-1.5">
                                <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-text-dim">Chỉ số (chọn nhiều)</p>
                                <div className="flex flex-wrap gap-1 px-2">
                                  {['VNXALL', 'VN30', 'VN100', 'HOSE', 'HNX', 'UPCOM', 'VNALL', 'VNX50', 'HNX30'].map((code) => {
                                    const item = MARKET_INDEX_CODES_BANG_GIA.find((x) => x.code === code); if (!item) return null;
                                    const isSelected = indexCodes.includes(code);
                                    return (
                                      <button key={code} type="button" onClick={() => setIndexCodes(toggleIndexCode(code, indexCodes))} className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${isSelected ? 'bg-accent text-white' : 'text-text-main hover:bg-panel-hover'}`}>{item.name}</button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="py-1.5 border-t border-border-subtle">
                                <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-text-dim">Một lựa chọn</p>
                                {SINGLE_CHOICE_GROUPS.map((group) => (
                                  <div key={group.label} className="mt-1.5 first:mt-0">
                                    <p className="px-3 py-0.5 text-[9px] font-medium uppercase tracking-wider text-text-dim">{group.label}</p>
                                    <div className="flex flex-wrap gap-1 px-2 mt-0.5">
                                      {group.codes.map((code) => {
                                        const item = MARKET_INDEX_CODES_BANG_GIA.find((x) => x.code === code); if (!item) return null;
                                        const isSelected = indexCodes.includes(code);
                                        return (
                                          <button key={code} type="button" onClick={() => setIndexCodes(toggleIndexCode(code, indexCodes))} className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${isSelected ? 'bg-accent text-white' : 'text-text-main hover:bg-panel-hover'}`}>{item.name}</button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="py-1.5 border-t border-border-subtle">
                                <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-text-dim">CP theo ngành</p>
                                <div className="px-2 pb-1">
                                  <select
                                    value={industryCode ? `INDUSTRY_${industryCode}` : ''}
                                    onChange={(e) => { const v = e.target.value; if (v) setIndexCodes([v]); else if (isIndustryView) setIndexCodes(['VNXALL']); }}
                                    className="w-full px-2 py-1.5 text-[12px] font-medium text-text-main bg-transparent border border-border-subtle rounded focus:border-accent outline-none"
                                  >
                                    <option value="">— Chọn ngành —</option>
                                    {INDUSTRY_CODES.map((i) => (
                                      <option key={i.code} value={`INDUSTRY_${i.code}`}>{i.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <button type="button" onClick={() => setMarketTableFullscreen((f) => !f)} className="p-1.5 rounded text-text-dim hover:text-accent transition-colors shrink-0" title={marketTableFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}>
                        {marketTableFullscreen ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>}
                      </button>
                    </div>
                  </div>
                  {marketTableFullscreen && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[9999] flex flex-col">
                      <div className="absolute inset-0 bg-black/50" onClick={() => setMarketTableFullscreen(false)} aria-hidden />
                      <div className="absolute inset-2 sm:inset-4 flex flex-col bg-panel rounded-xl shadow-2xl overflow-hidden z-10">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-border-standard bg-panel shrink-0">
                          <span className="text-sm font-semibold text-text-main">Bảng giá thị trường — Toàn màn hình</span>
                          <button type="button" onClick={() => setMarketTableFullscreen(false)} className="p-1.5 rounded-lg hover:bg-panel-hover text-text-muted">Thu nhỏ</button>
                        </div>
                        <div className="w-full bg-panel border-b border-border-standard flex items-center gap-3 px-4 py-3 min-h-12 shrink-0">
                          <div className="flex items-center bg-panel border border-border-standard rounded-lg px-3 py-2 w-44 sm:w-52 flex-shrink-0">
                            <input type="text" placeholder="Tìm mã..." value={indexSearch} onChange={(e) => setIndexSearch(e.target.value)} className="bg-transparent border-0 outline-none text-text-main text-sm placeholder-[#9CA3AF] w-full min-w-0" />
                          </div>
                          <div className="flex-1 min-w-0 flex items-center justify-end">
                            <div className="relative">
                              <button type="button" onClick={(e) => { e.stopPropagation(); setIndexDropdownOpen((o) => !o); }} className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-text-main bg-panel hover:bg-panel border border-border-standard transition-colors min-w-[140px]">
                                <span className="truncate">{indexSelectionLabel}</span>
                              </button>
                              {indexDropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-[10040]" onClick={() => setIndexDropdownOpen(false)} aria-hidden />
                                  <div className="absolute right-0 top-full mt-1.5 z-[10050] w-[300px] max-h-[60vh] overflow-y-auto rounded-xl bg-panel border border-border-standard shadow-xl py-2">
                                    <div className="px-3 py-2 border-b border-border-standard flex gap-2 flex-wrap">
                                      <button type="button" onClick={() => { setIndexCodes(['VNXALL']); setIndexDropdownOpen(false); }} className="text-xs font-medium text-accent hover:bg-accent-hover px-2 py-1.5 rounded">Mặc định</button>
                                      <button type="button" onClick={() => { setIndexCodes(MARKET_INDEX_CODES_BANG_GIA.filter((x) => !isSingleOnlyIndexCode(x.code)).map((x) => x.code)); setIndexDropdownOpen(false); }} className="text-xs font-medium text-text-muted hover:bg-panel px-2 py-1.5 rounded">Tất cả chỉ số</button>
                                    </div>
                                    <div className="py-2">
                                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Chỉ số (chọn nhiều)</p>
                                      <div className="flex flex-wrap gap-1 px-2">
                                        {['VNXALL', 'VN30', 'VN100', 'HOSE', 'HNX', 'UPCOM', 'VNALL', 'VNX50', 'HNX30'].map((code) => {
                                          const item = MARKET_INDEX_CODES_BANG_GIA.find((x) => x.code === code); if (!item) return null;
                                          const isSelected = indexCodes.includes(code);
                                          return (
                                            <button key={code} type="button" onClick={() => setIndexCodes(toggleIndexCode(code, indexCodes))} className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${isSelected ? 'bg-[#0B6E4B] text-white' : 'bg-panel text-text-main hover:bg-panel-hover'}`}>{item.name}</button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div className="py-2 border-t border-border-standard">
                                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Một lựa chọn</p>
                                      {SINGLE_CHOICE_GROUPS.map((group) => (
                                        <div key={group.label} className="mt-2 first:mt-0">
                                          <p className="px-3 py-0.5 text-[9px] font-medium uppercase tracking-wide text-text-muted">{group.label}</p>
                                          <div className="flex flex-wrap gap-1 px-2 mt-0.5">
                                            {group.codes.map((code) => {
                                              const item = MARKET_INDEX_CODES_BANG_GIA.find((x) => x.code === code); if (!item) return null;
                                              const isSelected = indexCodes.includes(code);
                                              return (
                                                <button key={code} type="button" onClick={() => setIndexCodes(toggleIndexCode(code, indexCodes))} className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${isSelected ? 'bg-accent text-white' : 'bg-panel text-text-main hover:bg-panel-hover'}`}>{item.name}</button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="py-2 border-t border-border-standard">
                                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">CP theo ngành</p>
                                      <div className="px-2 pb-1">
                                        <select
                                          value={industryCode ? `INDUSTRY_${industryCode}` : ''}
                                          onChange={(e) => { const v = e.target.value; if (v) setIndexCodes([v]); else if (isIndustryView) setIndexCodes(['VNXALL']); }}
                                          className="w-full px-3 py-2 text-sm font-medium text-text-main bg-panel border border-border-standard rounded-lg focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] outline-none"
                                        >
                                          <option value="">— Chọn ngành —</option>
                                          {INDUSTRY_CODES.map((i) => (
                                            <option key={i.code} value={`INDUSTRY_${i.code}`}>{i.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto">
                          {isPTView ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
                              {/* Chào mua */}
                              <div className="rounded-lg border border-border-standard bg-panel overflow-hidden flex flex-col min-h-0">
                                <div className="px-3 py-2 bg-panel border-b border-border-standard font-semibold text-text-muted text-sm shrink-0">Chào mua</div>
                                <div className="flex-1 min-h-0 overflow-auto">
                                  <table className="trading-table">
                                    <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold border-b border-border-standard sticky top-0 z-10">
                                      <tr>
                                        <th className="px-2 py-1.5 whitespace-nowrap">Mã CK</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">Giá</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">KL</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">Thời gian</th>
                                      </tr>
                                    </thead>
                                    <tbody className="text-text-main divide-y divide-border-subtle">
                                      {loadingIndexDetail && ptBidList.length === 0 ? (
                                        <tr><td colSpan={4} className="px-3 py-8 text-center text-text-muted text-xs">Đang tải dữ liệu...</td></tr>
                                      ) : ptBidList.length === 0 ? (
                                        <tr><td colSpan={4} className="px-3 py-8 text-center text-text-muted text-xs">Hiện tại không có dữ liệu.</td></tr>
                                      ) : ptBidList.slice(0, 200).map((r: any, i: number) => {
                                        const fmt = (v: number | null | undefined, scale = 1) => v != null && Number.isFinite(v) ? (v * scale).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
                                        const fmtVol = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '—';
                                        return (
                                          <tr key={`bid-${r.symbol}-${i}`} onClick={() => handleStockClick(r.symbol, ptMarketCode || 'HOSE')} className="hover:bg-panel-hover cursor-pointer">
                                            <td className="px-2 py-1.5 font-medium text-accent whitespace-nowrap text-xs">{r.symbol}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-xs">{fmt(r.price)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmtVol(r.volume)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{r.time || '—'}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              {/* Khớp lệnh */}
                              <div className="rounded-lg border border-border-standard bg-panel overflow-hidden flex flex-col min-h-0">
                                <div className="px-3 py-2 bg-panel border-b border-border-standard font-semibold text-text-muted text-sm shrink-0">Khớp lệnh</div>
                                <div className="flex-1 min-h-0 overflow-auto">
                                  <table className="trading-table">
                                    <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold border-b border-border-standard sticky top-0 z-10">
                                      <tr>
                                        <th className="px-2 py-1.5 whitespace-nowrap">Mã CK</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">Tham chiếu</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">Giá</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">KL</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">Giá trị</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">Thời gian</th>
                                      </tr>
                                    </thead>
                                    <tbody className="text-text-main divide-y divide-border-subtle">
                                      {loadingIndexDetail && indexDetailList.length === 0 ? (
                                        <tr><td colSpan={6} className="px-3 py-8 text-center text-text-muted text-xs">Đang tải dữ liệu...</td></tr>
                                      ) : (() => {
                                        const search = indexSearch.trim().toUpperCase();
                                        const filtered = search ? indexDetailList.filter((r: any) => (r.symbol || '').toUpperCase().includes(search)) : indexDetailList;
                                        if (filtered.length === 0) return <tr><td colSpan={6} className="px-3 py-8 text-center text-text-muted text-xs">Hiện tại không có dữ liệu.</td></tr>;
                                        const fmt = (v: number | null | undefined, scale = 1) => v != null && Number.isFinite(v) ? (v * scale).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
                                        const fmtVol = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '—';
                                        return filtered.slice(0, 500).map((r: any, i: number) => (
                                          <tr key={`match-${r.symbol}-${r.time}-${i}`} onClick={() => handleStockClick(r.symbol, ptMarketCode || 'HOSE')} className="hover:bg-panel-hover cursor-pointer">
                                            <td className="px-2 py-1.5 font-semibold text-accent whitespace-nowrap text-xs">{r.symbol}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmt(r.refPrice)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-xs">{fmt(r.price)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmtVol(r.volume)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmtVol(r.value)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{r.time || '—'}</td>
                                          </tr>
                                        ));
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              {/* Chào bán */}
                              <div className="rounded-lg border border-border-standard bg-panel overflow-hidden flex flex-col min-h-0">
                                <div className="px-3 py-2 bg-panel border-b border-border-standard font-semibold text-text-muted text-sm shrink-0">Chào bán</div>
                                <div className="flex-1 min-h-0 overflow-auto">
                                  <table className="trading-table">
                                    <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold border-b border-border-standard sticky top-0 z-10">
                                      <tr>
                                        <th className="px-2 py-1.5 whitespace-nowrap">Mã CK</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">Giá</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">KL</th>
                                        <th className="px-2 py-1.5 text-right whitespace-nowrap">Thời gian</th>
                                      </tr>
                                    </thead>
                                    <tbody className="text-text-main divide-y divide-border-subtle">
                                      {loadingIndexDetail && ptAskList.length === 0 ? (
                                        <tr><td colSpan={4} className="px-3 py-8 text-center text-text-muted text-xs">Đang tải dữ liệu...</td></tr>
                                      ) : ptAskList.length === 0 ? (
                                        <tr><td colSpan={4} className="px-3 py-8 text-center text-text-muted text-xs">Hiện tại không có dữ liệu.</td></tr>
                                      ) : ptAskList.slice(0, 200).map((r: any, i: number) => {
                                        const fmt = (v: number | null | undefined, scale = 1) => v != null && Number.isFinite(v) ? (v * scale).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
                                        const fmtVol = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '—';
                                        return (
                                          <tr key={`ask-${r.symbol}-${i}`} onClick={() => handleStockClick(r.symbol, ptMarketCode || 'HOSE')} className="hover:bg-panel-hover cursor-pointer">
                                            <td className="px-2 py-1.5 font-medium text-accent whitespace-nowrap text-xs">{r.symbol}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-xs">{fmt(r.price)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmtVol(r.volume)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{r.time || '—'}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <table className="trading-table">
                              {isBondView ? (
                                <>
                                  <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold border-b border-border-standard sticky top-0 z-10">
                                    <tr>
                                      <th className="px-3 py-2.5 whitespace-nowrap">Mã TP</th>
                                      <th className="px-3 py-2.5 whitespace-nowrap">Tên / Ký hiệu</th>
                                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Lãi suất (%)</th>
                                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Ngày đáo hạn</th>
                                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Giá</th>
                                    </tr>
                                  </thead>
                                  <tbody className="text-text-main divide-y divide-border-subtle">
                                    {loadingIndexDetail && indexDetailList.length === 0 ? (
                                      <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted">Đang tải dữ liệu...</td></tr>
                                    ) : (() => {
                                      const search = indexSearch.trim().toUpperCase();
                                      const filtered = search ? indexDetailList.filter((r: any) => (r.symbol || r.bondCode || '').toUpperCase().includes(search)) : indexDetailList;
                                      if (filtered.length === 0) return <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted">Chưa có dữ liệu.</td></tr>;
                                      return filtered.slice(0, 200).map((r: any) => {
                                        const sym = r.symbol ?? r.bondCode ?? r.code ?? '—';
                                        return (
                                          <tr key={sym} onClick={() => setBondDetailSymbol(sym)} className="hover:bg-panel-hover cursor-pointer">
                                            <td className="px-3 py-2 font-semibold text-accent whitespace-nowrap">{sym}</td>
                                            <td className="px-3 py-2 text-text-main">{r.bondName ?? r.name ?? r.issuerName ?? '—'}</td>
                                            <td className="px-3 py-2 text-right font-mono">{r.couponRate ?? r.interestRate ?? r.laiSuat ?? '—'}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{r.maturityDate ?? r.dueDate ?? r.ngayDaoHan ?? '—'}</td>
                                            <td className="px-3 py-2 text-right font-mono">{r.lastPrice ?? r.price ?? r.gia ?? '—'}</td>
                                          </tr>
                                        );
                                      });
                                    })()}
                                  </tbody>
                                </>
                              ) : (
                                <>
                                  <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold border-b border-border-standard sticky top-0 z-10">
                                    <tr>
                                      <th className="px-3 py-2.5 whitespace-nowrap">Mã CK</th>
                                      <th className="px-3 py-2.5 text-right whitespace-nowrap">TC</th>
                                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Trần</th>
                                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Sàn</th>
                                      <th colSpan={6} className="px-3 py-2.5 text-center border-l border-border-standard">Mua</th>
                                      <th colSpan={4} className="px-3 py-2.5 text-center border-l border-border-standard">Khớp lệnh</th>
                                      <th colSpan={6} className="px-3 py-2.5 text-center border-l border-border-standard">Bán</th>
                                      <th colSpan={3} className="px-3 py-2.5 text-center border-l border-border-standard">Giá GD</th>
                                    </tr>
                                    <tr className="bg-panel text-[9px] text-text-muted">
                                      <th className="px-3 py-1.5" />
                                      <th className="px-3 py-1.5 text-right" />
                                      <th className="px-3 py-1.5 text-right" />
                                      <th className="px-3 py-1.5 text-right" />
                                      <th className="px-3 py-1.5 text-right border-l border-border-standard">Giá 3</th>
                                      <th className="px-3 py-1.5 text-right">KL 3</th>
                                      <th className="px-3 py-1.5 text-right">Giá 2</th>
                                      <th className="px-3 py-1.5 text-right">KL 2</th>
                                      <th className="px-3 py-1.5 text-right">Giá 1</th>
                                      <th className="px-3 py-1.5 text-right">KL 1</th>
                                      <th className="px-3 py-1.5 text-right border-l border-border-standard">Giá</th>
                                      <th className="px-3 py-1.5 text-right">KL</th>
                                      <th className="px-3 py-1.5 text-right">+/-</th>
                                      <th className="px-3 py-1.5 text-right">%</th>
                                      <th className="px-3 py-1.5 text-right border-l border-border-standard">Giá 1</th>
                                      <th className="px-3 py-1.5 text-right">KL 1</th>
                                      <th className="px-3 py-1.5 text-right">Giá 2</th>
                                      <th className="px-3 py-1.5 text-right">KL 2</th>
                                      <th className="px-3 py-1.5 text-right">Giá 3</th>
                                      <th className="px-3 py-1.5 text-right">KL 3</th>
                                      <th className="px-3 py-1.5 text-right border-l border-border-standard">Tổng KL</th>
                                      <th className="px-3 py-1.5 text-right">Cao</th>
                                      <th className="px-3 py-1.5 text-right">TB</th>
                                    </tr>
                                  </thead>
                                  <tbody className="text-text-main divide-y divide-border-subtle">
                                    {loadingIndexDetail && indexDetailList.length === 0 ? (
                                      <tr><td colSpan={20} className="px-4 py-12 text-center text-text-muted">Đang tải dữ liệu...</td></tr>
                                    ) : (() => {
                                      const search = indexSearch.trim().toUpperCase();
                                      const filtered = search ? indexDetailList.filter((r: any) => (r.symbol || '').toUpperCase().includes(search)) : indexDetailList;
                                      if (filtered.length === 0) return <tr><td colSpan={20} className="px-4 py-12 text-center text-text-muted">Chưa có dữ liệu.</td></tr>;
                                      const fmt = (v: number | null | undefined, scale = 1) => v != null && Number.isFinite(v) ? (v * scale).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
                                      const fmtVol = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '—';
                                      const chgCls = (ch: number | null | undefined) => ch == null || ch === 0 ? 'text-text-main' : ch > 0 ? 'text-positive' : 'text-negative';
                                      return filtered.slice(0, 200).map((r: any, i: number) => {
                                        const matchPrice = r.matchPrice;
                                        const change = r.change;
                                        const pct = r.percentChange;
                                        const isCeiling = r.tran != null && matchPrice != null && matchPrice >= r.tran;
                                        const isFloor = r.san != null && matchPrice != null && matchPrice <= r.san;
                                        return (
                                          <tr key={`${r.symbol}-${r.exchange ?? 'NA'}-${i}`} onClick={() => handleStockClick(r.symbol, r.exchange || 'HOSE')} className={`hover:bg-panel-hover cursor-pointer ${selectedSymbol === r.symbol ? 'bg-accent/10' : ''}`}>
                                            <td className="px-3 py-2 font-semibold text-accent whitespace-nowrap">{r.symbol}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-main">{fmt(r.tc)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-purple-400">{fmt(r.tran)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-sky-400">{fmt(r.san)}</td>
                                            <td className="px-3 py-2 text-right font-mono border-l border-border-standard text-text-muted">{fmt(r.gia3)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl3)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.gia2)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl2)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.gia1)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl1)}</td>
                                            <td className={`px-3 py-2 text-right font-mono font-semibold border-l border-border-standard ${isCeiling ? 'text-purple-400 bg-purple-500/10' : isFloor ? 'text-sky-400 bg-sky-500/10' : change != null && change > 0 ? 'text-positive bg-positive/10' : change != null && change < 0 ? 'text-negative bg-negative/10' : 'text-text-main bg-panel'}`}>{fmt(matchPrice)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.matchVolume)}</td>
                                            <td className={`px-3 py-2 text-right font-mono ${chgCls(change)}`}>{change != null ? (change >= 0 ? '+' : '') + fmt(change) : '—'}</td>
                                            <td className={`px-3 py-2 text-right font-mono ${chgCls(pct)}`}>{pct != null ? (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%' : '—'}</td>
                                            <td className="px-3 py-2 text-right font-mono border-l border-border-standard text-text-muted">{fmt(r.askPrice1)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.askVol1)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.askPrice2)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.askVol2)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.askPrice3)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.askVol3)}</td>
                                            <td className="px-3 py-2 text-right font-mono border-l border-border-standard text-text-muted">{fmtVol(r.totalVolume)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.high)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.average)}</td>
                                          </tr>
                                        );
                                      });
                                    })()}
                                  </tbody>
                                </>
                              )}
                            </table>
                          )}
                        </div>
                        <div className="px-4 py-2.5 border-t border-border-standard bg-panel text-xs text-slate-600 shrink-0">
                          {isBondView ? `${indexDetailList.length} trái phiếu • Click hàng để xem chi tiết` : isCWView ? `${indexDetailList.length} chứng quyền • Click hàng để xem biểu đồ` : isEFView ? `${indexDetailList.length} ETF • Click hàng để xem biểu đồ` : isIndustryView ? `${indexDetailList.length} mã • Ngành: ${industryName} • Click hàng để xem biểu đồ` : isPTView ? `${indexDetailList.length} khớp lệnh thoả thuận (${ptMarketCode}) • Click hàng để xem biểu đồ` : isOddLotView ? `${indexDetailList.length} mã lô lẻ (${oddLotMarketCode}) • Click hàng để xem biểu đồ` : isFUView ? `${indexDetailList.length} phái sinh (${fuStockType}) • Click hàng để xem biểu đồ` : `${indexDetailList.length} mã • Index: ${indexCodes.join(', ') || 'VNXALL'} • Click hàng để xem biểu đồ`}
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                  {!marketTableFullscreen && (
                    <div className="rounded overflow-hidden border border-border-subtle min-w-0 w-full mt-2">
                      <div className="overflow-x-auto overflow-y-auto max-h-[420px] sm:max-h-[520px] w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {isPTView ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
                            <div className="rounded-lg border border-border-standard bg-panel overflow-hidden">
                              <div className="px-3 py-2 bg-panel border-b border-border-standard font-semibold text-text-muted text-sm">Chào mua</div>
                              <div className="overflow-auto max-h-[400px]">
                                <table className="trading-table">
                                  <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold sticky top-0"><tr><th className="px-2 py-1.5">Mã CK</th><th className="px-2 py-1.5 text-right">Giá</th><th className="px-2 py-1.5 text-right">KL</th><th className="px-2 py-1.5 text-right">Thời gian</th></tr></thead>
                                  <tbody className="text-text-main divide-y divide-border-subtle">
                                    {loadingIndexDetail && ptBidList.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-text-muted text-xs">Đang tải...</td></tr> : ptBidList.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-text-muted text-xs">Hiện tại không có dữ liệu.</td></tr> : ptBidList.slice(0, 200).map((r: any, i: number) => {
                                      const fmt = (v: number | null | undefined, s = 1) => v != null && Number.isFinite(v) ? (v * s).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
                                      const fmtV = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '—';
                                      return <tr key={`b-${r.symbol}-${i}`} onClick={() => handleStockClick(r.symbol, ptMarketCode || 'HOSE')} className="hover:bg-panel-hover cursor-pointer"><td className="px-2 py-1.5 font-medium text-accent text-xs">{r.symbol}</td><td className="px-2 py-1.5 text-right font-mono text-xs">{fmt(r.price)}</td><td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmtV(r.volume)}</td><td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{r.time || '—'}</td></tr>;
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div className="rounded-lg border border-border-standard bg-panel overflow-hidden">
                              <div className="px-3 py-2 bg-panel border-b border-border-standard font-semibold text-text-muted text-sm">Khớp lệnh</div>
                              <div className="overflow-auto max-h-[400px]">
                                <table className="trading-table">
                                  <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold sticky top-0"><tr><th className="px-2 py-1.5">Mã CK</th><th className="px-2 py-1.5 text-right">Tham chiếu</th><th className="px-2 py-1.5 text-right">Giá</th><th className="px-2 py-1.5 text-right">KL</th><th className="px-2 py-1.5 text-right">Giá trị</th><th className="px-2 py-1.5 text-right">Thời gian</th></tr></thead>
                                  <tbody className="text-text-main divide-y divide-border-subtle">
                                    {loadingIndexDetail && indexDetailList.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-text-muted text-xs">Đang tải...</td></tr> : (() => {
                                      const filtered = indexSearch.trim() ? indexDetailList.filter((r: any) => (r.symbol || '').toUpperCase().includes(indexSearch.trim().toUpperCase())) : indexDetailList;
                                      if (filtered.length === 0) return <tr><td colSpan={6} className="px-3 py-6 text-center text-text-muted text-xs">Hiện tại không có dữ liệu.</td></tr>;
                                      const fmt = (v: number | null | undefined, s = 1) => v != null && Number.isFinite(v) ? (v * s).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
                                      const fmtV = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '—';
                                      return filtered.slice(0, 500).map((r: any, i: number) => <tr key={`m-${r.symbol}-${i}`} onClick={() => handleStockClick(r.symbol, ptMarketCode || 'HOSE')} className="hover:bg-panel-hover cursor-pointer"><td className="px-2 py-1.5 font-semibold text-accent text-xs">{r.symbol}</td><td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmt(r.refPrice)}</td><td className="px-2 py-1.5 text-right font-mono text-xs">{fmt(r.price)}</td><td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmtV(r.volume)}</td><td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmtV(r.value)}</td><td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{r.time || '—'}</td></tr>);
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div className="rounded-lg border border-border-standard bg-panel overflow-hidden">
                              <div className="px-3 py-2 bg-panel border-b border-border-standard font-semibold text-text-muted text-sm">Chào bán</div>
                              <div className="overflow-auto max-h-[400px]">
                                <table className="trading-table">
                                  <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold sticky top-0"><tr><th className="px-2 py-1.5">Mã CK</th><th className="px-2 py-1.5 text-right">Giá</th><th className="px-2 py-1.5 text-right">KL</th><th className="px-2 py-1.5 text-right">Thời gian</th></tr></thead>
                                  <tbody className="text-text-main divide-y divide-border-subtle">
                                    {loadingIndexDetail && ptAskList.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-text-muted text-xs">Đang tải...</td></tr> : ptAskList.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-text-muted text-xs">Hiện tại không có dữ liệu.</td></tr> : ptAskList.slice(0, 200).map((r: any, i: number) => {
                                      const fmt = (v: number | null | undefined, s = 1) => v != null && Number.isFinite(v) ? (v * s).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
                                      const fmtV = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '—';
                                      return <tr key={`a-${r.symbol}-${i}`} onClick={() => handleStockClick(r.symbol, ptMarketCode || 'HOSE')} className="hover:bg-panel-hover cursor-pointer"><td className="px-2 py-1.5 font-medium text-accent text-xs">{r.symbol}</td><td className="px-2 py-1.5 text-right font-mono text-xs">{fmt(r.price)}</td><td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{fmtV(r.volume)}</td><td className="px-2 py-1.5 text-right font-mono text-text-muted text-xs">{r.time || '—'}</td></tr>;
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <table className="trading-table">
                            {isBondView ? (
                              <>
                                <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold border-b border-border-standard sticky top-0 z-10">
                                  <tr>
                                    <th className="px-3 py-2.5 whitespace-nowrap">Mã TP</th>
                                    <th className="px-3 py-2.5 whitespace-nowrap">Tên / Ký hiệu</th>
                                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Lãi suất (%)</th>
                                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Ngày đáo hạn</th>
                                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Giá</th>
                                  </tr>
                                </thead>
                                <tbody className="text-text-main divide-y divide-border-subtle">
                                  {loadingIndexDetail && indexDetailList.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted">Đang tải dữ liệu...</td></tr>
                                  ) : (() => {
                                    const search = indexSearch.trim().toUpperCase();
                                    const filtered = search ? indexDetailList.filter((r: any) => (r.symbol || r.bondCode || '').toUpperCase().includes(search)) : indexDetailList;
                                    if (filtered.length === 0) return <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted">Chưa có dữ liệu. Thử đổi index hoặc kiểm tra API.</td></tr>;
                                    return filtered.slice(0, 200).map((r: any) => {
                                      const sym = r.symbol ?? r.bondCode ?? r.code ?? '—';
                                      return (
                                        <tr key={sym} onClick={() => setBondDetailSymbol(sym)} className="hover:bg-panel-hover cursor-pointer transition-colors">
                                          <td className="px-3 py-2 font-semibold text-accent whitespace-nowrap">{sym}</td>
                                          <td className="px-3 py-2 text-text-main">{r.bondName ?? r.name ?? r.issuerName ?? '—'}</td>
                                          <td className="px-3 py-2 text-right font-mono">{r.couponRate ?? r.interestRate ?? r.laiSuat ?? '—'}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{r.maturityDate ?? r.dueDate ?? r.ngayDaoHan ?? '—'}</td>
                                          <td className="px-3 py-2 text-right font-mono">{r.lastPrice ?? r.price ?? r.gia ?? '—'}</td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </>
                            ) : (
                              <>
                                <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold border-b border-border-standard sticky top-0 z-10">
                                  <tr>
                                    <th className="px-3 py-2.5 whitespace-nowrap">Mã CK</th>
                                    <th className="px-3 py-2.5 text-right whitespace-nowrap">TC</th>
                                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Trần</th>
                                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Sàn</th>
                                    <th colSpan={6} className="px-3 py-2.5 text-center border-l border-border-standard">Mua</th>
                                    <th colSpan={4} className="px-3 py-2.5 text-center border-l border-border-standard">Khớp lệnh</th>
                                    <th colSpan={6} className="px-3 py-2.5 text-center border-l border-border-standard">Bán</th>
                                    <th colSpan={3} className="px-3 py-2.5 text-center border-l border-border-standard">Giá GD</th>
                                  </tr>
                                  <tr className="bg-panel text-[9px] text-text-muted">
                                    <th className="px-3 py-1.5" />
                                    <th className="px-3 py-1.5 text-right" />
                                    <th className="px-3 py-1.5 text-right" />
                                    <th className="px-3 py-1.5 text-right" />
                                    <th className="px-3 py-1.5 text-right border-l border-border-standard">Giá 3</th>
                                    <th className="px-3 py-1.5 text-right">KL 3</th>
                                    <th className="px-3 py-1.5 text-right">Giá 2</th>
                                    <th className="px-3 py-1.5 text-right">KL 2</th>
                                    <th className="px-3 py-1.5 text-right">Giá 1</th>
                                    <th className="px-3 py-1.5 text-right">KL 1</th>
                                    <th className="px-3 py-1.5 text-right border-l border-border-standard">Giá</th>
                                    <th className="px-3 py-1.5 text-right">KL</th>
                                    <th className="px-3 py-1.5 text-right">+/-</th>
                                    <th className="px-3 py-1.5 text-right">%</th>
                                    <th className="px-3 py-1.5 text-right border-l border-border-standard">Giá 1</th>
                                    <th className="px-3 py-1.5 text-right">KL 1</th>
                                    <th className="px-3 py-1.5 text-right">Giá 2</th>
                                    <th className="px-3 py-1.5 text-right">KL 2</th>
                                    <th className="px-3 py-1.5 text-right">Giá 3</th>
                                    <th className="px-3 py-1.5 text-right">KL 3</th>
                                    <th className="px-3 py-1.5 text-right border-l border-border-standard">Tổng KL</th>
                                    <th className="px-3 py-1.5 text-right">Cao</th>
                                    <th className="px-3 py-1.5 text-right">TB</th>
                                  </tr>
                                </thead>
                                <tbody className="text-text-main divide-y divide-border-subtle">
                                  {loadingIndexDetail && indexDetailList.length === 0 ? (
                                    <tr><td colSpan={20} className="px-4 py-12 text-center text-text-muted">Đang tải dữ liệu...</td></tr>
                                  ) : (() => {
                                    const search = indexSearch.trim().toUpperCase();
                                    const filtered = search ? indexDetailList.filter((r: any) => (r.symbol || '').toUpperCase().includes(search)) : indexDetailList;
                                    if (filtered.length === 0) return <tr><td colSpan={20} className="px-4 py-12 text-center text-text-muted">Chưa có dữ liệu. Thử đổi index hoặc kiểm tra API.</td></tr>;
                                    const fmt = (v: number | null | undefined, scale = 1) => v != null && Number.isFinite(v) ? (v * scale).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
                                    const fmtVol = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '—';
                                    const chgCls = (ch: number | null | undefined) => ch == null || ch === 0 ? 'text-text-main' : ch > 0 ? 'text-positive' : 'text-negative';
                                    return filtered.slice(0, 200).map((r: any, i: number) => {
                                      const ref = r.tc;
                                      const matchPrice = r.matchPrice;
                                      const change = r.change;
                                      const pct = r.percentChange;
                                      const isCeiling = r.tran != null && matchPrice != null && matchPrice >= r.tran;
                                      const isFloor = r.san != null && matchPrice != null && matchPrice <= r.san;
                                      return (
                                        <tr key={`${r.symbol}-${r.exchange ?? 'NA'}-${i}`} onClick={() => handleStockClick(r.symbol, r.exchange || 'HOSE')} className={`hover:bg-panel-hover cursor-pointer transition-colors ${selectedSymbol === r.symbol ? 'bg-accent/10' : ''}`}>
                                          <td className="px-3 py-2 font-semibold text-accent whitespace-nowrap">{r.symbol}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-main">{fmt(ref)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-purple-400">{fmt(r.tran)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-sky-400">{fmt(r.san)}</td>
                                          <td className="px-3 py-2 text-right font-mono border-l border-border-standard text-text-muted">{fmt(r.gia3)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl3)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.gia2)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl2)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.gia1)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl1)}</td>
                                          <td className={`px-3 py-2 text-right font-mono font-semibold border-l border-border-standard ${isCeiling ? 'text-purple-400 bg-purple-500/10' : isFloor ? 'text-sky-400 bg-sky-500/10' : change != null && change > 0 ? 'text-positive bg-positive/10' : change != null && change < 0 ? 'text-negative bg-negative/10' : 'text-text-main bg-panel'}`}>{fmt(matchPrice)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.matchVolume)}</td>
                                          <td className={`px-3 py-2 text-right font-mono ${chgCls(change)}`}>{change != null ? (change >= 0 ? '+' : '') + fmt(change) : '—'}</td>
                                          <td className={`px-3 py-2 text-right font-mono ${chgCls(pct)}`}>{pct != null ? (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%' : '—'}</td>
                                          <td className="px-3 py-2 text-right font-mono border-l border-border-standard text-text-muted">{fmt(r.askPrice1)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.askVol1)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.askPrice2)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.askVol2)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.askPrice3)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.askVol3)}</td>
                                          <td className="px-3 py-2 text-right font-mono border-l border-border-standard text-text-muted">{fmtVol(r.totalVolume)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.high)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.average)}</td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </>
                            )}
                          </table>
                        )}
                      </div>
                      <div className="px-3 py-2 border-t border-border-subtle text-[10px] text-text-dim flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{isBondView ? `${indexDetailList.length} trái phiếu` : isCWView ? `${indexDetailList.length} chứng quyền` : isEFView ? `${indexDetailList.length} ETF` : isIndustryView ? `${indexDetailList.length} mã · ${industryName}` : isPTView ? `${indexDetailList.length} khớp lệnh (${ptMarketCode})` : isOddLotView ? `${indexDetailList.length} lô lẻ (${oddLotMarketCode})` : isFUView ? `${indexDetailList.length} phái sinh (${fuStockType})` : `${indexDetailList.length} mã · ${indexCodes.join(', ') || 'VNXALL'}`}</span>
                        <span className="sm:hidden">· Kéo ngang xem thêm</span>
                      </div>
                    </div>
                  )}
                </>
              }
            />
          </div>
        )}

        {(currentView as string) === 'terminal_legacy' && (
          <div className="space-y-8 max-w-[1600px] mx-auto animate-fade-in">
            <div>
              <div className="flex justify-between items-center mb-5">
                <h1 className="text-lg font-semibold text-text-main">RiskGuard Terminal</h1>
                <button
                  onClick={() => setShowSetupModal(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-panel hover:bg-panel border border-border-standard text-text-muted hover:text-text-main transition-colors duration-150 text-sm font-medium"
                >
                  Cấu hình
                </button>
              </div>

              {/* Stats: 5 cards — accent border, value-first, hover lift */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                <div className="group relative overflow-hidden rounded-xl bg-panel border border-border-standard pl-4 pr-4 py-4 shadow-sm hover:shadow-md hover:border-[#1E3A5F]/20 transition-all duration-200 border-l-4 border-l-[#1E3A5F]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">Tổng vốn</p>
                  <p className="text-xl font-bold text-text-main font-mono tabular-nums tracking-tight">{formatNumberVI(totalBalance)}</p>
                </div>
                <div className="group relative overflow-hidden rounded-xl bg-panel border border-border-standard pl-4 pr-4 py-4 shadow-sm hover:shadow-md hover:border-[#B45309]/30 transition-all duration-200 border-l-4 border-l-[#B45309]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">Hạn mức rủi ro</p>
                  <p className="text-xl font-bold text-text-main font-mono tabular-nums tracking-tight">{formatNumberVI(maxRiskAmount)} <span className="text-sm font-semibold text-text-muted">({maxRiskPercent}%)</span></p>
                </div>
                <div className="group relative overflow-hidden rounded-xl bg-panel border border-border-standard pl-4 pr-4 py-4 shadow-sm hover:shadow-md hover:border-[#0B6E4B]/30 transition-all duration-200 border-l-4 border-l-[#0B6E4B]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">Lãi kỳ vọng</p>
                  <p className="text-xl font-bold text-text-main font-mono tabular-nums tracking-tight">{expectedReturnPercent}% <span className="text-sm font-medium text-text-muted">≈ {formatNumberVI(totalBalance * expectedReturnPercent / 100)}</span></p>
                </div>
                <div className={`group relative overflow-hidden rounded-xl bg-panel border pl-4 pr-4 py-4 shadow-sm hover:shadow-md transition-all duration-200 border-l-4 ${riskUsagePercent > 80 ? 'border-[#A63D3D] border-l-[#A63D3D] hover:border-[#A63D3D]/50' : 'border-border-standard border-l-[#0B6E4B] hover:border-[#0B6E4B]/30'}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">Rủi ro hiện tại</p>
                  <p className="text-xl font-bold text-text-main font-mono tabular-nums tracking-tight">{formatNumberVI(currentRiskUsed)}</p>
                </div>
                <div className="group relative overflow-hidden rounded-xl bg-panel border border-border-standard pl-4 pr-4 py-4 shadow-sm hover:shadow-md hover:border-[#9CA3AF]/30 transition-all duration-200 border-l-4 border-l-[#9CA3AF] opacity-90">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">Lệnh mở</p>
                  <p className="text-xl font-bold text-text-main font-mono tabular-nums">{openPositions.length}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Market Data Chart */}
              <div className="lg:col-span-2 card-flat p-5 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">

                    {/* Symbol Dropdown */}
                    <div className="relative">
                      <select
                        value={`${selectedSymbol}-${selectedExchange}`}
                        onChange={async (e) => {
                          const [newSymbol, newExchange] = e.target.value.split('-');
                          setSelectedSymbol(newSymbol);
                          setSelectedExchange(newExchange);
                          // Load chart data
                          try {
                            const res = await marketApi.getOHLCV(newSymbol, { exchange: newExchange, timeframe: '1d', limit: 30 });
                            if (res.data.success && Array.isArray(res.data.data)) {
                              const data = res.data.data.map((item: any) => ({
                                time: new Date(item.timestamp).toLocaleDateString(),
                                open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
                                high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
                                low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
                                close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
                                volume: parseFloat(item.volume)
                              }));
                              setMarketData(data);
                            }
                          } catch (error) {
                            console.error('Load chart error:', error);
                          }
                        }}
                        className="appearance-none bg-panel border border-border-standard rounded-lg pl-3 pr-3 py-1.5 text-sm font-semibold text-text-main hover:border-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]/10 cursor-pointer transition-all"
                      >
                        {stocks.map((stock) => (
                          <option key={`${stock.symbol}-${stock.exchange ?? 'NA'}`} value={`${stock.symbol}-${stock.exchange ?? 'NA'}`}>
                            {stock.symbol} ({stock.exchange})
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="text-[9px] text-text-muted uppercase font-semibold">30 ngày gần nhất</p>
                  </div>
                  {marketData.length > 0 && (
                    <div className="text-right">
                      <p className="text-lg font-semibold text-text-main font-mono">{marketData[marketData.length - 1].close.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</p>
                      <p className={`text-xs font-semibold ${marketData[marketData.length - 1]?.close > marketData[marketData.length - 2]?.close ? 'text-positive' : 'text-negative'
                        }`}>
                        {marketData.length > 1 ? (
                          ((marketData[marketData.length - 1]?.close - marketData[marketData.length - 2]?.close) / marketData[marketData.length - 2]?.close * 100).toFixed(2)
                        ) : 0}%
                      </p>
                    </div>
                  )}
                </div>
                {marketData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={marketData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: '#6B7280' }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#6B7280' }}
                        domain={['dataMin - 10', 'dataMax + 10']}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#FFFFFF',
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
                      />
                      <Line
                        type="monotone"
                        dataKey="high"
                        stroke="#0B6E4B"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="low"
                        stroke="#A63D3D"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-text-muted text-sm">
                    Đang tải dữ liệu thị trường...
                  </div>
                )}
              </div>

              {/* Risk Allocation */}
              <div className="card-flat p-5 rounded-lg flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-semibold text-text-main text-sm">Phân bổ rủi ro</h3>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-5 flex-1">
                  <div className="relative w-32 h-32 min-w-[128px] min-h-[128px]">
                    <ResponsiveContainer width={128} height={128}>
                      <PieChart>
                        <Pie
                          data={riskData}
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={58}
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                          stroke="none"
                        >
                          {riskData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-lg font-semibold text-text-main">{chartRiskPercentage}%</span>
                      <span className="text-[9px] text-text-muted uppercase font-semibold">Đã dùng</span>
                    </div>
                  </div>
                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-text-muted font-medium">Đã dùng</span>
                        <span className="text-text-main font-semibold font-mono">{formatNumberVI(currentRiskUsed)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${Math.min(chartRiskPercentage, 100)}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-text-muted font-medium">Khả dụng</span>
                        <span className="text-positive font-semibold font-mono">{formatNumberVI(availableRisk)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div className="h-full bg-[#E5E7EB] rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Giao dịch: danh sách + Đặt lệnh */}
            <div className="card-flat rounded-lg overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-border-standard">
                <h3 className="text-sm font-semibold text-text-main">Giao dịch</h3>
                {portfolio?.id ? (
                  <button
                    onClick={() => setShowOpenPositionModal(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 text-sm font-medium transition-colors"
                  >
                    Đặt lệnh
                  </button>
                ) : (
                  <p className="text-text-muted text-xs">Cần cấu hình danh mục để đặt lệnh.</p>
                )}
              </div>
              {!portfolio?.id ? (
                <div className="p-8 text-center text-text-muted text-sm">Chọn hoặc tạo danh mục ở bước Cấu hình để quản lý giao dịch.</div>
              ) : loadingPositions ? (
                <div className="p-8 text-center text-text-muted text-sm">Đang tải danh sách giao dịch...</div>
              ) : positions.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-sm">Chưa có giao dịch nào. Bấm &quot;Đặt lệnh&quot; để tạo.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="trading-table">
                    <thead className="bg-panel text-text-muted text-[10px] uppercase font-semibold border-b border-border-standard">
                      <tr>
                        <th className="px-4 py-3">Mã CK</th>
                        <th className="px-4 py-3">Sàn</th>
                        <th className="px-4 py-3 text-right">Giá vào</th>
                        <th className="px-4 py-3 text-right">Dừng lỗ</th>
                        <th className="px-4 py-3 text-right">Chốt lời</th>
                        <th className="px-4 py-3 text-right">KL</th>
                        <th className="px-4 py-3 text-right">Rủi ro</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-4 py-3 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle text-text-main">
                      {positions.map((pos) => {
                        const p = pos as any;
                        const entry = p.entry_price_points != null ? Number(p.entry_price_points) : Number(pos.entry_price);
                        const stop = p.stop_loss_points != null ? Number(p.stop_loss_points) : Number(pos.stop_loss);
                        const tp = p.take_profit_points != null ? Number(p.take_profit_points) : (pos.take_profit != null ? Number(pos.take_profit) : null);
                        const risk = getPositionRiskVnd(pos);
                        const isOpen = pos.status === 'OPEN';
                        return (
                          <tr key={pos.id} className="hover:bg-panel">
                            <td className="px-4 py-2.5 font-semibold text-text-main">{pos.symbol}</td>
                            <td className="px-4 py-2.5 text-text-muted">{pos.exchange}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{formatPricePoints(entry)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-negative">{formatPricePoints(stop)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-positive">{tp != null ? formatPricePoints(tp) : '—'}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{formatNumberVI(Number(pos.quantity) || 0)}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{formatNumberVI(risk)}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isOpen ? 'bg-[#DBEAFE] text-accent' :
                                pos.status === 'CLOSED_TP' ? 'bg-positive/10 text-positive' :
                                  pos.status === 'CLOSED_SL' ? 'bg-negative/10 text-negative' : 'bg-panel text-text-muted'
                                }`}>
                                {pos.status === 'OPEN' ? 'Mở' : pos.status === 'CLOSED_TP' ? 'Chốt lời' : pos.status === 'CLOSED_SL' ? 'Cắt lỗ' : 'Đóng tay'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {isOpen && (
                                <button
                                  onClick={() => setClosePositionConfirm({ position: pos })}
                                  className="text-[10px] border border-[#A63D3D] text-negative hover:bg-[#A63D3D] hover:text-white px-2 py-1 rounded font-semibold transition-colors"
                                >
                                  Đóng
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

{currentView === 'notifications' && (
          <NotificationsView onUnreadCountChange={setUnreadNotifications} onNavigate={setCurrentView} />
        )}

        {currentView === 'settings' && (
          <SettingsView
            portfolio={portfolio}
            onOpenSetup={() => setShowSetupModal(true)}
            onPortfolioUpdated={loadData}
          />
        )}

      </main>
      )} {/* end currentView !== 'terminal' */}

      {/* --- AI Report Modal (Fintech style) --- */}
      {insightContent && insightTrader && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111827]/50 animate-fade-in">
          <div className="bg-panel border border-border-standard rounded-lg w-full max-w-2xl shadow-card-hover flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border-standard flex justify-between items-start bg-[#FAFAFA]">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg border border-border-standard overflow-hidden bg-panel shrink-0">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${insightTrader.id}&backgroundColor=b6e3f4`} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="text-text-main font-semibold text-base">{insightTrader.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-panel text-accent border border-border-standard uppercase tracking-wider">AI Report</span>
                    <span className="text-text-muted text-[10px] font-mono">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${insightContent.verdict === 'RECOMMENDED' ? 'bg-positive/10 border-[#A7F3D0] text-positive' :
                insightContent.verdict === 'CAUTION' ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]' :
                  'bg-negative/10 border-[#FECACA] text-negative'
                }`}>
                {insightContent.verdict}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-panel rounded-lg p-3 border border-border-standard">
                  <div className="flex justify-between mb-2">
                    <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">Mức độ phù hợp</span>
                    <span className="text-text-main font-mono font-semibold text-sm">{insightContent.marketFitScore}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${insightContent.marketFitScore}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted font-medium">{insightContent.strategyMatch}</p>
                </div>
                <div className="bg-panel rounded-lg p-3 border border-border-standard">
                  <div className="flex justify-between mb-2">
                    <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">Điểm an toàn</span>
                    <span className={`font-mono font-semibold text-sm ${insightContent.safetyScore > 70 ? 'text-positive' : 'text-[#B45309]'}`}>
                      {insightContent.safetyScore}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${insightContent.safetyScore > 70 ? 'bg-[#0B6E4B]' : 'bg-[#B45309]'}`} style={{ width: `${insightContent.safetyScore}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted font-medium">Đảo ngược chỉ số rủi ro</p>
                </div>
              </div>

              <div className="bg-panel rounded-lg p-4 border-l-4 border-[#1E3A5F] border border-border-standard">
                <h4 className="text-accent text-xs font-semibold mb-1.5">
                  Phân tích thị trường
                </h4>
                <p className="text-text-main text-sm leading-relaxed">
                  {insightContent.marketAnalysis}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="flex items-center gap-2 text-positive text-[10px] font-semibold uppercase mb-2 tracking-wider">
                    <span className="w-1.5 h-1.5 bg-[#0B6E4B] rounded-full" />
                    Điểm mạnh
                  </h4>
                  <ul className="space-y-2">
                    {insightContent.pros.map((pro, idx) => (
                      <li key={idx} className="text-sm text-text-main bg-panel p-2 rounded-lg border border-border-standard">
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="flex items-center gap-2 text-negative text-[10px] font-semibold uppercase mb-2 tracking-wider">
                    <span className="w-1.5 h-1.5 bg-[#A63D3D] rounded-full" />
                    Rủi ro cần lưu ý
                  </h4>
                  <ul className="space-y-2">
                    {insightContent.cons.map((con, idx) => (
                      <li key={idx} className="text-sm text-text-main bg-panel p-2 rounded-lg border border-border-standard">
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border-standard bg-[#FAFAFA]">
              <button onClick={closeInsightModal} className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors duration-150">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding wizard — first login only */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onNavigate={setCurrentView}
        />
      )}

    </div>
  );
}


export default MainApp;
