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
      label: 'Tổng vốn',
      value: totalBalance,
      color: 'text-[var(--color-text-main)]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
    {
      label: 'Khả dụng',
      value: availableCash,
      color: 'text-[var(--color-positive)]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Chờ thanh toán T+2',
      value: pendingSettlement,
      color: 'text-[var(--color-warning)]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Đã phân bổ',
      value: deployedCash,
      color: 'text-[var(--color-accent)]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
      ),
    },
  ];

  // Tính phần trăm cho progress bar
  const totalForBar = totalBalance || 1;
  const availablePercent = (availableCash / totalForBar) * 100;
  const pendingPercent = (pendingSettlement / totalForBar) * 100;
  const deployedPercent = (deployedCash / totalForBar) * 100;

  return (
    <div className="panel-section p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-[var(--color-text-main)]">Dòng tiền & Phân bổ vốn</h3>
        <span className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">VND</span>
      </div>

      {/* Allocation Bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-5 bg-[var(--color-background)]">
        {availablePercent > 0 && (
          <div
            className="bg-[var(--color-positive)] transition-all duration-500"
            style={{ width: `${availablePercent}%` }}
            title={`Khả dụng: ${availablePercent.toFixed(1)}%`}
          />
        )}
        {pendingPercent > 0 && (
          <div
            className="bg-[var(--color-warning)] transition-all duration-500"
            style={{ width: `${pendingPercent}%` }}
            title={`Chờ TT: ${pendingPercent.toFixed(1)}%`}
          />
        )}
        {deployedPercent > 0 && (
          <div
            className="bg-[var(--color-accent)] transition-all duration-500"
            style={{ width: `${deployedPercent}%` }}
            title={`Đã phân bổ: ${deployedPercent.toFixed(1)}%`}
          />
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-lg p-3 bg-[var(--color-background)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-standard)] transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`${m.color} opacity-60`}>{m.icon}</span>
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                {m.label}
              </span>
            </div>
            <p className={`text-[16px] font-bold tabular-nums ${m.color}`}>
              {formatVND(m.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
