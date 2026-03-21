import React, { useMemo } from 'react';
import type { Position } from '../services/api';
import { formatNumberVI, STOCK_PRICE_DISPLAY_SCALE } from '../constants';

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
  const r = 60;
  const cx = 80;
  const cy = 80;
  const startAngle = -210;
  const endAngle = 30;
  const totalArc = endAngle - startAngle;
  const fillArc = (clamped / 100) * totalArc;

  const polarToXY = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const arcPath = (startDeg: number, endDeg: number, r: number) => {
    const s = polarToXY(startDeg, r);
    const e = polarToXY(endDeg, r);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const color = clamped < 50 ? '#22C55E' : clamped < 80 ? '#F59E0B' : '#EF4444';
  const label = clamped < 50 ? 'AN TOÀN' : clamped < 80 ? 'CẨN THẬN' : 'NGUY HIỂM';

  return (
    <div className="flex flex-col items-center">
      <svg width={160} height={110} viewBox="0 0 160 110">
        {/* Track */}
        <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12} strokeLinecap="round" />
        {/* Fill */}
        {clamped > 0 && (
          <path d={arcPath(startAngle, startAngle + fillArc, r)} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
        )}
        {/* Needle */}
        {(() => {
          const needleAngle = startAngle + fillArc;
          const tip = polarToXY(needleAngle, r - 2);
          return (
            <>
              <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={2} strokeLinecap="round" />
              <circle cx={cx} cy={cy} r={4} fill={color} />
            </>
          );
        })()}
        {/* Percentage */}
        <text x={cx} y={cy + 22} textAnchor="middle" fill={color} fontSize={18} fontWeight="bold" fontFamily="monospace">
          {clamped.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 36} textAnchor="middle" fill="var(--color-text-muted)" fontSize={9} fontWeight="600" fontFamily="sans-serif" letterSpacing="0.1em">
          {label}
        </text>
      </svg>
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

  const positionsWithRisk = useMemo(() => {
    return openPositions.map((pos) => {
      const riskVnd = getPositionRiskVnd(pos);
      const riskPct = totalBalance > 0 ? (riskVnd / totalBalance) * 100 : 0;
      const entry = Number(pos.entry_price ?? 0);
      const current = Number(pos.current_price ?? pos.entry_price ?? 0);
      const qty = Number(pos.quantity ?? 0);
      const sl = Number((pos as any).stop_loss ?? 0);
      const pnl = (current - entry) * qty;
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-0.5">Tổng Rủi Ro</p>
            <p className={`text-[20px] font-bold font-mono ${riskUsagePct < 50 ? 'text-positive' : riskUsagePct < 80 ? 'text-warning' : 'text-negative'}`}>
              {formatNumberVI(totalRisk)}
            </p>
            <p className="text-[10px] text-text-dim">VND ({riskUsagePct.toFixed(1)}% hạn mức)</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-0.5">Hạn Mức Rủi Ro</p>
            <p className="text-[20px] font-bold font-mono text-warning">{maxRiskPercent}%</p>
            <p className="text-[10px] text-text-dim">≈ {formatNumberVI(maxRiskAmount)} VND</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-0.5">Còn Lại</p>
            <p className="text-[20px] font-bold font-mono text-accent">
              {formatNumberVI(Math.max(0, maxRiskAmount - totalRisk))}
            </p>
            <p className="text-[10px] text-text-dim">{(100 - riskUsagePct).toFixed(1)}% hạn mức</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-0.5">Vị Thế Mở</p>
            <p className="text-[20px] font-bold font-mono text-text-main">{openPositions.length}</p>
            <p className="text-[10px] text-text-dim">đang hoạt động</p>
          </div>
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

      {/* ── Row 2: Gauge + Exposure Chart ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Gauge */}
        <div className="panel-section flex flex-col items-center justify-center p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-4">Mức Rủi Ro Tổng</p>
          <RiskGauge percent={riskUsagePct} />
          <div className="mt-4 flex gap-4 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-positive" />{'<'}50% An toàn</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" />50-80% Cẩn thận</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-negative" />{'>'}80% Nguy hiểm</span>
          </div>
        </div>

        {/* Exposure per symbol */}
        <div className="xl:col-span-2 panel-section flex flex-col">
          <div className="px-4 py-2.5 border-b border-border-subtle shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Phân Bổ Rủi Ro Theo Mã</span>
          </div>
          <div className="flex-1 overflow-y-auto dense-scroll p-4 space-y-3">
            {positionsWithRisk.length === 0 ? (
              <div className="flex items-center justify-center h-full text-text-dim text-[12px]">
                Không có vị thế nào đang mở
              </div>
            ) : (
              positionsWithRisk.map((pos) => {
                const barColor = pos.riskPct < 2 ? 'bg-positive' : pos.riskPct < 4 ? 'bg-warning' : 'bg-negative';
                const barWidth = maxRiskAmount > 0 ? (pos.riskVnd / maxRiskAmount) * 100 : 0;
                return (
                  <div key={pos.id}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-text-main">{pos.symbol}</span>
                        <span className="text-[10px] text-text-muted">{pos.exchange}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] font-mono">
                        <span className={pos.pnl >= 0 ? 'text-positive' : 'text-negative'}>
                          {pos.pnl !== 0 ? (pos.pnl >= 0 ? '+' : '') + formatNumberVI(pos.pnl, { maximumFractionDigits: 0 }) : '—'}
                        </span>
                        <span className={pos.riskPct < 2 ? 'text-positive' : pos.riskPct < 4 ? 'text-warning' : 'text-negative'}>
                          Rủi ro: {pos.riskPct.toFixed(2)}%
                        </span>
                        <span className="text-text-muted">SL -{pos.slDistance.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border-subtle)' }}>
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
                  <th>SL Distance</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {positionsWithRisk.map((pos) => {
                  const entry = Number(pos.entry_price ?? 0) / 1000;
                  const current = Number(pos.current_price ?? pos.entry_price ?? 0) / 1000;
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
                      <td className={pos.pnl >= 0 ? 'text-positive' : 'text-negative'}>
                        {pos.pnl !== 0 ? (pos.pnl >= 0 ? '+' : '') + formatNumberVI(pos.pnl, { maximumFractionDigits: 0 }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
