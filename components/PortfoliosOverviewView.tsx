import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { portfolioApi } from '../services/api';
import { useActivePortfolio } from '../contexts/ActivePortfolioContext';
import { PortfolioType, getPresetLabel } from '../utils/portfolioPresets';
import { CreatePortfolioModal } from './portfolio/CreatePortfolioModal';
import { PresetIcon } from './portfolio/PresetIcon';

interface PortfolioOverviewItem {
  id: string;
  name: string;
  portfolio_type: PortfolioType;
  nav_vnd: number;
  pnl_vnd: number;
  pnl_pct: number;
  open_positions: number;
  risk_usage_pct: number;
}

interface Totals {
  total_nav_vnd: number;
  total_pnl_vnd: number;
  total_pnl_pct: number;
  total_open_positions: number;
  allocation_by_type: { type: string; value_vnd: number; pct: number }[];
}

interface OverviewData {
  portfolios: PortfolioOverviewItem[];
  totals: Totals;
}

const TYPE_COLORS: Record<string, string> = {
  LONG_TERM: '#3b82f6',
  SWING: '#f59e0b',
  DAY_TRADE: '#ef4444',
};

const formatVND = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const pnlColor = (v: number) =>
  v > 0 ? 'text-[var(--color-positive)]' : v < 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-text-muted)]';
const pnlPrefix = (v: number) => (v > 0 ? '+' : '');

interface Props {
  onNavigateToDashboard?: () => void;
}

