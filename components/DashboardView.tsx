import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { marketApi, realPortfolioApi, aiApi, portfolioApi, orderApi } from '../services/api';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_LOCALE, formatNumberVI } from '../constants';
import type { Position, Order } from '../services/api';
import wsService from '../services/websocket';
import { EmptyState } from './ui/EmptyState';
import { AiDisclaimer } from './ui/AiDisclaimer';
import { Tooltip } from './ui/Tooltip';
import { SkeletonCard } from './ui/SkeletonLoader';

interface IndexData {
  indexCode: string;
  value: number;
  change: number;
  changePercent: number;
  chartData: { time: string; value: number }[];
  advancing: number;
  declining: number;
  unchanged: number;
}

interface PerformanceStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl_vnd: number;
}

interface NewsArticle {
  title: string;
  url: string;
  date: string;
  description?: string;
}

interface Props {
  portfolioId?: string | null;
  totalBalance: number;
  openPositions: Position[];
  riskUsed: number;
  maxRisk: number;
  onNavigate: (view: string) => void;
}

function normalizeIndexData(raw: any, indexCode: string): IndexData {
  const d = raw?.data ?? raw;
  const value = d?.indexValue ?? d?.lastValue ?? d?.close ?? d?.value ?? 0;
  const prev = d?.prevIndexValue ?? d?.previousClose ?? d?.open ?? value;
  const change = d?.indexChange ?? d?.change ?? value - prev;
  const changePercent = d?.indexPercentChange ?? d?.changePercent ?? (prev ? (change / prev) * 100 : 0);
  const chartRaw = d?.index ?? d?.sessionData ?? d?.intradayData ?? [];
  const chartData = Array.isArray(chartRaw)
    ? chartRaw.map((p: any) => ({ time: p?.indexTime ?? p?.time ?? '', value: p?.indexValue ?? p?.value ?? 0 }))
        .filter((c: any) => Number.isFinite(c.value))
    : [];
  return {
    indexCode,
    value,
    change,
    changePercent,
    chartData,
    advancing: d?.advances ?? d?.advancing ?? 0,
    unchanged: d?.noChange ?? d?.unchanged ?? 0,
    declining: d?.declines ?? d?.declining ?? 0,
  };
}

const INDEX_CODES = ['VNINDEX', 'VN30'];

// ═══════════════════════════════════════════════════════════════════════════
// Icons
// ═══════════════════════════════════════════════════════════════════════════
const Icons = {
  chart: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  wallet: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    </svg>
  ),
  trendUp: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  trendDown: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
    </svg>
  ),
  shield: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  sparkle: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════
