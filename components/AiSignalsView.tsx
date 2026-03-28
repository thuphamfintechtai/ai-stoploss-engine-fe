import React, { useState, useEffect, useCallback } from 'react';
import { aiApi, watchlistApi } from '../services/api';
import { FinancialTooltip } from './ui/Tooltip';
import { EmptyState } from './ui/EmptyState';
import { InfoCard } from './ui/InfoCard';

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
  generated_at: string;
}

export const AiSignalsView: React.FC<Props> = ({ onNavigate }) => {
  const [watchlist, setWatchlist] = useState<{ symbol: string; exchange: string }[]>([]);
  const [results, setResults] = useState<Record<string, AiResult>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

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
      const res = await aiApi.suggestSLTP({ symbol, exchange, side: 'LONG', rr_ratio: 2 });
      if (res.data?.success) {
        const d = res.data.data;
        setResults(prev => ({
          ...prev,
          [symbol]: {
            symbol:            d.symbol ?? symbol,
            exchange:          d.exchange ?? exchange,
            current_price:     d.current_price,
            suggestions:       d.suggestions,
            technical_score:   d.technical_score ?? null,
            technical_label:   d.technical_label ?? null,
            analysis_text:     d.analysis_text ?? null,
            disclaimer:        d.disclaimer ?? null,
            recommended:       d.recommended,
            data_insufficient: d.data_insufficient,
            recommendation_id: d.recommendation_id ?? null,
            generated_at:      new Date().toISOString(),
          }
        }));
        setSelected(symbol);
      }
    } catch { /* ignore */ }
    finally { setAnalyzing(prev => ({ ...prev, [symbol]: false })); }
  };

  const handleApply = async (recId: string, level: string) => {
    setApplyingId(recId);
    try {
      await aiApi.applyRecommendation(recId, level as any);
    } catch { /* ignore */ }
    finally { setApplyingId(null); }
  };

  const sel = selected ? results[selected] : null;
  const selWl = selected ? watchlist.find(w => w.symbol === selected) : null;

  const scoreCls = (score?: number | null) =>
    score == null ? 'text-text-dim' : score >= 70 ? 'text-positive' : score >= 50 ? 'text-warning' : 'text-negative';

  return (
    <div className="flex gap-3 h-[calc(100vh-120px)] animate-fade-in">

      {/* ── LEFT: Watchlist phân tích ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-[16px] font-bold text-text-main">AI Phân Tích SL/TP</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Gợi ý dừng lỗ và chốt lời cho các mã đang theo dõi</p>
          </div>
          <button
            onClick={loadWatchlist}
            className="p-1.5 rounded text-text-dim hover:text-text-main hover:bg-white/5 transition-colors"
            title="Tải lại watchlist"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto dense-scroll">
          <div className="mb-3">
            <InfoCard title="AI Goi Y la gi?" variant="tip" defaultOpen={false}>
              <p>He thong AI phan tich du lieu ky thuat (<FinancialTooltip term="ATR" />, Bollinger Band, volume) de goi y muc <FinancialTooltip term="Stop Loss" /> va <FinancialTooltip term="Take Profit" /> toi uu.</p>
              <p className="mt-1 text-text-muted text-[11px]">Day la goi y tham khao, khong phai loi khuyen dau tu. Hay ket hop voi phan tich ca nhan.</p>
            </InfoCard>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : watchlist.length === 0 ? (
            <EmptyState
              title="Chua co goi y AI"
              description="AI dang phan tich thi truong. Goi y se xuat hien khi co tin hieu dang chu y."
              actionLabel="Them ma theo doi"
              onAction={() => onNavigate('watchlist')}
            />
          ) : (
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
                      <div>
                        <span className="text-[14px] font-bold text-text-main">{item.symbol}</span>
                        <span className="text-[9px] text-text-dim ml-2">{item.exchange}</span>
                      </div>
                      {res?.technical_score != null ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          res.technical_score >= 70 ? 'bg-positive/15 text-positive'
                          : res.technical_score >= 50 ? 'bg-warning/15 text-warning'
                          : 'bg-negative/15 text-negative'
                        }`}>
                          {res.technical_label === 'HOP_LY' ? 'Hợp Lý'
                            : res.technical_label === 'TRUNG_BINH' ? 'Trung Bình'
                            : res.technical_label === 'YEU' ? 'Yếu'
                            : `${res.technical_score}/100`}
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
                        className="flex items-center justify-center gap-2 py-2 rounded-md bg-accent/10 text-accent font-semibold text-[11px] hover:bg-accent/20 transition-colors disabled:opacity-50 border border-accent/20"
                      >
                        {isAn ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            Đang phân tích...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            Phân tích AI SL/TP
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Chi tiết phân tích ─────────────────────────────────── */}
      <div className="w-[360px] shrink-0 panel-section flex flex-col">
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
                <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full transition-all ${sel.technical_score >= 70 ? 'bg-positive' : sel.technical_score >= 50 ? 'bg-warning' : 'bg-negative'}`}
                    style={{ width: `${sel.technical_score}%` }}
                  />
                </div>
                <p className="text-[9px] text-text-dim">
                  {sel.technical_label === 'HOP_LY' ? 'Vùng SL hợp lý — ATR phù hợp với biến động thị trường'
                    : sel.technical_label === 'TRUNG_BINH' ? 'SL ở mức trung bình — có thể bị noise'
                    : 'SL quá gần — rủi ro bị quét cao'}
                </p>
              </div>
            )}

            {/* Giá hiện tại */}
            <div className="px-4 py-3 border-b border-border-subtle">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-text-dim">Giá hiện tại ({sel.symbol})</span>
                <span className="text-[14px] font-mono font-bold text-text-main">{fmtPrice(sel.current_price)}</span>
              </div>
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
              {/* Apply recommendation để tracking */}
              {sel.recommendation_id && !sel.data_insufficient && (
                <button
                  onClick={() => handleApply(sel.recommendation_id!, sel.recommended ?? 'moderate')}
                  disabled={applyingId === sel.recommendation_id}
                  className="w-full py-1.5 rounded border border-border-standard text-[9px] text-text-dim hover:text-text-muted transition-colors disabled:opacity-40"
                >
                  {applyingId === sel.recommendation_id ? 'Đang lưu...' : 'Đánh dấu đã áp dụng gợi ý'}
                </button>
              )}
              <div className="text-[9px] text-text-dim text-center">
                Phân tích lúc {new Date(sel.generated_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
