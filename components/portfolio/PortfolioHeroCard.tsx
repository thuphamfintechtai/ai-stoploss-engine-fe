import React from 'react';

interface PortfolioHeroCardProps {
  totalBalance: number;
  availableCash: number;
  pendingSettlement: number;
  totalPnl: number;
  percentReturn: number;
  positionCount: number;
  closedCount: number;
  loading?: boolean;
}

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

export const PortfolioHeroCard: React.FC<PortfolioHeroCardProps> = ({
  totalBalance,
  availableCash,
  pendingSettlement,
  totalPnl,
  percentReturn,
  positionCount,
  closedCount,
  loading = false,
}) => {
  const deployedCash = Math.max(0, totalBalance - availableCash - pendingSettlement);
  const isPnlPositive = totalPnl >= 0;
  const totalForBar = totalBalance || 1;
  const availablePercent = (availableCash / totalForBar) * 100;
  const pendingPercent = (pendingSettlement / totalForBar) * 100;
  const deployedPercent = (deployedCash / totalForBar) * 100;

  const pnlColor = isPnlPositive
    ? 'text-[var(--color-positive)]'
    : 'text-[var(--color-negative)]';

  if (loading) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-[var(--color-accent-subtle)] to-[var(--color-panel)] border border-[var(--color-border-subtle)] p-6 animate-pulse">
        <div className="h-8 w-48 bg-[var(--color-panel-hover)] rounded mb-4" />
        <div className="h-4 w-32 bg-[var(--color-panel-hover)] rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-[var(--color-accent-subtle)] to-[var(--color-panel)] border border-[var(--color-border-subtle)] p-5 lg:p-6">
      {/* Row 1: Hero numbers */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
        {/* Tổng vốn — số lớn nhất */}
        <div>
          <p className="text-[10px] font-medium text-[var(--color-text-dim)] uppercase tracking-wider mb-1">Tổng vốn</p>
          <p className="text-[28px] lg:text-[32px] font-bold tabular-nums text-[var(--color-text-main)] leading-none">
            {formatVND(totalBalance)}
            <span className="text-[14px] font-normal text-[var(--color-text-dim)] ml-1">₫</span>
          </p>
        </div>

        {/* Metrics bên phải */}
        <div className="flex items-center gap-6">
          {/* Lãi/Lỗ */}
          <div className="text-right">
            <p className="text-[10px] font-medium text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Lãi/Lỗ</p>
            <p className={`text-[18px] font-bold tabular-nums ${pnlColor} leading-tight`}>
              {isPnlPositive ? '+' : ''}{formatVND(totalPnl)}
            </p>
            <p className={`text-[11px] tabular-nums ${pnlColor}`}>
              {isPnlPositive ? '+' : ''}{percentReturn.toFixed(2)}%
            </p>
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-[var(--color-divider)]" />

          {/* Vị thế */}
          <div className="text-right">
            <p className="text-[10px] font-medium text-[var(--color-text-dim)] uppercase tracking-wider mb-0.5">Vị thế</p>
            <p className="text-[18px] font-bold tabular-nums text-[var(--color-text-main)] leading-tight">
              {positionCount}
            </p>
            <p className="text-[11px] text-[var(--color-text-dim)]">
              {positionCount} mở · {closedCount} đóng
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Allocation bar */}
      <div>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--color-background)]">
          {availablePercent > 0 && (
            <div
              className="bg-[var(--color-positive)] transition-all duration-500"
              style={{ width: `${availablePercent}%` }}
            />
          )}
          {pendingPercent > 0 && (
            <div
              className="bg-[var(--color-warning)] transition-all duration-500"
              style={{ width: `${pendingPercent}%` }}
            />
          )}
          {deployedPercent > 0 && (
            <div
              className="bg-[var(--color-accent)] transition-all duration-500"
              style={{ width: `${deployedPercent}%` }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--color-positive)]" />
            <span className="text-[var(--color-text-dim)]">Khả dụng</span>
            <span className="text-[var(--color-text-muted)] font-mono">{formatVND(availableCash)}</span>
          </span>
          {pendingSettlement > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
              <span className="text-[var(--color-text-dim)]">Chờ TT</span>
              <span className="text-[var(--color-text-muted)] font-mono">{formatVND(pendingSettlement)}</span>
            </span>
          )}
          {deployedCash > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
              <span className="text-[var(--color-text-dim)]">Đã phân bổ</span>
              <span className="text-[var(--color-text-muted)] font-mono">{formatVND(deployedCash)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
