import React from 'react';

interface PortfolioSummaryCardProps {
  totalValue: number;         // Tong gia tri da dau tu
  totalPnl: number;           // Tong P&L (realized + unrealized)
  percentReturn: number;      // % loi nhuan
  positionCount: number;      // So vi the dang mo
  closedCount: number;        // So vi the da dong
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
    value.toLocaleString('vi-VN') + ' \u20ab';

  return (
    <div className="panel-section p-4">
      <h3 className="text-[13px] font-black text-text-main mb-3">Tong Quan Portfolio That</h3>
      {loading ? (
        <div className="text-[11px] text-text-dim animate-pulse">Dang tai...</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-[10px] text-text-muted mb-0.5">Tong da dau tu</div>
            <div className="text-[13px] font-bold text-text-main">{formatVND(totalValue)}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted mb-0.5">Lai/Lo thuc hien</div>
            <div className={`text-[13px] font-bold ${isPnlPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPnlPositive ? '+' : ''}{formatVND(totalPnl)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted mb-0.5">% Loi nhuan</div>
            <div className={`text-[13px] font-bold ${isPnlPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPnlPositive ? '+' : ''}{percentReturn.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted mb-0.5">Vi the</div>
            <div className="text-[13px] font-bold text-text-main">
              <span className="text-blue-400">{positionCount}</span>
              <span className="text-text-dim text-[10px]"> mo</span>
              {' / '}
              <span className="text-gray-400">{closedCount}</span>
              <span className="text-text-dim text-[10px]"> dong</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
