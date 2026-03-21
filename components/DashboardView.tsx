import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { marketApi, positionApi } from '../services/api';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_LOCALE, PRICE_FRACTION_OPTIONS, formatNumberVI } from '../constants';
import type { Position } from '../services/api';

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

interface Props {
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
  const minVal = Math.min(...data.chartData.map((c) => c.value));
  const maxVal = Math.max(...data.chartData.map((c) => c.value));
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
          <div style={{ width: 90, height: 48 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chartData}>
                <ReferenceLine y={refVal} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="value" stroke={isUp ? '#22C55E' : '#EF4444'} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Breadth bar */}
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

export const DashboardView: React.FC<Props> = ({
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
      const res = await marketApi.getNews({ limit: 8 });
      if (res.data.success && Array.isArray(res.data.data)) {
        setNews(res.data.data.slice(0, 8));
      }
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIndices();
    loadNews();
    const interval = setInterval(loadIndices, 60_000);
    return () => clearInterval(interval);
  }, [loadIndices, loadNews]);

  const riskPct = maxRisk > 0 ? (riskUsed / maxRisk) * 100 : 0;
  const riskColor = riskPct < 50 ? 'text-positive' : riskPct < 80 ? 'text-warning' : 'text-negative';
  const riskBarColor = riskPct < 50 ? 'bg-positive' : riskPct < 80 ? 'bg-warning' : 'bg-negative';

  const totalPnl = openPositions.reduce((s, p) => {
    if ((p as any).current_price && p.entry_price && p.quantity) {
      return s + (Number((p as any).current_price) - Number(p.entry_price)) * Number(p.quantity);
    }
    return s;
  }, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── ROW 1: KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Tổng Vốn',
            value: formatNumberVI(totalBalance),
            sub: 'VND',
            color: 'border-l-accent',
          },
          {
            label: 'P&L Hôm nay',
            value: totalPnl !== 0 ? (totalPnl >= 0 ? '+' : '') + formatNumberVI(totalPnl) : '—',
            sub: 'VND',
            color: totalPnl >= 0 ? 'border-l-positive' : 'border-l-negative',
            valueColor: totalPnl >= 0 ? 'text-positive' : 'text-negative',
          },
          {
            label: 'Rủi Ro Đang Dùng',
            value: `${riskPct.toFixed(1)}%`,
            sub: `${formatNumberVI(riskUsed)} / ${formatNumberVI(maxRisk)}`,
            color: riskPct < 50 ? 'border-l-positive' : riskPct < 80 ? 'border-l-warning' : 'border-l-negative',
            valueColor: riskColor,
          },
          {
            label: 'Lệnh Mở',
            value: openPositions.length.toString(),
            sub: 'vị thế đang mở',
            color: 'border-l-neutral',
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`stat-card border-l-4 ${card.color} cursor-default`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1">{card.label}</p>
            <p className={`text-[20px] font-bold font-mono leading-none ${card.valueColor || 'text-text-main'}`}>{card.value}</p>
            <p className="text-[10px] text-text-dim mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── ROW 2: Indices + Open Positions ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Index Cards */}
        <div className="xl:col-span-2 grid grid-cols-3 gap-3">
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

        {/* Open Positions mini table */}
        <div className="panel-section flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Vị Thế Đang Mở</span>
            <button
              onClick={() => onNavigate('portfolio')}
              className="text-[10px] text-accent hover:underline"
            >
              Xem tất cả →
            </button>
          </div>
          <div className="flex-1 overflow-y-auto dense-scroll">
            {openPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-text-dim">
                <svg className="w-8 h-8 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5" />
                </svg>
                <p className="text-[11px]">Chưa có vị thế nào</p>
                <button onClick={() => onNavigate('terminal')} className="mt-2 text-[10px] text-accent hover:underline">Đặt lệnh mới →</button>
              </div>
            ) : (
              <table className="table-terminal w-full">
                <thead>
                  <tr>
                    <th className="text-left">Mã</th>
                    <th>Vào</th>
                    <th>Hiện</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {openPositions.slice(0, 8).map((pos) => {
                    const entry = Number(pos.entry_price ?? 0) / 1000;
                    const current = Number((pos as any).current_price ?? 0) / 1000;
                    const qty = Number(pos.quantity ?? 0);
                    const pnl = (current - entry) * qty * 1000;
                    return (
                      <tr
                        key={pos.id}
                        className={`cursor-pointer ${pnl >= 0 ? 'row-profit' : 'row-loss'}`}
                        onClick={() => onNavigate('terminal')}
                      >
                        <td className="text-left font-bold text-text-main">{pos.symbol}</td>
                        <td className="text-text-muted">{entry > 0 ? entry.toFixed(2) : '—'}</td>
                        <td className={current > 0 ? (current > entry ? 'text-positive' : current < entry ? 'text-negative' : 'text-warning') : 'text-text-muted'}>
                          {current > 0 ? current.toFixed(2) : '—'}
                        </td>
                        <td className={pnl >= 0 ? 'text-positive' : 'text-negative'}>
                          {pnl !== 0 ? (pnl >= 0 ? '+' : '') + formatNumberVI(pnl, { maximumFractionDigits: 0 }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {/* Risk bar */}
          <div className="px-4 py-2 border-t border-border-subtle">
            <div className="flex justify-between text-[10px] text-text-muted mb-1">
              <span>Rủi ro</span>
              <span className={riskColor}>{riskPct.toFixed(1)}%</span>
            </div>
            <div className="h-1 rounded-full bg-border-subtle overflow-hidden">
              <div className={`h-full rounded-full transition-all ${riskBarColor}`} style={{ width: `${Math.min(100, riskPct)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: News ── */}
      <div className="panel-section">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Tin Tức Thị Trường</span>
          <button onClick={() => onNavigate('news')} className="text-[10px] text-accent hover:underline">Xem tất cả →</button>
        </div>
        {newsLoading ? (
          <div className="p-4 text-center text-text-muted text-[12px]">Đang tải...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0">
            {news.map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 border-r border-b border-border-subtle last:border-r-0 hover:bg-white/5 transition-colors group"
              >
                <p className="text-[12px] font-medium text-text-main group-hover:text-accent line-clamp-2 leading-snug mb-2">
                  {article.title}
                </p>
                {article.description && (
                  <p className="text-[11px] text-text-muted line-clamp-2 leading-snug mb-2">{article.description}</p>
                )}
                <p className="text-[10px] text-text-dim">{article.date}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
