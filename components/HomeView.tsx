import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { marketApi } from '../services/api';
import { MARKET_INDEX_CODES, formatNumberVI } from '../constants';

interface Props {
  totalBalance: number;
  activePositionsCount: number;
  riskUsed: number;
  maxRisk: number;
  onNavigate: (view: string) => void;
  /** Nội dung cột trái - Tất cả mã chứng khoán (truyền từ App) */
  marketDataContent?: React.ReactNode;
}

// Normalize VPBS API response (intradayMarketIndex) to a common shape
function normalizeIndexData(raw: any, indexCode: string) {
  const d = raw?.data ?? raw;
  const value = d?.indexValue ?? d?.lastValue ?? d?.close ?? d?.value ?? 0;
  const prev = d?.prevIndexValue ?? d?.previousClose ?? d?.open ?? value;
  const change = d?.indexChange ?? d?.change ?? (value - prev);
  const changePercent = d?.indexPercentChange ?? d?.changePercent ?? (prev ? (change / prev) * 100 : 0);
  const volume = d?.totalVolume ?? d?.sumVolume ?? d?.volume ?? 0;
  const totalValue = d?.totalValue ?? d?.sumValue ?? d?.valueVolume ?? 0;
  const chartRaw = d?.index ?? d?.sessionData ?? d?.intradayData ?? [];
  const chartData = Array.isArray(chartRaw)
    ? chartRaw.map((p: any) => ({
        time: p?.indexTime ?? p?.time ?? p?.t,
        value: p?.indexValue ?? p?.value ?? p?.close ?? 0,
      }))
    : [];
  const advancing = d?.advances ?? d?.advancing ?? 0;
  const unchanged = d?.noChange ?? d?.unchanged ?? 0;
  const declining = d?.declines ?? d?.declining ?? 0;
  return {
    indexCode,
    value,
    change,
    changePercent,
    volume,
    totalValue,
    chartData: chartData.filter((c: any) => Number.isFinite(c.value)),
    advancing,
    unchanged,
    declining,
  };
}

const defaultIndices = ['VN30', 'VN100', 'VNX50'];

interface NewsArticle {
  title: string;
  url: string;
  date: string;
  description?: string;
}

const MARKET_INDEX_DETAIL_CODES = 'VNINDEX,VN30,VNXALL,HNX30,HNXINDEX,HNXUPCOMINDI';

interface MarketIndexDetailRow {
  indexCode: string;
  indexValue: number | null;
  indexChange: number | null;
  sumVolume: number | null;
  sumValue: number | null;
  advances: number;
  declines: number;
  noChange: number;
}

