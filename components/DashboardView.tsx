import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, AreaChart, Area } from 'recharts';
import { marketApi, positionApi, aiApi, portfolioApi } from '../services/api';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_LOCALE, PRICE_FRACTION_OPTIONS, formatNumberVI } from '../constants';
import type { Position } from '../services/api';
import wsService from '../services/websocket';

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

const INDEX_CODES = ['VNINDEX', 'VN30', 'HNXINDEX'];

const IndexCard: React.FC<{ data: IndexData }> = ({ data }) => {
  const isUp = data.change >= 0;
  const refVal = data.value - data.change;

  return (
    <div className="panel-section p-4 flex flex-col gap-3 hover:border-border-standard/30 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">{data.indexCode}</span>
          <div className={`text-[22px] font-bold font-mono leading-none mt-1 ${isUp ? 'text-positive' : 'text-negative'}`}>
            {data.value > 0 ? data.value.toLocaleString(PRICE_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </div>
          <div className={`text-[12px] font-mono mt-1 flex items-center gap-1 ${isUp ? 'text-positive' : 'text-negative'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(data.change).toFixed(2)} ({data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%)
          </div>
        </div>
        {data.chartData.length > 1 && (
          <div style={{ width: 90, height: 48, flexShrink: 0 }}>
            <ResponsiveContainer width={90} height={48}>
              <LineChart data={data.chartData}>
                <ReferenceLine y={refVal} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="value" stroke={isUp ? '#22C55E' : '#EF4444'} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {(data.advancing + data.declining + data.unchanged) > 0 && (
        <div>
          <div className="flex rounded-full overflow-hidden h-1.5">
            <div className="bg-positive" style={{ width: `${(data.advancing / (data.advancing + data.declining + data.unchanged)) * 100}%` }} />
            <div className="bg-text-dim" style={{ width: `${(data.unchanged / (data.advancing + data.declining + data.unchanged)) * 100}%` }} />
            <div className="bg-negative" style={{ width: `${(data.declining / (data.advancing + data.declining + data.unchanged)) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[9px] font-mono">
            <span className="text-positive">{data.advancing} tăng</span>
            <span className="text-text-dim">{data.unchanged} đứng</span>
            <span className="text-negative">{data.declining} giảm</span>
          </div>
        </div>
      )}

      <div className="flex gap-4 text-[10px] border-t border-border-subtle pt-2">
        <div><span className="text-text-dim">KL:</span> <span className="text-text-muted font-mono">{formatNumberVI(data.volume, { maximumFractionDigits: 0 })}</span></div>
        {data.totalValue > 0 && <div><span className="text-text-dim">GT:</span> <span className="text-text-muted font-mono">{(data.totalValue / 1e9).toFixed(0)} tỷ</span></div>}
      </div>
    </div>
  );
};

// ── Win Rate Donut ──────────────────────────────────────────────────────────
const WinRateDonut: React.FC<{ rate: number; size?: number }> = ({ rate, size = 44 }) => {
  const safeRate = Number(rate) || 0;
  const r = 15;
  const circ = 2 * Math.PI * r;
  const dash = (safeRate / 100) * circ;
  const color = safeRate >= 60 ? '#22C55E' : safeRate >= 45 ? '#F59E0B' : '#EF4444';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
      <circle
        cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="18" y="21" textAnchor="middle" fontSize="7" fontWeight="700" fill={color} fontFamily="monospace">
        {safeRate.toFixed(0)}%
      </text>
    </svg>
  );
};

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
    } catch { /* optional */ } finally {
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
    } catch { /* optional */ } finally {
      setPerfLoading(false);
    }
  }, [portfolioId]);

  // Refresh live positions P&L every 30s
  const refreshLivePnL = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const res = await positionApi.list(portfolioId, { status: 'OPEN' });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setLivePositions(res.data.data);
        setLastPnlRefresh(new Date());
      }
    } catch { /* silent */ }
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
    refreshLivePnL(); // Lấy current_price ngay khi mount
    const indexInterval = setInterval(loadIndices, 60_000);
    const regimeInterval = setInterval(loadMarketRegime, 15 * 60_000);
    const pnlInterval = setInterval(refreshLivePnL, 30_000);
    return () => {
      clearInterval(indexInterval);
      clearInterval(regimeInterval);
      clearInterval(pnlInterval);
    };
  }, [loadIndices, loadNews, loadMarketRegime, loadPerformance, refreshLivePnL]);

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

  const winRate = performance?.win_rate ?? 0;
  const profitFactor = performance?.profit_factor ?? 0;
  const maxDD = performance?.max_drawdown_pct ?? 0;
  const totalTrades = performance?.total_trades ?? 0;

  // Quick action items
  const quickActions = [
    {
      label: 'Gợi Ý SL/TP',
      sub: 'AI tối ưu điểm dừng lỗ',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
      view: 'terminal',
      color: 'text-accent border-accent/20 hover:bg-accent/5',
    },
    {
      label: 'Review Vị Thế',
      sub: 'AI phân tích toàn danh mục',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      ),
      view: 'portfolio',
      color: 'text-blue-400 border-blue-500/20 hover:bg-blue-500/5',
    },
    {
      label: 'Phân Tích Xu Hướng',
      sub: 'AI dự báo thị trường',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
      view: 'terminal',
      color: 'text-purple-400 border-purple-500/20 hover:bg-purple-500/5',
    },
    {
      label: 'Đặt Lệnh Mới',
      sub: 'Mở vị thế với AI hỗ trợ',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
      view: 'terminal',
      color: 'text-positive border-positive/20 hover:bg-positive/5',
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── HEADER BAR ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text-main">AI Trading Dashboard</h1>
          <p className="text-[11px] text-text-dim mt-0.5">
            Hệ Thống Dừng Lỗ &amp; Chốt Lợi Nhuận Tăng Cường AI · Dự Báo Động &amp; Hành Vi Thị Trường
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-text-dim">
            Cập nhật P&amp;L: {lastPnlRefresh.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button
            onClick={refreshLivePnL}
            className="p-1.5 rounded border border-border-standard text-text-muted hover:text-text-main hover:bg-white/5 transition-colors"
            title="Làm mới P&L"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── ROW 1: KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Tổng vốn */}
        <div className="stat-card border-l-4 border-l-accent lg:col-span-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1">Tổng Vốn</p>
          <p className="text-[18px] font-bold font-mono text-text-main leading-none">{formatNumberVI(totalBalance)}</p>
          <p className="text-[10px] text-text-dim mt-1">VND</p>
        </div>

        {/* P&L hôm nay */}
        <div className={`stat-card border-l-4 lg:col-span-1 ${totalPnl >= 0 ? 'border-l-positive' : 'border-l-negative'}`}>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1">P&amp;L Hôm Nay</p>
          <p className={`text-[18px] font-bold font-mono leading-none ${totalPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
            {totalPnl !== 0 ? (totalPnl >= 0 ? '+' : '') + formatNumberVI(totalPnl, { maximumFractionDigits: 0 }) : '—'}
          </p>
          <p className="text-[10px] text-text-dim mt-1">trên {livePositions.length} vị thế</p>
        </div>

        {/* Win Rate */}
        <div className="stat-card border-l-4 border-l-blue-500 lg:col-span-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1">Tỷ Lệ Thắng</p>
          {perfLoading ? (
            <div className="h-5 w-12 bg-border-subtle rounded animate-pulse mt-1" />
          ) : (
            <div className="flex items-center gap-2 mt-0.5">
              <WinRateDonut rate={winRate} size={36} />
              <div>
                <p className="text-[10px] text-text-dim">{totalTrades} lệnh</p>
              </div>
            </div>
          )}
        </div>

        {/* Profit Factor */}
        <div className={`stat-card border-l-4 lg:col-span-1 ${profitFactor >= 1.5 ? 'border-l-positive' : profitFactor >= 1 ? 'border-l-warning' : 'border-l-negative'}`}>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1">Profit Factor</p>
          {perfLoading ? (
            <div className="h-6 w-10 bg-border-subtle rounded animate-pulse mt-1" />
          ) : (
            <>
              <p className={`text-[18px] font-bold font-mono leading-none ${profitFactor >= 1.5 ? 'text-positive' : profitFactor >= 1 ? 'text-warning' : 'text-negative'}`}>
                {profitFactor > 0 ? profitFactor.toFixed(2) : '—'}
              </p>
              <p className="text-[10px] text-text-dim mt-1">{profitFactor >= 1.5 ? 'Xuất sắc' : profitFactor >= 1.2 ? 'Tốt' : profitFactor >= 1 ? 'Đạt' : 'Cần cải thiện'}</p>
            </>
          )}
        </div>

        {/* Rủi ro */}
        <div className={`stat-card border-l-4 lg:col-span-1 ${riskPct < 50 ? 'border-l-positive' : riskPct < 80 ? 'border-l-warning' : 'border-l-negative'}`}>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1">Rủi Ro Đang Dùng</p>
          <p className={`text-[18px] font-bold font-mono leading-none ${riskColor}`}>{riskPct.toFixed(1)}%</p>
          <div className="mt-1.5 h-1 rounded-full bg-border-subtle overflow-hidden">
            <div className={`h-full rounded-full transition-all ${riskBarColor}`} style={{ width: `${Math.min(100, riskPct)}%` }} />
          </div>
          <p className="text-[9px] text-text-dim mt-0.5">{formatNumberVI(riskUsed, { maximumFractionDigits: 0 })} / {formatNumberVI(maxRisk, { maximumFractionDigits: 0 })}</p>
        </div>

        {/* Max Drawdown */}
        <div className={`stat-card border-l-4 lg:col-span-1 ${maxDD < 5 ? 'border-l-positive' : maxDD < 15 ? 'border-l-warning' : 'border-l-negative'}`}>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1">Max Drawdown</p>
          {perfLoading ? (
            <div className="h-6 w-10 bg-border-subtle rounded animate-pulse mt-1" />
          ) : (
            <>
              <p className={`text-[18px] font-bold font-mono leading-none ${maxDD < 5 ? 'text-positive' : maxDD < 15 ? 'text-warning' : 'text-negative'}`}>
                {maxDD > 0 ? `-${maxDD.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[10px] text-text-dim mt-1">{maxDD < 5 ? 'Kiểm soát tốt' : maxDD < 15 ? 'Chú ý' : 'Rủi ro cao'}</p>
            </>
          )}
        </div>
      </div>

      {/* ── ROW 2: AI Market Regime Banner ── */}
      <div className={`panel-section p-4 border-l-4 ${
        marketRegime?.regime === 'BULL' ? 'border-l-positive' :
        marketRegime?.regime === 'BEAR' ? 'border-l-negative' :
        marketRegime?.regime === 'VOLATILE' ? 'border-l-warning' :
        marketRegime?.regime === 'SIDEWAYS' ? 'border-l-text-muted' : 'border-l-border-standard'
      }`}>
        <div className="flex items-start gap-4 flex-wrap">
          {/* Regime badge */}
          <div className="flex items-center gap-3 shrink-0">
            <div className={`w-3 h-3 rounded-full ${
              marketRegime?.regime === 'BULL' ? 'bg-positive animate-pulse' :
              marketRegime?.regime === 'BEAR' ? 'bg-negative animate-pulse' :
              marketRegime?.regime === 'VOLATILE' ? 'bg-warning animate-pulse' : 'bg-text-muted'
            }`} />
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">Chế Độ Thị Trường AI</p>
              {regimeLoading ? (
                <div className="h-6 w-28 bg-border-subtle rounded animate-pulse mt-0.5" />
              ) : marketRegime ? (
                <p className={`text-[16px] font-bold font-mono ${
                  marketRegime.regime === 'BULL' ? 'text-positive' :
                  marketRegime.regime === 'BEAR' ? 'text-negative' :
                  marketRegime.regime === 'VOLATILE' ? 'text-warning' : 'text-text-main'
                }`}>
                  {marketRegime.regime === 'BULL' ? 'TĂNG TRƯỞNG' :
                   marketRegime.regime === 'BEAR' ? 'SUY GIẢM' :
                   marketRegime.regime === 'VOLATILE' ? 'BIẾN ĐỘNG' : 'ĐI NGANG'}
                </p>
              ) : (
                <button
                  onClick={loadMarketRegime}
                  className="text-[11px] text-accent hover:underline mt-0.5"
                >
                  Tải phân tích AI →
                </button>
              )}
            </div>
          </div>

          {marketRegime && (
            <>
              <div className="shrink-0">
                <p className="text-[9px] text-text-dim uppercase tracking-wider mb-0.5">Độ Tin Cậy</p>
                <p className="text-[14px] font-bold font-mono text-accent">{marketRegime.confidence}%</p>
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-[11px] text-text-muted leading-relaxed">{marketRegime.description}</p>
                {marketRegime.sector_focus && (
                  <p className="text-[10px] text-accent mt-1">📊 Ngành tập trung: {marketRegime.sector_focus}</p>
                )}
              </div>
              {Array.isArray(marketRegime.recommendations) && marketRegime.recommendations.length > 0 && (
                <div className="flex-1 min-w-[200px] border-l border-border-subtle pl-4">
                  <p className="text-[9px] text-text-dim uppercase tracking-wider mb-1">Chiến Lược AI</p>
                  <ul className="space-y-0.5">
                    {marketRegime.recommendations.slice(0, 3).map((r: string, i: number) => (
                      <li key={i} className="text-[10px] text-text-muted flex items-start gap-1">
                        <span className="text-accent mt-0.5 shrink-0">›</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Key levels */}
              {marketRegime.key_levels && (
                <div className="shrink-0 border-l border-border-subtle pl-4">
                  <p className="text-[9px] text-text-dim uppercase tracking-wider mb-1">Ngưỡng Quan Trọng</p>
                  {marketRegime.key_levels.support && (
                    <p className="text-[10px] text-text-muted">
                      <span className="text-positive">Hỗ trợ:</span> {Array.isArray(marketRegime.key_levels.support) ? marketRegime.key_levels.support.join(', ') : marketRegime.key_levels.support}
                    </p>
                  )}
                  {marketRegime.key_levels.resistance && (
                    <p className="text-[10px] text-text-muted mt-0.5">
                      <span className="text-negative">Kháng cự:</span> {Array.isArray(marketRegime.key_levels.resistance) ? marketRegime.key_levels.resistance.join(', ') : marketRegime.key_levels.resistance}
                    </p>
                  )}
                </div>
              )}
              <div className="shrink-0 text-right">
                <p className="text-[9px] text-text-dim uppercase tracking-wider mb-0.5">Rủi Ro TT</p>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  marketRegime.risk_level === 'LOW' ? 'text-positive bg-positive/10' :
                  marketRegime.risk_level === 'MEDIUM' ? 'text-warning bg-warning/10' :
                  'text-negative bg-negative/10'
                }`}>
                  {marketRegime.risk_level === 'LOW' ? 'THẤP' : marketRegime.risk_level === 'MEDIUM' ? 'TRUNG BÌNH' : marketRegime.risk_level === 'HIGH' ? 'CAO' : 'RẤT CAO'}
                </span>
                {marketRegime.cached && (
                  <p className="text-[9px] text-text-dim mt-1">cache {marketRegime.cache_age_minutes ?? 0}p trước</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ROW 3: Quick Actions ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onNavigate(action.view)}
            className={`panel-section p-3 flex items-start gap-3 text-left border transition-all hover:scale-[1.01] active:scale-[0.99] ${action.color}`}
          >
            <div className="shrink-0 mt-0.5">{action.icon}</div>
            <div>
              <p className="text-[12px] font-semibold">{action.label}</p>
              <p className="text-[10px] text-text-dim mt-0.5">{action.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── ROW 4: Indices + News + Open Positions ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Index Cards + News */}
        <div className="xl:col-span-2 flex flex-col gap-3">
          {/* Index Cards */}
          <div className="grid grid-cols-3 gap-3">
            {loading
              ? Array(3).fill(0).map((_, i) => (
                  <div key={i} className="panel-section p-4 animate-pulse h-32" />
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

          {/* Tin tức thị trường (compact, 2 cột) */}
          <div className="panel-section">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Tin Tức Thị Trường</span>
              <span className="text-[10px] text-text-dim">cafef.vn</span>
            </div>
            {newsLoading ? (
              <div className="p-3 text-center text-text-muted text-[11px]">Đang tải...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                {news.slice(0, 6).map((article, i) => (
                  <a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2.5 border-b border-r border-border-subtle last:border-b-0 even:border-r-0 hover:bg-white/5 transition-colors group"
                  >
                    <p className="text-[11px] font-medium text-text-main group-hover:text-accent line-clamp-2 leading-snug">{article.title}</p>
                    <p className="text-[9px] text-text-dim mt-1">{article.date}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Open Positions mini table */}
        <div className="panel-section flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Vị Thế Đang Mở</span>
            <button onClick={() => onNavigate('portfolio')} className="text-[10px] text-accent hover:underline">
              Xem tất cả →
            </button>
          </div>
          <div className="flex-1 overflow-y-auto dense-scroll">
            {livePositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-text-dim">
                <svg className="w-8 h-8 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5" />
                </svg>
                <p className="text-[11px]">Chưa có vị thế nào</p>
                <button onClick={() => onNavigate('terminal')} className="mt-2 text-[10px] text-accent hover:underline">
                  Đặt lệnh mới →
                </button>
              </div>
            ) : (
              <table className="table-terminal w-full">
                <thead>
                  <tr>
                    <th className="text-left">Mã</th>
                    <th>Vào</th>
                    <th>Hiện</th>
                    <th>P&amp;L%</th>
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
                    return (
                      <tr
                        key={pos.id}
                        className={`cursor-pointer ${pnlVnd >= 0 ? 'row-profit' : 'row-loss'}`}
                        onClick={() => onNavigate('terminal')}
                      >
                        <td className="text-left font-bold text-text-main">{pos.symbol}</td>
                        <td className="text-text-muted">{entry > 0 ? entry.toFixed(2) : '—'}</td>
                        <td className={current > 0 ? (current > entry ? 'text-positive' : current < entry ? 'text-negative' : 'text-warning') : 'text-text-muted'}>
                          {current > 0 ? current.toFixed(2) : '—'}
                        </td>
                        <td className={pnlPct >= 0 ? 'text-positive font-mono' : 'text-negative font-mono'}>
                          {pnlPct !== 0 ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="px-4 py-2 border-t border-border-subtle">
            <div className="flex justify-between text-[10px] text-text-muted mb-1">
              <span>Rủi ro đang dùng</span>
              <span className={riskColor}>{riskPct.toFixed(1)}%</span>
            </div>
            <div className="h-1 rounded-full bg-border-subtle overflow-hidden">
              <div className={`h-full rounded-full transition-all ${riskBarColor}`} style={{ width: `${Math.min(100, riskPct)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 5: Performance Summary ── */}
      {performance && performance.total_trades > 0 && (
        <div className="panel-section p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Hiệu Suất Giao Dịch</span>
            <button onClick={() => onNavigate('portfolio')} className="text-[10px] text-accent hover:underline">Chi tiết →</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: 'Tổng Lệnh', value: performance.total_trades.toString(), color: 'text-text-main' },
              { label: 'Lệnh Thắng', value: performance.winning_trades.toString(), color: 'text-positive' },
              { label: 'Lệnh Thua', value: performance.losing_trades.toString(), color: 'text-negative' },
              { label: 'TB Lãi', value: performance.avg_win_vnd > 0 ? '+' + formatNumberVI(performance.avg_win_vnd, { maximumFractionDigits: 0 }) : '—', color: 'text-positive' },
              { label: 'TB Lỗ', value: performance.avg_loss_vnd > 0 ? '-' + formatNumberVI(performance.avg_loss_vnd, { maximumFractionDigits: 0 }) : '—', color: 'text-negative' },
              { label: 'Tổng P&L', value: performance.total_pnl_vnd !== 0 ? (performance.total_pnl_vnd >= 0 ? '+' : '') + formatNumberVI(performance.total_pnl_vnd, { maximumFractionDigits: 0 }) : '—', color: performance.total_pnl_vnd >= 0 ? 'text-positive' : 'text-negative' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[9px] text-text-dim uppercase tracking-wider mb-0.5">{item.label}</p>
                <p className={`text-[13px] font-bold font-mono ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
