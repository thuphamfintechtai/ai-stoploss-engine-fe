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
    <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 pb-6 sm:pb-8 pt-2 bg-background min-h-full overflow-x-hidden">
      {/* Hàng đầu: Chỉ số trong ngày (trái, scroll ngang như VPBS) + Tóm tắt chỉ số (phải), chiều cao cố định tránh bảng bị kéo dãn */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 mb-4 sm:mb-6 items-stretch min-h-[220px] lg:h-[260px] xl:h-[280px]">
        {/* Chỉ số trong ngày – bên trái: thanh kéo ngang, chart theo chiều rộng (rộng-thấp) */}
        <div className="lg:col-span-8 xl:col-span-9 min-w-0 flex min-h-[240px] lg:min-h-0">
          <section className="bg-panel rounded-xl sm:rounded-2xl border border-border-standard/80 shadow-md sm:shadow-lg shadow-slate-200/50 overflow-hidden flex flex-col w-full min-h-0">
            <div className="px-3 sm:px-4 py-2 border-b border-border-standard bg-panel/50 shrink-0">
              <h2 className="text-sm font-semibold text-text-main">Chỉ số trong ngày</h2>
              <p className="text-text-muted text-[10px] sm:text-xs mt-0.5 hidden sm:block">Cập nhật theo phiên · Kéo ngang xem thêm</p>
            </div>
            {error && (
              <div className="mx-3 sm:mx-4 mt-2 py-2 px-3 bg-amber-50 text-amber-800 text-xs border-l-4 border-amber-400 rounded-r shrink-0">
                {error}
              </div>
            )}
            {/* Một component gồm nhiều chỉ số: nền chung, chỉ phân cách bằng đường kẻ dọc */}
            <div
              className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden mx-3 sm:mx-4 mb-2 rounded-lg border border-border-standard/80 bg-panel/50 flex flex-nowrap"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarGutter: 'stable' }}
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
                    className={`flex-shrink-0 w-[280px] sm:w-[300px] p-2 flex flex-col h-full min-h-[160px] ${i < 2 ? 'border-r border-border-standard/70' : ''}`}
                  >
                    <div className="flex justify-between items-center gap-2 shrink-0">
                      <div className="relative inline-block">
                        <select
                          value={code}
                          onChange={(e) => setCardCode(i, e.target.value)}
                          className="appearance-none bg-transparent text-text-main text-sm font-semibold border-none py-0.5 pr-2 cursor-pointer focus:ring-0 focus:outline-none w-full min-w-[80px] text-accent"
                        >
                          {MARKET_INDEX_CODES.map((opt) => (
                            <option key={opt.code} value={opt.code}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {loading && !data && (
                        <span className="text-text-muted text-xs font-medium">Đang tải...</span>
                      )}
                    </div>

                    {data ? (
                      <>
                        <div className="mt-1.5 shrink-0">
                          <p className={`text-xl font-bold tabular-nums tracking-tight ${isUp ? 'text-positive' : 'text-negative'}`}>
                            {formatNumberVI(Number(data.value), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-sm font-semibold text-text-muted ml-1">điểm</span>
                          </p>
                          <div className={`inline-flex items-center mt-0.5 text-xs font-medium ${isUp ? 'text-positive' : 'text-negative'}`}>
                            <span>
                              {data.change >= 0 ? '+' : ''}{Number(data.change).toFixed(2)} <span className="text-text-muted font-normal">({data.changePercent >= 0 ? '+' : ''}{Number(data.changePercent).toFixed(2)}%)</span>
                            </span>
                          </div>
                        </div>

                        {/* Chart theo chiều rộng: rộng, thấp (không kéo dài theo chiều dọc) */}
                        <div className="mt-1.5 w-full h-9 flex-shrink-0 bg-panel/80 rounded border border-border-standard/60 overflow-hidden">
                          {chartPoints.length > 0 ? (
                            <ResponsiveContainer width="100%" height={36}>
                              <LineChart data={chartPoints} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                                <ReferenceLine y={refValue} stroke="#94A3B8" strokeDasharray="3 3" strokeOpacity={0.8} />
                                <XAxis dataKey="time" hide />
                                <YAxis hide domain={['auto', 'auto']} />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke={isUp ? '#059669' : '#dc2626'}
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-text-muted text-xs">Chưa có dữ liệu</div>
                          )}
                        </div>

                        <div className="mt-1.5 pt-1 border-t border-border-standard/80 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] shrink-0">
                          {data.volume > 0 && (
                            <span className="text-text-muted">
                              <span className="font-medium text-slate-600">KL:</span> {formatNumberVI(Number(data.volume))} CP
                            </span>
                          )}
                          {data.totalValue > 0 && (
                            <span className="text-text-muted">
                              <span className="font-medium text-slate-600">Giá trị:</span> {formatTotalValueTyr(data.totalValue)}
                            </span>
                          )}
                          {(data.advancing > 0 || data.unchanged > 0 || data.declining > 0) && (
                            <span className="flex items-center gap-1.5 mt-0.5 w-full">
                              <span className="text-positive font-medium">↑{data.advancing}</span>
                              <span className="text-text-muted">{data.unchanged} đứng giá</span>
                              <span className="text-negative font-medium">↓{data.declining}</span>
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      !loading && (
                        <div className="flex-1 flex items-center justify-center text-text-muted text-xs py-4">
                          Chọn mã chỉ số
                        </div>
                      )
                )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Tóm tắt chỉ số – bên phải, bảng tóm tắt */}
        <div className="lg:col-span-4 xl:col-span-3 min-w-0 flex">
          <section className="bg-panel rounded-xl sm:rounded-2xl border border-border-standard/80 shadow-md sm:shadow-lg shadow-slate-200/50 overflow-hidden flex flex-col w-full min-h-0">
            <div className="px-3 sm:px-4 py-2 border-b border-border-standard bg-panel/50 shrink-0">
              <h2 className="text-sm font-semibold text-text-main">Tóm tắt chỉ số</h2>
              <p className="text-text-muted text-[10px] mt-0.5 hidden sm:block">Điểm · KLGD · GTGD · CK ↑/↓</p>
            </div>
            <div className="overflow-auto -mx-px flex-1 min-h-0">
              <table className="trading-table">
                <thead>
                  <tr className="bg-panel text-slate-600 font-semibold uppercase tracking-wide text-[10px]">
                    <th className="px-1.5 sm:px-2 py-1.5 whitespace-nowrap">Chỉ số</th>
                    <th className="px-1.5 py-1.5 text-right whitespace-nowrap">Điểm</th>
                    <th className="px-1.5 py-1.5 text-right whitespace-nowrap">+/-</th>
                    <th className="px-1.5 py-1.5 text-right whitespace-nowrap">KLGD</th>
                    <th className="px-1.5 py-1.5 text-right whitespace-nowrap">GTGD</th>
                    <th className="px-1.5 py-1.5 text-right whitespace-nowrap">↑/↓</th>
                  </tr>
                </thead>
                <tbody className="text-text-main divide-y divide-border-subtle">
                  {marketIndexDetailList.length === 0 ? (
                    <tr><td colSpan={6} className="px-2 py-4 text-center text-text-muted text-xs">Đang tải...</td></tr>
                  ) : (
                    marketIndexDetailList.map((row) => {
                      const isUp = row.indexChange != null && row.indexChange >= 0;
                      const chgCls = row.indexChange == null ? 'text-text-main' : isUp ? 'text-positive' : 'text-negative';
                      return (
                        <tr key={row.indexCode} className="hover:bg-panel/80 transition-colors">
                          <td className="px-1.5 sm:px-2 py-1.5 font-medium text-text-main whitespace-nowrap">{row.indexCode}</td>
                          <td className={`px-1.5 py-1.5 text-right font-mono font-medium tabular-nums ${chgCls}`}>
                            {row.indexValue != null ? formatNumberVI(row.indexValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className={`px-1.5 py-1.5 text-right font-mono tabular-nums ${chgCls}`}>
                            {row.indexChange != null ? (row.indexChange >= 0 ? '+' : '') + formatNumberVI(row.indexChange, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-1.5 py-1.5 text-right font-mono text-text-muted tabular-nums text-[11px]">{formatVolumeMillion(row.sumVolume)}</td>
                          <td className="px-1.5 py-1.5 text-right font-mono text-text-muted tabular-nums text-[11px]">{formatValueBillion(row.sumValue)}</td>
                          <td className="px-1.5 py-1.5 text-right whitespace-nowrap text-[11px]">
                            <span className="text-positive font-medium">↑{row.advances}</span>
                            <span className="text-text-muted mx-0.5">_</span>
                            <span className="text-amber-600 font-medium">{row.noChange}</span>
                            <span className="text-text-muted mx-0.5">_</span>
                            <span className="text-negative font-medium">↓{row.declines}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* Bảng giá theo index — full width, tránh tràn màn hình nhỏ */}
      {marketDataContent && (
        <div className="mb-4 sm:mb-6 min-w-0 w-full">
          <section className="bg-panel rounded-xl sm:rounded-2xl border border-border-standard/80 shadow-md sm:shadow-lg shadow-slate-200/50 overflow-hidden w-full">
            <div className="px-3 sm:px-4 py-2.5 border-b border-border-standard bg-panel/50">
              <h2 className="text-sm font-semibold text-text-main">Bảng giá theo index</h2>
              <p className="text-text-muted text-[10px] sm:text-xs mt-0.5 hidden sm:block">Chọn index, tìm mã — click hàng xem biểu đồ</p>
            </div>
            <div className="p-3 sm:p-4 min-w-0 overflow-hidden">
              {marketDataContent}
            </div>
          </section>
        </div>
      )}

      {/* Tin tức — full width ngang với khung bảng giá phía trên */}
      <div className="mt-4 sm:mt-6 w-full min-w-0">
        <div className="bg-panel rounded-xl sm:rounded-2xl border border-border-standard/80 shadow-md sm:shadow-lg shadow-slate-200/50 overflow-hidden w-full min-h-[320px] sm:min-h-[360px] flex flex-col">
          <div className="px-3 sm:px-4 py-2.5 border-b border-border-standard bg-panel/50 shrink-0">
            <h3 className="text-sm font-semibold text-text-main">Tin tức</h3>
            <p className="text-text-muted text-[10px] mt-0.5 hidden sm:block">Nguồn CafeF</p>
          </div>
          <div className="p-3 sm:p-4 space-y-4 flex-1 min-h-0 flex flex-col">
            {newsLoading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-text-muted text-sm">
                Đang tải tin...
              </div>
            ) : newsError ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <p className="text-slate-600 font-medium">Không tải được tin tức</p>
                <p className="text-text-muted text-xs mt-1">{newsError}</p>
                <button type="button" onClick={fetchNews} className="mt-3 px-4 py-2 text-sm font-medium text-accent border border-[#1E3A5F] rounded-lg hover:bg-accent/5">Thử lại</button>
              </div>
            ) : news.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <p className="text-slate-600 font-medium">Chưa có tin mới</p>
                <p className="text-text-muted text-xs mt-1">Tin sẽ hiển thị khi có bản cập nhật.</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={fetchNews} className="px-4 py-2 text-sm font-medium text-slate-600 border border-border-standard rounded-lg hover:bg-panel">Tải lại</button>
                  <button type="button" onClick={() => onNavigate('market')} className="px-4 py-2.5 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90">Xem trang tin</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0">
                  {news.slice(0, 5).map((article, idx) => (
                    <a
                      key={idx}
                      href={typeof article.url === 'string' ? article.url.split(/\s|"/)[0].trim() : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block py-2 border-b border-border-standard last:border-0 last:pb-0"
                    >
                      <div className="flex justify-between text-[10px] text-text-muted mb-1 font-semibold uppercase tracking-wide">
                        <span className="text-accent">CafeF</span>
                        <span>{article.date || '—'}</span>
                      </div>
                      <p className="text-xs text-text-main group-hover:text-slate-900 leading-relaxed font-medium transition-colors line-clamp-2">
                        {article.title}
                      </p>
                    </a>
                  ))}
                </div>
                <div className="pt-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => onNavigate('market')}
                    className="w-full py-2.5 text-xs font-semibold text-slate-600 hover:text-accent hover:bg-panel rounded-xl transition-colors duration-150"
                  >
                    Xem tất cả tin tức
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
