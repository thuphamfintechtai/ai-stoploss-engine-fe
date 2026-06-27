import React from 'react';
import { SkeletonCard } from '../ui/SkeletonLoader';

interface PortfolioSummaryCardProps {
  totalValue: number;
  totalPnl: number;         // GIỮ NGUYÊN — backward-compat (WARNING 6)
  realizedPnl: number;      // THÊM — từ CLOSED positions (total_realized_pnl)
  unrealizedPnl: number;    // THÊM — từ OPEN positions mark-to-market (total_unrealized_pnl, D-08)
  percentReturn: number;
  positionCount: number;
  closedCount: number;
  loading?: boolean;
}

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

const pnlColor = (pnl: number) =>
  pnl > 0
    ? 'text-[var(--color-positive)]'
    : pnl < 0
      ? 'text-[var(--color-negative)]'
      : 'text-[var(--color-text-muted)]';

const pnlPrefix = (pnl: number) => (pnl > 0 ? '+' : '');

interface MetricProps {
  label: string;
  value: string;
  subValue?: string;
  valueClass?: string;
  subValueClass?: string;
}

const Metric: React.FC<MetricProps> = ({ label, value, subValue, valueClass, subValueClass }) => (
  <div>
    <div className="text-micro text-[var(--color-text-muted)] mb-0.5">
      {label}
    </div>
    <div className={`text-subheading font-bold tabular-nums ${valueClass ?? 'text-[var(--color-text-main)]'}`}>
      {value}
    </div>
    {subValue !== undefined && (
      <div className={`text-caption font-medium tabular-nums mt-0.5 ${subValueClass ?? 'text-[var(--color-text-dim)]'}`}>
        {subValue}
      </div>
    )}
  </div>
);

interface PnlCardProps {
  label: string;
  tooltip?: string;
  icon: string;
  value: number;
}

const PnlCard: React.FC<PnlCardProps> = ({ label, tooltip, icon, value }) => (
  <div title={tooltip}>
    <div className="flex items-center gap-1 text-micro text-[var(--color-text-muted)] mb-0.5">
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </div>
    <div className={`text-subheading font-bold tabular-nums ${pnlColor(value)}`}>
      {pnlPrefix(value)}{formatVND(value)}{' '}
      <span className="text-micro font-normal">đ</span>
    </div>
  </div>
);

export const PortfolioSummaryCard: React.FC<PortfolioSummaryCardProps> = ({
  totalValue,
  totalPnl,
  realizedPnl,
  unrealizedPnl,
  percentReturn,
  positionCount,
  closedCount,
  loading = false,
}) => {
  return (
    <div className="panel-section p-4">
      <h3 className="text-body font-semibold text-[var(--color-text-main)] mb-3">
        Tổng quan danh mục
      </h3>
      {loading ? (
        <div className="space-y-2">
          <SkeletonCard className="h-4 w-1/2" />
          <SkeletonCard className="h-10" />
          <SkeletonCard className="h-10" />
        </div>
      ) : (
        <>
          {/* Row 1: Tổng đầu tư + % Lợi nhuận (với totalPnl sub-label — WARNING 6: totalPnl vẫn hiển thị) */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Metric
              label="Tổng đã đầu tư"
              value={`${formatVND(totalValue)} đ`}
            />
            <Metric
              label="% Lợi nhuận"
              value={`${pnlPrefix(totalPnl)}${percentReturn.toFixed(2)}%`}
              subValue={`${pnlPrefix(totalPnl)}${formatVND(totalPnl)} đ`}
              valueClass={pnlColor(totalPnl)}
              subValueClass={pnlColor(totalPnl)}
            />
          </div>

          {/* Row 2: 2 thẻ P/L riêng (realized + unrealized) + Vị thế */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--color-divider)]">
            <PnlCard
              label="Lời/Lỗ đã thực hiện"
              tooltip="Lời/Lỗ đã chốt từ các vị thế đã đóng (CLOSED)"
              icon="✓"
              value={realizedPnl}
            />
            <PnlCard
              label="Lời/Lỗ chưa thực hiện"
              tooltip="Lời/Lỗ theo giá thị trường hiện tại của các vị thế đang mở (OPEN) — mark-to-market"
              icon="◴"
              value={unrealizedPnl}
            />
            <div>
              <div className="text-micro text-[var(--color-text-muted)] mb-0.5">
                Vị thế
              </div>
              <div className="text-subheading font-bold text-[var(--color-text-main)]">
                <span className="text-[var(--color-accent)]">{positionCount}</span>
                <span className="text-[var(--color-text-dim)] text-micro font-normal"> đang mở</span>
                {' / '}
                <span className="text-[var(--color-text-muted)]">{closedCount}</span>
                <span className="text-[var(--color-text-dim)] text-micro font-normal"> đã đóng</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
