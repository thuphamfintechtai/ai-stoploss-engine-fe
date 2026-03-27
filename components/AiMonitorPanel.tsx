import React, { useState, useCallback, useEffect, useRef } from 'react';
import { aiApi, positionApi } from '../services/api';
import type { Position } from '../services/api';
import { formatNumberVI } from '../constants';
import wsService from '../services/websocket';

interface DynamicSLUpdate {
  symbol: string;
  old_sl: number;
  new_sl: number;
  regime: 'VOLATILE' | 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  atr_value?: number;
  atr_multiplier?: number;
  narrative: string;
  timestamp: string;
}

interface PositionReview {
  position_id: string;
  symbol: string;
  action: 'HOLD' | 'TIGHTEN_SL' | 'TAKE_PARTIAL' | 'EXIT';
  new_stop_loss?: number | null;
  new_take_profit?: number | null;
  reasoning: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  key_concern?: string;
}

interface ReviewResult {
  id?: string;
  positions_reviewed: number;
  recommendations: PositionReview[];
  portfolio_health_score: number;
  current_prices: Record<string, number>;
  reviewed_at: string;
}

interface HistoryRecord {
  id: string;
  positions_reviewed: number;
  portfolio_health_score: number;
  recommendations: PositionReview[];
  current_prices: Record<string, number>;
  applied_count: number;
  created_at: string;
}

interface Props {
  portfolioId: string | null;
  openPositions: Position[];
  onNavigate: (view: string) => void;
}

const ACTION_CONFIG: Record<string, { label: string; cls: string; bg: string }> = {
  HOLD:         { label: 'Giữ nguyên',    cls: 'text-positive',  bg: 'bg-positive/10 border-positive/30' },
  TIGHTEN_SL:   { label: 'Kéo SL lên',    cls: 'text-accent',    bg: 'bg-accent/10 border-accent/30' },
  TAKE_PARTIAL: { label: 'Chốt một phần', cls: 'text-warning',   bg: 'bg-warning/10 border-warning/30' },
  EXIT:         { label: 'Đóng ngay',     cls: 'text-negative',  bg: 'bg-negative/10 border-negative/30' },
};

