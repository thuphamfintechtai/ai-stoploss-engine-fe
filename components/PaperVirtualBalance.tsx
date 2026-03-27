import React, { useState, useEffect, useCallback } from 'react';
import { orderApi } from '../services/api';
import type { VirtualBalance } from '../services/api';
import { formatNumberVI } from '../constants';
import wsService from '../services/websocket';

interface PaperVirtualBalanceProps {
  portfolioId: string;
  refreshTrigger?: number;
}

export const PaperVirtualBalance: React.FC<PaperVirtualBalanceProps> = ({
  portfolioId,
  refreshTrigger,
}) => {
  const [balance, setBalance] = useState<VirtualBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await orderApi.getPaperVirtualBalance(portfolioId);
      if (res.data?.success && res.data?.data) {
        setBalance(res.data.data);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không thể tải số dư ảo');
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, refreshTrigger]);

  // Lắng nghe WebSocket event 'order_filled' để auto-refresh
  useEffect(() => {
    const handleOrderFilled = () => {
      fetchBalance();
    };
    wsService.off('order_filled', handleOrderFilled);
    const socket = (wsService as any).socket;
    if (socket) {
      socket.on('order_filled', handleOrderFilled);
    }
    return () => {
      const s = (wsService as any).socket;
      if (s) s.off('order_filled', handleOrderFilled);
    };
  }, [fetchBalance]);

  if (loading && !balance) {
    return (
      <div className="panel-section p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-white/10 rounded w-32 mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !balance) {
    return (
      <div className="panel-section p-4">
        <p className="text-[11px] text-negative">{error}</p>
        <button onClick={fetchBalance} className="mt-2 text-[10px] text-accent hover:underline">
          Thử lại
        </button>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Tổng Vốn Ảo',
      value: balance?.virtual_balance ?? 0,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border border-green-500/20',
      icon: '💰',
    },
    {
      label: 'Khả Dụng',
      value: balance?.paper_available_cash ?? 0,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border border-blue-500/20',
      icon: '✅',
    },
    {
      label: 'Chờ T+2',
      value: balance?.paper_pending_settlement ?? 0,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10 border border-yellow-500/20',
      icon: '⏳',
    },
    {
      label: 'Đã Deploy',
      value: balance?.paper_deployed ?? 0,
      color: 'text-gray-400',
      bg: 'bg-gray-500/10 border border-gray-500/20',
      icon: '📊',
    },
  ];

  return (
    <div className="panel-section p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-black text-text-main">Số Dư Ảo (Paper Trading)</h3>
          <p className="text-[10px] text-text-muted mt-0.5">Vốn mô phỏng — không liên quan đến tiền thật</p>
        </div>
        <button
          onClick={fetchBalance}
          disabled={loading}
          className="text-[10px] text-accent hover:underline disabled:opacity-40"
        >
          {loading ? 'Đang tải...' : '↻ Làm mới'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-lg p-3 ${m.bg}`}>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1">
              {m.label}
            </p>
            <p className={`text-[14px] font-bold font-mono ${m.color}`}>
              {formatNumberVI(m.value, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[9px] text-text-dim mt-0.5">VND</p>
          </div>
        ))}
      </div>
    </div>
  );
};
