import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip as RechartsTooltip, AreaChart, Area } from 'recharts';
import { marketApi, positionApi, aiApi, portfolioApi } from '../services/api';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_LOCALE, PRICE_FRACTION_OPTIONS, formatNumberVI } from '../constants';
import type { Position } from '../services/api';
import wsService from '../services/websocket';
import { StatCard } from './ui/StatCard';
import { Tooltip, FinancialTooltip } from './ui/Tooltip';
import { EmptyState } from './ui/EmptyState';
import { InfoCard } from './ui/InfoCard';

interface IndexData {
  indexCode: string;
  value: number;
  change: number;
  changePercent: number;
  chartData: { time: string; value: number }[];
  advancing: number;
  declining: number;
  unchanged: number;
  volume: number;
  totalValue: number;
}

interface NewsArticle {
  title: string;
  url: string;
  date: string;
  description?: string;
}

interface PerformanceStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl_vnd: number;
  avg_win_vnd: number;
  avg_loss_vnd: number;
  profit_factor: number;
  max_drawdown_vnd: number;
  max_drawdown_pct: number;
  sharpe_ratio?: number;
}

interface AiInsight {
  symbol: string;
  action: string;
  recommendation: string;
  confidence: number;
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
  const volume = d?.totalVolume ?? d?.sumVolume ?? d?.volume ?? 0;
  const totalValue = d?.totalValue ?? d?.sumValue ?? 0;
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
    volume,
    totalValue,
    chartData,
    advancing: d?.advances ?? d?.advancing ?? 0,
    unchanged: d?.noChange ?? d?.unchanged ?? 0,
    declining: d?.declines ?? d?.declining ?? 0,
  };
}

const INDEX_CODES = ['VNINDEX', 'VN30'];

