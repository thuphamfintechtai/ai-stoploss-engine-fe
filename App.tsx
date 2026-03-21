import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ComposedChart } from 'recharts';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { TraderProfile, AiAnalysis } from './types';
import { RiskProgressBar } from './components/RiskProgressBar';
import { TraderCard } from './components/TraderCard';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { MarketNewsView } from './components/MarketNewsView';
import { AuthView } from './components/AuthView';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { DashboardView } from './components/DashboardView';
import { TradingTerminal } from './components/TradingTerminal';
import { PortfolioView } from './components/PortfolioView';
import { WatchlistView } from './components/WatchlistView';
import { RiskManagerView } from './components/RiskManagerView';
import { AiSignalsView } from './components/AiSignalsView';
import { analyzeTrader } from './services/geminiService';
import { portfolioApi, positionApi, marketApi, authApi } from './services/api';
import type { Position as PositionType, CreatePositionRequest } from './services/api';
import wsService from './services/websocket';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_FRACTION_OPTIONS, PRICE_LOCALE, EXCHANGES, formatNumberVI, formatPricePoints, MARKET_INDEX_CODES_BANG_GIA, INDUSTRY_CODES, SINGLE_CHOICE_GROUPS } from './constants';

// --- Helper: Convert Vietnamese date to Lightweight Charts format ---
function convertToLightweightTime(dateStr: string): string {
  // Input: "12/2/2026" (dd/mm/yyyy)
  // Output: "2026-02-12" (yyyy-mm-dd)
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// --- Helper: Calculate Simple Moving Average ---
function calculateSMA(data: any[], period: number) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      continue; // Not enough data yet
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    });
  }
  return result;
}

// --- Candlestick Chart Component (TradingView Lightweight Charts) ---
const CandlestickChartLW = ({ data, loading }: { data: any[], loading: boolean }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ma20SeriesRef = useRef<any>(null);
  const ma50SeriesRef = useRef<any>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Effect 1: Initialize chart on mount
  useEffect(() => {
    console.log('CandlestickChartLW: Initializing chart, container:', chartContainerRef.current);
    if (!chartContainerRef.current) {
      console.error('CandlestickChartLW: Container ref is null!');
      return;
    }

    console.log('CandlestickChartLW: Creating chart...');
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#090812' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12,
        minBarSpacing: 8,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    });

    console.log('CandlestickChartLW: Chart created, adding series...');
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    });

    // Assign to refs for external access (drawing tools)
    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    console.log('Chart and series refs assigned');

    // Add volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#22C55E',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    // Configure volume scale (separate from price)
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.7, // Volume takes bottom 30%
        bottom: 0,
      },
    });

    // Add MA20 (blue)
    const ma20Series = chart.addSeries(LineSeries, {
      color: '#2962FF',
      lineWidth: 2,
      title: 'MA20',
    });

    // Add MA50 (orange)
    const ma50Series = chart.addSeries(LineSeries, {
      color: '#FF6D00',
      lineWidth: 2,
      title: 'MA50',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    ma20SeriesRef.current = ma20Series;
    ma50SeriesRef.current = ma50Series;
    console.log('CandlestickChartLW: Chart initialized successfully!', { chart, series: candlestickSeries, volume: volumeSeries });

    // Responsive resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Effect 2: Update data when changed
  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) {
      console.log('CandlestickChartLW: Skipping data update', { hasRef: !!seriesRef.current, dataLength: data?.length });
      return;
    }

    // Transform data: { time: '12/2/2026', ... } → { time: '2026-02-12', ... }
    console.log('CandlestickChartLW: Raw data sample:', data[0]);
    const transformed = data.map(d => ({
      time: convertToLightweightTime(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    // Remove duplicates and sort ascending by time
    const uniqueData = transformed.reduce((acc: any[], curr) => {
      if (!acc.find(item => item.time === curr.time)) {
        acc.push(curr);
      }
      return acc;
    }, []);

    const sortedData = uniqueData.sort((a, b) => {
      const timeA = new Date(a.time).getTime();
      const timeB = new Date(b.time).getTime();
      return timeA - timeB; // Ascending order
    });

    console.log('CandlestickChartLW: Transformed data sample:', sortedData[0]);
    console.log('CandlestickChartLW: All transformed times:', sortedData.map(d => d.time));
    console.log('CandlestickChartLW: Setting data, count:', sortedData.length);

    // Set candlestick data
    seriesRef.current.setData(sortedData);

    // Set volume data (with colors based on price direction)
    if (volumeSeriesRef.current) {
      const volumeData = sortedData.map((d, i) => ({
        time: d.time,
        value: data[i]?.volume || 0,
        color: d.close >= d.open ? '#22C55E80' : '#EF444480', // Green/Red with transparency
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    // Set MA20 data
    if (ma20SeriesRef.current && sortedData.length >= 20) {
      const ma20Data = calculateSMA(sortedData, 20);
      ma20SeriesRef.current.setData(ma20Data);
    }

    // Set MA50 data
    if (ma50SeriesRef.current && sortedData.length >= 50) {
      const ma50Data = calculateSMA(sortedData, 50);
      ma50SeriesRef.current.setData(ma50Data);
    }
  }, [data]);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Update chart size when fullscreen changes
  useEffect(() => {
    if (chartRef.current && chartContainerRef.current) {
      const newHeight = isFullscreen ? window.innerHeight - 80 : 450;
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: newHeight
      });
    }
  }, [isFullscreen]);

  const containerStyle: React.CSSProperties = isFullscreen
    ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      background: '#ffffff',
      padding: '20px'
    }
    : {
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#ffffff'
    };

  return (
    <div style={{ ...containerStyle, position: 'relative', minWidth: 0 }}>
      {/* Nút phóng to chart */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
      }}>
        <button
          onClick={toggleFullscreen}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-panel border border-border-standard text-text-main hover:bg-panel hover:border-[#1E3A5F] transition-colors shadow-sm"
          title={isFullscreen ? 'Thu nhỏ' : 'Phóng to'}
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          )}
        </button>
      </div>

      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'default',
        }}
      />

      {loading && (
        <div className="flex items-center justify-center" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff' }}>
          <div className="text-text-muted">Đang tải...</div>
        </div>
      )}
    </div>
  );
};

// --- Mobile Navigation Component ---
const MobileNav = ({ currentView, onChangeView }: { currentView: string, onChangeView: (v: string) => void }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    )},
    { id: 'portfolio', label: 'Danh mục', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
      </svg>
    )},
    { id: 'terminal', label: 'Trading', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    )},
    { id: 'watchlist', label: 'Watchlist', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    )},
    { id: 'risk', label: 'Rủi ro', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    )},
  ];

  const isActive = (id: string) => currentView === id || (id === 'dashboard' && currentView === 'home');

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-panel border border-border-standard z-[60] lg:hidden rounded-xl shadow-elevated">
      <div className="flex justify-around items-center h-14 px-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-lg transition-colors duration-150 ${isActive(item.id) ? 'text-accent' : 'text-text-dim hover:text-text-muted'}`}
          >
            {item.icon}
            <span className="text-[9px] font-semibold tracking-wide">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Trading Modal Component (TradingView-like) ---