// Stat Card Component
// ═══════════════════════════════════════════════════════════════════════════
const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  accentColor?: string;
  tooltip?: React.ReactNode;
  breakdown?: React.ReactNode;
}> = ({ label, value, subValue, icon, trend, accentColor = 'var(--color-accent)', tooltip, breakdown }) => {
  const trendColor = trend === 'up'
    ? 'text-[var(--color-positive)]'
    : trend === 'down'
      ? 'text-[var(--color-negative)]'
      : 'text-[var(--color-text-main)]';

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4 hover:border-[var(--color-border-standard)] transition-all">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        {trend && trend !== 'neutral' && (
          <span className={`text-micro px-2 py-1 rounded-full ${
            trend === 'up' ? 'bg-[var(--color-positive)]/10 text-[var(--color-positive)]' : 'bg-[var(--color-negative)]/10 text-[var(--color-negative)]'
          }`}>
            {trend === 'up' ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-micro text-[var(--color-text-dim)] flex items-center gap-1">
          {label}
          {tooltip && (
            <Tooltip content={tooltip} position="top">
              <span
                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-micro text-[var(--color-text-dim)] border border-[var(--color-border-subtle)] cursor-help"
                aria-label="Giải thích"
              >
                ?
              </span>
            </Tooltip>
          )}
        </div>
        <p className={`text-title tabular-nums ${trendColor}`}>
          {value}
        </p>
        {subValue && (
          <p className="text-caption text-[var(--color-text-muted)]">{subValue}</p>
        )}
        {breakdown}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Market Index Card
// ═══════════════════════════════════════════════════════════════════════════
const MarketIndexCard: React.FC<{ data: IndexData }> = ({ data }) => {
  const isUp = data.change >= 0;
  const refVal = data.value - data.change;
  const total = data.advancing + data.declining + data.unchanged;
  const color = isUp ? 'var(--chart-positive)' : 'var(--chart-negative)';

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4 hover:border-[var(--color-border-standard)] transition-all">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-micro text-[var(--color-text-dim)]">
              {data.indexCode}
            </span>
            {total > 0 && (
              <span className="text-micro text-[var(--color-text-dim)] tabular-nums">
                <span className="text-[var(--color-positive)]">{data.advancing}</span>
                /
                <span className="text-[var(--color-negative)]">{data.declining}</span>
              </span>
            )}
          </div>
          <div className={`text-title tabular-nums ${isUp ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
            {data.value > 0 ? data.value.toLocaleString(PRICE_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </div>
          <div className={`text-body-sm tabular-nums mt-1 flex items-center gap-1 ${isUp ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(data.change).toFixed(2)}
            <span className="text-[var(--color-text-dim)]">|</span>
            {data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
          </div>
        </div>

        {data.chartData.length > 1 && (
          <div style={{ width: 100, height: 48, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chartData}>
                <defs>
                  <linearGradient id={`grad-${data.indexCode}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ReferenceLine y={refVal} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 2" />
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#grad-${data.indexCode})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-3 flex h-1.5 rounded-full overflow-hidden bg-[var(--color-background)]">
          <div className="bg-[var(--color-positive)]" style={{ width: `${(data.advancing / total) * 100}%` }} />
          <div className="bg-[var(--color-text-dim)]/30" style={{ width: `${(data.unchanged / total) * 100}%` }} />
          <div className="bg-[var(--color-negative)]" style={{ width: `${(data.declining / total) * 100}%` }} />
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Risk Gauge Component
// ═══════════════════════════════════════════════════════════════════════════
const RiskGauge: React.FC<{ percentage: number; used: number; max: number }> = ({ percentage, used, max }) => {
  const color = percentage < 50 ? 'var(--color-positive)' : percentage < 80 ? 'var(--color-warning)' : 'var(--color-negative)';
  const label = percentage < 50 ? 'An toàn' : percentage < 80 ? 'Cảnh báo' : 'Nguy hiểm';

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center">
            <span className="text-[var(--color-warning)]">{Icons.shield}</span>
          </div>
          <div>
            <p className="text-micro text-[var(--color-text-dim)]">
              Rủi ro danh mục
            </p>
            <p className="text-micro" style={{ color }}>{label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-title tabular-nums" style={{ color }}>
            {percentage.toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="h-2 rounded-full bg-[var(--color-background)] overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, percentage)}%`, background: color }}
        />
      </div>

      <div className="flex justify-between text-micro text-[var(--color-text-dim)]">
        <span>Đã dùng: {formatNumberVI(used)}đ</span>
        <span>Tối đa: {formatNumberVI(max)}đ</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Position Row
// ═══════════════════════════════════════════════════════════════════════════
const PositionRow: React.FC<{ position: Position; onClick: () => void }> = ({ position, onClick }) => {
  // STOCK_PRICE_DISPLAY_SCALE = 1 — toàn app dùng VND nguyên, không chia 1000.
  const entry = Number(position.entry_price ?? 0);
  const current = Number((position as any).current_price ?? 0);
  const isShort = (position.side ?? 'LONG').toUpperCase() === 'SHORT';
  const rawPct = entry > 0 && current > 0 ? ((current - entry) / entry) * 100 : 0;
  const pnlPct = isShort ? -rawPct : rawPct;
  const sl = Number(position.trailing_current_stop ?? position.stop_loss ?? 0);

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer hover:bg-[var(--color-panel-hover)] transition-colors"
    >
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <span className={`text-micro px-1.5 py-0.5 rounded ${
            isShort ? 'bg-[var(--color-negative)]/10 text-[var(--color-negative)]' : 'bg-[var(--color-positive)]/10 text-[var(--color-positive)]'
          }`}>
            {isShort ? 'S' : 'L'}
          </span>
          <span className="text-body font-bold text-[var(--color-text-main)]">{position.symbol}</span>
        </div>
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className="text-body-sm tabular-nums text-[var(--color-text-muted)]">
          {entry > 0 ? formatNumberVI(entry) : '—'}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className={`text-body-sm tabular-nums font-medium ${
          current > entry ? 'text-[var(--color-positive)]' : current < entry ? 'text-[var(--color-negative)]' : 'text-[var(--color-text-muted)]'
        }`}>
          {current > 0 ? formatNumberVI(current) : '—'}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className={`text-body-sm tabular-nums font-semibold ${
          pnlPct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
        }`}>
          {pnlPct !== 0 ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className="text-body-sm tabular-nums text-[var(--color-text-dim)]">
          {sl > 0 ? formatNumberVI(sl) : '—'}
        </span>
      </td>
    </tr>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DashboardView
// ═══════════════════════════════════════════════════════════════════════════
export const DashboardView: React.FC<Props> = ({
  portfolioId,
  totalBalance,
  openPositions,
  riskUsed,
  maxRisk,
  onNavigate,
}) => {
  const [indexData, setIndexData] = useState<Record<string, IndexData>>({});
  const [loading, setLoading] = useState(true);
  const [marketRegime, setMarketRegime] = useState<any>(null);
  const [performance, setPerformance] = useState<PerformanceStats | null>(null);
  // Separate state for positions and prices to avoid losing prices on refresh
  const [positions, setPositions] = useState<Position[]>(openPositions);
  const [symbolPrices, setSymbolPrices] = useState<Record<string, number>>({});
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [cashBalance, setCashBalance] = useState<any>(null);

  const loadIndices = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        INDEX_CODES.map((code) => marketApi.getIntradayIndex(code))
      );
      const newData: Record<string, IndexData> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.data.success) {
          newData[INDEX_CODES[i]] = normalizeIndexData(r.value.data.data, INDEX_CODES[i]);
        }
      });
      setIndexData(newData);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMarketRegime = useCallback(async () => {
    try {
      const res = await aiApi.getMarketRegime(false);
      if (res.data?.success) setMarketRegime(res.data.data);
    } catch {}
  }, []);

  const loadPerformance = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const res = await portfolioApi.getPerformance(portfolioId);
      if (res.data?.success && res.data.data) {
        setPerformance(res.data.data);
      }
    } catch {}
  }, [portfolioId]);

  const loadRecentOrders = useCallback(async () => {
    if (!portfolioId) return;
    setOrdersLoading(true);
    try {
      const res = await realPortfolioApi.getTransactionHistory(portfolioId, 1, 5);
      if (res.data?.success && Array.isArray(res.data.data?.orders)) {
        setRecentOrders(res.data.data.orders);
      } else if (res.data?.success && Array.isArray(res.data.data)) {
        setRecentOrders(res.data.data);
      }
    } finally {
      setOrdersLoading(false);
    }
  }, [portfolioId]);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await marketApi.getNews({ limit: 6, format: 'json' });
      const articles = Array.isArray((res.data as any)?.articles) ? (res.data as any).articles : [];
      setNews(articles.slice(0, 6));
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const res = await realPortfolioApi.getSummary(portfolioId);
      if (res.data?.success && res.data.data?.cash_balance) {
        setCashBalance(res.data.data.cash_balance);
      }
    } catch {}
  }, [portfolioId]);


  const refreshLivePnL = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const res = await realPortfolioApi.getOpenPositions(portfolioId);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setPositions(res.data.data);
        setLastRefresh(new Date());
      }
    } catch {}
  }, [portfolioId]);

  // Stable key to detect position list changes
  const positionKey = openPositions.map(p => p.id).sort().join(',');

  // Sync positions from props when position list changes
  useEffect(() => {
    setPositions(openPositions);
  }, [positionKey]);

  // Fetch current prices once when position list changes (separate from positions)
  useEffect(() => {
    if (openPositions.length === 0) return;
    let cancelled = false;
    const fetchPrices = async () => {
      const symbols = [...new Set(openPositions.map(p => p.symbol))];
      const priceMap: Record<string, number> = {};
      await Promise.all(
        symbols.map(async (sym) => {
          try {
            const res = await marketApi.getPrice(sym);
            const price = res.data?.data?.price ?? res.data?.data?.lastPrice ?? res.data?.data?.close;
            if (price != null) priceMap[sym] = Number(price) * STOCK_PRICE_DISPLAY_SCALE;
          } catch { /* ignore */ }
        })
      );
      if (!cancelled && Object.keys(priceMap).length > 0) {
        setSymbolPrices(prev => ({ ...prev, ...priceMap }));
      }
    };
    fetchPrices();
    return () => { cancelled = true; };
  }, [positionKey]);

  // WebSocket price updates - only update symbolPrices
  useEffect(() => {
    const handler = (data: any) => {
      if (!data?.symbol) return;
      const priceVnd = data.price != null ? parseFloat(data.price) * STOCK_PRICE_DISPLAY_SCALE : null;
      if (priceVnd == null) return;
      setSymbolPrices(prev => ({ ...prev, [data.symbol]: priceVnd }));
    };
    wsService.onPriceUpdate(handler);
    return () => { wsService.off('price_update', handler); };
  }, []);

  // Combine positions with prices (computed, not state)
  const livePositions = useMemo(() => {
    return positions.map(p => ({
      ...p,
      current_price: symbolPrices[p.symbol] ?? (p as any).current_price ?? 0
    })) as Position[];
  }, [positions, symbolPrices]);

  useEffect(() => {
    loadIndices();
    loadMarketRegime();
    loadPerformance();
    loadRecentOrders();
    loadNews();
    loadSummary();
    refreshLivePnL();

    const indexInterval = setInterval(loadIndices, 60_000);
    const pnlInterval = setInterval(refreshLivePnL, 30_000);

    return () => {
      clearInterval(indexInterval);
      clearInterval(pnlInterval);
    };
  }, [loadIndices, loadMarketRegime, loadPerformance, loadRecentOrders, loadNews, loadSummary, refreshLivePnL]);

  // Computed values
  const riskPct = maxRisk > 0 ? (riskUsed / maxRisk) * 100 : 0;
  const totalPnl = livePositions.reduce((s, p) => {
    if ((p as any).current_price && p.entry_price && p.quantity) {
      const isShort = (p.side ?? 'LONG').toUpperCase() === 'SHORT';
      const pnl = isShort
        ? (Number(p.entry_price) - Number((p as any).current_price)) * Number(p.quantity)
        : (Number((p as any).current_price) - Number(p.entry_price)) * Number(p.quantity);
      return s + pnl;
    }
    return s;
  }, 0);
  const totalPnlPct = totalBalance > 0 ? (totalPnl / totalBalance) * 100 : 0;
  const availableCash = cashBalance?.buying_power ?? (totalBalance - livePositions.reduce((s, p) => s + Number(p.entry_price ?? 0) * Number(p.quantity ?? 0), 0));

  const regimeLabel = marketRegime?.regime === 'BULL' ? 'Tăng trưởng'
    : marketRegime?.regime === 'BEAR' ? 'Suy giảm'
    : marketRegime?.regime === 'VOLATILE' ? 'Biến động'
    : 'Đi ngang';

  const regimeColor = marketRegime?.regime === 'BULL' ? 'var(--color-positive)'
    : marketRegime?.regime === 'BEAR' ? 'var(--color-negative)'
    : marketRegime?.regime === 'VOLATILE' ? 'var(--color-warning)'
    : 'var(--color-text-muted)';

  return (
    <div className="space-y-5 animate-fade-in max-w-[1600px] mx-auto">
      {/* ═══ HEADER ═══ */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-title text-[var(--color-text-main)]">
            Tổng quan
          </h1>
          <p className="text-body-sm text-[var(--color-text-dim)] mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-positive)] animate-pulse" />
            Cập nhật lúc {lastRefresh.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            <button
              onClick={refreshLivePnL}
              className="focus-ring p-1 rounded hover:bg-[var(--color-panel-hover)] text-[var(--color-text-dim)] hover:text-[var(--color-text-main)] transition-colors"
              title="Làm mới"
              aria-label="Làm mới dữ liệu"
            >
              {Icons.refresh}
            </button>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('portfolio')}
            className="focus-ring px-4 py-2 rounded-lg text-body-sm font-medium border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-panel-hover)] transition-colors"
          >
            Quản lý vốn
          </button>
          <button
            onClick={() => onNavigate('terminal')}
            className="focus-ring px-4 py-2 rounded-lg text-body-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors flex items-center gap-1.5"
          >
            {Icons.plus}
            Đặt lệnh
          </button>
        </div>
      </header>

      {/* ═══ STATS GRID ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Tổng tài sản"
          value={`${formatNumberVI(totalBalance)}đ`}
          icon={Icons.wallet}
          accentColor="var(--color-accent)"
        />
        <StatCard
          label="Lãi/Lỗ hôm nay"
          value={totalPnl !== 0 ? `${totalPnl >= 0 ? '+' : ''}${formatNumberVI(totalPnl)}đ` : '0đ'}
          subValue={totalPnl !== 0 ? `${totalPnl >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%` : 'Chưa có biến động'}
          icon={totalPnl >= 0 ? Icons.trendUp : Icons.trendDown}
          trend={totalPnl > 0 ? 'up' : totalPnl < 0 ? 'down' : 'neutral'}
          accentColor={totalPnl >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}
        />
        <StatCard
          label="Vốn khả dụng"
          value={`${formatNumberVI(Math.max(0, availableCash))}đ`}
          subValue={`${totalBalance > 0 ? ((availableCash / totalBalance) * 100).toFixed(0) : '0'}% danh mục`}
          icon={Icons.chart}
          accentColor="var(--color-secondary)"
          tooltip={
            <div className="space-y-1.5 text-caption leading-relaxed max-w-[260px]">
              <div className="font-semibold text-[var(--color-text-main)]">Vốn khả dụng = sức mua thật</div>
              <div className="text-[var(--color-text-muted)]">
                = Tiền mặt sẵn có − Tiền đã khoá cho lệnh mua chờ khớp.
              </div>
              <div className="pt-1 border-t border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
                Tiền bán cổ phiếu phải đợi <strong className="text-[var(--color-text-main)]">T+2.5 ngày làm việc</strong> mới về tài khoản (theo quy định sàn VN). Trong lúc chờ, tiền nằm ở mục "Đang chờ về T+2.5" và <em>chưa</em> dùng được để mua mới.
              </div>
            </div>
          }
          breakdown={
            cashBalance && (
              (Number(cashBalance.pending_settlement_cash) > 0 ||
                Number(cashBalance.pending_buy_lock) > 0)
            ) ? (
              <div className="mt-1.5 pt-1.5 border-t border-[var(--color-border-subtle)] space-y-0.5 text-micro text-[var(--color-text-dim)]">
                {Number(cashBalance.pending_settlement_cash) > 0 && (
                  <div className="flex justify-between gap-2">
                    <span>Đang chờ về T+2.5:</span>
                    <span className="tabular-nums text-[var(--color-text-muted)]">
                      {formatNumberVI(Number(cashBalance.pending_settlement_cash))}đ
                    </span>
                  </div>
                )}
                {Number(cashBalance.pending_buy_lock) > 0 && (
                  <div className="flex justify-between gap-2">
                    <span>Khoá cho lệnh mua chờ:</span>
                    <span className="tabular-nums text-[var(--color-text-muted)]">
                      {formatNumberVI(Number(cashBalance.pending_buy_lock))}đ
                    </span>
                  </div>
                )}
              </div>
            ) : null
          }
        />
        <StatCard
          label="Vị thế đang mở"
          value={livePositions.length}
          subValue={performance?.win_rate ? `Tỷ lệ thắng: ${performance.win_rate.toFixed(0)}%` : 'Chưa có giao dịch'}
          icon={Icons.chart}
          accentColor="var(--color-warning)"
        />
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Positions + Risk */}
        <div className="lg:col-span-5 space-y-5">
          {/* Positions Table */}
          <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <h2 className="text-subheading text-[var(--color-text-main)]">
                Vị thế đang mở
                {livePositions.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-micro bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    {livePositions.length}
                  </span>
                )}
              </h2>
              {livePositions.length > 0 && (
                <button
                  onClick={() => onNavigate('portfolio')}
                  className="focus-ring rounded text-caption text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                >
                  Xem tất cả
                </button>
              )}
            </div>

            {livePositions.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="Chưa có vị thế"
                  description="Mở vị thế đầu tiên để bắt đầu theo dõi."
                  actionLabel="Đặt lệnh"
                  onAction={() => onNavigate('terminal')}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--color-background)]">
                      <th className="py-2 px-3 text-left text-micro text-[var(--color-text-dim)]">Mã</th>
                      <th className="py-2 px-3 text-right text-micro text-[var(--color-text-dim)]">Vào</th>
                      <th className="py-2 px-3 text-right text-micro text-[var(--color-text-dim)]">Hiện</th>
                      <th className="py-2 px-3 text-right text-micro text-[var(--color-text-dim)]">P&L</th>
                      <th className="py-2 px-3 text-right text-micro text-[var(--color-text-dim)]">SL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {livePositions.slice(0, 6).map((pos) => (
                      <PositionRow key={pos.id} position={pos} onClick={() => onNavigate('portfolio')} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Risk Gauge */}
          <RiskGauge percentage={riskPct} used={riskUsed} max={maxRisk} />
        </div>

        {/* Middle Column: AI Center */}
        <div className="lg:col-span-4">
          <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-secondary)] flex items-center justify-center">
                  <span className="text-white">{Icons.sparkle}</span>
                </div>
                <h2 className="text-subheading text-[var(--color-text-main)]">Trợ lý AI</h2>
              </div>
              <button
                onClick={() => onNavigate('signals')}
                className="focus-ring rounded text-caption text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
              >
                Xem tất cả
              </button>
            </div>

            {/* Market Regime */}
            <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ background: regimeColor }}
                />
                <div>
                  <p className="text-micro text-[var(--color-text-dim)]">
                    Chế độ thị trường
                  </p>
                  <p className="text-subheading" style={{ color: regimeColor }}>
                    {regimeLabel}
                  </p>
                </div>
                {marketRegime?.confidence && (
                  <span className="ml-auto text-caption font-semibold px-2 py-1 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    {marketRegime.confidence}%
                  </span>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="p-4 space-y-2">
              <p className="text-micro text-[var(--color-text-dim)] mb-3">
                Hoạt động gần đây
              </p>
              {ordersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <SkeletonCard key={i} className="h-14" />
                  ))}
                </div>
              ) : recentOrders.length > 0 ? (
                <div className="space-y-2">
                  {recentOrders.slice(0, 5).map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => onNavigate('portfolio')}
                      className="focus-ring w-full flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-background)] hover:bg-[var(--color-background-hover)] transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-micro ${
                          order.side === 'BUY'
                            ? 'bg-[var(--color-positive)]/10 text-[var(--color-positive)]'
                            : 'bg-[var(--color-negative)]/10 text-[var(--color-negative)]'
                        }`}>
                          {order.side === 'BUY' ? 'MUA' : 'BÁN'}
                        </div>
                        <div>
                          <p className="text-body-sm font-semibold text-[var(--color-text-main)]">
                            {order.symbol}
                          </p>
                          <p className="text-micro text-[var(--color-text-dim)]">
                            {order.quantity.toLocaleString()} CP × {formatNumberVI(order.limit_price ?? 0)}đ
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-micro px-1.5 py-0.5 rounded ${
                          order.status === 'FILLED' || order.status === 'RECORDED' ? 'bg-[var(--color-positive)]/10 text-[var(--color-positive)]' :
                          order.status === 'PENDING' ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' :
                          order.status === 'CANCELLED' ? 'bg-[var(--color-text-dim)]/10 text-[var(--color-text-dim)]' :
                          'bg-[var(--color-negative)]/10 text-[var(--color-negative)]'
                        }`}>
                          {order.status === 'FILLED' ? 'Khớp' :
                           order.status === 'RECORDED' ? 'Đã ghi' :
                           order.status === 'PENDING' ? 'Chờ' :
                           order.status === 'CANCELLED' ? 'Huỷ' :
                           order.status === 'PARTIALLY_FILLED' ? 'Khớp 1 phần' : order.status}
                        </span>
                        <p className="text-micro text-[var(--color-text-dim)] mt-0.5">
                          {new Date(order.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 px-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-background)] flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-[var(--color-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-caption text-[var(--color-text-muted)] text-center">
                    Chưa có hoạt động nào
                  </p>
                  <button
                    onClick={() => onNavigate('terminal')}
                    className="focus-ring rounded mt-2 text-caption text-[var(--color-accent)] hover:underline"
                  >
                    Đặt lệnh đầu tiên →
                  </button>
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-[var(--color-border-subtle)]">
              <AiDisclaimer compact />
            </div>
          </div>
        </div>

        {/* Right Column: Market */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-subheading text-[var(--color-text-main)]">Thị trường</h2>
            <button
              onClick={() => onNavigate('market')}
              className="focus-ring rounded text-caption text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            >
              Bảng giá
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <SkeletonCard key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {INDEX_CODES.map((code) =>
                indexData[code] ? (
                  <MarketIndexCard key={code} data={indexData[code]} />
                ) : (
                  <div key={code} className="h-28 rounded-xl bg-[var(--color-panel)] border border-[var(--color-border-subtle)] flex items-center justify-center">
                    <p className="text-caption text-[var(--color-text-dim)]">{code} — không có dữ liệu</p>
                  </div>
                )
              )}
            </div>
          )}

        </div>
      </div>

      {/* ═══ NEWS SECTION ═══ */}
      <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <h2 className="text-subheading text-[var(--color-text-main)]">
            Tin tức thị trường
          </h2>
          <button
            onClick={() => onNavigate('market')}
            className="focus-ring rounded text-caption text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
          >
            Xem tất cả
          </button>
        </div>

        {newsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--color-border-subtle)]">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-[var(--color-panel)] p-4 min-h-[80px] space-y-2">
                <SkeletonCard className="h-3 w-3/4" />
                <SkeletonCard className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <EmptyState
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            }
            title="Chưa có tin tức"
            description="Tin tức thị trường sẽ xuất hiện ở đây khi có cập nhật mới."
            variant="compact"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--color-border-subtle)]">
            {news.map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex items-start gap-3 p-4 bg-[var(--color-panel)] hover:bg-[var(--color-panel-hover)] transition-colors group"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shrink-0 mt-1.5" />
                <span className="text-caption text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)] transition-colors line-clamp-2 leading-relaxed">
                  {article.title}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
