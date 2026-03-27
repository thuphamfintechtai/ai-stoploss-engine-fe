import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { orderApi } from '../services/api';
import type { PaperPerformanceData } from '../services/api';
import { formatNumberVI } from '../constants';

interface PaperPerformanceReportProps {
  portfolioId: string;
  refreshTrigger?: number;
}

type Period = 'all' | 'week' | 'month';

const PERIOD_LABELS: Record<Period, string> = {
  all: 'Tất Cả',
  week: 'Tuần Này',
  month: 'Tháng Này',
};

export const PaperPerformanceReport: React.FC<PaperPerformanceReportProps> = ({
  portfolioId,
  refreshTrigger,
}) => {
  const [period, setPeriod] = useState<Period>('all');
  const [data, setData] = useState<PaperPerformanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await orderApi.getPaperPerformance(portfolioId, period);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      } else {
        setData(null);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không thể tải báo cáo hiệu suất');
    } finally {
      setLoading(false);
    }
  }, [portfolioId, period]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance, refreshTrigger]);

  const pnlColor = (v: number) => (v >= 0 ? '#22c55e' : '#ef4444');

  // Buy & Hold comparison chart data
  const buyHoldChartData =
    data?.buy_hold && data.total_pnl !== undefined
      ? [
          {
            name: 'Thực Tế Trade',
            value: data.total_pnl,
            color: pnlColor(data.total_pnl),
          },
          {
            name: 'Buy & Hold',
            value: data.buy_hold.return,
            color: pnlColor(data.buy_hold.return),
          },
        ]
      : [];

  const metrics = [
    {
      label: 'Tổng P&L',
      value: data?.total_pnl != null ? (
        <span className={data.total_pnl >= 0 ? 'text-positive' : 'text-negative'}>
          {data.total_pnl >= 0 ? '+' : ''}
          {formatNumberVI(data.total_pnl, { maximumFractionDigits: 0 })}
        </span>
      ) : '—',
      sub: 'VND',
    },
    {
      label: 'Tỉ Lệ Thắng',
      value: data?.win_rate != null ? (
        <span className={data.win_rate >= 50 ? 'text-positive' : 'text-negative'}>
          {Number(data.win_rate).toFixed(1)}%
        </span>
      ) : '—',
      sub: `${data?.winning_trades ?? 0}/${data?.total_trades ?? 0} lệnh`,
    },
    {
      label: 'TB Lời',
      value: data?.avg_win != null && data.avg_win > 0 ? (
        <span className="text-positive">
          +{formatNumberVI(data.avg_win, { maximumFractionDigits: 0 })}
        </span>
      ) : '—',
      sub: 'VND / lệnh',
    },
    {
      label: 'TB Lỗ',
      value: data?.avg_loss != null && data.avg_loss < 0 ? (
        <span className="text-negative">
          {formatNumberVI(data.avg_loss, { maximumFractionDigits: 0 })}
        </span>
      ) : '—',
      sub: 'VND / lệnh',
    },
    {
      label: 'Profit Factor',
      value: data?.profit_factor != null && data.profit_factor > 0 ? (
        <span className={
          data.profit_factor >= 1.5 ? 'text-positive' :
          data.profit_factor >= 1 ? 'text-warning' :
          'text-negative'
        }>
          {Number(data.profit_factor).toFixed(2)}
        </span>
      ) : '—',
      sub: data?.profit_factor != null && data.profit_factor > 0
        ? data.profit_factor >= 1.5 ? 'Xuất sắc' : data.profit_factor >= 1.2 ? 'Tốt' : data.profit_factor >= 1 ? 'Đạt' : 'Cần cải thiện'
        : '',
    },
    {
      label: 'Max Drawdown',
      value: data?.max_drawdown_vnd != null && data.max_drawdown_vnd !== 0 ? (
        <span className="text-negative">
          -{formatNumberVI(Math.abs(data.max_drawdown_vnd), { maximumFractionDigits: 0 })}
        </span>
      ) : '—',
      sub: data?.max_drawdown_pct != null && data.max_drawdown_pct !== 0
        ? `${Math.abs(data.max_drawdown_pct).toFixed(2)}%`
        : 'VND',
    },
  ];

  return (
    <div className="panel-section p-4">
      {/* Header + Period Selector */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-black text-text-main">Báo Cáo Hiệu Suất</h3>
          <p className="text-[10px] text-text-muted mt-0.5">Paper Trading — phân tích kết quả giao dịch mô phỏng</p>
        </div>
        <div className="flex gap-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-[10px] font-semibold transition-colors ${
                period === p
                  ? 'bg-accent text-white'
                  : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-main'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-[11px] text-negative mb-2">{error}</p>
          <button onClick={fetchPerformance} className="text-[10px] text-accent hover:underline">
            Thử lại
          </button>
        </div>
      ) : !data || data.total_trades === 0 ? (
        <div className="text-center py-8 text-text-muted">
          <p className="text-[12px] mb-1">Chưa có giao dịch nào</p>
          <p className="text-[10px]">Đặt lệnh paper trading và đợi khớp để xem báo cáo hiệu suất</p>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {metrics.map((m) => (
              <div key={m.label} className="bg-white/[0.03] border border-border-subtle/30 rounded-lg p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                  {m.label}
                </p>
                <p className="text-[16px] font-bold font-mono">{m.value}</p>
                {m.sub && <p className="text-[9px] text-text-dim mt-0.5">{m.sub}</p>}
              </div>
            ))}
          </div>

          {/* Buy & Hold Comparison */}
          {data.buy_hold && (
            <div className="mt-4 p-3 bg-white/[0.03] border border-border-subtle/30 rounded-lg">
              <h4 className="text-[11px] font-bold text-text-muted mb-2 uppercase tracking-wider">
                So Sánh: Trade vs Buy &amp; Hold
              </h4>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-[9px] text-text-dim mb-0.5">Thực Tế Trade</p>
                  <p className={`text-[14px] font-bold font-mono ${data.total_pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {data.total_pnl >= 0 ? '+' : ''}{formatNumberVI(data.total_pnl, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] text-text-dim">VND từ {data.total_trades} lệnh</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-dim mb-0.5">Nếu Buy &amp; Hold</p>
                  <p className={`text-[14px] font-bold font-mono ${data.buy_hold.return >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {data.buy_hold.return >= 0 ? '+' : ''}{formatNumberVI(data.buy_hold.return, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] text-text-dim">
                    {data.buy_hold.return_pct >= 0 ? '+' : ''}{Number(data.buy_hold.return_pct).toFixed(2)}% giá trị
                  </p>
                </div>
              </div>

              {buyHoldChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={buyHoldChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value: number) => [
                        `${value >= 0 ? '+' : ''}${formatNumberVI(value, { maximumFractionDigits: 0 })} VND`,
                        'P&L',
                      ]}
                      contentStyle={{
                        background: '#1a1f2e',
                        border: '1px solid #374151',
                        borderRadius: 6,
                        fontSize: 10,
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {buyHoldChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              <p className="text-[9px] text-text-dim mt-2 text-center">
                {data.total_pnl > data.buy_hold.return
                  ? '✅ Bạn đang outperform buy & hold!'
                  : data.total_pnl === data.buy_hold.return
                  ? '➡ Tương đương buy & hold'
                  : '📉 Underperform so với buy & hold'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
