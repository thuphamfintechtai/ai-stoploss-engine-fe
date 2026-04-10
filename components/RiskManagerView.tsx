import React, { useMemo, useState, useEffect } from 'react';
import type { Position, RiskBudgetResult, VaRResult, MonteCarloResult, StressTestResult, SectorConcentrationResult } from '../services/api';
import { getRiskBudget, getRebalancingSuggestions, getVaR, getMonteCarloSimulation, getStressTest, getSectorConcentration } from '../services/api';
import { formatNumberVI, STOCK_PRICE_DISPLAY_SCALE } from '../constants';
import { InfoCard } from './ui/InfoCard';
import { FinancialTooltip } from './ui/Tooltip';
import { StatCard } from './ui/StatCard';
import { SkeletonCard } from './ui/SkeletonLoader';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Props {
  portfolioId: string | null;
  positions: Position[];
  totalBalance: number;
  maxRiskPercent: number;
  onNavigate: (view: string) => void;
}

function getPositionRiskVnd(pos: Position): number {
  const entry = Number(pos.entry_price ?? 0);
  const sl = Number((pos as any).stop_loss ?? 0);
  const qty = Number(pos.quantity ?? 0);
  if (!entry || !sl || !qty) return 0;
  return Math.max(0, (entry - sl) * qty);
}

function RiskGauge({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const color = clamped < 50 ? 'var(--color-positive)' : clamped < 80 ? 'var(--color-warning)' : 'var(--color-negative)';
  const label = clamped < 50 ? 'An toàn' : clamped < 80 ? 'Cẩn thận' : 'Nguy hiểm';
  const bgColor = clamped < 50 ? 'var(--color-positive)' : clamped < 80 ? 'var(--color-warning)' : 'var(--color-negative)';

  return (
    <div className="flex items-center gap-4">
      {/* Circular progress */}
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-border-subtle)" strokeWidth="5" />
          <circle
            cx="32" cy="32" r="28" fill="none"
            stroke={bgColor} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * 175.9} 175.9`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[14px] font-bold tabular-nums" style={{ color }}>{clamped.toFixed(0)}%</span>
        </div>
      </div>
      {/* Label + bar */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold" style={{ color }}>{label}</p>
        <div className="h-1.5 rounded-full overflow-hidden bg-[var(--color-border-subtle)] mt-1.5">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${clamped}%`, backgroundColor: bgColor }} />
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-[var(--color-text-dim)]">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>
    </div>
  );
}