// ── Mini Index Card with AreaChart ──────────────────────────────────────────
const IndexCard: React.FC<{ data: IndexData }> = ({ data }) => {
  const isUp = data.change >= 0;
  const refVal = data.value - data.change;
  const total = data.advancing + data.declining + data.unchanged;

  return (
    <div className="panel-section p-4 flex flex-col gap-3 hover:border-border-standard/30 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">{data.indexCode}</span>
          <div className={`text-[22px] font-bold tabular-nums leading-none mt-1 ${isUp ? 'text-positive' : 'text-negative'}`}>
            {data.value > 0 ? data.value.toLocaleString(PRICE_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '\u2014'}
          </div>
          <div className={`text-[12px] tabular-nums mt-1 flex items-center gap-1 ${isUp ? 'text-positive' : 'text-negative'}`}>
            {isUp ? '\u25B2' : '\u25BC'} {Math.abs(data.change).toFixed(2)} ({data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%)
          </div>
        </div>
        {data.chartData.length > 1 && (
          <div style={{ width: 110, height: 52, flexShrink: 0 }}>
            <ResponsiveContainer width={110} height={52}>
              <AreaChart data={data.chartData}>
                <defs>
                  <linearGradient id={`grad-${data.indexCode}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isUp ? '#22C55E' : '#EF4444'} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={isUp ? '#22C55E' : '#EF4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ReferenceLine y={refVal} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 2" />
                <Area type="monotone" dataKey="value" stroke={isUp ? '#22C55E' : '#EF4444'} strokeWidth={1.5} fill={`url(#grad-${data.indexCode})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {total > 0 && (
        <div>
          <div className="flex rounded-full overflow-hidden h-1.5">
            <div className="bg-positive" style={{ width: `${(data.advancing / total) * 100}%` }} />
            <div className="bg-text-dim" style={{ width: `${(data.unchanged / total) * 100}%` }} />
            <div className="bg-negative" style={{ width: `${(data.declining / total) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[9px] tabular-nums">
            <span className="text-positive">{data.advancing} tăng</span>
            <span className="text-text-dim">{data.unchanged} đứng</span>
            <span className="text-negative">{data.declining} giảm</span>
          </div>
        </div>
      )}

      <div className="flex gap-4 text-[10px] border-t border-border-subtle pt-2">
        <div><span className="text-text-dim">KL:</span> <span className="text-text-muted tabular-nums">{formatNumberVI(data.volume, { maximumFractionDigits: 0 })}</span></div>
        {data.totalValue > 0 && <div><span className="text-text-dim">GT:</span> <span className="text-text-muted tabular-nums">{(data.totalValue / 1e9).toFixed(0)} tỷ</span></div>}
      </div>
    </div>
  );
};

// ── Sparkle Icon ────────────────────────────────────────────────────────────
const SparkleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

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
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [marketRegime, setMarketRegime] = useState<any>(null);
  const [regimeLoading, setRegimeLoading] = useState(false);
  const [performance, setPerformance] = useState<PerformanceStats | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [livePositions, setLivePositions] = useState<Position[]>(openPositions);
  const [lastPnlRefresh, setLastPnlRefresh] = useState<Date>(new Date());
  const [aiInsights, setAiInsights] = useState<AiInsight[]>([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);

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

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await marketApi.getNews({ limit: 8, format: 'json' });
      const articles = Array.isArray((res.data as any)?.articles) ? (res.data as any).articles : [];
      setNews(articles.slice(0, 8));
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const loadMarketRegime = useCallback(async () => {
    setRegimeLoading(true);
    try {
      const res = await aiApi.getMarketRegime(false);
      if (res.data?.success) setMarketRegime(res.data.data);
    } catch (err) { if (import.meta.env.DEV) console.warn('DashboardView load failed:', err); } finally {
      setRegimeLoading(false);
    }
  }, []);

  const loadPerformance = useCallback(async () => {
    if (!portfolioId) return;
    setPerfLoading(true);
    try {
      const res = await portfolioApi.getPerformance(portfolioId);
      if (res.data?.success && res.data.data) {
        setPerformance(res.data.data);
      }
    } catch (err) { if (import.meta.env.DEV) console.warn('DashboardView load failed:', err); } finally {
      setPerfLoading(false);
    }
  }, [portfolioId]);

  const loadAiInsights = useCallback(async () => {
    setAiInsightsLoading(true);
    try {
      const res = await aiApi.getSignals({ limit: 3 });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAiInsights(res.data.data.slice(0, 3));
      }
    } catch (err) { if (import.meta.env.DEV) console.warn('DashboardView load failed:', err); } finally {
      setAiInsightsLoading(false);
    }
  }, []);

  // Refresh live positions P&L every 30s
  const refreshLivePnL = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const res = await positionApi.list(portfolioId, { status: 'OPEN' });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setLivePositions(res.data.data);
        setLastPnlRefresh(new Date());
      }
    } catch (err) { if (import.meta.env.DEV) console.warn('DashboardView load failed:', err); }
  }, [portfolioId]);

  useEffect(() => {
    setLivePositions(openPositions);
  }, [openPositions]);

  // Cập nhật current_price cho live positions khi nhận WS price_update
  useEffect(() => {
    const handler = (data: any) => {
      if (!data?.symbol) return;
      const priceVnd = data.price != null ? parseFloat(data.price) * STOCK_PRICE_DISPLAY_SCALE : null;
      if (priceVnd == null) return;
      setLivePositions((prev) =>
        prev.map((p) =>
          p.symbol === data.symbol ? { ...p, current_price: priceVnd } as any : p
        )
      );
    };
    wsService.onPriceUpdate(handler);
    return () => { wsService.off('price_update', handler); };
  }, []);

  useEffect(() => {
    loadIndices();
    loadNews();
    loadMarketRegime();
    loadPerformance();
    loadAiInsights();
    refreshLivePnL();
    const indexInterval = setInterval(loadIndices, 60_000);
    const regimeInterval = setInterval(loadMarketRegime, 15 * 60_000);
    const pnlInterval = setInterval(refreshLivePnL, 30_000);
    return () => {
      clearInterval(indexInterval);
      clearInterval(regimeInterval);
      clearInterval(pnlInterval);
    };
  }, [loadIndices, loadNews, loadMarketRegime, loadPerformance, loadAiInsights, refreshLivePnL]);

  const riskPct = maxRisk > 0 ? (riskUsed / maxRisk) * 100 : 0;
  const riskColor = riskPct < 50 ? 'text-positive' : riskPct < 80 ? 'text-warning' : 'text-negative';
  const riskBarColor = riskPct < 50 ? 'bg-positive' : riskPct < 80 ? 'bg-warning' : 'bg-negative';

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
  const availableCash = totalBalance - livePositions.reduce((s, p) => s + Number(p.entry_price ?? 0) * Number(p.quantity ?? 0), 0);
  const returnPct = totalBalance > 0 ? ((totalBalance + totalPnl - totalBalance) / totalBalance) * 100 : 0;

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── SECTION 1: Hero Portfolio Overview (D-16) ── */}
      <div className="bg-gradient-to-r from-[var(--color-accent-subtle)] to-[var(--color-panel)] rounded-lg p-5 border border-border-subtle">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          {/* Left: Total assets + P&L today */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Tooltip content="Tổng giá trị các tài sản trong danh mục của bạn" position="bottom">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted cursor-help">
                  Tổng tài sản
                </span>
              </Tooltip>
              <button
                onClick={refreshLivePnL}
                className="p-1 rounded border border-border-standard text-text-muted hover:text-text-main hover:bg-white/5 transition-colors"
                title="Làm mới P&L"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>
            <p className="text-[28px] lg:text-[32px] font-bold tabular-nums text-text-main leading-none">
              {formatNumberVI(totalBalance)} <span className="text-[14px] font-normal text-text-dim">VND</span>
            </p>
            <div className={`flex items-center gap-2 mt-2 text-[13px] ${totalPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
              <FinancialTooltip term="P&L" />
              <span className="tabular-nums font-semibold">
                {totalPnl !== 0 ? (totalPnl >= 0 ? '+' : '') + formatNumberVI(totalPnl, { maximumFractionDigits: 0 }) : '\u2014'}
              </span>
              {totalPnl !== 0 && (
                <span className="tabular-nums text-[11px]">
                  ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
                </span>
              )}
              <span className="text-[10px] text-text-dim ml-1">hôm nay</span>
            </div>
            <div className="text-[10px] text-text-dim mt-1">
              Cập nhật: {lastPnlRefresh.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>

          {/* Right: 3 StatCards */}
          <div className="flex flex-col sm:flex-row lg:flex-row gap-3">
            <StatCard
              label="Vốn khả dụng"
              value={formatNumberVI(Math.max(0, availableCash), { maximumFractionDigits: 0 })}
              suffix=" VND"
              tooltip="Số vốn còn lại chưa sử dụng cho vị thế nào"
              size="sm"
            />
            <StatCard
              label="% Lợi nhuận"
              value={returnPct.toFixed(2)}
              suffix="%"
              change={totalPnl}
              tooltip="Tỷ lệ lợi nhuận trên tổng vốn đầu tư"
              size="sm"
            />
            <StatCard
              label="Rủi ro"
              value={`${riskPct.toFixed(1)}%`}
              tooltip="Mức rủi ro đang sử dụng so với giới hạn tối đa"
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Market Overview + Quick Actions (D-18, D-20) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Market indices (~60%) */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">Thị trường</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {loading
              ? Array(2).fill(0).map((_, i) => (
                  <div key={i} className="panel-section p-4 animate-pulse h-36" />
                ))
              : INDEX_CODES.map((code) => (
                  indexData[code] ? (
                    <IndexCard key={code} data={indexData[code]} />
                  ) : (
                    <div key={code} className="panel-section p-4 flex items-center justify-center text-text-muted text-[12px]">{code}</div>
                  )
                ))
            }
          </div>

          {/* AI Market Regime Banner */}
          {(marketRegime || regimeLoading) && (
            <div className={`panel-section p-3 border-l-4 ${
              marketRegime?.regime === 'BULL' ? 'border-l-positive' :
              marketRegime?.regime === 'BEAR' ? 'border-l-negative' :
              marketRegime?.regime === 'VOLATILE' ? 'border-l-warning' : 'border-l-border-standard'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  marketRegime?.regime === 'BULL' ? 'bg-positive animate-pulse' :
                  marketRegime?.regime === 'BEAR' ? 'bg-negative animate-pulse' :
                  marketRegime?.regime === 'VOLATILE' ? 'bg-warning animate-pulse' : 'bg-text-muted'
                }`} />
                {regimeLoading ? (
                  <div className="h-4 w-32 bg-border-subtle rounded animate-pulse" />
                ) : marketRegime ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Chế độ TT AI:</span>
                    <span className={`text-[13px] font-bold tabular-nums ${
                      marketRegime.regime === 'BULL' ? 'text-positive' :
                      marketRegime.regime === 'BEAR' ? 'text-negative' :
                      marketRegime.regime === 'VOLATILE' ? 'text-warning' : 'text-text-main'
                    }`}>
                      {marketRegime.regime === 'BULL' ? 'TĂNG TRƯỞNG' :
                       marketRegime.regime === 'BEAR' ? 'SUY GIẢM' :
                       marketRegime.regime === 'VOLATILE' ? 'BIẾN ĐỘNG' : 'ĐI NGANG'}
                    </span>
                    <span className="text-[11px] text-accent tabular-nums">{marketRegime.confidence}%</span>
                    {marketRegime.description && (
                      <span className="text-[10px] text-text-muted hidden lg:inline">{marketRegime.description.slice(0, 80)}{marketRegime.description.length > 80 ? '...' : ''}</span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Right: Quick Actions (~40%) */}
        <div className="lg:col-span-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-text-muted mb-3">Hành động nhanh</h2>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => onNavigate('terminal')}
              className="w-full panel-section p-4 flex items-center gap-3 text-left border transition-all hover:scale-[1.01] active:scale-[0.99] text-blue-400 border-blue-500/20 hover:bg-blue-500/5"
            >
              <div className="shrink-0 p-2 rounded-lg bg-blue-500/10">
                <PlusIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">Nhập lệnh mới</p>
                <p className="text-[10px] text-text-dim mt-0.5">Đặt lệnh với AI hỗ trợ SL/TP</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('portfolio')}
              className="w-full panel-section p-4 flex items-center gap-3 text-left border transition-all hover:scale-[1.01] active:scale-[0.99] text-amber-400 border-amber-500/20 hover:bg-amber-500/5"
            >
              <div className="shrink-0 p-2 rounded-lg bg-amber-500/10">
                <ShieldIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">Xem rủi ro</p>
                <p className="text-[10px] text-text-dim mt-0.5">Kiểm tra mức rủi ro danh mục</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('terminal')}
              className="w-full panel-section p-4 flex items-center gap-3 text-left border transition-all hover:scale-[1.01] active:scale-[0.99] text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/5"
            >
              <div className="shrink-0 p-2 rounded-lg bg-emerald-500/10">
                <SparkleIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">AI gợi ý</p>
                <p className="text-[10px] text-text-dim mt-0.5">AI phân tích và gợi ý SL/TP</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: AI Insights (D-19) ── */}
      <div className="panel-section">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <SparkleIcon className="w-4 h-4 text-accent" />
            <span className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">
              <FinancialTooltip term="AI" /> Gợi ý hôm nay
            </span>
          </div>
          <button onClick={() => onNavigate('terminal')} className="text-[10px] text-accent hover:underline">
            Xem tất cả
          </button>
        </div>
        <div className="p-4">
          {aiInsightsLoading ? (
            <div className="flex gap-3">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex-1 h-20 bg-border-subtle rounded animate-pulse" />
              ))}
            </div>
          ) : aiInsights.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {aiInsights.map((insight, i) => (
                <div key={i} className="panel-section p-3 border border-border-subtle hover:border-border-standard/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      (insight.action || '').toUpperCase() === 'BUY' || (insight.action || '').toUpperCase() === 'MUA'
                        ? 'text-positive bg-positive/10'
                        : (insight.action || '').toUpperCase() === 'SELL' || (insight.action || '').toUpperCase() === 'BAN'
                          ? 'text-negative bg-negative/10'
                          : 'text-warning bg-warning/10'
                    }`}>
                      {insight.action || 'HOLD'}
                    </span>
                    <span className="text-[13px] font-bold text-text-main tabular-nums">{insight.symbol}</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">{insight.recommendation}</p>
                  {insight.confidence > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-border-subtle overflow-hidden">
                        <div
                          className={`h-full rounded-full ${insight.confidence >= 70 ? 'bg-positive' : insight.confidence >= 50 ? 'bg-warning' : 'bg-negative'}`}
                          style={{ width: `${Math.min(100, insight.confidence)}%` }}
                        />
                      </div>
                      <span className="text-[9px] tabular-nums text-text-dim">{insight.confidence}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <InfoCard title="AI đang phân tích thị trường..." variant="tip" defaultOpen>
              <p>
                Hệ thống AI của chúng tôi đang phân tích dữ liệu thị trường để đưa ra gợi ý tốt nhất cho bạn.
                Hãy tạo vị thế đầu tiên hoặc thêm mã chứng khoán vào danh sách theo dõi để nhận gợi ý AI.
              </p>
              <button
                onClick={() => onNavigate('watchlist')}
                className="mt-2 text-[11px] text-accent hover:underline"
              >
                Thêm mã theo dõi
              </button>
            </InfoCard>
          )}
        </div>
      </div>

      {/* ── SECTION 4: Open Positions Summary ── */}
      <div className="panel-section flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Vị thế đang mở</span>
          <button onClick={() => onNavigate('portfolio')} className="text-[10px] text-accent hover:underline">
            Xem tất cả
          </button>
        </div>
        <div className="flex-1 overflow-y-auto dense-scroll">
          {livePositions.length === 0 ? (
            <EmptyState
              title="Chưa có vị thế nào"
              description="Bạn chưa mở vị thế nào. Hãy bắt đầu đặt lệnh đầu tiên để theo dõi danh mục."
              actionLabel="Nhập lệnh đầu tiên"
              onAction={() => onNavigate('terminal')}
            />
          ) : (
            <table className="table-terminal w-full">
              <thead>
                <tr>
                  <th className="text-left">Ma</th>
                  <th>Side</th>
                  <th>Vào</th>
                  <th>Hiện</th>
                  <th>P&amp;L</th>
                  <th>SL</th>
                </tr>
              </thead>
              <tbody>
                {livePositions.slice(0, 8).map((pos) => {
                  const entry = Number(pos.entry_price ?? 0) / 1000;
                  const current = Number((pos as any).current_price ?? 0) / 1000;
                  const isShort = (pos.side ?? 'LONG').toUpperCase() === 'SHORT';
                  const rawPct = entry > 0 && current > 0 ? ((current - entry) / entry) * 100 : 0;
                  const pnlPct = isShort ? -rawPct : rawPct;
                  const pnlVnd = isShort
                    ? (entry - current) * Number(pos.quantity ?? 0) * 1000
                    : (current - entry) * Number(pos.quantity ?? 0) * 1000;
                  const slPrice = Number(pos.trailing_current_stop ?? pos.stop_loss ?? 0) / 1000;
                  return (
                    <tr
                      key={pos.id}
                      className={`cursor-pointer ${pnlVnd >= 0 ? 'row-profit' : 'row-loss'}`}
                      onClick={() => onNavigate('terminal')}
                    >
                      <td className="text-left font-bold text-text-main">{pos.symbol}</td>
                      <td className={`text-[10px] tabular-nums ${isShort ? 'text-negative' : 'text-positive'}`}>
                        {isShort ? 'SHORT' : 'LONG'}
                      </td>
                      <td className="text-text-muted tabular-nums">{entry > 0 ? entry.toFixed(2) : '\u2014'}</td>
                      <td className={`tabular-nums ${current > 0 ? (current > entry ? 'text-positive' : current < entry ? 'text-negative' : 'text-warning') : 'text-text-muted'}`}>
                        {current > 0 ? current.toFixed(2) : '\u2014'}
                      </td>
                      <td className={`tabular-nums font-semibold ${pnlPct >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {pnlPct !== 0 ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%' : '\u2014'}
                      </td>
                      <td className="text-text-dim tabular-nums">{slPrice > 0 ? slPrice.toFixed(2) : '\u2014'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {livePositions.length > 0 && (
          <div className="px-4 py-2 border-t border-border-subtle">
            <div className="flex justify-between text-[10px] text-text-muted mb-1">
              <span><FinancialTooltip term="Rủi ro" /> đang dùng</span>
              <span className={riskColor}>{riskPct.toFixed(1)}%</span>
            </div>
            <div className="h-1 rounded-full bg-border-subtle overflow-hidden">
              <div className={`h-full rounded-full transition-all ${riskBarColor}`} style={{ width: `${Math.min(100, riskPct)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 5: Tin tức thị trường ── */}
      <div className="panel-section">
        <div className="px-4 py-2.5 border-b border-[var(--color-divider)] flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Tin tức thị trường</span>
          <button
            onClick={() => onNavigate('market-news')}
            className="text-[10px] text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
          >
            Xem tất cả →
          </button>
        </div>

        {newsLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-16 h-3 bg-[var(--color-panel-hover)] rounded" />
                <div className="flex-1 h-3 bg-[var(--color-panel-hover)] rounded" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="p-6 text-center text-[var(--color-text-dim)] text-[11px]">
            Không có tin tức mới
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--color-divider)]">
            {news.slice(0, 6).map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-panel)] hover:bg-[var(--color-panel-hover)] transition-colors group"
              >
                <span className="text-[11px] text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-1 flex-1">
                  {article.title}
                </span>
                <svg className="w-3 h-3 text-[var(--color-text-dim)] group-hover:text-[var(--color-accent)] transition-colors shrink-0 opacity-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
