import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { marketApi } from '../services/api';
import { MARKET_INDEX_CODES } from '../constants';

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

export const HomeView: React.FC<Props> = ({ onNavigate, totalBalance, riskUsed, maxRisk, marketDataContent }) => {
  const [cardCodes, setCardCodes] = useState<string[]>(defaultIndices);
  const [indexData, setIndexData] = useState<Record<string, ReturnType<typeof normalizeIndexData>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

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
    setNewsLoading(true);
    marketApi.getNews({ limit: 5, format: 'json' })
      .then((res) => {
        const data = (res.data as any);
        if (data?.success && Array.isArray(data?.articles)) {
          setNews(data.articles);
        }
      })
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, []);

  const setCardCode = (cardIndex: number, newCode: string) => {
    setCardCodes((prev) => {
      const next = [...prev];
      next[cardIndex] = newCode;
      return next;
    });
  };

  const formatVolume = (v: number) => {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + ' Tỷ';
    if (v >= 1e6) return (v / 1e6).toFixed(0) + ' Tr';
    return v?.toLocaleString('vi-VN') ?? '0';
  };

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6">
      {/* Chỉ số trong ngày - gọn, ít khung bo */}
      <section className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-[#111827]">Chỉ số trong ngày</h2>
          <p className="text-[#6B7280] text-xs mt-0.5">Cập nhật theo phiên giao dịch</p>
        </div>
        {error && (
          <div className="mx-4 mb-3 py-2 px-3 bg-amber-50 text-amber-800 text-xs border-l-4 border-amber-400">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-px md:bg-[#E5E7EB]">
          {[0, 1, 2].map((i) => {
            const code = cardCodes[i] ?? defaultIndices[i];
            const data = indexData[code];
            const isUp = data ? data.change >= 0 : true;
            const chartPoints = data?.chartData?.length ? data.chartData : [];
            const refValue = chartPoints.length ? chartPoints[0]?.value : data?.value;

            return (
              <div
                key={i}
                className="bg-[#FAFAFA] md:bg-white p-4 flex flex-col min-h-[220px]"
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="relative inline-block">
                    <select
                      value={code}
                      onChange={(e) => setCardCode(i, e.target.value)}
                      className="appearance-none bg-transparent text-[#111827] text-sm font-semibold border-none py-1 pr-6 cursor-pointer focus:ring-0 focus:outline-none w-full min-w-[90px] text-[#1E3A5F]"
                    >
                      {MARKET_INDEX_CODES.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {loading && !data && (
                    <span className="text-[#64748B] text-xs font-medium">Đang tải...</span>
                  )}
                </div>

                {data ? (
                  <>
                    <div className="mt-4">
                      <p className={`text-3xl font-bold tabular-nums tracking-tight ${isUp ? 'text-[#0B6E4B]' : 'text-[#A63D3D]'}`}>
                        {Number(data.value).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <div className={`inline-flex items-center gap-1.5 mt-1.5 text-sm font-medium ${isUp ? 'text-[#0B6E4B]' : 'text-[#A63D3D]'}`}>
                        {isUp ? (
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                        ) : (
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                        )}
                        <span>
                          {data.change >= 0 ? '+' : ''}{Number(data.change).toFixed(2)} <span className="text-[#64748B] font-normal">({data.changePercent >= 0 ? '+' : ''}{Number(data.changePercent).toFixed(2)}%)</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 h-12 min-h-[48px] bg-[#F5F5F5] overflow-hidden flex-shrink-0">
                      {chartPoints.length > 0 ? (
                        <ResponsiveContainer width="100%" height={48}>
                          <LineChart data={chartPoints} margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
                            <ReferenceLine y={refValue} stroke="#94A3B8" strokeDasharray="3 3" strokeOpacity={0.8} />
                            <XAxis dataKey="time" hide />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke={isUp ? '#0B6E4B' : '#A63D3D'}
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-[#94A3B8] text-sm">Chưa có dữ liệu biểu đồ</div>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#E5E7EB] space-y-1 text-sm">
                      {data.volume > 0 && (
                        <p className="text-[#64748B] text-sm">
                          <span className="font-medium text-[#475569]">KL:</span>{' '}
                          {Number(data.volume).toLocaleString('vi-VN')} CP
                        </p>
                      )}
                      {data.totalValue > 0 && (
                        <p className="text-[#64748B] text-sm">
                          <span className="font-medium text-[#475569]">Giá trị:</span>{' '}
                          {formatVolume(data.totalValue)} <span className="text-[#94A3B8]">Đóng cửa</span>
                        </p>
                      )}
                      {(data.advancing > 0 || data.unchanged > 0 || data.declining > 0) && (
                        <div className="flex items-center gap-4 pt-1.5">
                          <span className="inline-flex items-center gap-1 text-[#0B6E4B] text-sm font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                            {data.advancing} tăng
                          </span>
                          <span className="text-[#64748B] text-sm">{data.unchanged} đứng giá</span>
                          <span className="inline-flex items-center gap-1 text-[#A63D3D] text-sm font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                            {data.declining} giảm
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  !loading && (
                    <div className="flex-1 flex items-center justify-center text-[#94A3B8] text-sm py-8">
                      Chọn mã chỉ số ở trên
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột trái: Tất cả mã chứng khoán (Dữ liệu thị trường) - từ App */}
        {marketDataContent && (
          <div className="lg:col-span-2 space-y-4">
            {marketDataContent}
          </div>
        )}
        {/* Cột phải: Tin tức */}
        <div className={marketDataContent ? 'space-y-6' : 'lg:col-span-3 space-y-6'}>
          <div className="card-flat p-4 rounded-lg space-y-4">
            <h3 className="text-sm font-semibold text-[#111827] border-b border-[#E5E7EB] pb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125v18.75c0 .621-.504 1.125-1.125 1.125h-3.375m0-3H21m-3.75 3H21m-3.75 3h-3.375m0-3H21" /></svg>
              Tin Tức Mới
            </h3>
            <div className="space-y-4">
              {newsLoading ? (
                <p className="text-xs text-[#6B7280]">Đang tải tin...</p>
              ) : news.length === 0 ? (
                <p className="text-xs text-[#6B7280]">Chưa có tin mới.</p>
              ) : (
                news.slice(0, 5).map((article, idx) => (
                  <a
                    key={idx}
                    href={typeof article.url === 'string' ? article.url.split(/\s|"/)[0].trim() : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <div className="flex justify-between text-[10px] text-[#6B7280] mb-1 font-semibold uppercase tracking-wide">
                      <span className="text-[#1E3A5F]">CafeF</span>
                      <span>{article.date || '—'}</span>
                    </div>
                    <p className="text-xs text-[#374151] group-hover:text-[#111827] leading-relaxed font-medium transition-colors line-clamp-2">
                      {article.title}
                    </p>
                  </a>
                ))
              )}
            </div>
            <div className="pt-2 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => onNavigate('market')}
                className="w-full py-2 text-xs font-semibold text-[#6B7280] hover:text-[#1E3A5F] hover:bg-[#F3F4F6] rounded-lg transition-colors duration-150"
              >
                Xem tất cả tin tức
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