export const RiskManagerView: React.FC<Props> = ({
  portfolioId,
  positions,
  totalBalance,
  maxRiskPercent,
  onNavigate,
}) => {
  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const maxRiskAmount = (totalBalance * maxRiskPercent) / 100;

  // Risk budget + rebalancing state
  const [riskBudget, setRiskBudget] = useState<RiskBudgetResult | null>(null);
  const [riskBudgetLoading, setRiskBudgetLoading] = useState(false);
  const [rebalancing, setRebalancing] = useState<any>(null);

  // Risk simulation state
  const [riskSimTab, setRiskSimTab] = useState<'var' | 'montecarlo' | 'stress' | 'sector'>('var');
  const [varResult, setVarResult] = useState<VaRResult | null>(null);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [stressResult, setStressResult] = useState<StressTestResult | null>(null);
  const [sectorResult, setSectorResult] = useState<SectorConcentrationResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [customDrop, setCustomDrop] = useState<string>('');
  const [expandedScenarioIdx, setExpandedScenarioIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!portfolioId) {
      setRiskBudget(null);
      setRebalancing(null);
      return;
    }
    setRiskBudgetLoading(true);
    Promise.all([
      getRiskBudget(portfolioId).catch(() => null),
      getRebalancingSuggestions(portfolioId).catch(() => null),
    ]).then(([budget, rebal]) => {
      setRiskBudget(budget);
      setRebalancing(rebal);
    }).finally(() => setRiskBudgetLoading(false));
  }, [portfolioId]);

  // Fetch VaR + Sector khi portfolioId thay doi (nhe, fetch ngay)
  useEffect(() => {
    if (!portfolioId) {
      setVarResult(null);
      setSectorResult(null);
      setMcResult(null);
      setStressResult(null);
      return;
    }
    getVaR(portfolioId).then(setVarResult).catch(() => setVarResult(null));
    getSectorConcentration(portfolioId).then(setSectorResult).catch(() => setSectorResult(null));
  }, [portfolioId]);

  const handleSimTabChange = async (tab: 'var' | 'montecarlo' | 'stress' | 'sector') => {
    setRiskSimTab(tab);
    if (!portfolioId) return;
    if (tab === 'montecarlo' && !mcResult) {
      setSimLoading(true);
      getMonteCarloSimulation(portfolioId).then(setMcResult).catch(() => setMcResult(null)).finally(() => setSimLoading(false));
    }
    if (tab === 'stress' && !stressResult) {
      setSimLoading(true);
      getStressTest(portfolioId).then(setStressResult).catch(() => setStressResult(null)).finally(() => setSimLoading(false));
    }
  };

  const handleCustomStress = async () => {
    if (!portfolioId) return;
    const drop = parseFloat(customDrop);
    if (isNaN(drop) || drop >= 0 || drop < -50) return;
    setSimLoading(true);
    getStressTest(portfolioId, drop).then(setStressResult).catch(() => setStressResult(null)).finally(() => setSimLoading(false));
  };

  const positionsWithRisk = useMemo(() => {
    return openPositions.map((pos) => {
      const riskVnd = getPositionRiskVnd(pos);
      const riskPct = totalBalance > 0 ? (riskVnd / totalBalance) * 100 : 0;
      const entry = Number(pos.entry_price ?? 0);
      const rawCurrent = (pos as any).current_price != null ? Number((pos as any).current_price) : null;
      const current = rawCurrent != null && Number.isFinite(rawCurrent) && rawCurrent > 0 ? rawCurrent : entry;
      const qty = Number(pos.quantity ?? 0);
      const sl = Number((pos as any).stop_loss ?? 0);
      const hasCurrent = rawCurrent != null && rawCurrent > 0;
      const pnl = hasCurrent ? (current - entry) * qty : null;
      const slDistance = entry > 0 && sl > 0 ? ((entry - sl) / entry) * 100 : 0;
      return { ...pos, riskVnd, riskPct, pnl, slDistance };
    }).sort((a, b) => b.riskPct - a.riskPct);
  }, [openPositions, totalBalance]);

  const totalRisk = positionsWithRisk.reduce((s, p) => s + p.riskVnd, 0);
  const riskUsagePct = maxRiskAmount > 0 ? (totalRisk / maxRiskAmount) * 100 : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Summary Bar ── */}
      <div className="panel-section p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Tổng Rủi Ro"
            value={formatNumberVI(totalRisk)}
            suffix=" VND"
            change={riskUsagePct < 50 ? -1 : riskUsagePct < 80 ? 0 : 1}
            tooltip="Tổng số tiền có thể mất nếu tất cả stop loss bị kích hoạt"
            size="md"
          />
          <StatCard
            label="Hạn Mức Rủi Ro"
            value={maxRiskPercent.toFixed(0)}
            suffix="%"
            tooltip="Phần trăm vốn tối đa được phép rủi ro"
            size="md"
          />
          <StatCard
            label="Còn Lại"
            value={formatNumberVI(Math.max(0, maxRiskAmount - totalRisk))}
            suffix=" VND"
            tooltip="Ngân sách rủi ro còn lại có thể sử dụng"
            size="md"
          />
          <StatCard
            label="Vị Thế Mở"
            value={String(openPositions.length)}
            tooltip="Số vị thế đang hoạt động"
            size="md"
          />
        </div>

        {/* Overall risk bar */}
        {riskUsagePct >= 80 && (
          <div className="mt-4 p-3 rounded-md border border-negative/30 bg-negative/5 text-[12px] text-negative font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Cảnh báo: Rủi ro đã vượt 80% hạn mức! Xem xét đóng bớt vị thế.
          </div>
        )}
      </div>

      {/* ── Row 2: Risk Gauge + Phân bổ rủi ro ── */}
      <div className="panel-section">
        <div className="px-4 py-3 border-b border-border-subtle grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
          {/* Gauge bên trái */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Mức rủi ro tổng</p>
            <RiskGauge percent={riskUsagePct} />
          </div>
          {/* Phân bổ theo mã bên phải */}
          <div className="space-y-2 overflow-y-auto dense-scroll max-h-[180px]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Phân bổ theo mã</p>
            {positionsWithRisk.length === 0 ? (
              <div className="text-text-dim text-[11px]">Không có vị thế nào đang mở</div>
            ) : (
              positionsWithRisk.map((pos) => {
                const barColor = pos.riskPct < 2 ? 'bg-positive' : pos.riskPct < 4 ? 'bg-warning' : 'bg-negative';
                const barWidth = maxRiskAmount > 0 ? (pos.riskVnd / maxRiskAmount) * 100 : 0;
                return (
                  <div key={pos.id}>
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-bold text-text-main">{pos.symbol}</span>
                        <span className="text-[9px] text-text-muted">{pos.exchange}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono">
                        <span className={pos.pnl != null && pos.pnl >= 0 ? 'text-positive' : pos.pnl != null ? 'text-negative' : 'text-text-muted'}>
                          {pos.pnl != null ? (pos.pnl >= 0 ? '+' : '') + formatNumberVI(pos.pnl, { maximumFractionDigits: 0 }) : '—'}
                        </span>
                        <span className={pos.riskPct < 2 ? 'text-positive' : pos.riskPct < 4 ? 'text-warning' : 'text-negative'}>
                          {pos.riskPct.toFixed(2)}%
                        </span>
                        <span className="text-text-muted">SL -{pos.slDistance.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border-subtle)' }}>
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(100, barWidth)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Ngân sách rủi ro (Risk Budget AI) ── */}
      {portfolioId && (riskBudgetLoading || riskBudget) && (
        <div className="panel-section">
          <div className="px-4 py-2.5 border-b border-border-subtle">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Ngân Sách Rủi Ro</span>
          </div>
          {riskBudgetLoading && (
            <div className="p-3 text-center text-[11px] text-text-dim flex items-center justify-center gap-2">
              <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              Đang tính ngân sách rủi ro...
            </div>
          )}
          {riskBudget && !riskBudgetLoading && (
            <div className="p-4 space-y-3">
              {/* Budget summary — compact inline */}
              <div className="flex items-center gap-4">
                <div className="shrink-0 w-[140px]">
                  <RiskGauge percent={riskBudget.usedRiskPercent ?? 0} />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3 text-[10px]">
                  <div>
                    <span className="text-text-muted font-semibold">Đã dùng</span>
                    <p className="font-mono text-negative text-[12px]">{formatNumberVI(riskBudget.usedRiskVnd ?? 0)}</p>
                  </div>
                  <div>
                    <span className="text-text-muted font-semibold">Còn lại</span>
                    <p className="font-mono text-positive text-[12px]">{formatNumberVI(riskBudget.remainingBudget ?? 0)}</p>
                  </div>
                </div>
              </div>

              {/* Tập trung ngành */}
              {Array.isArray(riskBudget.sectorConcentration) && riskBudget.sectorConcentration.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Tập trung ngành</p>
                  <div className="space-y-1.5">
                    {riskBudget.sectorConcentration.map((sector: any, i: number) => {
                      const pct = typeof sector.percent === 'number' ? sector.percent : 0;
                      const isHigh = pct > 30;
                      return (
                        <div key={i}>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[10px] text-text-main">{sector.sectorLabel ?? sector.sector ?? 'Khác'}</span>
                            <span className={`text-[10px] font-mono font-bold ${isHigh ? 'text-negative' : 'text-text-muted'}`}>{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border-subtle)' }}>
                            <div
                              className={`h-full rounded-full transition-all ${isHigh ? 'bg-negative' : 'bg-accent'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cảnh báo tái cân bằng */}
              {rebalancing && (
                <div className="space-y-2">
                  {Array.isArray(rebalancing.warnings) && rebalancing.warnings.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-warning uppercase tracking-wider">Cảnh báo tái cân bằng</p>
                      {rebalancing.warnings.map((w: any, i: number) => {
                        let text: string;
                        if (typeof w === 'string') {
                          text = w;
                        } else if (w?.sectorLabel && w?.percent != null) {
                          text = `Ngành ${w.sectorLabel} chiếm ${Number(w.percent).toFixed(1)}% danh mục (ngưỡng cảnh báo: 30%)`;
                        } else {
                          text = w?.message ?? w?.text ?? JSON.stringify(w);
                        }
                        return (
                          <div key={i} className="px-2 py-1 rounded bg-warning/5 border border-warning/20 text-[9px] text-warning/90 flex items-start gap-1.5">
                            <span className="shrink-0">⚠</span><span>{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {Array.isArray(rebalancing.suggestions) && rebalancing.suggestions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Đề xuất tái cân bằng</p>
                      <div className="space-y-1">
                        {rebalancing.suggestions.map((s: any, i: number) => {
                          if (typeof s === 'string') return (
                            <div key={i} className="panel-section p-2">
                              <p className="text-[9px] text-text-muted leading-relaxed">{s}</p>
                            </div>
                          );
                          return (
                            <div key={i} className="panel-section p-2">
                              <p className="text-[10px] font-semibold text-text-main mb-0.5">{s.symbol ?? `Đề xuất ${i + 1}`}</p>
                              {s.narrative && <p className="text-[9px] text-text-muted leading-relaxed">{typeof s.narrative === 'string' ? s.narrative : JSON.stringify(s.narrative)}</p>}
                              {!s.narrative && s.action && <p className="text-[9px] text-text-muted">{typeof s.action === 'string' ? s.action : JSON.stringify(s.action)}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {rebalancing.narrative && (
                    <div className="panel-section p-2">
                      <p className="text-[9px] text-text-muted leading-relaxed">{rebalancing.narrative}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Position Risk Table ── */}
      <div className="panel-section">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Bảng Rủi Ro Chi Tiết</span>
          <button onClick={() => onNavigate('terminal')} className="text-[10px] text-accent hover:underline">
            + Đặt lệnh mới
          </button>
        </div>
        <div className="overflow-x-auto">
          {positionsWithRisk.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-[12px]">Không có vị thế nào đang mở</div>
          ) : (
            <table className="table-terminal w-full">
              <thead>
                <tr>
                  <th className="text-left">Mã</th>
                  <th>Giá Vào</th>
                  <th>Hiện Tại</th>
                  <th>Stop Loss</th>
                  <th>KL</th>
                  <th>Rủi Ro (VND)</th>
                  <th>Rủi Ro (%)</th>
                  <th>Khoảng Cách SL</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {positionsWithRisk.map((pos) => {
                  const entry = Number(pos.entry_price ?? 0) / 1000;
                  const current = Number((pos as any).current_price ?? pos.entry_price ?? 0) / 1000;
                  const sl = Number((pos as any).stop_loss ?? 0) / 1000;
                  const qty = Number(pos.quantity ?? 0);
                  const rowCls = pos.riskPct >= 4 ? 'row-loss' : pos.riskPct >= 2 ? '' : '';
                  return (
                    <tr key={pos.id} className={rowCls}>
                      <td className="text-left font-bold text-text-main">{pos.symbol}</td>
                      <td className="text-text-muted">{entry > 0 ? entry.toFixed(2) : '—'}</td>
                      <td className={current > 0 ? (current > entry ? 'text-positive' : current < entry ? 'text-negative' : 'text-warning') : 'text-text-muted'}>
                        {current > 0 ? current.toFixed(2) : '—'}
                      </td>
                      <td className="text-negative">{sl > 0 ? sl.toFixed(2) : '—'}</td>
                      <td>{qty > 0 ? formatNumberVI(qty, { maximumFractionDigits: 0 }) : '—'}</td>
                      <td className={pos.riskVnd > 0 ? (pos.riskPct >= 4 ? 'text-negative' : pos.riskPct >= 2 ? 'text-warning' : 'text-positive') : 'text-text-muted'}>
                        {pos.riskVnd > 0 ? formatNumberVI(pos.riskVnd, { maximumFractionDigits: 0 }) : '—'}
                      </td>
                      <td className={pos.riskPct >= 4 ? 'text-negative' : pos.riskPct >= 2 ? 'text-warning' : 'text-positive'}>
                        {pos.riskPct > 0 ? pos.riskPct.toFixed(2) + '%' : '—'}
                      </td>
                      <td className="text-negative">
                        {pos.slDistance > 0 ? '-' + pos.slDistance.toFixed(2) + '%' : '—'}
                      </td>
                      <td className={pos.pnl != null && pos.pnl >= 0 ? 'text-positive' : pos.pnl != null ? 'text-negative' : 'text-text-muted'}>
                        {pos.pnl != null ? (pos.pnl >= 0 ? '+' : '') + formatNumberVI(pos.pnl, { maximumFractionDigits: 0 }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Phan Tich Rui Ro Nang Cao ── */}
      {portfolioId && (
        <div className="panel-section">
          <div className="px-4 py-2.5 border-b border-border-subtle">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Phân Tích Rủi Ro Nâng Cao</span>
          </div>

          {/* Tab bar - scrollable on mobile */}
          <div className="flex gap-0 border-b border-border-subtle px-4 overflow-x-auto whitespace-nowrap">
            {([
              { key: 'var', label: 'VaR' },
              { key: 'montecarlo', label: 'Monte Carlo' },
              { key: 'stress', label: 'Stress Test' },
              { key: 'sector', label: 'Sector' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleSimTabChange(tab.key)}
                className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors shrink-0 ${
                  riskSimTab === tab.key
                    ? 'text-accent border-b-2 border-accent -mb-px'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* ── VaR Tab ── */}
            {riskSimTab === 'var' && (
              <div className="space-y-4">
                <InfoCard title="VaR là gì?" variant="info" defaultOpen={false}>
                  <p>Value at Risk (<FinancialTooltip term="VaR" />) cho bạn biết: "Với 95% tin cậy, danh mục của bạn sẽ KHÔNG mất quá X đồng trong 1 ngày."</p>
                  <p className="mt-1 text-text-muted text-[11px]">Ví dụ: VaR = 5 triệu VND nghĩa là 95% khả năng bạn không mất quá 5 triệu trong 1 ngày giao dịch.</p>
                </InfoCard>
                {!varResult ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-text-dim text-[12px]">
                    <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                    Đang tính VaR...
                  </div>
                ) : (
                  <>
                    {/* VaR summary */}
                    <div className="space-y-3">
                      <p className="text-[14px] font-semibold text-negative leading-relaxed">
                        {varResult.portfolioVaR.summary ||
                          `Với ${varResult.portfolioVaR.confidenceLevel ?? 95}% tin cậy, tổn thất tối đa 1 ngày là ${formatNumberVI(varResult.portfolioVaR.varVnd, { maximumFractionDigits: 0 })} VND (${varResult.portfolioVaR.varPercent?.toFixed(2) ?? 0}% danh mục)`}
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <StatCard label="VaR 95% (1 ngày)" value={formatNumberVI(varResult.portfolioVaR.varVnd, { maximumFractionDigits: 0 })} suffix=" VND" size="md" tooltip="VaR" />
                        <StatCard label="VaR (%)" value={varResult.portfolioVaR.varPercent?.toFixed(2) ?? '0'} suffix="%" size="md" />
                        <StatCard label="Tin cậy" value={String(varResult.portfolioVaR.confidenceLevel ?? 95)} suffix="%" size="md" />
                      </div>
                    </div>

                    {/* Per-position VaR table */}
                    {Array.isArray(varResult.positionVaRs) && varResult.positionVaRs.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2"><FinancialTooltip term="VaR" /> Theo Vị Thế</p>
                        <table className="table-terminal w-full">
                          <thead>
                            <tr>
                              <th className="text-left">Mã</th>
                              <th>VaR (VND)</th>
                              <th>VaR (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {varResult.positionVaRs.map((pv, i) => (
                              <tr key={i}>
                                <td className="text-left font-bold text-text-main">{pv.symbol}</td>
                                <td className="text-negative font-mono">{formatNumberVI(pv.varVnd, { maximumFractionDigits: 0 })}</td>
                                <td className="text-negative font-mono">{pv.varPercent?.toFixed(2) ?? 0}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Monte Carlo Tab ── */}
            {riskSimTab === 'montecarlo' && (
              <div className="space-y-4">
                <InfoCard title="Monte Carlo Simulation là gì?" variant="info" defaultOpen={false}>
                  <p>Hệ thống chạy 1,000 kịch bản ngẫu nhiên dựa trên dữ liệu lịch sử để dự đoán nhiều kết quả có thể xảy ra.</p>
                  <p className="mt-1 text-text-muted text-[11px]">Giống như dự báo thời tiết: không nói chính xác ngày mai thế nào, nhưng cho biết phạm vi khả năng.</p>
                </InfoCard>
                {simLoading && !mcResult ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-text-dim text-[12px]">
                    <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                    Đang chạy Monte Carlo simulation...
                  </div>
                ) : !mcResult ? (
                  <div className="text-center py-8 text-text-dim text-[12px]">Không đủ dữ liệu để chạy simulation</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted"><FinancialTooltip term="Monte Carlo" /> Fan Chart 20 Ngày</p>
                      <p className="text-[11px] text-warning font-semibold">
                        Xác suất lỗ vốn: {mcResult.probabilityOfLoss?.toFixed(1) ?? 0}%
                      </p>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart
                        data={Array.from({ length: (mcResult.percentileBands.p50?.length ?? 20) }, (_, i) => ({
                          day: i + 1,
                          p5: mcResult.percentileBands.p5?.[i] ?? 0,
                          p25: mcResult.percentileBands.p25?.[i] ?? 0,
                          p50: mcResult.percentileBands.p50?.[i] ?? 0,
                          p75: mcResult.percentileBands.p75?.[i] ?? 0,
                          p95: mcResult.percentileBands.p95?.[i] ?? 0,
                        }))}
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      >
                        <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumberVI(v, { maximumFractionDigits: 0 })} width={80} />
                        <Tooltip
                          contentStyle={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border-subtle)', fontSize: 10 }}
                          formatter={(value: number) => formatNumberVI(value, { maximumFractionDigits: 0 })}
                          labelFormatter={(l) => `Ngày ${l}`}
                        />
                        <Area type="monotone" dataKey="p95" stroke="#22C55E" fill="#22C55E" fillOpacity={0.1} strokeWidth={1} />
                        <Area type="monotone" dataKey="p75" stroke="#22C55E" fill="#22C55E" fillOpacity={0.2} strokeWidth={1} />
                        <Area type="monotone" dataKey="p50" stroke="#3B82F6" fill="none" strokeWidth={2} strokeDasharray="4 2" />
                        <Area type="monotone" dataKey="p25" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} strokeWidth={1} />
                        <Area type="monotone" dataKey="p5" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} strokeWidth={1} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 text-[9px] text-text-muted">
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-positive inline-block" />P95 (tốt nhất)</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-positive opacity-60 inline-block" />P75</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-accent inline-block" style={{ borderTop: '2px dashed' }} />P50 (trung vị)</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-negative opacity-60 inline-block" />P25</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-negative inline-block" />P5 (xấu nhất)</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Stress Test Tab ── */}
            {riskSimTab === 'stress' && (
              <div className="space-y-4">
                <InfoCard title="Stress Test là gì?" variant="warning" defaultOpen={false}>
                  <p>Kiểm tra: "Nếu VNINDEX giảm 10%, 15%, 20% thì danh mục của bạn bị ảnh hưởng thế nào?"</p>
                  <p className="mt-1 text-text-muted text-[11px]">Giúp bạn chuẩn bị tinh thần và kế hoạch cho trường hợp xấu nhất.</p>
                </InfoCard>
                {simLoading && !stressResult ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-text-dim text-[12px]">
                    <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                    Đang chạy stress test...
                  </div>
                ) : !stressResult ? (
                  <div className="text-center py-8 text-text-dim text-[12px]">Không đủ dữ liệu để chạy stress test</div>
                ) : (
                  <>
                    {/* Scenario cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {stressResult.scenarios.map((sc, idx) => (
                        <div
                          key={idx}
                          className={`rounded-md border p-3 cursor-pointer transition-colors ${
                            expandedScenarioIdx === idx
                              ? 'border-accent/50 bg-accent/5'
                              : 'border-border-subtle hover:border-accent/30'
                          }`}
                          onClick={() => setExpandedScenarioIdx(expandedScenarioIdx === idx ? null : idx)}
                        >
                          <p className="text-[11px] font-bold text-negative">{sc.dropPercent}%</p>
                          <p className="text-[10px] text-text-muted mt-0.5">Thị trường giảm</p>
                          <p className="text-[13px] font-bold font-mono text-negative mt-1">
                            -{formatNumberVI(Math.abs(sc.totalImpactVnd), { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-[10px] text-text-muted">{Math.abs(sc.totalImpactPercent)?.toFixed(2)}% portfolio</p>
                          <p className="text-[9px] text-accent mt-1">{expandedScenarioIdx === idx ? '▲ Thu gọn' : '▼ Chi tiết'}</p>
                        </div>
                      ))}
                    </div>

                    {/* Expanded detail table */}
                    {expandedScenarioIdx !== null && stressResult.scenarios[expandedScenarioIdx] && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                          <FinancialTooltip term="Stress Test" /> — Kịch Bản {stressResult.scenarios[expandedScenarioIdx].dropPercent}%
                        </p>
                        <table className="table-terminal w-full">
                          <thead>
                            <tr>
                              <th className="text-left">Mã</th>
                              <th>Beta</th>
                              <th>Impact (VND)</th>
                              <th>Impact (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stressResult.scenarios[expandedScenarioIdx].positions.map((p, i) => (
                              <tr key={i}>
                                <td className="text-left font-bold text-text-main">{p.symbol}</td>
                                <td className="font-mono text-text-muted">{p.beta?.toFixed(2) ?? '—'}</td>
                                <td className="text-negative font-mono">{formatNumberVI(p.impactVnd, { maximumFractionDigits: 0 })}</td>
                                <td className="text-negative font-mono">{Math.abs(p.impactPercent)?.toFixed(2)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Custom scenario */}
                    <div className="border-t border-border-subtle pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Kịch Bản Tùy Chỉnh</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={-50}
                          max={-1}
                          step={1}
                          placeholder="-25"
                          value={customDrop}
                          onChange={(e) => setCustomDrop(e.target.value)}
                          className="w-24 px-2 py-1 text-[11px] rounded border border-border-subtle bg-bg-input text-text-main focus:outline-none focus:border-accent"
                        />
                        <span className="text-[10px] text-text-muted">% (từ -50 đến -1)</span>
                        <button
                          onClick={handleCustomStress}
                          disabled={simLoading}
                          className="px-3 py-1 text-[10px] font-semibold rounded bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 disabled:opacity-50 transition-colors"
                        >
                          {simLoading ? 'Đang chạy...' : 'Chạy'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Sector Tab ── */}
            {riskSimTab === 'sector' && (
              <div className="space-y-4">
                <InfoCard title="Tại sao cần đa dạng hóa ngành?" variant="tip" defaultOpen={false}>
                  <p>Nếu bạn đầu tư quá nhiều vào 1 ngành (ví dụ: 50% vào ngân hàng), khi ngành đó gặp khó khăn, toàn bộ danh mục chịu ảnh hưởng.</p>
                  <p className="mt-1 text-text-muted text-[11px]">Quy tắc: Không quá 30-40% vào 1 ngành duy nhất.</p>
                </InfoCard>
                {!sectorResult ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-text-dim text-[12px]">
                    <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                    Đang tải phân bổ ngành...
                  </div>
                ) : sectorResult.sectors.length === 0 ? (
                  <div className="text-center py-8 text-text-dim text-[12px]">Không đủ dữ liệu phân bổ ngành</div>
                ) : (
                  <>
                    {(() => {
                      const SECTOR_COLORS = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6B7280'];
                      const pieData = sectorResult.sectors.map((s, i) => ({
                        name: s.sectorLabel || s.sector,
                        value: s.percent,
                        warningLevel: s.warningLevel,
                        color: SECTOR_COLORS[i % SECTOR_COLORS.length],
                      }));
                      return (
                        <>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                            <ResponsiveContainer width={200} height={200}>
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={85}
                                  paddingAngle={2}
                                  dataKey="value"
                                >
                                  {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border-subtle)', fontSize: 10 }}
                                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Tỷ trọng']}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-1.5">
                              {pieData.map((entry, i) => {
                                const sector = sectorResult.sectors[i];
                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                    <span className="text-[11px] text-text-main flex-1">{entry.name}</span>
                                    <span className="text-[11px] font-mono text-text-muted">{entry.value.toFixed(1)}%</span>
                                    {sector.warningLevel === 'RED' && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-negative/10 text-negative border border-negative/30">RED</span>
                                    )}
                                    {sector.warningLevel === 'YELLOW' && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning/10 text-warning border border-warning/30">YELLOW</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Warnings */}
                          {Array.isArray(sectorResult.warnings) && sectorResult.warnings.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-semibold text-warning uppercase tracking-wider">Cảnh Báo <FinancialTooltip term="Sector Concentration" /></p>
                              {sectorResult.warnings.map((w: any, i: number) => (
                                <div key={i} className="px-2.5 py-1.5 rounded bg-warning/5 border border-warning/20 text-[9px] text-warning/90 flex items-start gap-1.5">
                                  <span className="shrink-0">⚠</span><span>{typeof w === 'string' ? w : (w?.message ?? w?.text ?? JSON.stringify(w))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
