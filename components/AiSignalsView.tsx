import React, { useState } from 'react';
import { TraderCard } from './TraderCard';
import type { TraderProfile, AiAnalysis } from '../types';

interface Props {
  traders: TraderProfile[];
  onAiCheck: (trader: TraderProfile) => void;
  analyzingId: string | null;
  insightContent: AiAnalysis | null;
  insightTrader: TraderProfile | null;
  onNavigate: (view: string) => void;
}

function ScoreGauge({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width={72} height={72} viewBox="0 0 72 72">
          <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
          <circle
            cx={36} cy={36} r={r} fill="none"
            stroke={color} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
          <text x={36} y={40} textAnchor="middle" fill={color} fontSize={16} fontWeight="bold" fontFamily="monospace">
            {score}
          </text>
        </svg>
      </div>
      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">{label}</span>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: AiAnalysis['verdict'] }) {
  const map = {
    RECOMMENDED: { label: 'KHUYẾN NGHỊ', cls: 'bg-positive/15 text-positive border border-positive/30' },
    CAUTION: { label: 'CẨN THẬN', cls: 'bg-warning/15 text-warning border border-warning/30' },
    AVOID: { label: 'TRÁNH', cls: 'bg-negative/15 text-negative border border-negative/30' },
  };
  const s = map[verdict];
  return (
    <span className={`text-[11px] font-bold px-3 py-1 rounded-full tracking-widest ${s.cls}`}>{s.label}</span>
  );
}

export const AiSignalsView: React.FC<Props> = ({
  traders,
  onAiCheck,
  analyzingId,
  insightContent,
  insightTrader,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<'all' | 'recommended' | 'caution' | 'avoid'>('all');

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)] animate-fade-in">
      {/* LEFT: Trader Cards */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[16px] font-bold text-text-main">AI Signals</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Phân tích nhà đầu tư từ Gemini AI</p>
          </div>
          <div className="flex gap-1.5">
            {(['all', 'recommended', 'caution', 'avoid'] as const).map((f) => {
              const labels = { all: 'Tất cả', recommended: 'Khuyến nghị', caution: 'Cẩn thận', avoid: 'Tránh' };
              const colors = {
                all: 'text-text-muted border-border-standard hover:text-text-main',
                recommended: 'text-positive border-positive/30 hover:bg-positive/10',
                caution: 'text-warning border-warning/30 hover:bg-warning/10',
                avoid: 'text-negative border-negative/30 hover:bg-negative/10',
              };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                    filter === f ? 'opacity-100 bg-white/10' : 'opacity-60'
                  } ${colors[f]}`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards grid */}
        <div className="flex-1 overflow-y-auto dense-scroll">
          {traders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-dim py-12">
              <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <p className="text-[13px]">Chưa có tín hiệu AI nào</p>
              <p className="text-[11px] mt-1 text-text-dim">Tín hiệu sẽ được tạo khi có dữ liệu thị trường</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-4">
              {traders.map((trader) => (
                <TraderCard
                  key={trader.id}
                  trader={trader}
                  onAiCheck={onAiCheck}
                  isAnalyzing={analyzingId === trader.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: AI Analysis Panel */}
      <div
        className="w-[360px] shrink-0 panel-section flex flex-col"
        style={{ height: 'fit-content', maxHeight: '100%' }}
      >
        <div className="px-4 py-2.5 border-b border-border-subtle">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Phân Tích AI</span>
        </div>

        {!insightContent ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12 text-text-dim">
            <svg className="w-10 h-10 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="text-[12px] text-center">Nhấn "AI Phân Tích" trên một nhà đầu tư để xem kết quả</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto dense-scroll">
            {/* Trader name */}
            {insightTrader && (
              <div className="px-4 py-3 border-b border-border-subtle">
                <p className="text-[13px] font-bold text-text-main">{insightTrader.name}</p>
                <p className="text-[10px] text-text-muted">{insightTrader.strategy}</p>
              </div>
            )}

            {/* Verdict */}
            <div className="px-4 py-4 flex justify-center border-b border-border-subtle">
              <VerdictBadge verdict={insightContent.verdict} />
            </div>

            {/* Score gauges */}
            <div className="px-4 py-4 flex justify-around border-b border-border-subtle">
              <ScoreGauge
                score={insightContent.marketFitScore}
                label="Phù Hợp TT"
                color={insightContent.marketFitScore >= 70 ? '#22C55E' : insightContent.marketFitScore >= 40 ? '#F59E0B' : '#EF4444'}
              />
              <ScoreGauge
                score={insightContent.safetyScore}
                label="An Toàn"
                color={insightContent.safetyScore >= 70 ? '#22C55E' : insightContent.safetyScore >= 40 ? '#F59E0B' : '#EF4444'}
              />
            </div>

            {/* Strategy match */}
            {insightContent.strategyMatch && (
              <div className="px-4 py-3 border-b border-border-subtle">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-text-dim mb-1">Chiến Lược</p>
                <p className="text-[12px] text-accent font-medium">{insightContent.strategyMatch}</p>
              </div>
            )}

            {/* Market analysis */}
            <div className="px-4 py-3 border-b border-border-subtle">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-text-dim mb-2">Phân Tích Thị Trường</p>
              <p className="text-[12px] text-text-muted leading-relaxed">{insightContent.marketAnalysis}</p>
            </div>

            {/* Pros & Cons */}
            <div className="px-4 py-3 border-b border-border-subtle">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-text-dim mb-2">Ưu Điểm</p>
              <ul className="space-y-1">
                {insightContent.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-positive">
                    <span className="mt-0.5 shrink-0">✓</span> {pro}
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-4 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-text-dim mb-2">Rủi Ro</p>
              <ul className="space-y-1">
                {insightContent.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-negative">
                    <span className="mt-0.5 shrink-0">✗</span> {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