export const HomeView: React.FC<Props> = ({ onNavigate, totalBalance, riskUsed, maxRisk, marketDataContent }) => {
  const [cardCodes, setCardCodes] = useState<string[]>(defaultIndices);
  const [indexData, setIndexData] = useState<Record<string, ReturnType<typeof normalizeIndexData>>>({});
  const [marketIndexDetailList, setMarketIndexDetailList] = useState<MarketIndexDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const fetchIndices = useCallback(async (codes: string[]) => {
    if (!codes.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await marketApi.getIntradayIndices(codes);
      const list = (res.data as any)?.data ?? [];
      const next: Record<string, ReturnType<typeof normalizeIndexData>> = {};
      list.forEach((item: any) => {
        if (item.success && item.indexCode) {
          next[item.indexCode] = normalizeIndexData({ data: item.data }, item.indexCode);
        }
      });
      setIndexData((prev) => ({ ...prev, ...next }));
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được dữ liệu chỉ số');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIndices(cardCodes);
    const t = setInterval(() => fetchIndices(cardCodes), 60000);
    return () => clearInterval(t);
  }, [cardCodes.join(','), fetchIndices]);

  useEffect(() => {
    marketApi.getMarketIndexDetail({ indexCode: MARKET_INDEX_DETAIL_CODES })
      .then((res) => {
        const raw = (res.data as any)?.data;
        if (Array.isArray(raw)) {
          setMarketIndexDetailList(raw.map((d: any) => ({
            indexCode: (d.indexCode ?? d.code ?? '').toString().trim(),
            indexValue: d.indexValue != null ? Number(d.indexValue) : null,
            indexChange: d.indexChange != null ? Number(d.indexChange) : null,
            sumVolume: d.sumVolume != null ? Number(d.sumVolume) : null,
            sumValue: d.sumValue != null ? Number(d.sumValue) : null,
            advances: Number(d.advances) || 0,
            declines: Number(d.declines) || 0,
            noChange: Number(d.noChange) || 0,
          })));
        }
      })
      .catch((e: any) => {
        if (e?.response?.status !== 503) console.error('Market index detail error:', e);
        setMarketIndexDetailList([]);
      });
    const t = setInterval(() => {
      marketApi.getMarketIndexDetail({ indexCode: MARKET_INDEX_DETAIL_CODES })
        .then((res) => {
          const raw = (res.data as any)?.data;
          if (Array.isArray(raw)) {
            setMarketIndexDetailList(raw.map((d: any) => ({
              indexCode: (d.indexCode ?? d.code ?? '').toString().trim(),
              indexValue: d.indexValue != null ? Number(d.indexValue) : null,
              indexChange: d.indexChange != null ? Number(d.indexChange) : null,
              sumVolume: d.sumVolume != null ? Number(d.sumVolume) : null,
              sumValue: d.sumValue != null ? Number(d.sumValue) : null,
              advances: Number(d.advances) || 0,
              declines: Number(d.declines) || 0,
              noChange: Number(d.noChange) || 0,
            })));
          }
        })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const fetchNews = useCallback(() => {
    setNewsLoading(true);
    setNewsError(null);
    marketApi.getNews({ limit: 10, format: 'json' })
      .then((res) => {
        const data = (res.data as any) ?? {};
        const list = Array.isArray(data?.articles) ? data.articles : Array.isArray((data as any)?.data?.articles) ? (data as any).data.articles : [];
        setNews(
          list
            .map((a: any) => ({
              title: (a?.title ?? '').trim(),
              url: typeof a?.url === 'string' ? a.url.trim() : '#',
              date: (a?.date ?? '').trim(),
              description: (a?.description ?? '').trim(),
            }))
            .filter((a) => a.title.length > 0)
        );
      })
      .catch((err) => {
        setNews([]);
        setNewsError(err?.message ?? 'Không tải được tin tức');
      })
      .finally(() => setNewsLoading(false));
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const setCardCode = (cardIndex: number, newCode: string) => {
    setCardCodes((prev) => {
      const next = [...prev];
      next[cardIndex] = newCode;
      return next;
    });
  };

  // Giá trị giao dịch: hiển thị theo tỷ, dạng 11,787.10 Tỷ (dấu phẩy nghìn, chấm thập phân)
  const formatTotalValueTyr = (v: number) => {
    if (v >= 1e9) {
      const n = v / 1e9;
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Tỷ';
    }
    if (v >= 1e6) return (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' Tr Tỷ';
    return (v ?? 0).toLocaleString('en-US') + ' Tỷ';
  };

  const formatVolumeMillion = (v: number | null) =>
    v != null && Number.isFinite(v) ? (v / 1e6).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : '—';
  const formatValueBillion = (v: number | null) =>
    v != null && Number.isFinite(v) ? (v / 1e9).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : '—';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Chỉ số trong ngày + Tóm tắt ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Chỉ số trong ngày — scroll ngang */}
        <div className="lg:col-span-8 xl:col-span-9 min-w-0">
          <div className="panel-section h-full flex flex-col">
            <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Chỉ số trong ngày</span>
              <span className="text-[10px] text-text-dim hidden sm:block">Cập nhật theo phiên</span>
            </div>
            {error && (
              <div className="mx-4 mt-2 py-1.5 px-3 bg-warning/5 border border-warning/20 text-warning text-[11px] rounded shrink-0">
                {error}
              </div>
            )}
            <div
              className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden flex flex-nowrap"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {[0, 1, 2].map((i) => {
                const code = cardCodes[i] ?? defaultIndices[i];
                const data = indexData[code];
                const isUp = data ? data.change >= 0 : true;
                const chartPoints = data?.chartData?.length ? data.chartData : [];
                const refValue = chartPoints.length ? chartPoints[0]?.value : data?.value;

                return (
                  <div
                    key={i}
                    className={`flex-shrink-0 w-[260px] sm:w-[280px] px-4 py-3 flex flex-col ${i < 2 ? 'border-r border-border-subtle' : ''}`}
                  >
                    <div className="flex justify-between items-center gap-2 shrink-0">
                      <select
                        value={code}
                        onChange={(e) => setCardCode(i, e.target.value)}
                        className="appearance-none bg-transparent text-[13px] font-bold text-accent border-none p-0 cursor-pointer focus:ring-0 focus:outline-none min-w-[70px]"
                      >
                        {MARKET_INDEX_CODES.map((opt) => (
                          <option key={opt.code} value={opt.code}>{opt.name}</option>
                        ))}
                      </select>
                      {loading && !data && (
                        <span className="text-text-dim text-[10px]">Đang tải...</span>
                      )}
                    </div>

                    {data ? (
                      <>
                        <div className="mt-1 shrink-0">
                          <span className={`text-lg font-bold tabular-nums ${isUp ? 'text-positive' : 'text-negative'}`}>
                            {formatNumberVI(Number(data.value), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[11px] text-text-muted ml-1">điểm</span>
                          <div className={`text-[11px] font-medium mt-0.5 ${isUp ? 'text-positive' : 'text-negative'}`}>
                            {data.change >= 0 ? '+' : ''}{Number(data.change).toFixed(2)}
                            <span className="text-text-muted font-normal ml-1">({data.changePercent >= 0 ? '+' : ''}{Number(data.changePercent).toFixed(2)}%)</span>
                          </div>
                        </div>

                        {/* Mini chart */}
                        <div className="mt-1.5 w-full h-8 flex-shrink-0 overflow-hidden">
                          {chartPoints.length > 0 ? (
                            <ResponsiveContainer width="100%" height={32}>
                              <LineChart data={chartPoints} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                                <ReferenceLine y={refValue} stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
                                <XAxis dataKey="time" hide />
                                <YAxis hide domain={['auto', 'auto']} />
                                <Line type="monotone" dataKey="value" stroke={isUp ? 'var(--color-positive)' : 'var(--color-negative)'} strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-text-dim text-[10px]">Chưa có dữ liệu</div>
                          )}
                        </div>

                        <div className="mt-1.5 pt-1 border-t border-border-subtle flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] shrink-0">
                          {data.volume > 0 && (
                            <span className="text-text-muted">
                              <span className="font-medium text-text-main">KL:</span> {formatNumberVI(Number(data.volume))} CP
                            </span>
                          )}
                          {data.totalValue > 0 && (
                            <span className="text-text-muted">
                              <span className="font-medium text-text-main">GT:</span> {formatTotalValueTyr(data.totalValue)}
                            </span>
                          )}
                          {(data.advancing > 0 || data.unchanged > 0 || data.declining > 0) && (
                            <span className="flex items-center gap-1.5 w-full">
                              <span className="text-positive font-medium">↑{data.advancing}</span>
                              <span className="text-text-dim">{data.unchanged} đứng giá</span>
                              <span className="text-negative font-medium">↓{data.declining}</span>
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      !loading && (
                        <div className="flex-1 flex items-center justify-center text-text-dim text-[11px] py-4">
                          Chọn mã chỉ số
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tóm tắt chỉ số — bảng nhỏ bên phải */}
        <div className="lg:col-span-4 xl:col-span-3 min-w-0">
          <div className="panel-section h-full flex flex-col">
            <div className="px-4 py-2.5 border-b border-border-subtle shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Tóm tắt chỉ số</span>
            </div>
            <div className="overflow-auto flex-1 min-h-0">
              <table className="table-terminal w-full">
                <thead>
                  <tr>
                    <th className="text-left">Chỉ số</th>
                    <th>Điểm</th>
                    <th>+/-</th>
                    <th>↑/↓</th>
                  </tr>
                </thead>
                <tbody>
                  {marketIndexDetailList.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-text-dim text-[11px] py-4">Đang tải...</td></tr>
                  ) : (
                    marketIndexDetailList.map((row) => {
                      const isUp = row.indexChange != null && row.indexChange >= 0;
                      const chgCls = row.indexChange == null ? 'text-text-main' : isUp ? 'text-positive' : 'text-negative';
                      return (
                        <tr key={row.indexCode}>
                          <td className="text-left font-medium text-text-main">{row.indexCode}</td>
                          <td className={`font-mono tabular-nums ${chgCls}`}>
                            {row.indexValue != null ? formatNumberVI(row.indexValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className={`font-mono tabular-nums ${chgCls}`}>
                            {row.indexChange != null ? (row.indexChange >= 0 ? '+' : '') + formatNumberVI(row.indexChange, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="text-positive">↑{row.advances}</span>
                            <span className="text-text-dim mx-0.5">/</span>
                            <span className="text-negative">↓{row.declines}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bảng giá theo index ── */}
      {marketDataContent && (
        <div className="panel-section">
          <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Bảng giá theo index</span>
            <span className="text-[10px] text-text-dim hidden sm:block">Chọn index, tìm mã — click hàng xem biểu đồ</span>
          </div>
          <div className="p-3 sm:p-4 min-w-0 overflow-hidden">
            {marketDataContent}
          </div>
        </div>
      )}

      {/* ── Tin tức ── */}
      <div className="panel-section">
        <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between shrink-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Tin tức</span>
          <span className="text-[10px] text-text-dim hidden sm:block">Nguồn CafeF</span>
        </div>
        <div className="p-4">
          {newsLoading ? (
            <div className="flex items-center justify-center gap-2 text-text-dim text-[12px] py-6">
              <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              Đang tải tin...
            </div>
          ) : newsError ? (
            <div className="text-center py-6">
              <p className="text-text-muted text-[12px]">Không tải được tin tức</p>
              <p className="text-text-dim text-[11px] mt-1">{newsError}</p>
              <button type="button" onClick={fetchNews} className="mt-2 px-3 py-1.5 text-[11px] font-semibold text-accent border border-accent/30 rounded hover:bg-accent/5">Thử lại</button>
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-text-muted text-[12px]">Chưa có tin mới</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button type="button" onClick={fetchNews} className="px-3 py-1.5 text-[11px] font-semibold text-text-muted border border-border-subtle rounded hover:bg-bg-panel">Tải lại</button>
                <button type="button" onClick={() => onNavigate('market')} className="px-3 py-1.5 text-[11px] font-semibold bg-accent text-white rounded hover:bg-accent/90">Xem trang tin</button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-0 divide-y divide-border-subtle">
                {news.slice(0, 5).map((article, idx) => (
                  <a
                    key={idx}
                    href={typeof article.url === 'string' ? article.url.split(/\s|"/)[0].trim() : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block py-2.5 first:pt-0"
                  >
                    <div className="flex justify-between text-[9px] text-text-dim mb-0.5 uppercase tracking-wide">
                      <span className="text-accent font-semibold">CafeF</span>
                      <span>{article.date || '—'}</span>
                    </div>
                    <p className="text-[12px] text-text-main group-hover:text-accent leading-relaxed font-medium transition-colors line-clamp-2">
                      {article.title}
                    </p>
                  </a>
                ))}
              </div>
              <div className="pt-3 border-t border-border-subtle mt-3">
                <button
                  type="button"
                  onClick={() => onNavigate('market')}
                  className="w-full py-2 text-[11px] font-semibold text-text-muted hover:text-accent transition-colors"
                >
                  Xem tất cả tin tức →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