export const PortfoliosOverviewView: React.FC<Props> = ({ onNavigateToDashboard }) => {
  const { setActivePortfolioId, refreshPortfolios } = useActivePortfolio();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portfolioApi.getOverview();
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Không tải được tổng quan');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);

  const handleSelectPortfolio = (id: string) => {
    setActivePortfolioId(id);
    if (onNavigateToDashboard) onNavigateToDashboard();
  };

  if (loading) {
    return <div className="p-6 text-[12px] text-[var(--color-text-muted)] animate-pulse">Đang tải tổng quan...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-[12px] text-[var(--color-negative)] mb-2">{error}</div>
        <button onClick={fetchOverview} className="px-3 py-1.5 text-[11px] rounded border border-[var(--color-divider)] hover:bg-[var(--color-hover-bg)]">
          Thử lại
        </button>
      </div>
    );
  }

  if (!data || data.portfolios.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-[14px] font-semibold text-[var(--color-text-main)] mb-2">Bạn chưa có danh mục nào</div>
        <div className="text-[12px] text-[var(--color-text-muted)] mb-4">Tạo danh mục đầu tiên để bắt đầu theo dõi rủi ro</div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 text-[12px] rounded bg-[var(--color-accent)] text-white hover:opacity-90"
        >
          + Tạo danh mục đầu tiên
        </button>
        {createOpen && <CreatePortfolioModal onClose={() => { setCreateOpen(false); refreshPortfolios(); fetchOverview(); }} />}
      </div>
    );
  }

  const { portfolios, totals } = data;
  const pieData = totals.allocation_by_type.map(a => ({
    name: getPresetLabel(a.type),
    value: a.value_vnd,
    type: a.type,
  }));

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--color-text-main)]">Tổng quan danh mục</h1>
          <div className="text-[11px] text-[var(--color-text-muted)]">Tất cả {portfolios.length} danh mục của bạn</div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchOverview} className="px-3 py-1.5 text-[11px] rounded border border-[var(--color-divider)] hover:bg-[var(--color-hover-bg)]">
            Làm mới
          </button>
          <button onClick={() => setCreateOpen(true)} className="px-3 py-1.5 text-[11px] rounded bg-[var(--color-accent)] text-white hover:opacity-90">
            + Tạo mới
          </button>
        </div>
      </div>

      {/* Section 1: Total NAV + P/L cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <MetricCard label="Tổng NAV" value={`${formatVND(totals.total_nav_vnd)} đ`} />
        <MetricCard
          label="Tổng Lời/Lỗ"
          value={`${pnlPrefix(totals.total_pnl_vnd)}${formatVND(totals.total_pnl_vnd)} đ`}
          valueClass={pnlColor(totals.total_pnl_vnd)}
        />
        <MetricCard
          label="% Lợi nhuận"
          value={`${pnlPrefix(totals.total_pnl_pct)}${totals.total_pnl_pct.toFixed(2)}%`}
          valueClass={pnlColor(totals.total_pnl_pct)}
        />
        <MetricCard label="Vị thế đang mở" value={String(totals.total_open_positions)} />
      </div>

      {/* Section 2: Allocation pie + risk usage bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="panel-section p-4">
          <h3 className="text-[13px] font-semibold text-[var(--color-text-main)] mb-3">Phân bổ theo loại danh mục</h3>
          {totals.total_nav_vnd > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData.filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={80}
                  label={(entry: any) => `${entry.name}: ${((entry.value / totals.total_nav_vnd) * 100).toFixed(1)}%`}
                >
                  {pieData.filter(d => d.value > 0).map((entry, idx) => (
                    <Cell key={idx} fill={TYPE_COLORS[entry.type] || '#888'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${formatVND(Number(v))} đ`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-[11px] text-[var(--color-text-muted)] py-8 text-center">Chưa có giá trị</div>
          )}
          {/* Show 3 types breakdown including value=0 for consistency */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-divider)]">
            {pieData.map(d => (
              <div key={d.type} className="text-center">
                <div className="w-2 h-2 mx-auto mb-1 rounded-full" style={{ background: TYPE_COLORS[d.type] || '#888' }} />
                <div className="text-[10px] text-[var(--color-text-muted)]">{d.name}</div>
                <div className="text-[11px] font-semibold text-[var(--color-text-main)]">
                  {totals.total_nav_vnd > 0 ? ((d.value / totals.total_nav_vnd) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Total risk usage indicator */}
        <div className="panel-section p-4">
          <h3 className="text-[13px] font-semibold text-[var(--color-text-main)] mb-3">Sử dụng rủi ro theo danh mục</h3>
          <div className="space-y-3">
            {portfolios.map(p => {
              const cappedPct = Math.min(p.risk_usage_pct, 100);
              const overflow = p.risk_usage_pct > 100;
              const barColor = overflow ? '#dc2626' : cappedPct > 70 ? '#f59e0b' : '#10b981';
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[var(--color-text-main)] truncate">{p.name}</span>
                    <span className={`tabular-nums ${overflow ? 'text-[var(--color-negative)]' : 'text-[var(--color-text-muted)]'}`}>
                      {p.risk_usage_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-divider)] rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${cappedPct}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 3: Per-portfolio table */}
      <div className="panel-section p-4">
        <h3 className="text-[13px] font-semibold text-[var(--color-text-main)] mb-3">Chi tiết danh mục</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--color-divider)] text-left text-[10px] uppercase text-[var(--color-text-muted)]">
                <th className="py-2 pr-3">Tên</th>
                <th className="py-2 pr-3">Loại</th>
                <th className="py-2 pr-3 text-right">NAV (VND)</th>
                <th className="py-2 pr-3 text-right">Lời/Lỗ</th>
                <th className="py-2 pr-3 text-right">%</th>
                <th className="py-2 pr-3 text-right">Vị thế</th>
                <th className="py-2 text-right">Rủi ro</th>
              </tr>
            </thead>
            <tbody>
              {portfolios.map(p => (
                <tr
                  key={p.id}
                  onClick={() => handleSelectPortfolio(p.id)}
                  className="border-b border-[var(--color-divider)] hover:bg-[var(--color-hover-bg)] cursor-pointer"
                  title="Click để chuyển sang danh mục này"
                >
                  <td className="py-2.5 pr-3 font-semibold text-[var(--color-text-main)]">
                    <span className="inline-flex items-center gap-1.5">
                      <PresetIcon type={p.portfolio_type} size={14} className="text-[var(--color-text-muted)] shrink-0" />
                      {p.name}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className="inline-block px-2 py-0.5 text-[10px] rounded"
                      style={{ background: `${TYPE_COLORS[p.portfolio_type]}22`, color: TYPE_COLORS[p.portfolio_type] }}
                    >
                      {getPresetLabel(p.portfolio_type)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatVND(p.nav_vnd)}</td>
                  <td className={`py-2.5 pr-3 text-right tabular-nums ${pnlColor(p.pnl_vnd)}`}>
                    {pnlPrefix(p.pnl_vnd)}{formatVND(p.pnl_vnd)}
                  </td>
                  <td className={`py-2.5 pr-3 text-right tabular-nums ${pnlColor(p.pnl_pct)}`}>
                    {pnlPrefix(p.pnl_pct)}{p.pnl_pct.toFixed(2)}%
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{p.open_positions}</td>
                  <td className="py-2.5 text-right tabular-nums text-[var(--color-text-muted)]">{p.risk_usage_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && <CreatePortfolioModal onClose={() => { setCreateOpen(false); refreshPortfolios(); fetchOverview(); }} />}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass = 'text-[var(--color-text-main)]' }) => (
  <div className="panel-section p-3">
    <div className="text-[10px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">{label}</div>
    <div className={`text-[16px] font-bold tabular-nums ${valueClass}`}>{value}</div>
  </div>
);
