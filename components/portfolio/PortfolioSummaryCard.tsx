import React from 'react';

interface PortfolioSummaryCardProps {
  totalValue: number;
  totalPnl: number;
  percentReturn: number;
  positionCount: number;
  closedCount: number;
  loading?: boolean;
}

export const PortfolioSummaryCard: React.FC<PortfolioSummaryCardProps> = ({
  totalValue,
  totalPnl,
  percentReturn,
  positionCount,
  closedCount,
  loading = false,
}) => {
  const isPnlPositive = totalPnl >= 0;

  const formatVND = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  const pnlColor = isPnlPositive
    ? 'text-[var(--color-positive)]'
    : 'text-[var(--color-negative)]';

  return (
    <div className="panel-section p-4">
      <h3 className="text-[13px] font-semibold text-[var(--color-text-main)] mb-3">
        Tổng quan danh mục
      </h3>
      {loading ? (
        <div className="text-[11px] text-[var(--color-text-dim)] animate-pulse">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider">
              Tổng đã đầu tư
            </div>
            <div className="text-[14px] font-bold tabular-nums text-[var(--color-text-main)]">
              {formatVND(totalValue)} <span className="text-[10px] font-normal text-[var(--color-text-dim)]">đ</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider">
              Lãi/Lỗ thực hiện
            </div>
            <div className={`text-[14px] font-bold tabular-nums ${pnlColor}`}>
              {isPnlPositive ? '+' : ''}{formatVND(totalPnl)} <span className="text-[10px] font-normal">đ</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider">
              % Lợi nhuận
            </div>
            <div className={`text-[14px] font-bold tabular-nums ${pnlColor}`}>
              {isPnlPositive ? '+' : ''}{percentReturn.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider">
              Vị thế
            </div>
            <div className="text-[14px] font-bold text-[var(--color-text-main)]">
              <span className="text-[var(--color-accent)]">{positionCount}</span>
              <span className="text-[var(--color-text-dim)] text-[10px] font-normal"> đang mở</span>
              {' / '}
              <span className="text-[var(--color-text-muted)]">{closedCount}</span>
              <span className="text-[var(--color-text-dim)] text-[10px] font-normal"> đã đóng</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