const TradingModal = ({ isOpen, onClose, symbol, exchange, data, loading, onTimeframeChange }: {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  exchange: string;
  data: any[];
  loading: boolean;
  onTimeframeChange: (symbol: string, exchange: string, timeframe: string) => void;
}) => {
  const [timeframe, setTimeframe] = React.useState('1d');
  const [activeTab, setActiveTab] = React.useState('Giao dịch');
  const [symbolDetail, setSymbolDetail] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // Tab-specific data states
  const [companyInfo, setCompanyInfo] = React.useState<any>(null);
  const [shareholders, setShareholders] = React.useState<any>(null);
  const [financialData, setFinancialData] = React.useState<any>(null);
  const [loadingTabData, setLoadingTabData] = React.useState(false);

  // Right sidebar states
  const [sidebarTab, setSidebarTab] = React.useState('Khớp lệnh');
  const [matchingHistory, setMatchingHistory] = React.useState<any>(null);
  const [orderBook, setOrderBook] = React.useState<any>(null);
  const [loadingSidebar, setLoadingSidebar] = React.useState(false);

  // Fetch symbol details when modal opens
  React.useEffect(() => {
    if (isOpen && symbol) {
      setLoadingDetail(true);
      marketApi.getSymbolDetail(symbol, { exchange })
        .then(res => {
          if (res.data.success) {
            setSymbolDetail(res.data.data);
          }
        })
        .catch(err => console.error('Load symbol detail error:', err))
        .finally(() => setLoadingDetail(false));
    }
  }, [isOpen, symbol, exchange]);

  // Fetch sidebar data (matching history & order book)
  React.useEffect(() => {
    if (isOpen && symbol) {
      setLoadingSidebar(true);
      Promise.all([
        marketApi.getMatchingHistory(symbol, { pageSize: 50 }),
        marketApi.getOrderBook(symbol)
      ])
        .then(([matchingRes, orderBookRes]) => {
          console.log('🔍 MATCHING RESPONSE:', matchingRes.data);
          console.log('🔍 ORDER BOOK RESPONSE:', orderBookRes.data);
          if (matchingRes.data.success) {
            console.log('matchingHistory:', matchingRes.data.data);
            setMatchingHistory(matchingRes.data.data);
          }
          if (orderBookRes.data.success) {
            console.log('orderBook:', orderBookRes.data.data);
            setOrderBook(orderBookRes.data.data);
          }
        })
        .catch(err => console.error('Load sidebar data error:', err))
        .finally(() => setLoadingSidebar(false));
    }
  }, [isOpen, symbol]);

  // Fetch tab-specific data when activeTab changes
  React.useEffect(() => {
    if (!isOpen || !symbol) return;

    const fetchTabData = async () => {
      setLoadingTabData(true);
      try {
        switch (activeTab) {
          case 'Hồ sơ':
          case 'Vốn & Cổ tức':
            const companyRes = await marketApi.getCompanyInfo(symbol);
            setCompanyInfo(companyRes.data);
            break;

          case 'Cổ đông':
            const shareholdersRes = await marketApi.getShareholders(symbol);
            setShareholders(shareholdersRes.data);
            break;

          case 'Tài chính':
          case 'Thống kê':
            const financialRes = await marketApi.getAdvancedInfo(symbol);
            setFinancialData(financialRes.data);
            break;

          default:
            break;
        }
      } catch (error) {
        console.error(`Error fetching ${activeTab} data:`, error);
      } finally {
        setLoadingTabData(false);
      }
    };

    if (activeTab !== 'Giao dịch') {
      fetchTabData();
    }
  }, [activeTab, symbol, isOpen]);

  if (!isOpen) return null;

  const latestCandle = data.length > 0 ? data[data.length - 1] : null;
  const detail = symbolDetail || {};

  // API trả giá (đơn vị theo STOCK_PRICE_DISPLAY_SCALE). Fallback từ candle khi detail thiếu.
  const rawClose = detail.closePrice != null ? Number(detail.closePrice) : null;
  const currentPriceRaw = rawClose != null
    ? rawClose * STOCK_PRICE_DISPLAY_SCALE
    : (latestCandle?.close ?? 0);
  const priceChangeRaw = (Number(detail.change) || 0) * STOCK_PRICE_DISPLAY_SCALE;
  const priceChangePercent = detail.percentChange ?? 0;
  const companyName = detail.companyName || symbol;
  const isNegative = priceChangeRaw < 0;
  const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);
  const currentPrice = toPoint(currentPriceRaw);
  const priceChange = toPoint(priceChangeRaw);

  // Giá Sàn/TC/Trần: ưu tiên detail từ API, nếu 0 hoặc thiếu thì lấy từ candle (đã scale khi load)
  const rawFloor = (Number(detail.floor) || 0) * STOCK_PRICE_DISPLAY_SCALE;
  const rawRef = (Number(detail.reference) || 0) * STOCK_PRICE_DISPLAY_SCALE;
  const rawCeiling = (Number(detail.ceiling) || 0) * STOCK_PRICE_DISPLAY_SCALE;
  const floorDisplay = rawFloor > 0 ? toPoint(rawFloor) : toPoint(latestCandle?.low ?? currentPriceRaw);
  const referenceDisplay = rawRef > 0 ? toPoint(rawRef) : toPoint(latestCandle?.open ?? currentPriceRaw);
  const ceilingDisplay = rawCeiling > 0 ? toPoint(rawCeiling) : toPoint(latestCandle?.high ?? currentPriceRaw);
  const totalTradingDisplay = Number(detail.totalTrading) || latestCandle?.volume || 0;
  // GTGD (tỷ): detail.totalValue hoặc ước lượng từ giá đóng cửa * KL (tỷ = 1e9)
  const totalValueDisplay = Number(detail.totalValue) ?? (totalTradingDisplay && currentPriceRaw ? (currentPriceRaw * totalTradingDisplay) / 1e9 : null);

  const tabs = ['Giao dịch', 'Hồ sơ', 'Cổ đông', 'Vốn & Cổ tức', 'Tài chính', 'Thống kê'];
  const timeframes = ['1m', '1d', '1w', '1M'];

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-[#111827]/50 animate-fade-in p-4">
      <div className="w-full max-w-7xl h-[90vh] bg-panel rounded-lg overflow-hidden flex flex-col shadow-2xl border border-border-standard">
        {/* Header */}
        <div className="bg-panel border-b border-border-standard px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-main">
                {symbol} <span className="text-text-muted">({exchange})</span>
              </h1>
              <span className="text-sm text-text-muted">{companyName}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-2 hover:bg-panel rounded text-text-muted transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Price Info */}
          {!loadingDetail && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-8">
                <div>
                  <div className={`text-3xl font-bold font-mono ${isNegative ? 'text-negative' : 'text-positive'}`}>
                    {currentPrice.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}
                  </div>
                  <div className={`text-sm font-mono mt-1 ${isNegative ? 'text-negative' : 'text-positive'}`}>
                    {isNegative ? '↓' : '↑'} {Math.abs(priceChange).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <div><span className="text-text-muted">Sàn:</span> <span className="text-accent font-mono ml-1">{(floorDisplay != null && floorDisplay > 0 ? Number(floorDisplay).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—')}</span></div>
                  <div><span className="text-text-muted">TC:</span> <span className="text-amber-600 font-mono ml-1">{(referenceDisplay != null && referenceDisplay > 0 ? Number(referenceDisplay).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—')}</span></div>
                  <div><span className="text-text-muted">Trần:</span> <span className="text-purple-600 font-mono ml-1">{(ceilingDisplay != null && ceilingDisplay > 0 ? Number(ceilingDisplay).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—')}</span></div>
                  <div><span className="text-text-muted">Cao:</span> <span className="text-positive font-mono ml-1">{toPoint(latestCandle?.high ?? currentPriceRaw).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span></div>
                  <div><span className="text-text-muted">Thấp:</span> <span className="text-negative font-mono ml-1">{toPoint(latestCandle?.low ?? currentPriceRaw).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span></div>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div><span className="text-text-muted">Tổng KL:</span> <span className="text-text-main font-mono ml-1">{totalTradingDisplay > 0 ? formatNumberVI(totalTradingDisplay, { maximumFractionDigits: 0 }) : '—'}</span></div>
                <div><span className="text-text-muted">KLGD TB 10 phiên:</span> <span className="text-text-main font-mono ml-1">{formatNumberVI(detail.avgVol10s || 0, { maximumFractionDigits: 0 })}</span></div>
                <div><span className="text-text-muted">GTGD:</span> <span className="text-text-main font-mono ml-1">{totalValueDisplay != null && totalValueDisplay > 0 ? totalValueDisplay.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—'} tỷ</span></div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-6 mt-4 border-b border-border-standard overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`pb-2 px-1 text-sm whitespace-nowrap transition ${activeTab === tab ? 'text-accent border-b-2 border-[#1E3A5F]' : 'text-text-muted hover:text-text-main'}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Center - Main Content */}
          <div className={`flex-1 bg-panel p-4 min-h-0 flex flex-col ${activeTab === 'Giao dịch' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            {/* Tab: Giao dịch (Chart) - một thanh cuộn cho cả chart + timeframe bên dưới */}
            {activeTab === 'Giao dịch' && (
              <div className="flex flex-col min-h-[420px]">
                {/* Chart Header - TradingView Style */}
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <div className="flex items-center gap-6">
                    {/* Symbol with dot indicator */}
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-text-main">{symbol} · {timeframe} · {exchange}</span>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>

                    {/* OHLC Inline - TradingView Style (đã scale khi load) */}
                    <div className="flex items-center gap-2 text-sm font-mono">
                      <span className="text-accent">O</span>
                      <span className="text-accent font-semibold">{toPoint(latestCandle?.open ?? 0).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span>
                      <span className="text-accent ml-2">H</span>
                      <span className="text-accent font-semibold">{toPoint(latestCandle?.high ?? 0).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span>
                      <span className="text-accent ml-2">L</span>
                      <span className="text-accent font-semibold">{toPoint(latestCandle?.low ?? 0).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span>
                      <span className="text-accent ml-2">C</span>
                      <span className="text-accent font-semibold">{toPoint(latestCandle?.close ?? 0).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span>
                      <span className={`ml-3 ${(latestCandle?.close ?? 0) >= (latestCandle?.open ?? 0) ? 'text-positive' : 'text-negative'}`}>
                        {priceChange >= 0 ? '+' : ''}{priceChange.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                      </span>
                    </div>

                    {/* Volume */}
                    <div className="text-sm">
                      <span className="text-text-muted">Khối lượng</span>
                      <span className="text-text-main font-mono font-semibold ml-2">
                        {formatNumberVI(latestCandle?.volume || 0, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chart Area - nền trắng, chiều cao nhỏ hơn */}
                <div className="relative h-[300px] flex-shrink-0 bg-panel rounded-lg border border-border-standard overflow-hidden">
                  <CandlestickChartLW data={data} loading={loading} />

                  {/* TradingView Logo */}
                  <div style={{
                    position: 'absolute',
                    bottom: '50px',
                    left: '12px',
                    zIndex: 5,
                    background: 'rgba(243, 244, 246, 0.95)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#374151',
                    fontFamily: 'monospace',
                    border: '1px solid #E5E7EB'
                  }}>
                    TV
                  </div>
                </div>

                {/* Bottom Timeframe Bar - TradingView Style */}
                <div className="flex items-center justify-between pt-2 pb-1 border-t border-border-standard flex-shrink-0">
                  <div className="flex gap-1">
                    {['1m', '1h', '1d', '1w', '1M'].map(tf => (
                      <button
                        key={tf}
                        onClick={() => {
                          setTimeframe(tf);
                          onTimeframeChange(symbol, exchange, tf);
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${timeframe === tf
                          ? 'bg-accent text-white'
                          : 'bg-transparent text-text-muted hover:text-text-main hover:bg-panel'
                          }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span className="font-mono">{new Date().toLocaleTimeString('vi-VN')} UTC+7</span>
                    <button className="hover:text-text-main transition">%</button>
                    <button className="hover:text-text-main transition">log</button>
                    <button className="hover:text-text-main transition">tự động</button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Hồ sơ (Company Info) */}
            {activeTab === 'Hồ sơ' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : companyInfo?.data?.data ? (
                  <div className="space-y-6">
                    {/* Header - Company Name & Industry */}
                    <div className="bg-panel rounded-lg p-5 border border-border-standard">
                      <h1 className="text-2xl font-bold text-text-main mb-2">
                        {symbol} - {companyInfo.data.data.basicInformation?.symbol || 'N/A'}
                      </h1>
                      <p className="text-text-muted text-sm">
                        {companyInfo.data.data.basicInformation?.icbNameLevel2 || 'N/A'}
                      </p>
                    </div>

                    {/* Basic Information Grid */}
                    <div className="bg-panel rounded-lg p-5 border border-border-standard">
                      <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                        Thông tin cơ bản
                      </h2>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Ngày thành lập:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.basicInformation?.foundingDate
                              ? new Date(companyInfo.data.data.basicInformation.foundingDate).toLocaleDateString('vi-VN')
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Vốn điều lệ:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.basicInformation?.charterCapital
                              ? (companyInfo.data.data.basicInformation.charterCapital / 1000000000).toFixed(2) + ' tỷ VNĐ'
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Ngày niêm yết:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.listedInformation?.listingDate
                              ? new Date(companyInfo.data.data.listedInformation.listingDate).toLocaleDateString('vi-VN')
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Sàn giao dịch:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.listedInformation?.marketCode || 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Vốn hóa thị trường:</span>
                          <span className="text-positive font-medium">
                            {companyInfo.data.data.listedInformation?.marketCap
                              ? (companyInfo.data.data.listedInformation.marketCap / 1000000000).toFixed(2) + ' tỷ VNĐ'
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">CP đang lưu hành:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.listedInformation?.sharesOutstanding
                              ? formatNumberVI(companyInfo.data.data.listedInformation.sharesOutstanding)
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Company Profile */}
                    {companyInfo.data.data.basicInformation?.companyProfile && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Giới thiệu công ty
                        </h2>
                        <p className="text-text-main text-sm leading-relaxed">
                          {companyInfo.data.data.basicInformation.companyProfile}
                        </p>
                      </div>
                    )}

                    {/* Leadership Table */}
                    {companyInfo.data.data.leaderInformation && companyInfo.data.data.leaderInformation.length > 0 && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Ban lãnh đạo
                        </h2>
                        <div className="overflow-x-auto">
                          <table className="trading-table">
                            <thead>
                              <tr className="border-b border-border-standard">
                                <th className="text-left text-text-muted font-medium pb-3">Họ tên</th>
                                <th className="text-left text-text-muted font-medium pb-3">Chức vụ</th>
                                <th className="text-right text-text-muted font-medium pb-3">Tỷ lệ sở hữu</th>
                              </tr>
                            </thead>
                            <tbody>
                              {companyInfo.data.data.leaderInformation.map((leader: any, idx: number) => (
                                <tr key={idx} className="border-b border-border-standard">
                                  <td className="py-3 text-text-main">{leader.fullName}</td>
                                  <td className="py-3 text-text-main">{leader.positionName}</td>
                                  <td className="py-3 text-right text-accent font-medium">
                                    {leader.shareholderRate > 0 ? `${leader.shareholderRate.toFixed(2)}%` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Cổ đông (Shareholders) */}
            {activeTab === 'Cổ đông' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : shareholders?.data?.data ? (
                  <div className="space-y-6">
                    {/* Shareholders Table */}
                    {shareholders.data.data.inforShareholder && shareholders.data.data.inforShareholder.length > 0 && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Danh sách cổ đông
                        </h2>
                        <div className="overflow-x-auto">
                          <table className="trading-table">
                            <thead>
                              <tr className="border-b border-border-standard">
                                <th className="text-left text-text-muted font-medium pb-3">Tên cổ đông</th>
                                <th className="text-left text-text-muted font-medium pb-3">Loại</th>
                                <th className="text-right text-text-muted font-medium pb-3">Số lượng CP</th>
                                <th className="text-right text-text-muted font-medium pb-3">Tỷ lệ (%)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shareholders.data.data.inforShareholder.map((sh: any, idx: number) => (
                                <tr key={idx} className="border-b border-border-standard/50">
                                  <td className="py-3 text-text-main">{sh.owner || 'N/A'}</td>
                                  <td className="py-3 text-text-main">
                                    {sh.ownerType === 0 ? 'Cá nhân' : sh.ownerType === 2 ? 'Tổ chức' : 'Khác'}
                                  </td>
                                  <td className="py-3 text-right text-text-main font-mono">
                                    {sh.quantity ? formatNumberVI(sh.quantity) : '-'}
                                  </td>
                                  <td className="py-3 text-right text-accent font-medium">
                                    {sh.shareholderRate !== undefined ? `${sh.shareholderRate.toFixed(2)}%` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Shareholder Rate Summary */}
                    {shareholders.data.data.shareholderRate && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Tỷ lệ sở hữu
                        </h2>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-panel rounded p-4 border border-border-standard">
                            <div className="text-text-muted text-xs mb-1">Nhà nước</div>
                            <div className="text-text-main text-xl font-bold">
                              {shareholders.data.data.shareholderRate.corpGovRate?.toFixed(2) || '0.00'}%
                            </div>
                          </div>
                          <div className="bg-panel rounded p-4 border border-border-standard">
                            <div className="text-text-muted text-xs mb-1">Nước ngoài</div>
                            <div className="text-accent text-xl font-bold">
                              {shareholders.data.data.shareholderRate.corpForeignRate?.toFixed(2) || '0.00'}%
                            </div>
                          </div>
                          <div className="bg-panel rounded p-4 border border-border-standard">
                            <div className="text-text-muted text-xs mb-1">Khác</div>
                            <div className="text-positive text-xl font-bold">
                              {shareholders.data.data.shareholderRate.otherRate?.toFixed(2) || '0.00'}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Vốn & Cổ tức */}
            {activeTab === 'Vốn & Cổ tức' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : companyInfo?.data?.data ? (
                  <div className="space-y-6">
                    {/* Capital Information */}
                    <div className="bg-panel rounded-lg p-5 border border-border-standard">
                      <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                        Thông tin vốn
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between bg-panel rounded p-4 border border-border-standard">
                          <span className="text-text-muted">Vốn điều lệ:</span>
                          <span className="text-text-main font-bold">
                            {companyInfo.data.data.basicInformation?.charterCapital
                              ? (companyInfo.data.data.basicInformation.charterCapital / 1000000000).toFixed(2) + ' tỷ VNĐ'
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between bg-panel rounded p-4 border border-border-standard">
                          <span className="text-text-muted">CP niêm yết:</span>
                          <span className="text-text-main font-bold">
                            {companyInfo.data.data.listedInformation?.sharesListed
                              ? formatNumberVI(companyInfo.data.data.listedInformation.sharesListed)
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between bg-panel rounded p-4 border border-border-standard">
                          <span className="text-text-muted">CP lưu hành:</span>
                          <span className="text-text-main font-bold">
                            {companyInfo.data.data.listedInformation?.sharesOutstanding
                              ? formatNumberVI(companyInfo.data.data.listedInformation.sharesOutstanding)
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between bg-panel rounded p-4 border border-border-standard">
                          <span className="text-text-muted">Room NN còn lại:</span>
                          <span className="text-positive font-bold">
                            {companyInfo.data.data.listedInformation?.foreignCurrentRoom
                              ? formatNumberVI(companyInfo.data.data.listedInformation.foreignCurrentRoom)
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Information from companyInfo */}
                    {companyInfo.data.data.financeInformation && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Thông tin tài chính bổ sung
                        </h2>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          <div className="flex justify-between bg-panel rounded p-3 border border-border-standard">
                            <span className="text-text-muted">EPS:</span>
                            <span className="text-text-main font-bold">
                              {companyInfo.data.data.financeInformation.eps != null
                                ? formatNumberVI(Number(companyInfo.data.data.financeInformation.eps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between bg-panel rounded p-3 border border-border-standard">
                            <span className="text-text-muted">BVPS:</span>
                            <span className="text-text-main font-bold">
                              {companyInfo.data.data.financeInformation.bvps != null
                                ? formatNumberVI(Number(companyInfo.data.data.financeInformation.bvps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between bg-panel rounded p-3 border border-border-standard">
                            <span className="text-text-muted">ROE:</span>
                            <span className="text-positive font-bold">
                              {companyInfo.data.data.financeInformation.roe !== null
                                ? (companyInfo.data.data.financeInformation.roe * 100).toFixed(2) + '%'
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Tài chính */}
            {activeTab === 'Tài chính' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : financialData?.data?.data?.length > 0 ? (
                  <div className="space-y-6">
                    {(() => {
                      const info = financialData.data.data[0];
                      return (
                        <>
                          {/* Valuation Metrics */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Định giá
                            </h2>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">P/E</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.pe !== null && info.pe !== undefined ? info.pe.toFixed(2) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">P/B</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.pb !== null && info.pb !== undefined ? info.pb.toFixed(2) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">EPS</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.eps !== null && info.eps !== undefined ? formatNumberVI(Number(info.eps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">BVPS</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.bvps !== null && info.bvps !== undefined ? formatNumberVI(Number(info.bvps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Profitability */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Hiệu suất hoạt động
                            </h2>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">ROE:</span>
                                <span className="text-positive font-bold">
                                  {info.roe !== null && info.roe !== undefined ? (info.roe * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">ROA:</span>
                                <span className="text-positive font-bold">
                                  {info.roa !== null && info.roa !== undefined ? (info.roa * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">ROIC:</span>
                                <span className="text-positive font-bold">
                                  {info.roic !== null && info.roic !== undefined ? (info.roic * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">Biên LN gộp:</span>
                                <span className="text-accent font-bold">
                                  {info.grossProfitMargin !== null && info.grossProfitMargin !== undefined ? (info.grossProfitMargin * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">Biên LN ròng:</span>
                                <span className="text-accent font-bold">
                                  {info.netProfitMargin !== null && info.netProfitMargin !== undefined ? (info.netProfitMargin * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">Beta:</span>
                                <span className="text-text-main font-bold">
                                  {info.beta !== null && info.beta !== undefined ? info.beta.toFixed(2) : '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Liquidity */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Khả năng thanh khoản
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Current Ratio</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.currentRatio !== null && info.currentRatio !== undefined ? info.currentRatio.toFixed(2) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Quick Ratio</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.quickRatio !== null && info.quickRatio !== undefined ? info.quickRatio.toFixed(2) : '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Thống kê */}
            {activeTab === 'Thống kê' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : financialData?.data?.data?.length > 0 ? (
                  <div className="space-y-6">
                    {(() => {
                      const info = financialData.data.data[0];
                      return (
                        <>
                          {/* Trading Statistics */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Biến động giao dịch
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Giá hiện tại</div>
                                <div className={`text-2xl font-bold ${info.stockPercentChange > 0 ? 'text-positive' :
                                  info.stockPercentChange < 0 ? 'text-negative' : 'text-amber-600'
                                  }`}>
                                  {info.closePrice != null ? (info.closePrice * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '-'}
                                </div>
                                <div className={`text-xs mt-1 ${info.stockPercentChange > 0 ? 'text-positive' :
                                  info.stockPercentChange < 0 ? 'text-negative' : 'text-amber-600'
                                  }`}>
                                  {info.change !== null && info.change !== undefined ?
                                    `${info.change > 0 ? '+' : ''}${(info.change * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}` : '-'}
                                  {' '}
                                  ({info.stockPercentChange !== null && info.stockPercentChange !== undefined ?
                                    `${info.stockPercentChange > 0 ? '+' : ''}${info.stockPercentChange.toFixed(2)}%` : '-'})
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Tham chiếu</div>
                                <div className="text-amber-600 text-xl font-bold">
                                  {info.reference != null ? (info.reference * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Trần</div>
                                <div className="text-purple-400 text-xl font-bold">
                                  {info.ceiling != null ? (info.ceiling * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Sàn</div>
                                <div className="text-cyan-400 text-xl font-bold">
                                  {info.floor != null ? (info.floor * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">KL giao dịch</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.totalTrading ? formatNumberVI(info.totalTrading) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">GT giao dịch</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.totalValue
                                    ? (info.totalValue / 1000000000).toFixed(2) + ' tỷ'
                                    : '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Market Cap & Volume */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Vốn hóa & Thanh khoản
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Vốn hóa thị trường</div>
                                <div className="text-text-main text-2xl font-bold">
                                  {info.marketCap
                                    ? (info.marketCap / 1000000000).toFixed(2) + ' tỷ VNĐ'
                                    : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">KL TB 10 phiên</div>
                                <div className="text-text-main text-2xl font-bold">
                                  {info.avgVol10s ? formatNumberVI(info.avgVol10s) : '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Foreign Trading */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Giao dịch nước ngoài
                            </h2>
                            <div className="flex items-center justify-between bg-panel rounded p-4 border border-border-standard">
                              <span className="text-text-muted">Mua/Bán ròng:</span>
                              <div className="text-right">
                                <div className={`text-xl font-bold ${info.isForeignNetBuy ? 'text-positive' : 'text-negative'
                                  }`}>
                                  {info.foreignNetBSVal
                                    ? `${info.isForeignNetBuy ? '+' : ''}${(info.foreignNetBSVal / 1000000).toFixed(2)} triệu VNĐ`
                                    : '-'}
                                </div>
                                <div className="text-xs text-text-muted mt-1">
                                  {info.isForeignNetBuy ? 'Mua ròng' : 'Bán ròng'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Indices */}
                          {info.indexs && info.indexs.length > 0 && (
                            <div className="bg-panel rounded-lg p-5 border border-border-standard">
                              <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                                Thuộc chỉ số
                              </h2>
                              <div className="flex flex-wrap gap-2">
                                {info.indexs.map((index: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="bg-blue-900/30 text-blue-300 px-3 py-1 rounded text-sm font-medium border border-blue-700/50"
                                  >
                                    {index}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right Sidebar - Stats & Metrics */}
          <div className="w-80 bg-panel border-l border-border-standard flex flex-col min-h-0">
            {/* Tabs */}
            <div className="border-b border-border-standard p-3 flex-shrink-0">
              <div className="flex gap-4 text-sm">
                <button
                  onClick={() => setSidebarTab('Khớp lệnh')}
                  className={`pb-1 font-medium transition ${sidebarTab === 'Khớp lệnh'
                    ? 'text-accent border-b-2 border-[#1E3A5F]'
                    : 'text-text-muted hover:text-text-main'
                    }`}
                >
                  Khớp lệnh
                </button>
                <button
                  onClick={() => setSidebarTab('Bước giá')}
                  className={`pb-1 font-medium transition ${sidebarTab === 'Bước giá'
                    ? 'text-accent border-b-2 border-[#1E3A5F]'
                    : 'text-text-muted hover:text-text-main'
                    }`}
                >
                  Bước giá
                </button>
              </div>
            </div>

            {/* Scrollable area: stats + table + ĐỊNH GIÁ + HIỆU SUẤT */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Trading Stats – BE trả data: { arrayList, totalTradingVolume, buyUpVolume, sellDownVolume } */}
              {matchingHistory && (
                <div className="p-3 pb-4 border-b border-border-standard">
                  <div className="flex justify-between text-xs text-text-muted gap-4">
                    <span className="py-1">KL: <span className="text-text-main font-mono">{formatNumberVI(matchingHistory.totalTradingVolume ?? matchingHistory.data?.totalTradingVolume ?? 0, { maximumFractionDigits: 0 })}</span></span>
                    <span className="py-1">M: <span className="text-positive font-mono">{formatNumberVI(matchingHistory.buyUpVolume ?? matchingHistory.data?.buyUpVolume ?? 0, { maximumFractionDigits: 0 })}</span></span>
                    <span className="py-1">B: <span className="text-negative font-mono">{formatNumberVI(matchingHistory.sellDownVolume ?? matchingHistory.data?.sellDownVolume ?? 0, { maximumFractionDigits: 0 })}</span></span>
                  </div>
                </div>
              )}

              {/* Tab Content: Khớp lệnh – arrayList ở root hoặc data.arrayList */}
              {sidebarTab === 'Khớp lệnh' && (matchingHistory?.arrayList ?? matchingHistory?.data?.arrayList) && (
                <div className="overflow-y-auto">
                  <table className="trading-table">
                    <thead className="sticky top-0 bg-panel">
                      <tr className="border-b border-border-standard">
                        <th className="text-left text-text-muted font-medium py-2 px-3">Giá</th>
                        <th className="text-right text-text-muted font-medium py-2 px-3">KL</th>
                        <th className="text-right text-text-muted font-medium py-2 px-3">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(matchingHistory.arrayList ?? matchingHistory.data?.arrayList ?? []).map((trade: any, idx: number) => {
                        const price = Number(trade.matchPrice ?? trade.price ?? 0);
                        const vol = Number(trade.tradingVolume ?? trade.volume ?? 0);
                        const timeStr = (trade.time ?? trade.matchTime ?? '').toString();
                        return (
                          <tr key={idx} className="border-b border-border-standard hover:bg-panel">
                            <td className={`py-3 px-3 font-mono ${(trade.style ?? trade.side ?? '') === 'B' ? 'text-positive' :
                              (trade.style ?? trade.side ?? '') === 'S' ? 'text-negative' : 'text-amber-600'
                              }`}>
                              {(price * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}
                            </td>
                            <td className="py-3 px-3 text-right text-text-main font-mono">
                              {(vol / 100).toFixed(1)}
                            </td>
                            <td className="py-3 px-3 text-right text-text-muted">
                              {timeStr.substring(0, 5)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab Content: Bước giá – BE trả data: { priceStatistic } */}
              {sidebarTab === 'Bước giá' && (
                <div className="overflow-y-auto">
                  {((orderBook?.priceStatistic ?? orderBook?.data?.priceStatistic)?.length ?? 0) > 0 ? (
                    <table className="trading-table">
                      <thead className="sticky top-0 bg-panel">
                        <tr className="border-b border-border-standard">
                          <th className="text-left text-text-muted font-medium py-2 px-3">Giá</th>
                          <th className="text-right text-text-muted font-medium py-2 px-3">Mua</th>
                          <th className="text-right text-text-muted font-medium py-2 px-3">Bán</th>
                          <th className="text-right text-text-muted font-medium py-2 px-3">Tổng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orderBook?.priceStatistic ?? orderBook?.data?.priceStatistic ?? []).map((step: any, idx: number) => {
                          const stepPrice = Number(step.priceStep ?? step.price ?? 0);
                          const buyVol = Number(step.buyUpVolume ?? step.buyVolume ?? 0);
                          const sellVol = Number(step.sellDownVolume ?? step.sellVolume ?? 0);
                          const totalVol = Number(step.stepVolume ?? step.volume ?? step.totalVolume ?? 0);
                          return (
                            <tr key={idx} className="border-b border-border-standard hover:bg-panel">
                              <td className="py-3 px-3 font-mono text-amber-600">
                                {(stepPrice * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-positive">
                                {buyVol ? (buyVol / 100).toFixed(1) : '-'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-negative">
                                {sellVol ? (sellVol / 100).toFixed(1) : '-'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-text-main">
                                {totalVol ? (totalVol / 100).toFixed(1) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center text-text-muted py-8">
                      {loadingSidebar ? 'Đang tải...' : 'Chưa có dữ liệu bước giá'}
                    </div>
                  )}
                </div>
              )}

              {/* Valuation Metrics - Always show below */}
              <div className="p-4 pt-5 border-t border-border-standard">
                <h3 className="text-xs font-bold text-text-muted uppercase mb-4">ĐỊNH GIÁ</h3>
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">P/E:</span>
                    <span className="text-text-main font-mono text-right">{detail.pe ? detail.pe.toFixed(2) : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">P/B:</span>
                    <span className="text-text-main font-mono text-right">{detail.pb ? detail.pb.toFixed(2) : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">EPS:</span>
                    <span className="text-text-main font-mono text-right">{detail.eps != null ? formatNumberVI(Number(detail.eps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">ROE:</span>
                    <span className="text-positive font-mono text-right">{detail.roe ? detail.roe.toFixed(2) + '%' : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">ROA:</span>
                    <span className="text-positive font-mono text-right">{detail.roa ? detail.roa.toFixed(2) + '%' : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">Beta:</span>
                    <span className="text-text-main font-mono text-right">{detail.beta ? detail.beta.toFixed(2) : '-'}</span>
                  </div>
                  <div className="flex justify-between border-t border-border-standard pt-4 mt-3 py-1">
                    <span className="text-text-muted">Vốn hóa:</span>
                    <span className="text-text-main font-mono text-right">{detail.marketCap ? detail.marketCap.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) + ' tỷ' : '-'}</span>
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div className="p-4 pt-5 border-t border-border-standard">
                <h3 className="text-xs font-bold text-text-muted uppercase mb-4">HIỆU SUẤT</h3>
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">1 tuần:</span>
                    <span className={`font-mono text-right ${(detail.raw?.stockPercentChange1w || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {detail.raw?.stockPercentChange1w ? detail.raw.stockPercentChange1w.toFixed(2) + '%' : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">1 tháng:</span>
                    <span className={`font-mono text-right ${(detail.raw?.stockPercentChange1m || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {detail.raw?.stockPercentChange1m ? detail.raw.stockPercentChange1m.toFixed(2) + '%' : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">3 tháng:</span>
                    <span className={`font-mono text-right ${(detail.raw?.stockPercentChange3m || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {detail.raw?.stockPercentChange3m ? detail.raw.stockPercentChange3m.toFixed(2) + '%' : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Chart Modal Component ---
const ChartModal = ({ isOpen, onClose, symbol, exchange, data, loading, stocks, onSymbolChange }: {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  exchange: string;
  data: any[];
  loading: boolean;
  stocks: any[];
  onSymbolChange: (symbol: string, exchange: string) => void;
}) => {
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('auth_token'));

  useEffect(() => {
    const handler = () => setIsAuthenticated(false);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  if (!isAuthenticated) {
    return <AuthView onSuccess={() => setIsAuthenticated(true)} />;
  }

  const handleLogout = async () => {
    await authApi.logout();
    setIsAuthenticated(false);
  };

  return (
    <AppErrorBoundary onReset={handleLogout}>
      <MainApp onLogout={handleLogout} />
    </AppErrorBoundary>
  );
}

// Modal cấu hình danh mục — khai báo ngoài MainApp để tránh re-mount mỗi khi parent re-render (gây giựt sau F5).
function PortfolioSetupModalStandalone({
  isOpen,
  onClose,
  initialBalance,
  initialRisk,
  initialExpectedReturn,
  onSave,
  portfolioId,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialBalance: number;
  initialRisk: number;
  initialExpectedReturn?: number;
  onSave: (balance: number, riskPercent: number, expectedReturnPercent: number) => void | Promise<void>;
  portfolioId?: string | null;
  onDelete?: () => void | Promise<void>;
}) {
  const [localBalance, setLocalBalance] = useState(initialBalance.toString());
  const [localRisk, setLocalRisk] = useState(initialRisk);
  const [localExpectedReturn, setLocalExpectedReturn] = useState(initialExpectedReturn ?? 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cập nhật state local khi props đổi (vd. mở lại modal với giá trị mới)
  useEffect(() => {
    if (isOpen) {
      setLocalBalance(initialBalance.toString());
      setLocalRisk(initialRisk);
      setLocalExpectedReturn(initialExpectedReturn ?? 0);
    }
  }, [isOpen, initialBalance, initialRisk, initialExpectedReturn]);

  const calcMaxLoss = () => {
    const bal = parseFloat(localBalance) || 0;
    return (bal * localRisk) / 100;
  };

  const handleSave = async () => {
    const bal = parseFloat(localBalance);
    if (isNaN(bal) || bal < 0) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(bal, localRisk, localExpectedReturn));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !portfolioId) return;
    if (!confirm('Bạn có chắc muốn xóa danh mục này? Dữ liệu liên quan có thể bị ảnh hưởng.')) return;
    setDeleting(true);
    try {
      await Promise.resolve(onDelete());
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const riskLevel = localRisk <= 2 ? 'Bảo toàn (Safe)' : localRisk <= 5 ? 'Tiêu chuẩn (Standard)' : 'Mạo hiểm (High Risk)';
  const riskColor = localRisk <= 2 ? 'text-positive' : localRisk <= 5 ? 'text-accent' : 'text-negative';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md flex flex-col" style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border-standard)', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-standard shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-text-main">Cấu Hình Danh Mục</h2>
            <p className="text-[11px] text-text-dim mt-0.5">Thiết lập vốn và giới hạn rủi ro</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded text-text-dim hover:text-text-main hover:bg-white/5 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">

          {/* Vốn ban đầu */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-text-dim block mb-1.5">Vốn Ban Đầu (VND)</label>
            <input
              type="number"
              value={localBalance}
              onChange={(e) => setLocalBalance(e.target.value)}
              placeholder="Ví dụ: 100000000"
              className="w-full px-3 py-2.5 rounded font-mono text-[14px] font-semibold text-text-main outline-none focus:border-accent transition-colors"
              style={{ background: 'var(--color-background)', border: '1px solid var(--color-border-standard)' }}
            />
            {parseFloat(localBalance) > 0 && (
              <p className="text-[10px] text-text-dim mt-1 font-mono">{formatNumberVI(parseFloat(localBalance))} VND</p>
            )}
          </div>

          {/* Giới hạn rủi ro */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-text-dim">Giới Hạn Rủi Ro</label>
              <span className={`text-[11px] font-bold ${riskColor}`}>{riskLevel}</span>
            </div>
            <div className="rounded p-3 space-y-3" style={{ background: 'var(--color-background)', border: '1px solid var(--color-border-subtle)' }}>
              <input
                type="range"
                min="1"
                max="30"
                step="0.5"
                value={Math.min(30, Math.max(1, localRisk))}
                onChange={(e) => setLocalRisk(parseFloat(e.target.value))}
                className="w-full cursor-pointer accent-blue-500"
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <div className="flex justify-between items-center">
                <div>
                  <span className={`text-[22px] font-bold font-mono ${riskColor}`}>{localRisk}%</span>
                  <span className="text-[10px] text-text-dim ml-1">/ lệnh</span>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-text-dim">Mất Tối Đa</p>
                  <p className="text-[13px] font-mono font-semibold text-negative mt-0.5">{formatNumberVI(calcMaxLoss())}</p>
                </div>
              </div>
              <div className="flex justify-between text-[9px] text-text-dim">
                <span>1% — An toàn</span>
                <span>30% — Mạo hiểm</span>
              </div>
            </div>
          </div>

          {/* Lãi kỳ vọng */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-text-dim block mb-1.5">Lãi Kỳ Vọng / Kỳ (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="-100"
                max="100"
                step="0.5"
                value={localExpectedReturn}
                onChange={(e) => setLocalExpectedReturn(parseFloat(e.target.value) || 0)}
                className="w-24 px-3 py-2.5 rounded font-mono text-[13px] font-semibold text-text-main outline-none focus:border-accent"
                style={{ background: 'var(--color-background)', border: '1px solid var(--color-border-standard)' }}
              />
              <span className="text-[12px] text-text-dim">% / kỳ</span>
              {parseFloat(localBalance) > 0 && localExpectedReturn !== 0 && (
                <span className="text-[11px] font-mono text-positive ml-auto">
                  ≈ {formatNumberVI(parseFloat(localBalance) * localExpectedReturn / 100)} VND
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 space-y-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded font-bold text-[13px] tracking-wide text-white transition-all disabled:opacity-50"
            style={{ background: 'var(--color-accent)' }}
          >
            {saving ? 'Đang lưu...' : 'Xác Nhận Cấu Hình'}
          </button>
          {portfolioId && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="w-full py-2 rounded text-[11px] font-semibold text-negative transition-colors disabled:opacity-50 hover:bg-negative/5"
              style={{ border: '1px solid var(--color-border-subtle)' }}
            >
              {deleting ? 'Đang xóa...' : 'Xóa Danh Mục'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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
function OpenPositionModal({
  isOpen,
  onClose,
  portfolioId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  onSuccess: () => void;
}) {
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState<string>('');
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [useMarketPrice, setUseMarketPrice] = useState(true); // true = lấy giá thị trường, false = tự nhập
  const [entryPriceInput, setEntryPriceInput] = useState(''); // giá (điểm) khi tự nhập
  const [quantityInput, setQuantityInput] = useState(''); // khối lượng do user nhập (không lấy từ thị trường)
  const [stopType, setStopType] = useState<'FIXED' | 'PERCENT' | 'MAX_LOSS'>('FIXED');
  const [stopPrice, setStopPrice] = useState('');
  const [stopPercent, setStopPercent] = useState('');
  const [stopMaxLossVnd, setStopMaxLossVnd] = useState('');
  const [takeProfitType, setTakeProfitType] = useState<'FIXED' | 'PERCENT' | 'R_RATIO' | ''>('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [takeProfitPercent, setTakeProfitPercent] = useState('');
  const [takeProfitRR, setTakeProfitRR] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<{ stop_loss: number; take_profit: number | null; risk_value_vnd: number; risk_reward: number | null } | null>(null);

  const fetchEntryInfo = async (sym: string, qty?: number) => {
    const s = sym.trim();
    if (!s) {
      setExchange('');
      setMarketPrice(null);
      setQuantityInput('');
      setExchangeError(null);
      return;
    }
    setExchangeLoading(true);
    setExchangeError(null);
    try {
      const res = await marketApi.getEntryInfo(s, qty != null ? { quantity: qty } : undefined);
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setExchange(d.exchange || '');
        // Giá luôn lưu theo đơn vị ĐIỂM (1 điểm = 1.000 VND). Nếu API trả VND (>= 1000) thì quy về điểm.
        const raw = typeof d.market_price === 'number' ? d.market_price : null;
        const priceInPoints = raw != null ? (raw >= 1000 ? raw / 1000 : raw) : null;
        setMarketPrice(priceInPoints);
        setExchangeError(null);
      } else {
        setExchange('');
        setMarketPrice(null);
        setQuantityInput('');
        setExchangeError('Không lấy được thông tin mã');
      }
    } catch {
      setExchange('');
      setMarketPrice(null);
      setQuantityInput('');
      setExchangeError('Không lấy được thông tin mã');
    } finally {
      setExchangeLoading(false);
    }
  };

  const resetForm = () => {
    setSymbol('');
    setExchange('');
    setExchangeLoading(false);
    setExchangeError(null);
    setMarketPrice(null);
    setQuantityInput('');
    setUseMarketPrice(true);
    setEntryPriceInput('');
    setStopType('FIXED');
    setStopPrice('');
    setStopPercent('');
    setStopMaxLossVnd('');
    setTakeProfitType('');
    setTakeProfitPrice('');
    setTakeProfitPercent('');
    setTakeProfitRR('');
    setPreview(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const parseQuantity = (): number | null => {
    const s = quantityInput.replace(/\s|,/g, '');
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const effectiveQuantity = parseQuantity();

  const getEffectivePricePoints = (): number | null => {
    if (useMarketPrice) {
      const p = marketPrice != null ? (marketPrice >= 1000 ? marketPrice / 1000 : marketPrice) : null;
      return p != null && p > 0 ? p : null;
    }
    const n = parseFloat(entryPriceInput.replace(/,/g, '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const effectivePricePoints = getEffectivePricePoints();

  // Quy ước: Popup nhập giá theo ĐIỂM (1 điểm = 1.000 ₫). Gửi lên BE luôn là VND (điểm × 1000).
  const buildBody = (): CreatePositionRequest | null => {
    if (effectiveQuantity == null || effectiveQuantity <= 0) return null;
    if (effectivePricePoints == null || effectivePricePoints <= 0) return null;

    const body: CreatePositionRequest = {
      symbol: symbol.trim(),
      exchange,
      use_market_entry: useMarketPrice,
      ...(useMarketPrice ? {} : { entry_price: Math.round(effectivePricePoints * 1000) }),
      use_market_quantity: false,
      quantity: effectiveQuantity,
      stop_type: stopType,
      stop_params: {},
    };

    if (stopType === 'FIXED') {
      const sp = parseFloat(stopPrice);
      if (Number.isNaN(sp)) return null;
      body.stop_price = Math.round(sp * 1000); // điểm → VND
    } else if (stopType === 'PERCENT') {
      const pct = parseFloat(stopPercent);
      if (Number.isNaN(pct)) return null;
      body.stop_params = { percent: pct };
    } else if (stopType === 'MAX_LOSS') {
      const maxVnd = parseFloat(stopMaxLossVnd);
      if (Number.isNaN(maxVnd) || maxVnd <= 0) return null;
      body.stop_params = { max_loss_vnd: maxVnd }; // đã là VND
    }

    if (takeProfitType === 'FIXED') {
      const tp = parseFloat(takeProfitPrice);
      if (!Number.isNaN(tp)) {
        body.take_profit_type = 'FIXED';
        body.take_profit_price = Math.round(tp * 1000); // điểm → VND
      }
    } else if (takeProfitType === 'PERCENT') {
      const pct = parseFloat(takeProfitPercent);
      if (!Number.isNaN(pct)) {
        body.take_profit_type = 'PERCENT';
        body.take_profit_params = { percent: pct };
      }
    } else if (takeProfitType === 'R_RATIO') {
      const rr = parseFloat(takeProfitRR);
      if (!Number.isNaN(rr) && rr > 0) {
        body.take_profit_type = 'R_RATIO';
        body.take_profit_params = { risk_reward_ratio: rr };
      }
    }
    return body;
  };

  const handlePreview = async () => {
    const body = buildBody();
    if (!body || !body.symbol) {
      alert('Điền đủ Mã CK và cấu hình dừng lỗ. Khối lượng lấy từ thị trường sau khi chọn mã.');
      return;
    }
    if (!exchange || effectivePricePoints == null || effectivePricePoints <= 0 || effectiveQuantity == null || effectiveQuantity <= 0) {
      alert('Chọn mã CK, nhập giá và khối lượng hợp lệ.');
      return;
    }
    try {
      const entryPriceVnd = Math.round(effectivePricePoints * 1000);
      const res = await positionApi.calculate(portfolioId, {
        entry_price: entryPriceVnd,
        quantity: effectiveQuantity,
        stop_type: body.stop_type,
        stop_params: body.stop_params,
        stop_price: body.stop_price,
        take_profit_type: body.take_profit_type,
        take_profit_params: body.take_profit_params,
        take_profit_price: body.take_profit_price,
      });
      if (res.data?.success && res.data?.data) {
        setPreview(res.data.data);
      }
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Tính toán thất bại.');
    }
  };

  const handleSubmit = async () => {
    const body = buildBody();
    if (!body || !body.symbol) {
      alert('Điền đủ Mã CK và cấu hình dừng lỗ. Khối lượng lấy từ thị trường sau khi chọn mã.');
      return;
    }
    if (!exchange || effectivePricePoints == null || effectivePricePoints <= 0 || effectiveQuantity == null || effectiveQuantity <= 0) {
      alert('Chọn mã CK và nhập giá, khối lượng hợp lệ.');
      return;
    }
    setSubmitting(true);
    try {
      await positionApi.create(portfolioId, body);
      onSuccess();
      handleClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Đặt lệnh thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-panel rounded-2xl w-full max-w-lg shadow-xl overflow-hidden h-[90vh] max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 flex justify-between items-center flex-shrink-0 border-b border-border-standard/80">
          <h2 className="text-xl font-semibold text-text-main">
            Đặt lệnh
          </h2>
          <button type="button" onClick={handleClose} className="p-2 rounded-full text-text-muted hover:bg-panel hover:text-text-main" aria-label="Đóng">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6 bg-[#FAFBFC]">
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-text-main">Mã &amp; sàn</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Mã CK</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => {
                    setSymbol(e.target.value);
                    if (!e.target.value.trim()) { setExchange(''); setMarketPrice(null); setExchangeError(null); }
                  }}
                  onBlur={() => fetchEntryInfo(symbol)}
                  placeholder="VD: ACB"
                  className="w-full px-3 py-2.5 rounded-xl border border-border-standard text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] bg-panel"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Sàn</label>
                <div className="px-3 py-2.5 rounded-xl border border-border-standard bg-panel text-text-main text-sm min-h-[42px] flex items-center">
                  {exchangeLoading ? 'Đang tải...' : exchangeError ? <span className="text-negative">{exchangeError}</span> : exchange || '—'}
                </div>
              </div>
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-text-main">Giá &amp; khối lượng</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm text-text-muted">Giá vào</label>
                <div className="flex rounded-xl overflow-hidden bg-[#F1F5F9] p-1">
                  <button type="button" onClick={() => setUseMarketPrice(true)} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${useMarketPrice ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Giá sàn</button>
                  <button type="button" onClick={() => { setUseMarketPrice(false); if (marketPrice != null && entryPriceInput === '') setEntryPriceInput((marketPrice >= 1000 ? marketPrice / 1000 : marketPrice).toFixed(2)); }} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${!useMarketPrice ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Tự nhập</button>
                </div>
                {useMarketPrice ? (
                  <div className="px-3 py-2.5 rounded-xl border border-border-standard bg-panel min-h-[44px] flex items-center justify-between">
                    {exchangeLoading ? <span className="text-[#64748B] text-sm">Đang lấy giá...</span> : marketPrice != null ? (<><span className="font-semibold tabular-nums text-text-main">{(() => { const p = marketPrice * STOCK_PRICE_DISPLAY_SCALE; const points = p >= 1000 ? p / 1000 : p; return points.toFixed(2); })()}</span><span className="text-[#64748B] text-sm">điểm</span></>) : <span className="text-[#94A3B8] text-sm">Chọn mã CK trước</span>}
                  </div>
                ) : (
                  <div className="flex rounded-xl border border-border-standard bg-panel overflow-hidden">
                    <input type="text" inputMode="decimal" value={entryPriceInput} onChange={(e) => setEntryPriceInput(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="23.85" className="flex-1 min-w-0 px-3 py-2.5 text-text-main min-h-[44px] placeholder:text-[#94A3B8] focus:outline-none" />
                    <span className="flex-shrink-0 min-w-[3.5rem] px-3 py-2.5 text-sm text-[#64748B] flex items-center justify-end bg-[#F8FAFC]">điểm</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Khối lượng (cp)</label>
                <input type="text" inputMode="numeric" value={quantityInput} onChange={(e) => setQuantityInput(e.target.value.replace(/[^\d,]/g, ''))} placeholder="Số cp" className="w-full px-3 py-2.5 rounded-xl border border-border-standard text-text-main placeholder:text-[#94A3B8] bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] min-h-[44px]" />
              </div>
            </div>
          </section>
          {effectivePricePoints != null && effectivePricePoints > 0 && effectiveQuantity != null && effectiveQuantity > 0 && (() => {
            const pricePoints = effectivePricePoints;
            const priceVndPerShare = pricePoints * 1000;
            const totalVnd = Math.round(pricePoints * 1000 * effectiveQuantity);
            return (
              <section className="rounded-xl bg-panel border border-border-standard/80 p-4">
                <h3 className="text-sm font-medium text-text-main mb-3">Tổng tiền ước tính</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-[#475569]"><span>Giá</span><span className="font-mono tabular-nums">{pricePoints.toFixed(2)} điểm</span></div>
                  <div className="flex justify-between text-[#475569]"><span>Đơn giá</span><span className="font-mono tabular-nums">{formatNumberVI(priceVndPerShare)} ₫/cp</span></div>
                  <div className="flex justify-between text-[#475569]"><span>Khối lượng</span><span className="font-mono tabular-nums">{formatNumberVI(effectiveQuantity)} cp</span></div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-border-standard font-medium text-text-main"><span>Thành tiền</span><span className="font-mono tabular-nums text-[#166534]">{formatNumberVI(totalVnd)} ₫</span></div>
                </div>
              </section>
            );
          })()}
          <section className="rounded-xl bg-panel border border-border-standard/80 p-4 space-y-3">
            <h3 className="text-sm font-medium text-text-main">Ngừng lỗ</h3>
            <div className="flex rounded-xl overflow-hidden bg-[#F1F5F9] p-1">
              <button type="button" onClick={() => setStopType('FIXED')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${stopType === 'FIXED' ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Theo giá</button>
              <button type="button" onClick={() => setStopType('PERCENT')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${stopType === 'PERCENT' ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Theo %</button>
              <button type="button" onClick={() => setStopType('MAX_LOSS')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${stopType === 'MAX_LOSS' ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Thua lỗ tối đa</button>
            </div>
            {stopType === 'FIXED' && (
              <div>
                <label className="block text-sm text-text-muted mb-1">Giá dừng lỗ (điểm)</label>
                <input type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder="VD: 22.50" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {stopPrice.trim() !== '' && (() => {
                  const sp = parseFloat(stopPrice);
                  if (!Number.isFinite(sp) || sp <= 0) return null;
                  const entryPoints = effectivePricePoints ?? 0;
                  const stopVndPerShare = sp * 1000;
                  const riskPerShare = (entryPoints - sp) * 1000;
                  const qty = effectiveQuantity ?? 0;
                  const totalRisk = qty > 0 ? Math.round(riskPerShare * qty) : 0;
                  return (
                    <div className="mt-3 rounded-xl bg-[#FEF2F2]/60 border border-[#FECACA]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính dừng lỗ</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Giá dừng lỗ</span><span className="font-mono tabular-nums">{sp.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between"><span>Đơn giá</span><span className="font-mono tabular-nums">{formatNumberVI(stopVndPerShare)} ₫/cp</span></div>
                        {effectivePricePoints != null && effectiveQuantity != null && effectiveQuantity > 0 && (
                          <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Rủi ro ước tính</span><span className="font-mono tabular-nums text-negative">{formatNumberVI(totalRisk)} ₫</span></div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {stopType === 'PERCENT' && (
              <>
                <label className="block text-sm text-text-muted mb-1">% thua lỗ chấp nhận</label>
                <input type="number" value={stopPercent} onChange={(e) => setStopPercent(e.target.value)} placeholder="VD: 5" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {stopPercent.trim() !== '' && effectivePricePoints != null && effectiveQuantity != null && (() => {
                  const pct = parseFloat(stopPercent);
                  if (!Number.isFinite(pct) || pct < 0) return null;
                  const entryPoints = effectivePricePoints;
                  const stopPoints = entryPoints * (1 - pct / 100);
                  const stopVnd = stopPoints * 1000;
                  const riskPerShare = (entryPoints - stopPoints) * 1000;
                  const totalRisk = Math.round(riskPerShare * effectiveQuantity);
                  return (
                    <div className="mt-3 rounded-xl bg-[#FEF2F2]/60 border border-[#FECACA]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính dừng lỗ</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Giá vào</span><span className="font-mono tabular-nums">{entryPoints.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between"><span>Giảm {pct}%</span><span className="font-mono tabular-nums">→ {stopPoints.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Rủi ro ước tính</span><span className="font-mono tabular-nums text-negative">{formatNumberVI(totalRisk)} ₫</span></div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {stopType === 'MAX_LOSS' && (
              <>
                <label className="block text-sm text-text-muted mb-1">Số tiền tối đa chấp nhận thua (₫)</label>
                <input type="number" value={stopMaxLossVnd} onChange={(e) => setStopMaxLossVnd(e.target.value)} placeholder="VD: 500000" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {stopMaxLossVnd.trim() !== '' && effectivePricePoints != null && effectiveQuantity != null && effectiveQuantity > 0 && (() => {
                  const maxVnd = parseFloat(stopMaxLossVnd);
                  if (!Number.isFinite(maxVnd) || maxVnd <= 0) return null;
                  const entryPoints = effectivePricePoints;
                  const riskPerShareVnd = maxVnd / effectiveQuantity;
                  const stopPoints = entryPoints - riskPerShareVnd / 1000;
                  if (stopPoints <= 0) return null;
                  return (
                    <div className="mt-3 rounded-xl bg-[#FEF2F2]/60 border border-[#FECACA]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính dừng lỗ</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Thua lỗ tối đa</span><span className="font-mono tabular-nums">{formatNumberVI(maxVnd)} ₫</span></div>
                        <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Giá dừng lỗ (điểm)</span><span className="font-mono tabular-nums text-negative">{stopPoints.toFixed(2)}</span></div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </section>
          <section className="rounded-xl bg-panel border border-border-standard/80 p-4 space-y-3">
            <h3 className="text-sm font-medium text-text-main">Chốt lời <span className="text-text-muted font-normal">(tùy chọn)</span></h3>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setTakeProfitType('')} className={`py-2 text-xs font-medium rounded-lg transition-colors ${takeProfitType === '' ? 'bg-[#ECFDF5] text-positive border border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border border-transparent'}`}>Không</button>
              <button type="button" onClick={() => setTakeProfitType('FIXED')} className={`py-2 text-xs font-medium rounded-lg transition-colors ${takeProfitType === 'FIXED' ? 'bg-[#ECFDF5] text-positive border border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border border-transparent'}`}>Giá cố định</button>
              <button type="button" onClick={() => setTakeProfitType('PERCENT')} className={`py-2 text-xs font-medium rounded-lg transition-colors ${takeProfitType === 'PERCENT' ? 'bg-[#ECFDF5] text-positive border border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border border-transparent'}`}>Theo %</button>
              <button type="button" onClick={() => setTakeProfitType('R_RATIO')} className={`py-2 text-xs font-medium rounded-lg transition-colors ${takeProfitType === 'R_RATIO' ? 'bg-[#ECFDF5] text-positive border border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border border-transparent'}`}>Theo R:R</button>
            </div>
            {takeProfitType === 'FIXED' && (
              <>
                <label className="block text-sm text-text-muted mb-1">Giá chốt lời (điểm)</label>
                <input type="number" value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} placeholder="VD: 26.00" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {takeProfitPrice.trim() !== '' && (() => {
                  const tp = parseFloat(takeProfitPrice);
                  if (!Number.isFinite(tp) || tp <= 0) return null;
                  const tpVnd = tp * 1000;
                  const qty = effectiveQuantity ?? 0;
                  const totalVnd = qty > 0 ? Math.round(tpVnd * qty) : 0;
                  return (
                    <div className="mt-3 rounded-xl bg-[#F0FDF4]/80 border border-[#BBF7D0]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính chốt lời</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Giá chốt lời</span><span className="font-mono tabular-nums">{tp.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between"><span>Đơn giá</span><span className="font-mono tabular-nums">{formatNumberVI(tpVnd)} ₫/cp</span></div>
                        {qty > 0 && <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Thành tiền ước tính</span><span className="font-mono tabular-nums text-[#166534]">{formatNumberVI(totalVnd)} ₫</span></div>}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {takeProfitType === 'PERCENT' && (
              <>
                <label className="block text-sm text-text-muted mb-1">% lợi nhuận mong muốn</label>
                <input type="number" value={takeProfitPercent} onChange={(e) => setTakeProfitPercent(e.target.value)} placeholder="VD: 10" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {takeProfitPercent.trim() !== '' && effectivePricePoints != null && (() => {
                  const pct = parseFloat(takeProfitPercent);
                  if (!Number.isFinite(pct) || pct < 0) return null;
                  const entryPoints = effectivePricePoints;
                  const tpPoints = entryPoints * (1 + pct / 100);
                  const tpVnd = tpPoints * 1000;
                  const qty = effectiveQuantity ?? 0;
                  const totalVnd = qty > 0 ? Math.round(tpVnd * qty) : 0;
                  return (
                    <div className="mt-3 rounded-xl bg-[#F0FDF4]/80 border border-[#BBF7D0]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính chốt lời</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Giá vào</span><span className="font-mono tabular-nums">{entryPoints.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between"><span>Tăng {pct}%</span><span className="font-mono tabular-nums">→ {tpPoints.toFixed(2)} điểm</span></div>
                        {qty > 0 && <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Thành tiền ước tính</span><span className="font-mono tabular-nums text-[#166534]">{formatNumberVI(totalVnd)} ₫</span></div>}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {takeProfitType === 'R_RATIO' && (
              <>
                <label className="block text-sm text-text-muted mb-1">Tỷ lệ R:R (lợi : rủi ro)</label>
                <input type="number" value={takeProfitRR} onChange={(e) => setTakeProfitRR(e.target.value)} placeholder="VD: 2" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {takeProfitRR.trim() !== '' && effectivePricePoints != null && (() => {
                  const rr = parseFloat(takeProfitRR);
                  if (!Number.isFinite(rr) || rr <= 0) return null;
                  const entryPoints = effectivePricePoints;
                  let riskPerShare = 0;
                  if (stopType === 'FIXED' && stopPrice.trim() !== '') {
                    const sp = parseFloat(stopPrice);
                    if (Number.isFinite(sp)) riskPerShare = (entryPoints - sp) * 1000;
                  } else if (stopType === 'PERCENT' && stopPercent.trim() !== '') {
                    const pct = parseFloat(stopPercent);
                    if (Number.isFinite(pct) && pct >= 0) {
                      const stopPoints = entryPoints * (1 - pct / 100);
                      riskPerShare = (entryPoints - stopPoints) * 1000;
                    }
                  } else if (stopType === 'MAX_LOSS' && stopMaxLossVnd.trim() !== '' && effectiveQuantity != null && effectiveQuantity > 0) {
                    const maxVnd = parseFloat(stopMaxLossVnd);
                    if (Number.isFinite(maxVnd) && maxVnd > 0) riskPerShare = maxVnd / effectiveQuantity;
                  }
                  if (riskPerShare <= 0) return null;
                  const rewardPerShare = riskPerShare * rr;
                  const tpPoints = entryPoints + rewardPerShare / 1000;
                  const tpVnd = tpPoints * 1000;
                  const qty = effectiveQuantity ?? 0;
                  const totalVnd = qty > 0 ? Math.round(tpVnd * qty) : 0;
                  return (
                    <div className="mt-3 rounded-xl bg-[#F0FDF4]/80 border border-[#BBF7D0]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính chốt lời R:R</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>R:R = 1:{rr}</span><span className="font-mono tabular-nums">Giá chốt lời {tpPoints.toFixed(2)} điểm</span></div>
                        {qty > 0 && <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Thành tiền ước tính</span><span className="font-mono tabular-nums text-[#166534]">{formatNumberVI(totalVnd)} ₫</span></div>}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </section>
          {preview && (
            <section className="rounded-xl bg-panel border border-border-standard/80 p-4">
              <h3 className="text-sm font-medium text-text-main mb-2">Xem trước</h3>
              <div className="text-sm text-[#475569] space-y-1">
                <p>Dừng lỗ: {typeof preview.stop_loss === 'number' ? (preview.stop_loss / 1000).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—'} · Chốt lời: {preview.take_profit != null && typeof preview.take_profit === 'number' ? (preview.take_profit / 1000).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—'}</p>
                <p>Rủi ro: {typeof preview.risk_value_vnd === 'number' ? formatNumberVI(preview.risk_value_vnd) : '—'} ₫ · R:R: {preview.risk_reward != null && typeof preview.risk_reward === 'number' ? preview.risk_reward.toFixed(2) : '—'}</p>
              </div>
            </section>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border-standard/80 flex-shrink-0 bg-panel rounded-b-2xl">
          <button type="button" onClick={handleSubmit} disabled={submitting || !exchange || effectivePricePoints == null || effectivePricePoints <= 0 || effectiveQuantity == null || effectiveQuantity <= 0 || exchangeLoading} className="w-full py-3 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none transition-colors">{submitting ? 'Đang tạo...' : 'Đặt lệnh'}</button>
        </div>
      </div>
    </div>
  );
}

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

function MainApp({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const [currentView, setCurrentView] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Core State
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

    return () => {
      wsService.disconnect();
    };
  }, []);

  // Load stocks when on home (tổng quan) so "Tất cả mã chứng khoán" has data
  useEffect(() => {
    if (currentView === 'home') {
      loadStocks();
    }
  }, [currentView]);

  // Reload stocks when filters change + Auto refresh every 5s for real-time updates
  useEffect(() => {
    loadStocks();
    const interval = setInterval(() => {
      if (!loading) {
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
      const res = await positionApi.list(portfolio.id);
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

  async function loadData() {
    try {
      setLoading(true);

      // Only load auth-required data if token exists
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Load portfolio
        const portfolioRes = await portfolioApi.getAll();
        if (portfolioRes.data.success && portfolioRes.data.data.length > 0) {
          const p = portfolioRes.data.data[0];
          setPortfolio(p);
          setTotalBalance(parseFloat(p.total_balance));
          setMaxRiskPercent(parseFloat(p.max_risk_percent));
          setExpectedReturnPercent(parseFloat(p.expected_return_percent) ?? 0);
        } else {
          // No portfolio - show setup modal
          setShowSetupModal(true);
        }

      }

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
      console.log('Loading chart:', { symbol, exchange, timeframe, limit });
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
    } catch (error) {
      console.error('Load chart error:', error);
      console.error('Error details:', (error as any)?.response?.data);
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

    if (portfolio) {
      wsService.subscribeToPortfolio(portfolio.id);
    }

    wsService.onRiskUpdate((data) => {
      console.log('Risk update:', data);
      if (portfolio) {
        loadData();
      }
    });

    wsService.onNotification((data) => {
      console.log('Notification:', data);
      alert(`${data.title}\n${data.message}`);
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
                setPortfolio(res.data.data);
                setTotalBalance(parseFloat(res.data.data.total_balance));
                setMaxRiskPercent(parseFloat(res.data.data.max_risk_percent));
                setExpectedReturnPercent(parseFloat(res.data.data.expected_return_percent) ?? 0);
              }
            } else {
              const res = await portfolioApi.create({
                name: 'Default Portfolio',
                totalBalance: balance,
                maxRiskPercent: riskPercent,
                expectedReturnPercent: expectedReturn,
              });
              if (res.data?.data) {
                setPortfolio(res.data.data);
                setTotalBalance(parseFloat(res.data.data.total_balance));
                setMaxRiskPercent(parseFloat(res.data.data.max_risk_percent));
                setExpectedReturnPercent(parseFloat(res.data.data.expected_return_percent) ?? 0);
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
            setPortfolio(null);
            setTotalBalance(0);
            setMaxRiskPercent(5);
            setExpectedReturnPercent(0);
            setShowSetupModal(false);
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Xóa thất bại. Vui lòng thử lại.';
            alert(msg);
          }
        } : undefined}
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
      />

      <MobileNav currentView={currentView} onChangeView={setCurrentView} />

      {/* ── NEW FULL-SCREEN VIEWS (no padding) ── */}
      {(currentView === 'terminal') && (
        <div className={`fixed top-0 bottom-0 right-0 transition-all duration-200 ${isSidebarOpen ? 'left-[220px]' : 'left-16'}`}>
          <TradingTerminal
            portfolioId={portfolio?.id ?? null}
            initialSymbol={selectedSymbol}
            initialExchange={selectedExchange}
            sidebarWidth={isSidebarOpen ? 220 : 64}
            onOpenPosition={loadPositions}
          />
        </div>
      )}

      {/* ── STANDARD VIEWS (with padding) ── */}
      {currentView !== 'terminal' && (
      <main
        className={`flex-1 p-4 md:p-5 overflow-y-auto h-screen scroll-smooth relative pb-24 lg:pb-6 transition-all duration-200 ${isSidebarOpen ? 'lg:ml-[220px]' : 'lg:ml-16'
          }`}
      >

        {/* Dashboard (home / dashboard) */}
        {(currentView === 'dashboard' || currentView === 'home') && (
          <DashboardView
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
            onOpenTrading={(sym, exch) => {
              setSelectedSymbol(sym);
              setSelectedExchange(exch);
              setCurrentView('terminal');
            }}
          />
        )}

        {/* Risk Manager View */}
        {currentView === 'risk' && (
          <RiskManagerView
            portfolioId={portfolio?.id ?? null}
            positions={positions}
            totalBalance={totalBalance}
            maxRiskPercent={maxRiskPercent}
            onNavigate={setCurrentView}
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

        {/* OLD home view: 'home_legacy' + 'market' (Bảng Giá) */}
        {(currentView === 'home_legacy' || currentView === 'market') && (
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
                    <div className="flex items-center bg-panel border border-border-standard rounded-lg px-3 py-2 w-full sm:w-44 sm:max-w-[200px] min-w-0">
                      <input type="text" placeholder="Tìm mã..." value={indexSearch} onChange={(e) => setIndexSearch(e.target.value)} className="bg-transparent border-0 outline-none text-text-main text-sm placeholder-slate-400 w-full min-w-0" />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:justify-end min-w-0">
                      <div className="relative flex-1 min-w-0 sm:flex-initial">
                        <button type="button" onClick={() => setIndexDropdownOpen((o) => !o)} className="w-full sm:w-auto flex items-center px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-text-main bg-panel hover:bg-panel border border-border-standard transition-colors min-w-0 sm:min-w-[140px]">
                          <span className="truncate">{indexSelectionLabel}</span>
                        </button>
                        {indexDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIndexDropdownOpen(false)} aria-hidden />
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-[300px] max-h-[70vh] overflow-y-auto rounded-xl bg-panel border border-border-standard shadow-xl py-2">
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
                      <button type="button" onClick={() => setMarketTableFullscreen((f) => !f)} className="p-2.5 rounded-lg text-text-muted hover:bg-panel hover:text-accent transition-colors shrink-0" title={marketTableFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}>
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
                                      return filtered.slice(0, 200).map((r: any) => {
                                        const matchPrice = r.matchPrice;
                                        const change = r.change;
                                        const pct = r.percentChange;
                                        const isCeiling = r.tran != null && matchPrice != null && matchPrice >= r.tran;
                                        const isFloor = r.san != null && matchPrice != null && matchPrice <= r.san;
                                        return (
                                          <tr key={`${r.symbol}-${r.exchange ?? 'NA'}`} onClick={() => handleStockClick(r.symbol, r.exchange || 'HOSE')} className={`hover:bg-panel-hover cursor-pointer ${selectedSymbol === r.symbol ? 'bg-[#EFF6FF] ring-inset ring-1 ring-[#1E3A5F]/20' : ''}`}>
                                            <td className="px-3 py-2 font-semibold text-accent whitespace-nowrap">{r.symbol}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-main">{fmt(r.tc)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-[#7C3AED]">{fmt(r.tran)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-[#0369A1]">{fmt(r.san)}</td>
                                            <td className="px-3 py-2 text-right font-mono border-l border-border-standard text-text-muted">{fmt(r.gia3)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl3)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.gia2)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl2)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.gia1)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl1)}</td>
                                            <td className={`px-3 py-2 text-right font-mono font-semibold border-l border-border-standard ${isCeiling ? 'text-[#7C3AED] bg-[#F5F3FF]' : isFloor ? 'text-[#0369A1] bg-[#E0F2FE]' : change != null && change > 0 ? 'text-positive bg-[#ECFDF5]' : change != null && change < 0 ? 'text-negative bg-[#FEF2F2]' : 'text-text-main bg-panel'}`}>{fmt(matchPrice)}</td>
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
                    <div className="rounded-xl overflow-hidden bg-panel border border-border-standard shadow-sm min-w-0 w-full">
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
                                    return filtered.slice(0, 200).map((r: any) => {
                                      const ref = r.tc;
                                      const matchPrice = r.matchPrice;
                                      const change = r.change;
                                      const pct = r.percentChange;
                                      const isCeiling = r.tran != null && matchPrice != null && matchPrice >= r.tran;
                                      const isFloor = r.san != null && matchPrice != null && matchPrice <= r.san;
                                      return (
                                        <tr key={`${r.symbol}-${r.exchange ?? 'NA'}`} onClick={() => handleStockClick(r.symbol, r.exchange || 'HOSE')} className={`hover:bg-panel-hover cursor-pointer transition-colors ${selectedSymbol === r.symbol ? 'bg-[#EFF6FF] ring-inset ring-1 ring-[#1E3A5F]/20' : ''}`}>
                                          <td className="px-3 py-2 font-semibold text-accent whitespace-nowrap">{r.symbol}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-main">{fmt(ref)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-[#7C3AED]">{fmt(r.tran)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-[#0369A1]">{fmt(r.san)}</td>
                                          <td className="px-3 py-2 text-right font-mono border-l border-border-standard text-text-muted">{fmt(r.gia3)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl3)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.gia2)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl2)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(r.gia1)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtVol(r.kl1)}</td>
                                          <td className={`px-3 py-2 text-right font-mono font-semibold border-l border-border-standard ${isCeiling ? 'text-[#7C3AED] bg-[#F5F3FF]' : isFloor ? 'text-[#0369A1] bg-[#E0F2FE]' : change != null && change > 0 ? 'text-positive bg-[#ECFDF5]' : change != null && change < 0 ? 'text-negative bg-[#FEF2F2]' : 'text-text-main bg-panel'}`}>{fmt(matchPrice)}</td>
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
                      <div className="px-3 sm:px-4 py-2.5 border-t border-border-standard bg-panel text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{isBondView ? `${indexDetailList.length} trái phiếu • Click hàng để xem chi tiết` : isCWView ? `${indexDetailList.length} chứng quyền • Click hàng để xem biểu đồ` : isEFView ? `${indexDetailList.length} ETF • Click hàng để xem biểu đồ` : isIndustryView ? `${indexDetailList.length} mã • Ngành: ${industryName} • Click hàng để xem biểu đồ` : isPTView ? `${indexDetailList.length} khớp lệnh thoả thuận (${ptMarketCode}) • Click hàng để xem biểu đồ` : isOddLotView ? `${indexDetailList.length} mã lô lẻ (${oddLotMarketCode}) • Click hàng để xem biểu đồ` : isFUView ? `${indexDetailList.length} phái sinh (${fuStockType}) • Click hàng để xem biểu đồ` : `${indexDetailList.length} mã • Index: ${indexCodes.join(', ') || 'VNXALL'} • Click hàng để xem biểu đồ`}</span>
                        <span className="text-text-muted sm:hidden">• Kéo ngang để xem thêm cột</span>
                      </div>
                    </div>
                  )}
                </>
              }
            />
          </div>
        )}

        {currentView === 'terminal_legacy' && (
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
                                pos.status === 'CLOSED_TP' ? 'bg-[#ECFDF5] text-positive' :
                                  pos.status === 'CLOSED_SL' ? 'bg-[#FEF2F2] text-negative' : 'bg-panel text-text-muted'
                                }`}>
                                {pos.status === 'OPEN' ? 'Mở' : pos.status === 'CLOSED_TP' ? 'Chốt lời' : pos.status === 'CLOSED_SL' ? 'Cắt lỗ' : 'Đóng tay'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {isOpen && (
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Đóng lệnh ${pos.symbol} theo giá thị trường hiện tại (VPBS)?`)) return;
                                    try {
                                      await positionApi.close(portfolio!.id, pos.id, {
                                        reason: 'CLOSED_MANUAL',
                                        use_market_price: true,
                                      });
                                      await loadPositions();
                                    } catch (e: any) {
                                      alert(e?.response?.data?.message || 'Đóng lệnh thất bại.');
                                    }
                                  }}
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

        {/* Tin tức */}
        {currentView === 'news' && <MarketNewsView />}

        {/* Settings placeholder */}
        {currentView === 'settings' && (
          <div className="animate-fade-in">
            <button onClick={() => setShowSetupModal(true)} className="px-4 py-2 rounded-md bg-accent text-white text-sm font-semibold">
              Cấu hình Portfolio
            </button>
          </div>
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
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${insightContent.verdict === 'RECOMMENDED' ? 'bg-[#ECFDF5] border-[#A7F3D0] text-positive' :
                insightContent.verdict === 'CAUTION' ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]' :
                  'bg-[#FEF2F2] border-[#FECACA] text-negative'
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

    </div>
  );
}

export default App;
