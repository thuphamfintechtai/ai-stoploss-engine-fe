import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { positionApi } from '../services/api';
import type { Position } from '../services/api';
import { formatNumberVI, PRICE_LOCALE, PRICE_FRACTION_OPTIONS, STOCK_PRICE_DISPLAY_SCALE } from '../constants';

interface Props {
  portfolioId: string | null;
  totalBalance: number;
  maxRiskPercent: number;
  expectedReturnPercent: number;
  openPositions: Position[];
  onNavigate: (view: string) => void;
  onRefreshPositions: () => void;
  onOpenSetup: () => void;
}

const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);

function getPositionPnl(pos: Position) {
  const entry = Number(pos.entry_price ?? 0);
  const current = Number((pos as any).current_price ?? pos.entry_price ?? 0);
  const qty = Number(pos.quantity ?? 0);
  return (current - entry) * qty;
}

export const PortfolioView: React.FC<Props> = ({
  portfolioId,
  totalBalance,
  maxRiskPercent,
  expectedReturnPercent,
  openPositions,
  onNavigate,
  onRefreshPositions,
  onOpenSetup,
}) => {
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loadingClosed, setLoadingClosed] = useState(false);
  const [closedPage, setClosedPage] = useState(1);
  const [closedTotal, setClosedTotal] = useState(0);
  const CLOSED_PAGE_SIZE = 20;

  useEffect(() => {
    if (!portfolioId) return;
    loadClosed();
  }, [portfolioId, closedPage]);

  const loadClosed = async () => {
    if (!portfolioId) return;
    setLoadingClosed(true);
    try {
      const res = await positionApi.list(portfolioId, {
        status: 'CLOSED_TP,CLOSED_SL,CLOSED_MANUAL',
        page: closedPage,
        limit: CLOSED_PAGE_SIZE,
      } as any);
      if (res.data?.success) {
        setClosedPositions(res.data.data ?? []);
        setClosedTotal(res.data.total ?? 0);
      }
    } catch {
      // fallback
    } finally {
      setLoadingClosed(false);
    }
  };

  // Summary metrics
  const totalOpenPnl = openPositions.reduce((s, p) => s + getPositionPnl(p), 0);
  const totalClosedPnl = closedPositions.reduce((s, p) => s + getPositionPnl(p), 0);
  const winCount = closedPositions.filter((p) => getPositionPnl(p) >= 0).length;
  const winRate = closedPositions.length > 0 ? (winCount / closedPositions.length) * 100 : 0;
  const maxRiskAmount = (totalBalance * maxRiskPercent) / 100;

  // Mock equity curve (7 days)
  const equityCurve = Array.from({ length: 20 }, (_, i) => ({
    date: `D-${20 - i}`,
    value: totalBalance + totalClosedPnl * (i / 20),
  }));

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { label: string; cls: string }> = {
      OPEN: { label: 'Đang mở', cls: 'text-accent bg-accent/10' },
      CLOSED_TP: { label: 'Chốt lời', cls: 'text-positive bg-positive/10' },
      CLOSED_SL: { label: 'Dừng lỗ', cls: 'text-negative bg-negative/10' },
      CLOSED_MANUAL: { label: 'Đóng thủ công', cls: 'text-text-muted bg-white/5' },
    };
    const s = map[status] ?? { label: status, cls: 'text-text-muted bg-white/5' };
    return (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${s.cls}`}>{s.label}</span>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── HEADER BAR ── */}
      <div className="panel-section p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-0.5">Tổng Vốn</p>
              <p className="text-[20px] font-bold font-mono text-text-main">{formatNumberVI(totalBalance)}</p>
              <p className="text-[10px] text-text-dim">VND</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-0.5">P&L Mở</p>
              <p className={`text-[20px] font-bold font-mono ${totalOpenPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                {totalOpenPnl !== 0 ? (totalOpenPnl >= 0 ? '+' : '') + formatNumberVI(totalOpenPnl) : '—'}
              </p>
              <p className="text-[10px] text-text-dim">{openPositions.length} vị thế</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-0.5">Tỉ Lệ Thắng</p>
              <p className={`text-[20px] font-bold font-mono ${winRate >= 50 ? 'text-positive' : 'text-negative'}`}>
                {closedPositions.length > 0 ? winRate.toFixed(1) + '%' : '—'}
              </p>
              <p className="text-[10px] text-text-dim">{winCount}/{closedPositions.length} lệnh đóng</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-0.5">Hạn Mức Rủi Ro</p>
              <p className="text-[20px] font-bold font-mono text-warning">{maxRiskPercent}%</p>
              <p className="text-[10px] text-text-dim">≈ {formatNumberVI(maxRiskAmount)}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('terminal')}
              className="px-4 py-2 rounded-md text-[12px] font-semibold bg-positive text-white hover:bg-green-600 transition-colors"
            >
              + Đặt Lệnh Mới
            </button>
            <button
              onClick={onOpenSetup}
              className="px-4 py-2 rounded-md text-[12px] font-semibold border border-border-standard text-text-muted hover:text-text-main hover:bg-white/5 transition-colors"
            >
              Cấu Hình
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Holdings + Equity Curve ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        {/* Holdings Table */}
        <div className="xl:col-span-3 panel-section flex flex-col" style={{ maxHeight: 420 }}>
          <div className="px-4 py-2.5 border-b border-border-subtle shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Vị Thế Đang Mở ({openPositions.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto dense-scroll">
            {openPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-dim">
                <p className="text-[12px] mb-2">Không có vị thế nào đang mở</p>
                <button onClick={() => onNavigate('terminal')} className="text-[11px] text-accent hover:underline">
                  Đặt lệnh mới →
                </button>
              </div>
            ) : (
              <table className="table-terminal w-full">
                <thead>
                  <tr>
                    <th className="text-left">Mã</th>
                    <th className="text-left">Sàn</th>
                    <th>Giá Vào</th>
                    <th>Hiện Tại</th>
                    <th>KL</th>
                    <th>P&L (VND)</th>
                    <th>P&L (%)</th>
                    <th>Stop Loss</th>
                    <th className="text-left">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {openPositions.map((pos) => {
                    const entry = Number(pos.entry_price ?? 0);
                    const current = Number((pos as any).current_price ?? pos.entry_price ?? 0);
                    const qty = Number(pos.quantity ?? 0);
                    const pnl = (current - entry) * qty;
                    const pnlPct = entry > 0 ? ((current - entry) / entry) * 100 : 0;
                    const sl = Number((pos as any).stop_loss ?? 0);
                    return (
                      <tr key={pos.id} className={`cursor-pointer ${pnl >= 0 ? 'row-profit' : 'row-loss'}`} onClick={() => onNavigate('terminal')}>
                        <td className="text-left font-bold text-text-main">{pos.symbol}</td>
                        <td className="text-left text-text-muted">{pos.exchange || '—'}</td>
                        <td className="text-text-muted">{entry > 0 ? toPoint(entry / 1000).toFixed(2) : '—'}</td>
                        <td className={current > 0 ? (current > entry ? 'text-positive' : current < entry ? 'text-negative' : 'text-warning') : 'text-text-muted'}>
                          {current > 0 ? toPoint(current / 1000).toFixed(2) : '—'}
                        </td>
                        <td>{qty > 0 ? formatNumberVI(qty, { maximumFractionDigits: 0 }) : '—'}</td>
                        <td className={pnl >= 0 ? 'text-positive' : 'text-negative'}>
                          {pnl !== 0 ? (pnl >= 0 ? '+' : '') + formatNumberVI(pnl, { maximumFractionDigits: 0 }) : '—'}
                        </td>
                        <td className={pnlPct >= 0 ? 'text-positive' : 'text-negative'}>
                          {pnlPct !== 0 ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%' : '—'}
                        </td>
                        <td className="text-negative">{sl > 0 ? toPoint(sl / 1000).toFixed(2) : '—'}</td>
                        <td className="text-left"><StatusBadge status={pos.status ?? 'OPEN'} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Equity Curve */}
        <div className="xl:col-span-2 panel-section flex flex-col">
          <div className="px-4 py-2.5 border-b border-border-subtle shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Đường Vốn</span>
          </div>
          <div className="flex-1 p-3" style={{ minHeight: 200 }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#8896A4', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#8896A4', fontSize: 10 }} tickLine={false} axisLine={false} width={60}
                  tickFormatter={(v) => formatNumberVI(v, { maximumFractionDigits: 0 })} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-border-standard)', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: 'var(--color-text-muted)' }}
                  formatter={(v: any) => [formatNumberVI(v), 'Vốn']}
                />
                <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-border-subtle">
            <div className="p-3">
              <p className="text-[9px] text-text-dim uppercase tracking-wide mb-0.5">Lãi Kỳ Vọng</p>
              <p className="text-[14px] font-bold font-mono text-accent">{expectedReturnPercent}%</p>
            </div>
            <div className="p-3">
              <p className="text-[9px] text-text-dim uppercase tracking-wide mb-0.5">P&L Lệnh Đóng</p>
              <p className={`text-[14px] font-bold font-mono ${totalClosedPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                {totalClosedPnl !== 0 ? (totalClosedPnl >= 0 ? '+' : '') + formatNumberVI(totalClosedPnl) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: Closed Trades ── */}
      <div className="panel-section">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Lịch Sử Lệnh Đóng</span>
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            <button onClick={() => setClosedPage(Math.max(1, closedPage - 1))} disabled={closedPage <= 1} className="px-2 py-0.5 rounded border border-border-standard disabled:opacity-40">‹</button>
            <span>Trang {closedPage}</span>
            <button onClick={() => setClosedPage(closedPage + 1)} disabled={closedPositions.length < CLOSED_PAGE_SIZE} className="px-2 py-0.5 rounded border border-border-standard disabled:opacity-40">›</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loadingClosed ? (
            <div className="text-center py-6 text-text-muted text-[12px]">Đang tải...</div>
          ) : closedPositions.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-[12px]">Chưa có lệnh đóng nào</div>
          ) : (
            <table className="table-terminal w-full">
              <thead>
                <tr>
                  <th className="text-left">Mã</th>
                  <th className="text-left">Sàn</th>
                  <th>Giá Vào</th>
                  <th>Giá Đóng</th>
                  <th>KL</th>
                  <th>P&L (VND)</th>
                  <th>P&L (%)</th>
                  <th className="text-left">Lý Do</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((pos) => {
                  const entry = Number(pos.entry_price ?? 0);
                  const close = Number((pos as any).closed_price ?? pos.current_price ?? entry);
                  const qty = Number(pos.quantity ?? 0);
                  const pnl = (close - entry) * qty;
                  const pnlPct = entry > 0 ? ((close - entry) / entry) * 100 : 0;
                  return (
                    <tr key={pos.id} className={pnl >= 0 ? 'row-profit' : 'row-loss'}>
                      <td className="text-left font-bold text-text-main">{pos.symbol}</td>
                      <td className="text-left text-text-muted">{pos.exchange || '—'}</td>
                      <td>{entry > 0 ? toPoint(entry / 1000).toFixed(2) : '—'}</td>
                      <td>{close > 0 ? toPoint(close / 1000).toFixed(2) : '—'}</td>
                      <td>{qty > 0 ? formatNumberVI(qty, { maximumFractionDigits: 0 }) : '—'}</td>
                      <td className={pnl >= 0 ? 'text-positive' : 'text-negative'}>
                        {pnl !== 0 ? (pnl >= 0 ? '+' : '') + formatNumberVI(pnl, { maximumFractionDigits: 0 }) : '—'}
                      </td>
                      <td className={pnlPct >= 0 ? 'text-positive' : 'text-negative'}>
                        {pnlPct !== 0 ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%' : '—'}
                      </td>
                      <td className="text-left"><StatusBadge status={pos.status ?? ''} /></td>
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
