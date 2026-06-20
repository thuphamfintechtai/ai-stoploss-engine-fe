import React, { useMemo } from 'react';
import type { RealPosition } from '../../services/api';

interface PortfolioHealthCardProps {
  totalBalance: number;
  availableCash: number;
  realPositions: RealPosition[];
  realizedPnl: number;
  unrealizedPnl: number;
  initialCapital?: number | null;
  onOpenAdvanced?: () => void;
}

type HealthStatus = 'good' | 'warn' | 'bad';

interface Metric {
  label: string;
  value: string;
  status: HealthStatus;
  hint?: string;
  icon: React.ReactNode;
}

const STATUS_STYLES: Record<HealthStatus, { bg: string; text: string; ring: string }> = {
  good: {
    bg: 'bg-[var(--color-positive)]/10',
    text: 'text-[var(--color-positive)]',
    ring: 'ring-[var(--color-positive)]/30',
  },
  warn: {
    bg: 'bg-[var(--color-warning)]/10',
    text: 'text-[var(--color-warning)]',
    ring: 'ring-[var(--color-warning)]/30',
  },
  bad: {
    bg: 'bg-[var(--color-negative)]/10',
    text: 'text-[var(--color-negative)]',
    ring: 'ring-[var(--color-negative)]/30',
  },
};

const STATUS_SCORE: Record<HealthStatus, number> = { good: 90, warn: 60, bad: 30 };

export const PortfolioHealthCard: React.FC<PortfolioHealthCardProps> = ({
  totalBalance,
  availableCash,
  realPositions,
  realizedPnl,
  unrealizedPnl,
  initialCapital,
  onOpenAdvanced,
}) => {
  const metrics = useMemo<Metric[]>(() => {
    const total = totalBalance || 1;
    const openCount = realPositions.length;

    // 1. Deployed ratio
    const deployed = Math.max(0, totalBalance - availableCash);
    const deployedPct = (deployed / total) * 100;
    const deployedStatus: HealthStatus =
      deployedPct < 30 ? 'good' : deployedPct < 80 ? 'warn' : 'bad';

    // 2. Lãi/lỗ hiện tại (W3.5: rename từ "Sụt giảm" — đây không phải max-drawdown
    //    đỉnh-đáy mà là P&L hiện tại so với vốn ban đầu. Show cả + và -.)
    const base = initialCapital ?? totalBalance - realizedPnl - unrealizedPnl;
    const currentValue = base + realizedPnl + unrealizedPnl;
    const pnlPct = base > 0 ? ((currentValue - base) / base) * 100 : 0;
    const drawdownStatus: HealthStatus =
      pnlPct >= 0 ? 'good' : pnlPct > -10 ? 'warn' : 'bad';

    // 3. Diversity
    const uniqueSymbols = new Set(realPositions.map((p) => p.symbol)).size;
    const sectorStatus: HealthStatus =
      uniqueSymbols >= 5 ? 'good' : uniqueSymbols >= 3 ? 'warn' : openCount === 0 ? 'good' : 'bad';

    // 4. Concentration
    const positionValues = realPositions.map((p) =>
      Number(p.entry_price) * Number(p.quantity),
    );
    const maxPosValue = positionValues.length > 0 ? Math.max(...positionValues) : 0;
    const concentrationPct = (maxPosValue / total) * 100;
    const concentrationStatus: HealthStatus =
      concentrationPct < 20 ? 'good' : concentrationPct < 35 ? 'warn' : 'bad';

    return [
      {
        label: 'Vốn đang dùng',
        value: `${deployedPct.toFixed(0)}%`,
        status: deployedStatus,
        hint: deployedPct < 30 ? 'An toàn' : deployedPct < 80 ? 'Vừa phải' : 'Rủi ro cao',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'Lãi/lỗ hiện tại',
        value: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`,
        status: drawdownStatus,
        hint: pnlPct >= 5 ? 'Có lãi' : pnlPct >= 0 ? 'Hòa vốn' : pnlPct > -10 ? 'Cảnh báo' : 'Lỗ nặng',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
          </svg>
        ),
      },
      {
        label: 'Đa dạng hóa',
        value: `${uniqueSymbols} mã`,
        status: sectorStatus,
        hint:
          openCount === 0
            ? 'Chưa có vị thế'
            : uniqueSymbols >= 5
              ? 'Phân bổ tốt'
              : uniqueSymbols >= 3
                ? 'Trung bình'
                : 'Quá tập trung',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        ),
      },
      {
        label: 'Tập trung',
        value: openCount > 0 ? `${concentrationPct.toFixed(0)}%` : '—',
        status: openCount > 0 ? concentrationStatus : 'good',
        hint:
          openCount === 0
            ? 'Chưa có vị thế'
            : concentrationPct < 20
              ? 'Phân bổ đều'
              : concentrationPct < 35
                ? 'Hơi lệch'
                : 'Quá tập trung',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
          </svg>
        ),
      },
    ];
  }, [totalBalance, availableCash, realPositions, realizedPnl, unrealizedPnl, initialCapital]);

  const overallScore = Math.round(
    metrics.reduce((s, m) => s + STATUS_SCORE[m.status], 0) / metrics.length,
  );

  const overallStatus: HealthStatus =
    overallScore >= 80 ? 'good' : overallScore >= 50 ? 'warn' : 'bad';

  const overallLabel =
    overallStatus === 'good' ? 'Sức khỏe tốt' : overallStatus === 'warn' ? 'Cần theo dõi' : 'Cần xử lý';

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${STATUS_STYLES[overallStatus].bg}`}>
            <svg className={`w-4 h-4 ${STATUS_STYLES[overallStatus].text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--color-text-main)]">Sức khỏe danh mục</h3>
        </div>
        {onOpenAdvanced && (
          <button
            onClick={onOpenAdvanced}
            className="text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
          >
            Chi tiết
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Overall Score */}
        <div className="flex items-center gap-4 mb-5 pb-4 border-b border-[var(--color-border-subtle)]">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="var(--color-border-subtle)"
                strokeWidth="4"
              />
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                strokeLinecap="round"
                strokeWidth="4"
                strokeDasharray={`${(overallScore / 100) * 175.93} 175.93`}
                className={`transition-all duration-700 ${
                  overallStatus === 'good'
                    ? 'stroke-[var(--color-positive)]'
                    : overallStatus === 'warn'
                      ? 'stroke-[var(--color-warning)]'
                      : 'stroke-[var(--color-negative)]'
                }`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-[18px] font-bold tabular-nums ${STATUS_STYLES[overallStatus].text}`}>
                {overallScore}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <p className={`text-[15px] font-bold ${STATUS_STYLES[overallStatus].text}`}>
              {overallLabel}
            </p>
            <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5">
              Điểm số dựa trên 4 chỉ số đánh giá rủi ro
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className={`p-3 rounded-lg ${STATUS_STYLES[m.status].bg} ring-1 ${STATUS_STYLES[m.status].ring}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={STATUS_STYLES[m.status].text}>{m.icon}</span>
                <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  {m.label}
                </span>
              </div>
              <div className="text-[18px] font-bold tabular-nums text-[var(--color-text-main)]">
                {m.value}
              </div>
              {m.hint && (
                <div className={`text-[10px] font-medium mt-1 ${STATUS_STYLES[m.status].text}`}>
                  {m.hint}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
