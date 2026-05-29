import React from 'react';

export interface InvestmentGoal {
  target_return_pct: number;
  max_drawdown_pct: number;
  horizon_months: number;
  set_at?: string;
}

interface PortfolioHeroCardProps {
  totalBalance: number;
  availableCash: number;
  pendingSettlement: number;
  totalPnl: number;
  percentReturn: number;
  realizedPnl: number;
  unrealizedPnl: number;
  positionCount: number;
  closedCount: number;
  loading?: boolean;
  goal?: InvestmentGoal | null;
  onSetGoal?: () => void;
}

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

export const PortfolioHeroCard: React.FC<PortfolioHeroCardProps> = ({
  totalBalance,
  availableCash,
  pendingSettlement,
  totalPnl,
  percentReturn,
  realizedPnl,
  unrealizedPnl,
  positionCount,
  closedCount,
  loading = false,
  goal,
  onSetGoal,
}) => {
  const deployedCash = Math.max(0, totalBalance - availableCash - pendingSettlement);
  const isPnlPositive = totalPnl >= 0;
  const totalForBar = totalBalance || 1;
  const availablePercent = (availableCash / totalForBar) * 100;
  const pendingPercent = (pendingSettlement / totalForBar) * 100;
  const deployedPercent = (deployedCash / totalForBar) * 100;

  if (loading) {
    return (
      <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl p-6 animate-pulse">
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="h-3 w-20 bg-[var(--color-panel-hover)] rounded mb-3" />
            <div className="h-8 w-48 bg-[var(--color-panel-hover)] rounded mb-2" />
            <div className="h-3 w-32 bg-[var(--color-panel-hover)] rounded" />
          </div>
          <div className="w-px bg-[var(--color-border-subtle)]" />
          <div className="flex-1">
            <div className="h-3 w-24 bg-[var(--color-panel-hover)] rounded mb-3" />
            <div className="h-6 w-36 bg-[var(--color-panel-hover)] rounded" />
          </div>
        </div>
      </div>
    );
  }

  const goalProgress = goal ? Math.min(100, Math.max(0, (percentReturn / goal.target_return_pct) * 100)) : 0;
  const isDrawdownBreached = goal && percentReturn < -Math.abs(goal.max_drawdown_pct);

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
      {/* Main Stats Row */}
      <div className="p-5 lg:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: P&L Breakdown */}
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)] mb-4">
              Lãi / Lỗ Chi Tiết
            </h3>
            <div className="space-y-3">
              {/* Realized P&L */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-positive)]" />
                  <span className="text-[12px] text-[var(--color-text-muted)]">Đã thực hiện</span>
                </div>
                <span className={`text-[13px] font-semibold tabular-nums ${
                  realizedPnl >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                }`}>
                  {realizedPnl >= 0 ? '+' : ''}{formatVND(realizedPnl)}đ
                </span>
              </div>
              {/* Unrealized P&L */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
                  <span className="text-[12px] text-[var(--color-text-muted)]">Chưa thực hiện</span>
                </div>
                <span className={`text-[13px] font-semibold tabular-nums ${
                  unrealizedPnl >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                }`}>
                  {unrealizedPnl >= 0 ? '+' : ''}{formatVND(unrealizedPnl)}đ
                </span>
              </div>
              {/* Total */}
              <div className="pt-2 border-t border-[var(--color-border-subtle)]">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[var(--color-text-main)]">Tổng L/L</span>
                  <div className="text-right">
                    <span className={`text-[16px] font-bold tabular-nums ${
                      isPnlPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                    }`}>
                      {isPnlPositive ? '+' : ''}{formatVND(totalPnl)}đ
                    </span>
                    <span className={`text-[11px] ml-2 ${
                      isPnlPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                    }`}>
                      ({isPnlPositive ? '+' : ''}{percentReturn.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Capital Allocation */}
          <div className="md:border-l md:border-[var(--color-border-subtle)] md:pl-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)] mb-4">
              Phân Bổ Vốn
            </h3>
            {/* Allocation Bar */}
            <div className="mb-4">
              <div className="flex h-2 rounded-full overflow-hidden bg-[var(--color-background)]">
                {availablePercent > 0 && (
                  <div
                    className="bg-[var(--color-positive)] transition-all duration-500"
                    style={{ width: `${availablePercent}%` }}
                    title={`Khả dụng: ${formatVND(availableCash)}đ`}
                  />
                )}
                {pendingPercent > 0 && (
                  <div
                    className="bg-[var(--color-warning)] transition-all duration-500"
                    style={{ width: `${pendingPercent}%` }}
                    title={`Chờ thanh toán: ${formatVND(pendingSettlement)}đ`}
                  />
                )}
                {deployedPercent > 0 && (
                  <div
                    className="bg-[var(--color-accent)] transition-all duration-500"
                    style={{ width: `${deployedPercent}%` }}
                    title={`Đã phân bổ: ${formatVND(deployedCash)}đ`}
                  />
                )}
              </div>
            </div>
            {/* Legend */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-positive)]" />
                  <span className="text-[var(--color-text-muted)]">Khả dụng</span>
                </div>
                <span className="font-medium tabular-nums text-[var(--color-text-main)]">
                  {formatVND(availableCash)}đ
                </span>
              </div>
              {pendingSettlement > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
                    <span className="text-[var(--color-text-muted)]">Chờ T+2</span>
                  </div>
                  <span className="font-medium tabular-nums text-[var(--color-text-main)]">
                    {formatVND(pendingSettlement)}đ
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  <span className="text-[var(--color-text-muted)]">Đã phân bổ</span>
                </div>
                <span className="font-medium tabular-nums text-[var(--color-text-main)]">
                  {formatVND(deployedCash)}đ
                </span>
              </div>
            </div>
          </div>

          {/* Column 3: Positions Summary */}
          <div className="md:border-l md:border-[var(--color-border-subtle)] md:pl-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)] mb-4">
              Thống Kê Vị Thế
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--color-background)] rounded-lg p-3 text-center">
                <div className="text-[24px] font-bold text-[var(--color-accent)] tabular-nums">
                  {positionCount}
                </div>
                <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider mt-1">
                  Đang mở
                </div>
              </div>
              <div className="bg-[var(--color-background)] rounded-lg p-3 text-center">
                <div className="text-[24px] font-bold text-[var(--color-text-muted)] tabular-nums">
                  {closedCount}
                </div>
                <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider mt-1">
                  Đã đóng
                </div>
              </div>
            </div>
            {/* Win Rate placeholder */}
            <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--color-text-muted)]">Tỷ lệ thắng</span>
                <span className="font-semibold text-[var(--color-text-main)]">
                  {closedCount > 0 ? '--' : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Goal Progress Bar */}
      <div className="px-5 lg:px-6 py-4 bg-[var(--color-background)] border-t border-[var(--color-border-subtle)]">
        {goal ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
                <span className="text-[12px] font-medium text-[var(--color-text-main)]">
                  Mục tiêu: +{goal.target_return_pct}% trong {goal.horizon_months} tháng
                </span>
              </div>
              <span className={`text-[11px] font-semibold ${
                isDrawdownBreached
                  ? 'text-[var(--color-negative)]'
                  : goalProgress >= 100
                    ? 'text-[var(--color-positive)]'
                    : 'text-[var(--color-text-muted)]'
              }`}>
                {isDrawdownBreached
                  ? 'Vượt mức lỗ cho phép!'
                  : goalProgress >= 100
                    ? 'Đạt mục tiêu!'
                    : `${goalProgress.toFixed(0)}% hoàn thành`
                }
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-[var(--color-panel)]">
              <div
                className={`h-full transition-all duration-700 ${
                  isDrawdownBreached
                    ? 'bg-[var(--color-negative)]'
                    : goalProgress >= 100
                      ? 'bg-[var(--color-positive)]'
                      : 'bg-[var(--color-accent)]'
                }`}
                style={{ width: `${Math.min(100, goalProgress)}%` }}
              />
            </div>
            {goal.max_drawdown_pct > 0 && (
              <div className="mt-2 text-[10px] text-[var(--color-text-dim)]">
                Mức lỗ tối đa cho phép: -{goal.max_drawdown_pct}%
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
              <span className="text-[12px] text-[var(--color-text-dim)]">
                Bạn chưa đặt mục tiêu đầu tư
              </span>
            </div>
            {onSetGoal && (
              <button
                onClick={onSetGoal}
                className="text-[11px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors flex items-center gap-1"
              >
                Đặt mục tiêu
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
