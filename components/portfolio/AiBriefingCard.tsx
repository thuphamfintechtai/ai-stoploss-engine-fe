import React from 'react';

export interface BriefingContent {
  headline: string;
  paragraphs: string[];
  action_items?: { icon: string; text: string }[];
  generated_at?: string;
  generated_by?: 'gemini' | 'rule_based';
}

interface AiBriefingCardProps {
  portfolioId: string;
  briefing?: BriefingContent | null;
  loading?: boolean;
  onDismiss?: () => void;
  onViewDetail?: () => void;
}

export const AiBriefingCard: React.FC<AiBriefingCardProps> = ({
  briefing,
  loading,
  onDismiss,
  onViewDetail,
}) => {
  if (!briefing && !loading) return null;

  if (loading) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl p-5 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-panel-hover)]" />
          <div>
            <div className="h-4 w-24 bg-[var(--color-panel-hover)] rounded mb-1" />
            <div className="h-3 w-16 bg-[var(--color-panel-hover)] rounded" />
          </div>
        </div>
        <div className="h-4 w-3/4 bg-[var(--color-panel-hover)] rounded mb-2" />
        <div className="h-3 w-full bg-[var(--color-panel-hover)] rounded" />
      </div>
    );
  }

  const isGemini = briefing?.generated_by === 'gemini';

  return (
    <div className="bg-gradient-to-r from-[var(--color-accent)]/5 via-[var(--color-panel)] to-[var(--color-panel)] border border-[var(--color-accent)]/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-secondary)] flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--color-text-main)] flex items-center gap-2">
              Báo cáo AI
              {isGemini && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] uppercase tracking-wider">
                  Gemini
                </span>
              )}
            </h3>
            {briefing?.generated_at && (
              <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5">
                Cập nhật lúc {new Date(briefing.generated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
        <p className="text-[14px] font-medium text-[var(--color-text-main)] mb-3 leading-snug">
          {briefing!.headline}
        </p>

        <div className="space-y-2 mb-4">
          {briefing!.paragraphs.map((p, i) => (
            <p key={i} className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        {/* Action Items */}
        {briefing!.action_items && briefing!.action_items.length > 0 && (
          <div className="bg-[var(--color-background)] rounded-lg p-3 mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
              Gợi ý hành động
            </p>
            <div className="space-y-2">
              {briefing!.action_items.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)]">
                    {a.icon || '→'}
                  </span>
                  <span className="text-[var(--color-text-main)] leading-relaxed">{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {onViewDetail && (
          <button
            onClick={onViewDetail}
            className="text-[11px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors flex items-center gap-1"
          >
            Xem phân tích chi tiết
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
