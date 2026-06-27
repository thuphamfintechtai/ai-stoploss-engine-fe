import React, { useState, useEffect, useCallback } from 'react';
import { aiApi, watchlistApi } from '../services/api';
import type { AiResponseMeta } from '../services/api';
import { FinancialTooltip } from './ui/Tooltip';
import { EmptyState } from './ui/EmptyState';
import { InfoCard } from './ui/InfoCard';
import { AiDisclaimer } from './ui/AiDisclaimer';
import { SkeletonCard } from './ui/SkeletonLoader';
import { useActivePortfolio } from '../contexts/ActivePortfolioContext';
import {
  type PortfolioType,
  PORTFOLIO_PRESETS,
  getDataScope,
  formatDataScopeForDisplay,
} from '../utils/portfolioPresets';

// ─── PHS-10 UI Components ───────────────────────────────────────────────────

const TYPE_COLORS: Record<PortfolioType, { bg: string; text: string; border: string }> = {
  LONG_TERM:  { bg: 'rgba(59,130,246,0.12)',  text: 'var(--portfolio-type-long-term)',  border: 'rgba(59,130,246,0.3)' },
  SWING:      { bg: 'rgba(245,158,11,0.12)',  text: 'var(--portfolio-type-swing)',      border: 'rgba(245,158,11,0.3)' },
  DAY_TRADE:  { bg: 'rgba(239,68,68,0.12)',   text: 'var(--portfolio-type-day-trade)',  border: 'rgba(239,68,68,0.3)' },
};

/** Badge showing portfolio strategy type used for AI analysis. */
function TypeBadge({ portfolioType }: { portfolioType: PortfolioType | null | undefined }) {
  if (!portfolioType || !(portfolioType in PORTFOLIO_PRESETS)) return null;
  const preset = PORTFOLIO_PRESETS[portfolioType];
  const colors = TYPE_COLORS[portfolioType];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
      role="status"
      aria-label={`Phân tích theo chiến lược ${preset.label}`}
    >
      Phân tích cho {preset.label}
    </span>
  );
}

/** Chip showing data scope used for AI analysis: timeframe · bars · sources */
function DataDepthChip({ dataScope }: {
  dataScope: { timeframe: string; history_bars: number; extra_sources: readonly string[] | string[] } | null | undefined;
}) {
  if (!dataScope) return null;
  // Normalize readonly to mutable for formatDataScopeForDisplay
  const scope = {
    timeframe: dataScope.timeframe as '5m' | '1D',
    history_bars: dataScope.history_bars,
    extra_sources: [...dataScope.extra_sources],
  };
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] text-text-dim"
      style={{ background: 'var(--color-panel-secondary)', border: '1px solid var(--color-border-subtle)' }}
      role="note"
      aria-label={`Dữ liệu phân tích: ${dataScope.timeframe}, ${dataScope.history_bars} bars`}
    >
      {formatDataScopeForDisplay(scope)}
    </span>
  );
}

/** Per-type insight card variant showing type-specific technical signals. */
function InsightCardVariant({ portfolioType, data }: {
  portfolioType: PortfolioType | null | undefined;
  data: any;
}) {
  if (!portfolioType || !data) return null;

  if (portfolioType === 'DAY_TRADE') {
    return (
      <div className="border-l-4 pl-3 mt-2" style={{ borderColor: 'rgba(239,68,68,0.5)' }}>
        {data.rsi7 != null && (
          <div className="text-[12px] font-bold text-text-main">RSI(7): {(data.rsi7 as number).toFixed(1)}</div>
        )}
        {data.volume_z_score != null && (data.volume_z_score as number) > 2 && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-warning/20 text-warning">Vol spike</span>
        )}
        <span className="text-[9px] text-text-dim ml-1">T+2.5</span>
      </div>
    );
  }

  if (portfolioType === 'LONG_TERM') {
    const meta = data as AiResponseMeta;
    return (
      <div className="border-l-4 pl-3 mt-2" style={{ borderColor: 'rgba(59,130,246,0.5)' }}>
        {meta.valuation?.pe_ratio != null && (
          <div className="text-[11px] font-semibold text-accent">
            P/E: {meta.valuation.pe_ratio.toFixed(1)}
          </div>
        )}
        {meta.valuation?.is_stale && (
          <div className="text-[10px] text-warning italic">Dữ liệu cơ bản cũ</div>
        )}
        {meta.sectorTrend && (
          <div className="text-[10px] text-text-muted">
            Ngành: {meta.sectorTrend.avg_pct_change_1w?.toFixed(1) ?? '—'}%/tuần
          </div>
        )}
        <div className="text-[9px] text-text-dim mt-1">(Khuyến nghị giữ 6-12 tháng)</div>
      </div>
    );
  }

  // SWING: no extra variant by default
  return null;
}

