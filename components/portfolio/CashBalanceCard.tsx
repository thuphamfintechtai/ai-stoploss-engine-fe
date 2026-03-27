import React from 'react';

interface CashBalanceCardProps {
  totalBalance: number;
  availableCash: number;
  pendingSettlement: number;
}

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

export const CashBalanceCard: React.FC<CashBalanceCardProps> = ({
  totalBalance,
  availableCash,
  pendingSettlement,
}) => {
  const deployedCash = Math.max(0, totalBalance - availableCash - pendingSettlement);

  const metrics = [
    {
      label: 'Tong Von',
      value: totalBalance,
      color: 'text-white',
      bg: 'bg-gray-700',
    },
    {
      label: 'Kha Dung',
      value: availableCash,
      color: 'text-green-400',
      bg: 'bg-green-900/20',
    },
    {
      label: 'Cho TT T+2',
      value: pendingSettlement,
      color: 'text-yellow-400',
      bg: 'bg-yellow-900/20',
    },
    {
      label: 'Da Deploy',
      value: deployedCash,
      color: 'text-blue-400',
      bg: 'bg-blue-900/20',
    },
  ];

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-5">
      <h3 className="text-sm font-bold text-white mb-4">Dong Tien & Phan Bo Von</h3>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-lg p-3 ${m.bg}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              {m.label}
            </p>
            <p className={`text-[15px] font-bold font-mono ${m.color}`}>
              {formatVND(m.value)}
            </p>
            <p className="text-[9px] text-gray-500 mt-0.5">VND</p>
          </div>
        ))}
      </div>
    </div>
  );
};