const URGENCY_DOT: Record<string, string> = {
  LOW:    'bg-text-muted',
  MEDIUM: 'bg-warning',
  HIGH:   'bg-negative animate-pulse',
};

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-positive' : score >= 50 ? 'bg-warning' : 'bg-negative';
  const textColor = score >= 80 ? 'text-positive' : score >= 50 ? 'text-warning' : 'text-negative';
  const label = score >= 80 ? 'Tốt' : score >= 50 ? 'Trung bình' : 'Cần chú ý';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-border-subtle overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[12px] font-bold font-mono ${textColor}`}>{score}/100</span>
      <span className={`text-[10px] font-semibold ${textColor}`}>{label}</span>
    </div>
  );
}

function RecommendationList({
  recommendations,
  currentPrices,
  openPositions,
  onApply,
  applying,
  applied,
}: {
  recommendations: PositionReview[];
  currentPrices: Record<string, number>;
  openPositions: Position[];
  onApply: (rec: PositionReview) => void;
  applying: string | null;
  applied: Set<string>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {recommendations.map((rec) => {
        const cfg = ACTION_CONFIG[rec.action] ?? ACTION_CONFIG.HOLD;
        const isExpanded = expandedId === rec.position_id;
        const pos = openPositions.find(p => p.id === rec.position_id);
        const currentPrice = currentPrices[rec.symbol];
        const isApplied = applied.has(rec.position_id);
        const isApplying = applying === rec.position_id;
        const hasAction = rec.action !== 'HOLD' && !isApplied;

        return (
          <div key={rec.position_id} className={`panel-section border ${cfg.bg} transition-all`}>
            <div
              className="flex items-center gap-3 p-3 cursor-pointer select-none"
              onClick={() => setExpandedId(isExpanded ? null : rec.position_id)}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${URGENCY_DOT[rec.urgency]}`} />
              <span className="text-[13px] font-bold text-text-main min-w-[56px]">{rec.symbol}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.cls}`}>
                {cfg.label}
              </span>
              {currentPrice && (
                <span className="text-[11px] font-mono text-text-muted">
                  {(currentPrice / 1000).toFixed(2)}
                </span>
              )}
              {isApplied && <span className="text-[10px] font-semibold text-positive ml-auto">✓ Đã áp dụng</span>}
              <svg
                className={`w-3.5 h-3.5 text-text-dim ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border-subtle pt-3 space-y-3">
                <p className="text-[12px] text-text-main leading-relaxed">{rec.reasoning}</p>
                {rec.key_concern && (
                  <p className="text-[11px] text-text-muted italic">⚠ {rec.key_concern}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {pos && (
                    <div className="p-2 rounded-md" style={{ background: 'var(--color-panel-secondary)' }}>
                      <p className="text-[9px] text-text-dim uppercase tracking-wider mb-1">Hiện Tại</p>
                      <p className="text-[11px] font-mono text-text-muted">
                        SL: <span className="text-negative">{pos.stop_loss ? (Number(pos.stop_loss) / 1000).toFixed(2) : '—'}</span>
                      </p>
                      <p className="text-[11px] font-mono text-text-muted">
                        TP: <span className="text-positive">{(pos as any).take_profit ? (Number((pos as any).take_profit) / 1000).toFixed(2) : '—'}</span>
                      </p>
                    </div>
                  )}
                  {(rec.new_stop_loss || rec.new_take_profit) && (
                    <div className="p-2 rounded-md border border-accent/30" style={{ background: 'var(--color-accent-subtle)' }}>
                      <p className="text-[9px] text-accent uppercase tracking-wider mb-1">AI Đề Xuất</p>
                      {rec.new_stop_loss && (
                        <p className="text-[11px] font-mono">SL: <span className="text-negative font-semibold">{(rec.new_stop_loss / 1000).toFixed(2)}</span></p>
                      )}
                      {rec.new_take_profit && (
                        <p className="text-[11px] font-mono">TP: <span className="text-positive font-semibold">{(rec.new_take_profit / 1000).toFixed(2)}</span></p>
                      )}
                    </div>
                  )}
                </div>
                {hasAction && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onApply(rec)}
                      disabled={isApplying}
                      className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                        rec.action === 'EXIT'
                          ? 'bg-negative/20 text-negative hover:bg-negative/30 border border-negative/30'
                          : 'bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30'
                      }`}
                    >
                      {isApplying ? 'Đang áp dụng...' : rec.action === 'EXIT' ? 'Đóng vị thế' : 'Áp dụng đề xuất'}
                    </button>
                    <button
                      onClick={() => setExpandedId(null)}
                      className="px-3 py-1.5 rounded-md text-[11px] text-text-muted border border-border-standard hover:bg-white/5"
                    >
                      Bỏ qua
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryTab({ portfolioId }: { portfolioId: string }) {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    aiApi.getPositionReviewHistory(portfolioId, 30)
      .then(res => { if (res.data?.success) setHistory(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [portfolioId]);

  if (loading) {
    return <div className="panel-section p-6 text-center text-text-muted text-[12px]">Đang tải lịch sử...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="panel-section p-8 text-center">
        <p className="text-text-muted text-[12px]">Chưa có lịch sử review nào</p>
        <p className="text-text-dim text-[11px] mt-1">Chạy "AI Review" lần đầu để bắt đầu lưu lịch sử</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((rec) => {
        const isExpanded = expandedId === rec.id;
        const healthColor = rec.portfolio_health_score >= 80 ? 'text-positive' : rec.portfolio_health_score >= 50 ? 'text-warning' : 'text-negative';
        const exitCount = rec.recommendations?.filter(r => r.action === 'EXIT').length ?? 0;
        const highCount = rec.recommendations?.filter(r => r.urgency === 'HIGH').length ?? 0;

        return (
          <div key={rec.id} className="panel-section">
            <div
              className="flex items-center gap-4 p-3 cursor-pointer select-none"
              onClick={() => setExpandedId(isExpanded ? null : rec.id)}
            >
              {/* Health score */}
              <div className="text-center shrink-0 w-12">
                <p className={`text-[18px] font-bold font-mono ${healthColor}`}>{rec.portfolio_health_score}</p>
                <p className="text-[8px] text-text-dim uppercase">health</p>
              </div>

              {/* Time */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-text-main">
                  {new Date(rec.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {rec.positions_reviewed} vị thế
                  {highCount > 0 && <span className="text-negative ml-2">· {highCount} cảnh báo cao</span>}
                  {exitCount > 0 && <span className="text-negative ml-2">· {exitCount} cần đóng</span>}
                </p>
              </div>

              {/* Applied badge */}
              {rec.applied_count > 0 && (
                <span className="text-[10px] font-semibold text-positive px-2 py-0.5 rounded bg-positive/10 shrink-0">
                  ✓ {rec.applied_count} đã áp dụng
                </span>
              )}

              <svg
                className={`w-3.5 h-3.5 text-text-dim shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {isExpanded && Array.isArray(rec.recommendations) && rec.recommendations.length > 0 && (
              <div className="border-t border-border-subtle px-3 pb-3 pt-2 space-y-1.5">
                {rec.recommendations.map((r, i) => {
                  const cfg = ACTION_CONFIG[r.action] ?? ACTION_CONFIG.HOLD;
                  return (
                    <div key={i} className={`flex items-start gap-2 p-2 rounded-md border ${cfg.bg}`}>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${URGENCY_DOT[r.urgency]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[12px] font-bold text-text-main">{r.symbol}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.cls}`}>{cfg.label}</span>
                        </div>
                        <p className="text-[10px] text-text-muted leading-relaxed">{r.reasoning}</p>
                        {(r.new_stop_loss || r.new_take_profit) && (
                          <p className="text-[10px] font-mono text-text-dim mt-0.5">
                            {r.new_stop_loss && <span className="text-negative">SL→{(r.new_stop_loss / 1000).toFixed(2)} </span>}
                            {r.new_take_profit && <span className="text-positive">TP→{(r.new_take_profit / 1000).toFixed(2)}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const REGIME_CONFIG: Record<string, { label: string; color: string; borderColor: string; bgColor: string }> = {
  VOLATILE:  { label: 'Bien dong',  color: 'text-negative',  borderColor: 'border-negative',  bgColor: 'bg-negative/5' },
  BULLISH:   { label: 'Tang',       color: 'text-positive',  borderColor: 'border-positive',  bgColor: 'bg-positive/5' },
  BEARISH:   { label: 'Giam',       color: 'text-orange-500', borderColor: 'border-orange-400', bgColor: 'bg-orange-500/5' },
  SIDEWAYS:  { label: 'Di ngang',  color: 'text-text-muted', borderColor: 'border-border-standard', bgColor: 'bg-background/50' },
};

export const AiMonitorPanel: React.FC<Props> = ({ portfolioId, openPositions, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  // Dynamic SL Updates (WebSocket)
  const [dynamicSLUpdates, setDynamicSLUpdates] = useState<DynamicSLUpdate[]>([]);
  const dynamicSLRef = useRef<((data: DynamicSLUpdate) => void) | null>(null);

  useEffect(() => {
    const handler = (data: DynamicSLUpdate) => {
      setDynamicSLUpdates(prev => {
        const next = [{ ...data, timestamp: data.timestamp || new Date().toISOString() }, ...prev];
        return next.slice(0, 20); // giu toi da 20 updates
      });
    };
    dynamicSLRef.current = handler;
    wsService.off('DYNAMIC_SL_UPDATE');
    wsService.off('dynamic_sl_update');
    // Listen ca 2 event name (uppercase va lowercase)
    (wsService as any).socket?.on('DYNAMIC_SL_UPDATE', handler);
    (wsService as any).socket?.on('dynamic_sl_update', handler);
    return () => {
      (wsService as any).socket?.off('DYNAMIC_SL_UPDATE', handler);
      (wsService as any).socket?.off('dynamic_sl_update', handler);
    };
  }, []);

  const runReview = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    setApplied(new Set());
    try {
      const res = await aiApi.reviewPositions(portfolioId);
      if (res.data?.success) {
        setResult(res.data.data);
        setActiveTab('current');
      } else {
        setError(res.data?.message || 'Không thể review vị thế');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  const applyRecommendation = useCallback(async (rec: PositionReview) => {
    if (!portfolioId) return;
    const pos = openPositions.find(p => p.id === rec.position_id);
    if (!pos) return;

    setApplying(rec.position_id);
    try {
      if (rec.action === 'EXIT') {
        await positionApi.close(portfolioId, rec.position_id, { reason: 'CLOSED_MANUAL' });
      } else {
        const updateBody: Record<string, any> = {};
        if (rec.new_stop_loss != null) updateBody.stop_loss = rec.new_stop_loss;
        if (rec.new_take_profit != null) updateBody.take_profit = rec.new_take_profit;
        if (Object.keys(updateBody).length > 0) {
          await positionApi.update(portfolioId, rec.position_id, updateBody);
        }
      }
      setApplied(prev => new Set([...prev, rec.position_id]));

      // Tăng applied_count trong DB nếu có reviewId
      if (result?.id) {
        aiApi.markReviewApplied(result.id).catch(() => {});
      }
    } catch (e: any) {
      setError(`Không thể áp dụng: ${e?.response?.data?.message || e.message}`);
    } finally {
      setApplying(null);
    }
  }, [portfolioId, openPositions, result]);

  const highUrgencyCount = result?.recommendations.filter(r => r.urgency === 'HIGH').length ?? 0;
  const exitCount = result?.recommendations.filter(r => r.action === 'EXIT').length ?? 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Header ── */}
      <div className="panel-section p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-[13px] font-bold text-text-main mb-1">AI Giám Sát Vị Thế</h3>
            <p className="text-[11px] text-text-muted">
              AI đánh giá toàn bộ vị thế đang mở và đề xuất điều chỉnh SL/TP tối ưu
            </p>
            {result && (
              <p className="text-[10px] text-text-dim mt-1">
                Review lúc: {new Date(result.reviewed_at).toLocaleString('vi-VN')}
              </p>
            )}
          </div>
          <button
            onClick={runReview}
            disabled={loading || !portfolioId || openPositions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[12px] font-semibold bg-accent text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Đang phân tích...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Chạy AI Review
              </>
            )}
          </button>
        </div>

        {/* Summary metrics */}
        {result && (
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
              <div>
                <p className="text-[9px] text-text-dim uppercase tracking-widest mb-0.5">Sức Khỏe DM</p>
                <p className={`text-[18px] font-bold font-mono ${result.portfolio_health_score >= 80 ? 'text-positive' : result.portfolio_health_score >= 50 ? 'text-warning' : 'text-negative'}`}>
                  {result.portfolio_health_score}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-text-dim uppercase tracking-widest mb-0.5">Vị Thế</p>
                <p className="text-[18px] font-bold font-mono text-text-main">{result.positions_reviewed}</p>
              </div>
              <div>
                <p className="text-[9px] text-text-dim uppercase tracking-widest mb-0.5">Cảnh Báo Cao</p>
                <p className={`text-[18px] font-bold font-mono ${highUrgencyCount > 0 ? 'text-negative' : 'text-positive'}`}>{highUrgencyCount}</p>
              </div>
              <div>
                <p className="text-[9px] text-text-dim uppercase tracking-widest mb-0.5">Cần Đóng</p>
                <p className={`text-[18px] font-bold font-mono ${exitCount > 0 ? 'text-negative' : 'text-positive'}`}>{exitCount}</p>
              </div>
            </div>
            <HealthBar score={result.portfolio_health_score} />
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="panel-section p-3 border border-negative/30 bg-negative/5 text-[12px] text-negative flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-text-dim hover:text-text-muted ml-3 shrink-0">✕</button>
        </div>
      )}

      {/* ── Dynamic SL Updates ── */}
      {dynamicSLUpdates.length > 0 && (
        <div className="panel-section">
          <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Cap Nhat SL Dong (Dynamic SL)</span>
            <button
              onClick={() => setDynamicSLUpdates([])}
              className="text-[9px] text-text-dim hover:text-text-muted"
            >
              Xoa tat ca
            </button>
          </div>
          <div className="p-3 space-y-2 max-h-72 overflow-y-auto dense-scroll">
            {dynamicSLUpdates.map((update, i) => {
              const regimeCfg = REGIME_CONFIG[update.regime] ?? REGIME_CONFIG.SIDEWAYS;
              const slOld = typeof update.old_sl === 'number' ? (update.old_sl >= 1000 ? update.old_sl / 1000 : update.old_sl) : null;
              const slNew = typeof update.new_sl === 'number' ? (update.new_sl >= 1000 ? update.new_sl / 1000 : update.new_sl) : null;
              return (
                <div
                  key={i}
                  className={`p-3 rounded-lg border-l-4 ${regimeCfg.borderColor} ${regimeCfg.bgColor} border border-border-subtle`}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-text-main">{update.symbol}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${regimeCfg.color} ${regimeCfg.borderColor} ${regimeCfg.bgColor}`}>
                        {regimeCfg.label}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-dim font-mono">
                      {new Date(update.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  {slOld !== null && slNew !== null && (
                    <div className="flex items-center gap-2 mb-1.5 text-[10px] font-mono">
                      <span className="text-text-dim">SL:</span>
                      <span className="text-negative">{slOld.toFixed(2)}</span>
                      <span className="text-text-dim">→</span>
                      <span className="text-negative font-bold">{slNew.toFixed(2)}</span>
                    </div>
                  )}
                  {(update.atr_value || update.atr_multiplier) && (
                    <p className="text-[8px] text-text-dim mb-1">
                      ATR: {update.atr_value?.toFixed(2) ?? '—'}
                      {update.atr_multiplier && ` × ${update.atr_multiplier}`}
                    </p>
                  )}
                  {update.narrative && (
                    <p className="text-[9px] text-text-muted leading-relaxed">{update.narrative}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      {portfolioId && (
        <div className="flex gap-1 border-b border-border-standard">
          {[
            { id: 'current' as const, label: 'Review Hiện Tại' },
            { id: 'history' as const, label: 'Lịch Sử Review' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-[12px] font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab: Review Hiện Tại ── */}
      {activeTab === 'current' && (
        <>
          {openPositions.length === 0 ? (
            <div className="panel-section p-8 text-center">
              <p className="text-text-muted text-[13px] mb-2">Không có vị thế nào đang mở</p>
              <button onClick={() => onNavigate('terminal')} className="text-[11px] text-accent hover:underline">Đặt lệnh mới →</button>
            </div>
          ) : !result && !loading ? (
            <div className="panel-section p-8 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--color-accent-subtle)' }}>
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <p className="text-text-muted text-[13px] mb-1">Nhấn "Chạy AI Review" để phân tích</p>
              <p className="text-text-dim text-[11px]">AI sẽ đánh giá {openPositions.length} vị thế và đề xuất điều chỉnh SL/TP tối ưu</p>
            </div>
          ) : result && (
            <>
              {result.recommendations.every(r => r.action === 'HOLD') ? (
                <div className="panel-section p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-positive text-[13px] font-semibold">Danh mục ổn định</p>
                  <p className="text-text-muted text-[11px] mt-1">AI không phát hiện vấn đề nào cần điều chỉnh</p>
                </div>
              ) : (
                <RecommendationList
                  recommendations={result.recommendations}
                  currentPrices={result.current_prices}
                  openPositions={openPositions}
                  onApply={applyRecommendation}
                  applying={applying}
                  applied={applied}
                />
              )}
            </>
          )}
        </>
      )}

      {/* ── Tab: Lịch Sử ── */}
      {activeTab === 'history' && portfolioId && (
        <HistoryTab portfolioId={portfolioId} />
      )}
    </div>
  );
};