// ────────────────────────────────────────────────────────────────────────────

interface Props {
  traders?: any[];
  onAiCheck?: (trader: any) => void;
  analyzingId?: string | null;
  insightContent?: any;
  insightTrader?: any;
  onNavigate: (view: string) => void;
}

const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);
const fmtPrice = (v: number | null | undefined) =>
  v != null ? toPoint(v).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

/** Kết quả AI phân tích cho một symbol */
interface AiResult {
  symbol: string;
  exchange: string;
  current_price: number;
  suggestions?: Array<{
    type: 'aggressive' | 'moderate' | 'conservative';
    label: string;
    stop_loss_vnd: number;
    take_profit_vnd: number | null;
    rr_ratio: number | null;
  }>;
  technical_score?: number | null;
  technical_label?: string | null;
  analysis_text?: string | null;
  disclaimer?: string | null;
  recommended?: string;
  data_insufficient?: boolean;
  recommendation_id?: string | null;
  ai_source?: string;
  /** PHS-10: meta from BE with dataScope, portfolioType, valuation, sectorTrend */
  meta?: AiResponseMeta | null;
  generated_at: string;
}

/** Badge nguồn AI: gemini → "Gemini AI" (accent), khác → "Tự động" (muted). */
const AiSourceBadge: React.FC<{ source?: string }> = ({ source }) => {
  if (!source) return null;
  const isGemini = source === 'gemini';
  return (
    <span
      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
        isGemini ? 'bg-accent/15 text-accent' : 'bg-warning/15 text-warning'
      }`}
      title={isGemini ? 'Phân tích bởi Gemini AI' : 'Phân tích tự động (fallback khi AI không khả dụng)'}
    >
      {isGemini ? 'Gemini AI' : 'Tự động'}
    </span>
  );
};

export const AiSignalsView: React.FC<Props> = ({ onNavigate }) => {
  const { activePortfolio } = useActivePortfolio();
  const portfolioType = activePortfolio?.portfolio_type as PortfolioType | undefined;

  const [watchlist, setWatchlist] = useState<{ symbol: string; exchange: string }[]>([]);
  const [results, setResults] = useState<Record<string, AiResult>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  // C-03: optimistic apply tracking — applied rec IDs shown immediately
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const wlRes = await watchlistApi.getAll();
      const wl: { symbol: string; exchange: string }[] = wlRes.data?.success
        ? wlRes.data.data.map((i: any) => ({ symbol: i.symbol, exchange: i.exchange }))
        : [];
      setWatchlist(wl);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  const analyzeSymbol = async (symbol: string, exchange: string) => {
    if (analyzing[symbol]) return;
    setAnalyzing(prev => ({ ...prev, [symbol]: true }));
    try {
      const res = await aiApi.suggestSLTP({
        symbol,
        exchange,
        side: 'LONG',
        rr_ratio: 2,
        portfolio_id: activePortfolio?.id, // PHS-10: inject active portfolio_id
      });
      if (res.data?.success) {
        const d = res.data.data;
        setResults(prev => ({
          ...prev,
          [symbol]: {
            symbol:            d.symbol ?? symbol,
            exchange:          d.exchange ?? exchange,
            current_price:     d.current_price,
            suggestions:       d.suggestions,
            technical_score:   typeof d.technical_score === 'object' ? d.technical_score?.score : d.technical_score ?? null,
            technical_label:   typeof d.technical_score === 'object' ? d.technical_score?.label : d.technical_label ?? null,
            analysis_text:     d.analysis_text ?? null,
            disclaimer:        d.disclaimer ?? null,
            recommended:       d.recommended,
            data_insufficient: d.data_insufficient,
            recommendation_id: d.recommendation_id ?? null,
            ai_source:         d.ai_source ?? null,
            meta:              d.meta ?? null, // PHS-10: capture dataScope + portfolioType
            generated_at:      new Date().toISOString(),
          }
        }));
        setSelected(symbol);
      }
    } catch { /* ignore */ }
    finally { setAnalyzing(prev => ({ ...prev, [symbol]: false })); }
  };

  // C-03: optimistic apply — UI updates immediately, rolls back on API failure
  const handleApply = async (recId: string, level: string) => {
    setApplyingId(recId);
    // Optimistic: mark as applied before API call
    setAppliedIds(prev => new Set([...prev, recId]));
    try {
      await aiApi.applyRecommendation(recId, level as any);
      // Confirmed — optimistic state stays
    } catch (err: any) {
      // Rollback optimistic state
      setAppliedIds(prev => {
        const next = new Set(prev);
        next.delete(recId);
        return next;
      });
      // Surface toast for rollback feedback
      window.dispatchEvent(new CustomEvent('toast:show', {
        detail: {
          title: 'Áp dụng thất bại',
          message: err?.message ?? 'Vui lòng thử lại',
          severity: 'WARNING',
        },
      }));
    } finally {
      setApplyingId(null);
    }
  };

  const sel = selected ? results[selected] : null;
  const selWl = selected ? watchlist.find(w => w.symbol === selected) : null;

  const scoreCls = (score?: number | null) =>
    score == null ? 'text-text-dim' : score >= 70 ? 'text-positive' : score >= 50 ? 'text-warning' : 'text-negative';

  return (
    <div className="flex flex-col lg:flex-row gap-3 lg:h-[calc(100vh-120px)] animate-fade-in">

      {/* ── LEFT: Watchlist phân tích ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-[16px] font-bold text-text-main">AI phân tích SL/TP</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Gợi ý dừng lỗ và chốt lời cho các mã đang theo dõi</p>
            {/* PHS-10: TypeBadge + DataDepthChip */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <TypeBadge portfolioType={portfolioType} />
              {portfolioType && (
                <DataDepthChip dataScope={getDataScope(portfolioType)} />
              )}
            </div>
          </div>
          <button
            onClick={loadWatchlist}
            className="p-1.5 rounded text-text-dim hover:text-text-main hover:bg-panel-hover transition-colors"
            title="Tải lại watchlist"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto dense-scroll">
          <div className="mb-3">
            <InfoCard title="AI Gợi Ý là gì?" variant="tip" defaultOpen={false}>
              <p>Hệ thống AI phân tích dữ liệu kỹ thuật (<FinancialTooltip term="ATR" />, Bollinger Band, volume) để gợi ý mức <FinancialTooltip term="Stop Loss" /> và <FinancialTooltip term="Take Profit" /> tối ưu.</p>
              <p className="mt-1 text-text-muted text-[11px]">Đây là gợi ý tham khảo, không phải lời khuyên đầu tư. Hãy kết hợp với phân tích cá nhân.</p>
            </InfoCard>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 pb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} className="h-40" />
              ))}
            </div>
          ) : watchlist.length === 0 ? (
            <EmptyState
              title="Chưa có gợi ý AI"
              description="AI đang phân tích thị trường. Gợi ý sẽ xuất hiện khi có tín hiệu đáng chú ý."
              actionLabel="Thêm mã theo dõi"
              onAction={() => onNavigate('watchlist')}
            />
          ) : (
            <>
              {/* AIT-08: disclaimer covers all AI cards in the grid */}
              <div className="px-1 pb-2">
                <AiDisclaimer compact />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 pb-4">
              {watchlist.map((item) => {
                const res = results[item.symbol];
                const isSelected = selected === item.symbol;
                const isAn = analyzing[item.symbol];
                const rec = res?.suggestions?.find(s => s.type === (res.recommended ?? 'moderate')) ?? res?.suggestions?.[0];

                return (
                  <div
                    key={item.symbol}
                    onClick={() => res && setSelected(item.symbol)}
                    className={`panel-section p-4 flex flex-col gap-3 transition-all ${res ? 'cursor-pointer hover:border-accent/30' : ''} ${isSelected ? 'border border-accent/40' : 'border border-transparent'}`}
                  >
                    {/* Symbol header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-bold text-text-main">{item.symbol}</span>
                        <span className="text-[9px] text-text-dim">{item.exchange}</span>
                        {res?.ai_source && <AiSourceBadge source={res.ai_source} />}
                      </div>
                      {res?.technical_score != null ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          res.technical_score >= 70 ? 'bg-positive/20 text-positive border border-positive/30'
                          : res.technical_score >= 50 ? 'bg-warning/20 text-warning border border-warning/30'
                          : 'bg-negative/20 text-negative border border-negative/30'
                        }`}>
                          {res.technical_label === 'HOP_LY' ? 'Hợp Lý'
                            : res.technical_label === 'TRUNG_BINH' ? 'Trung Bình'
                            : res.technical_label === 'YEU' ? 'Yếu'
                            : res.technical_score >= 70 ? 'Tốt'
                            : res.technical_score >= 50 ? 'TB'
                            : 'Yếu'}
                        </span>
                      ) : (
                        <span className="text-[9px] text-text-dim border border-border-standard rounded px-2 py-0.5">Chưa phân tích</span>
                      )}
                    </div>

                    {/* Result */}
                    {res ? (
                      <>
                        {res.data_insufficient ? (
                          <p className="text-[10px] text-warning">Không đủ dữ liệu lịch sử để phân tích (cần &ge; 14 phiên)</p>
                        ) : rec ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[8px] text-text-dim uppercase tracking-wide mb-0.5">Giá hiện tại</p>
                              <p className="text-[11px] font-mono font-semibold text-text-main">{fmtPrice(res.current_price)}</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-text-dim uppercase tracking-wide mb-0.5">Score</p>
                              <p className={`text-[11px] font-bold ${scoreCls(res.technical_score)}`}>{res.technical_score ?? '—'}/100</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-text-dim uppercase tracking-wide mb-0.5"><FinancialTooltip term="Stop Loss" /></p>
                              <p className="text-[11px] font-mono text-negative font-semibold">{fmtPrice(rec.stop_loss_vnd)}</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-text-dim uppercase tracking-wide mb-0.5"><FinancialTooltip term="Take Profit" /></p>
                              <p className="text-[11px] font-mono text-positive font-semibold">{fmtPrice(rec.take_profit_vnd)}</p>
                            </div>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-text-dim">
                            {new Date(res.generated_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); analyzeSymbol(item.symbol, item.exchange); }}
                            disabled={isAn}
                            className="text-[9px] text-accent hover:underline disabled:opacity-50 flex items-center gap-1"
                          >
                            {isAn && <span className="w-2.5 h-2.5 border border-accent border-t-transparent rounded-full animate-spin" />}
                            Phân tích lại
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); analyzeSymbol(item.symbol, item.exchange); }}
                        disabled={isAn}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-md bg-accent/10 text-accent font-semibold text-[11px] hover:bg-accent/20 transition-colors disabled:opacity-50 border border-accent/20"
                      >
                        {isAn ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                            <span>Đang phân tích...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            <span>Phân tích AI SL/TP</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT: Chi tiết phân tích ─────────────────────────────────── */}
      <div className="w-full lg:w-[360px] lg:shrink-0 panel-section flex flex-col lg:max-h-none max-h-[70vh]">
        <div className="px-4 py-2.5 border-b border-border-subtle shrink-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {sel ? `Chi tiết – ${selected}` : 'Chi Tiết Phân Tích'}
          </span>
        </div>

        {!sel ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12 text-text-dim">
            <svg className="w-10 h-10 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="text-[12px] text-center px-4">Nhấn "Phân tích AI SL/TP" cho một mã để xem gợi ý</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto dense-scroll">
            {/* Technical score */}
            {sel.technical_score != null && (
              <div className="px-4 py-3 border-b border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Điểm Kỹ Thuật</span>
                  <span className={`text-[13px] font-bold ${scoreCls(sel.technical_score)}`}>{sel.technical_score}/100</span>
                </div>
                <div className="h-2 rounded-full bg-panel-hover overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full transition-all ${sel.technical_score >= 70 ? 'bg-positive' : sel.technical_score >= 50 ? 'bg-warning' : 'bg-negative'}`}
                    style={{ width: `${sel.technical_score}%` }}
                  />
                </div>
                <p className="text-[9px] text-text-dim">
                  {sel.technical_label === 'HOP_LY' ? 'Vùng SL hợp lý — ATR phù hợp với biến động thị trường'
                    : sel.technical_label === 'TRUNG_BINH' ? 'SL ở mức trung bình — có thể bị noise'
                    : sel.technical_label === 'YEU' ? 'SL quá gần — rủi ro bị quét cao'
                    : 'Đang đánh giá vùng SL phù hợp với biến động'}
                </p>
              </div>
            )}

            {/* Giá hiện tại */}
            <div className="px-4 py-3 border-b border-border-subtle">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-text-dim">Giá hiện tại ({sel.symbol})</span>
                <span className="text-[14px] font-mono font-bold text-text-main">{fmtPrice(sel.current_price)}</span>
              </div>
              {/* PHS-10: DataDepthChip from meta.dataScope */}
              {(sel.meta?.dataScope || portfolioType) && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <TypeBadge portfolioType={(sel.meta?.portfolioType as PortfolioType) ?? portfolioType} />
                  <DataDepthChip dataScope={sel.meta?.dataScope ?? getDataScope(portfolioType)} />
                </div>
              )}
              {/* Per-type insight variant */}
              <InsightCardVariant portfolioType={(sel.meta?.portfolioType as PortfolioType) ?? portfolioType} data={sel.meta} />
            </div>

            {/* 3 mức SL/TP */}
            {!sel.data_insufficient && sel.suggestions && sel.suggestions.length > 0 && (
              <div className="px-4 py-3 border-b border-border-subtle space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-text-dim mb-2">Các Mức Gợi Ý</p>
                {(['aggressive', 'moderate', 'conservative'] as const).map((type) => {
                  const s = sel.suggestions!.find(x => x.type === type);
                  if (!s) return null;
                  const isRec = sel.recommended === type;
                  return (
                    <div key={type} className={`p-2.5 rounded-lg border ${isRec ? 'border-accent bg-accent/8' : 'border-border-standard bg-background/50'}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className={`text-[9px] font-black ${type === 'aggressive' ? 'text-negative' : type === 'moderate' ? 'text-accent' : 'text-positive'}`}>
                          {type === 'aggressive' ? 'TÍCH CỰC' : type === 'moderate' ? 'CÂN BẰNG' : 'THẬN TRỌNG'}
                          {isRec && <span className="ml-1 text-warning">★ KN</span>}
                        </span>
                        <span className="text-[9px] text-text-dim"><FinancialTooltip term="R:R Ratio" /> {s.rr_ratio?.toFixed(1) ?? '—'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                        <div>SL <span className="text-negative font-bold">{fmtPrice(s.stop_loss_vnd)}</span></div>
                        <div>TP <span className="text-positive font-bold">{fmtPrice(s.take_profit_vnd)}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Analysis text */}
            {sel.analysis_text && (
              <div className="px-4 py-3 border-b border-border-subtle">
                <p className="text-[9px] font-bold uppercase tracking-wider text-text-dim mb-1.5">Nhận Xét AI</p>
                <p className="text-[11px] text-text-muted leading-relaxed">{sel.analysis_text}</p>
              </div>
            )}

            {/* Disclaimer — BẮT BUỘC */}
            {sel.disclaimer && (
              <div className="px-4 py-3 border-b border-border-subtle">
                <div className="p-2.5 rounded-lg bg-warning/5 border border-warning/20">
                  <p className="text-[8px] text-warning/80 leading-relaxed">{sel.disclaimer}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => { if (selWl) analyzeSymbol(selWl.symbol, selWl.exchange); }}
                  disabled={analyzing[selected!]}
                  className="flex-1 py-2 rounded bg-accent/15 text-accent text-[11px] font-semibold hover:bg-accent/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {analyzing[selected!] && <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
                  Phân tích lại
                </button>
                <button
                  onClick={() => onNavigate('terminal')}
                  className="flex-1 py-2 rounded bg-positive/15 text-positive text-[11px] font-semibold hover:bg-positive/25 transition-colors"
                >
                  Đặt Lệnh
                </button>
              </div>
              {/* C-03: Apply recommendation với optimistic UI */}
              {sel.recommendation_id && !sel.data_insufficient && (
                <button
                  onClick={() => handleApply(sel.recommendation_id!, sel.recommended ?? 'moderate')}
                  disabled={applyingId === sel.recommendation_id || appliedIds.has(sel.recommendation_id!)}
                  className={`w-full py-1.5 rounded border text-[9px] transition-colors disabled:opacity-40 ${
                    appliedIds.has(sel.recommendation_id!)
                      ? 'border-positive/40 text-positive bg-positive/5'
                      : 'border-border-standard text-text-dim hover:text-text-muted'
                  }`}
                >
                  {applyingId === sel.recommendation_id
                    ? 'Đang lưu...'
                    : appliedIds.has(sel.recommendation_id!)
                    ? 'Đã áp dụng'
                    : 'Đánh dấu đã áp dụng gợi ý'}
                </button>
              )}
              <div className="text-[9px] text-text-dim text-center">
                Phân tích lúc {new Date(sel.generated_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </div>
              {/* AIT-08: Disclaimer mandatory ở footer mọi AI output (D-08) */}
              <AiDisclaimer />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
