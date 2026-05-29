import React from 'react';

export interface SectorAllocation {
  name: string;
  value_vnd: number;
  pct: number;
  position_count: number;
  color?: string;
}

interface SectorAllocationCardProps {
  portfolioId: string;
  sectors?: SectorAllocation[];
  loading?: boolean;
  onOpenRebalance?: () => void;
}

const formatVND = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

const SECTOR_COLORS = [
  { bg: 'bg-blue-500', bar: '#3B82F6' },
  { bg: 'bg-emerald-500', bar: '#10B981' },
  { bg: 'bg-amber-500', bar: '#F59E0B' },
  { bg: 'bg-rose-500', bar: '#F43F5E' },
  { bg: 'bg-violet-500', bar: '#8B5CF6' },
  { bg: 'bg-cyan-500', bar: '#06B6D4' },
];

const CONCENTRATION_THRESHOLD = 30;

export const SectorAllocationCard: React.FC<SectorAllocationCardProps> = ({
  sectors,
  loading,
  onOpenRebalance,
}) => {
  const hasWarning = sectors?.some((s) => s.pct > CONCENTRATION_THRESHOLD) ?? false;
  const totalValue = sectors?.reduce((sum, s) => sum + s.value_vnd, 0) ?? 0;

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--color-accent)]/10">
            <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--color-text-main)]">Phân bổ ngành</h3>
        </div>
        {hasWarning && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[var(--color-warning)]/10 text-[var(--color-warning)] flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Tập trung
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <div className="h-3 w-24 bg-[var(--color-panel-hover)] rounded" />
                  <div className="h-3 w-12 bg-[var(--color-panel-hover)] rounded" />
                </div>
                <div className="h-2 bg-[var(--color-panel-hover)] rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && (!sectors || sectors.length === 0) && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-background)] flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--color-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
            </div>
            <p className="text-[12px] font-medium text-[var(--color-text-muted)]">Chưa có vị thế</p>
            <p className="text-[10px] text-[var(--color-text-dim)] mt-1">
              Mở vị thế để xem phân bổ theo ngành
            </p>
          </div>
        )}

        {!loading && sectors && sectors.length > 0 && (
          <>
            {/* Combined Progress Bar */}
            <div className="mb-4">
              <div className="h-3 rounded-full overflow-hidden bg-[var(--color-background)] flex">
                {sectors.slice(0, 6).map((s, i) => (
                  <div
                    key={s.name}
                    className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                    style={{
                      width: `${s.pct}%`,
                      background: s.color ?? SECTOR_COLORS[i % SECTOR_COLORS.length].bar,
                    }}
                    title={`${s.name}: ${s.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
            </div>

            {/* Sector List */}
            <div className="space-y-3">
              {sectors.slice(0, 6).map((s, i) => {
                const isConcentrated = s.pct > CONCENTRATION_THRESHOLD;
                const color = s.color ?? SECTOR_COLORS[i % SECTOR_COLORS.length].bar;

                return (
                  <div key={s.name} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-[var(--color-text-main)] truncate">
                          {s.name}
                        </span>
                        <span className={`text-[12px] font-semibold tabular-nums ${
                          isConcentrated ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]'
                        }`}>
                          {s.pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-[var(--color-text-dim)]">
                          {s.position_count} vị thế
                        </span>
                        <span className="text-[10px] text-[var(--color-text-dim)] font-mono tabular-nums">
                          {formatVND(s.value_vnd)}đ
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                  Tổng giá trị
                </span>
                <span className="text-[13px] font-bold text-[var(--color-text-main)] tabular-nums">
                  {formatVND(totalValue)}đ
                </span>
              </div>
            </div>

            {/* Rebalance Button */}
            {onOpenRebalance && (
              <button
                onClick={onOpenRebalance}
                className="w-full mt-4 py-2.5 rounded-lg text-[11px] font-semibold text-[var(--color-accent)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/10 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
                Gợi ý cân bằng AI
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
