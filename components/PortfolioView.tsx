import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { positionApi, portfolioApi, realPortfolioApi } from '../services/api';
import type { Position, RealPosition } from '../services/api';
import { StatCard } from './ui/StatCard';
import { EmptyState } from './ui/EmptyState';
import { FinancialTooltip } from './ui/Tooltip';
import { SkeletonCard, SkeletonTable } from './ui/SkeletonLoader';
import { formatNumberVI, PRICE_LOCALE, PRICE_FRACTION_OPTIONS, STOCK_PRICE_DISPLAY_SCALE } from '../constants';
// Heavy components — lazy loaded để giảm initial bundle size
const RiskManagerView = React.lazy(() => import('./RiskManagerView').then(m => ({ default: m.RiskManagerView })));
import { AiMonitorPanel } from './AiMonitorPanel';
import { PortfolioHeroCard } from './portfolio/PortfolioHeroCard';
import { RealOrderForm } from './portfolio/RealOrderForm';
import { RealPositionsTable } from './portfolio/RealPositionsTable';
import { ClosePositionModal } from './portfolio/ClosePositionModal';
import { TransactionHistory } from './portfolio/TransactionHistory';
import { type PortfolioFeeConfig } from '../utils/feeConstants';

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

type PortfolioTab = 'real' | 'risk' | 'ai_monitor';

const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);

function getPositionPnl(pos: Position) {
  // Lệnh đã đóng: dùng profit_loss_vnd từ DB (chính xác nhất)
  if (pos.status !== 'OPEN' && pos.profit_loss_vnd != null) {
    return Number(pos.profit_loss_vnd);
  }
  // Lệnh đang mở hoặc không có profit_loss_vnd: tính từ giá hiện tại
  const entry = Number(pos.entry_price ?? 0);
  const current = Number((pos as any).current_price ?? pos.entry_price ?? 0);
  const qty = Number(pos.quantity ?? 0);
  const side = (pos.side ?? 'LONG').toUpperCase();
  return side === 'SHORT' ? (entry - current) * qty : (current - entry) * qty;
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
  const [activeTab, setActiveTab] = useState<PortfolioTab>('real');
  const [realPositions, setRealPositions] = useState<RealPosition[]>([]);
  const [realPositionsLoading, setRealPositionsLoading] = useState(false);
  const [closingPosition, setClosingPosition] = useState<RealPosition | null>(null);
  const [cashBalance, setCashBalance] = useState({
    total_balance: 0,
    available_cash: 0,
    pending_settlement_cash: 0,
  });
  // D-02 MAP-04: portfolio fee config load từ portfolioApi.getById, pass xuống children
  const [portfolioConfig, setPortfolioConfig] = useState<PortfolioFeeConfig | null>(null);
  const [realSummary, setRealSummary] = useState<{
    total_value: number;
    total_pnl: number;
    percent_return: number;
    position_count: number;
    closed_count: number;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loadingClosed, setLoadingClosed] = useState(false);
  const [closedPage, setClosedPage] = useState(1);
  const [closedTotal, setClosedTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const CLOSED_PAGE_SIZE = 20;

  const [performance, setPerformance] = useState<any>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  // ── Close Position Modal ──
  type CloseReason = 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL';
  const [closeModal, setCloseModal] = useState<{ pos: Position; reason: CloseReason } | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeMsg, setCloseMsg] = useState('');

  // ── Edit SL/TP Modal ──
  const [editModal, setEditModal] = useState<{ pos: Position; stopLoss: string; takeProfit: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editMsg, setEditMsg] = useState('');

  const loadClosed = useCallback(async () => {
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
        const pagination = res.data.pagination;
        setClosedTotal(pagination?.total ?? res.data.total ?? 0);
        setTotalPages(pagination?.totalPages ?? Math.max(1, Math.ceil((pagination?.total ?? res.data.total ?? 0) / CLOSED_PAGE_SIZE)));
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('loadClosed failed:', err);
    } finally {
      setLoadingClosed(false);
    }
  }, [portfolioId, closedPage]);

  useEffect(() => {
    if (!portfolioId) return;
    loadClosed();
  }, [loadClosed]);

  const loadPerformance = useCallback(async () => {
    if (!portfolioId) return;
    setPerfLoading(true);
    try {
      const res = await portfolioApi.getPerformance(portfolioId);
      if (res.data?.success) setPerformance(res.data.data);
    } catch (err) { if (import.meta.env.DEV) console.warn('PortfolioView load failed:', err); } finally {
      setPerfLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => { loadPerformance(); }, [loadPerformance]);

  // ── Fetch Real Portfolio Data ──
  const fetchRealData = useCallback(async () => {
    if (!portfolioId) return;
    setRealPositionsLoading(true);
    setSummaryLoading(true);
    try {
      const [posRes, portRes, summaryRes] = await Promise.all([
        realPortfolioApi.getOpenPositions(portfolioId),
        portfolioApi.getById(portfolioId),
        realPortfolioApi.getSummary(portfolioId),
      ]);
      if (posRes.data?.success) {
        setRealPositions(posRes.data.data ?? []);
      }
      if (portRes.data?.success && portRes.data?.data) {
        const p = portRes.data.data;
        setCashBalance({
          total_balance: Number(p.total_balance ?? totalBalance ?? 0),
          available_cash: Number(p.available_cash ?? 0),
          pending_settlement_cash: Number(p.pending_settlement_cash ?? 0),
        });
        // D-02 MAP-04: extract fee config từ portfolio response (migration 006)
        setPortfolioConfig({
          buy_fee_percent: p.buy_fee_percent,
          sell_fee_percent: p.sell_fee_percent,
          sell_tax_percent: p.sell_tax_percent,
        });
      }
      if (summaryRes.data?.success && summaryRes.data?.data) {
        const s = summaryRes.data.data;
        setRealSummary({
          total_value: Number(s.total_value ?? 0),
          total_pnl: Number(s.total_pnl ?? 0),
          percent_return: Number(s.percent_return ?? 0),
          position_count: Number(s.position_count ?? 0),
          closed_count: Number(s.closed_count ?? 0),
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('PortfolioView fetchRealData failed:', err);
    } finally {
      setRealPositionsLoading(false);
      setSummaryLoading(false);
    }
  }, [portfolioId, totalBalance]);

  useEffect(() => {
    if (activeTab === 'real' && portfolioId) {
      fetchRealData();
    }
  }, [activeTab, portfolioId, fetchRealData]);

  // ── Close Position ──
  const handleClosePosition = async () => {
    if (!closeModal || !portfolioId) return;
    setClosing(true);
    setCloseMsg('');
    try {
      await positionApi.close(portfolioId, closeModal.pos.id, {
        reason: closeModal.reason,
        use_market_price: true,
      });
      setCloseModal(null);
      onRefreshPositions();
      loadClosed();
      loadPerformance();
    } catch (e: any) {
      setCloseMsg(e?.response?.data?.message || 'Đóng lệnh thất bại');
    } finally {
      setClosing(false);
    }
  };

  // ── Edit SL/TP ──
  const handleEditPosition = async () => {
    if (!editModal || !portfolioId) return;
    const sl = parseFloat(editModal.stopLoss);
    const tp = parseFloat(editModal.takeProfit);
    if (!isNaN(sl) && sl <= 0) { setEditMsg('Giá SL phải > 0'); return; }
    if (!isNaN(tp) && tp <= 0) { setEditMsg('Giá TP phải > 0'); return; }

    const body: { stop_loss?: number; take_profit?: number } = {};
    if (!isNaN(sl) && editModal.stopLoss.trim()) body.stop_loss = Math.round(sl * 1000);
    if (!isNaN(tp) && editModal.takeProfit.trim()) body.take_profit = Math.round(tp * 1000);
    if (!body.stop_loss && !body.take_profit) { setEditMsg('Nhập ít nhất SL hoặc TP'); return; }

    setEditing(true);
    setEditMsg('');
    try {
      await positionApi.update(portfolioId, editModal.pos.id, body);
      setEditModal(null);
      onRefreshPositions();
    } catch (e: any) {
      setEditMsg(e?.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setEditing(false);
    }
  };

  // Summary metrics
  const totalOpenPnl = openPositions.reduce((s, p) => s + getPositionPnl(p), 0);
  // Dùng total_pnl_vnd từ API (tính trên toàn bộ closed positions), fallback sang page hiện tại
  const totalClosedPnl = (performance as any)?.total_pnl_vnd ?? closedPositions.reduce((s, p) => s + getPositionPnl(p), 0);
  const winCount = closedPositions.filter((p) => getPositionPnl(p) >= 0).length;
  const totalClosedCount = (performance as any)?.total_closed_count ?? closedPositions.length;
  const winRate = totalClosedCount > 0 ? (winCount / totalClosedCount) * 100 : 0;
  const maxRiskAmount = (totalBalance * maxRiskPercent) / 100;

  // Equity curve từ API performance data (real), fallback sang tính từ closed positions
  // Luôn prepend điểm gốc (vốn ban đầu) để đường vốn có ít nhất 2 điểm
  const equityCurve = (() => {
    const originLabel = 'Gốc';
    const origin = { date: originLabel, value: totalBalance, pnl: 0 };

    if (performance?.equity_curve && performance.equity_curve.length > 0) {
      const points = performance.equity_curve.map((p: any) => ({
        date: new Date(p.date).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' }),
        value: totalBalance + p.cumulative_pnl,
        pnl: p.daily_pnl,
      }));
      return [origin, ...points];
    }
    // Fallback: xây từ closed positions hiện tại
    const sorted = [...closedPositions]
      .filter(p => p.closed_at)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());
    if (sorted.length === 0) return [];
    let running = 0;
    const points = sorted.map(p => {
      running += getPositionPnl(p);
      return {
        date: new Date(p.closed_at!).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' }),
        value: totalBalance + running,
        pnl: getPositionPnl(p),
      };
    });
    return [origin, ...points];
  })();

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

  const TABS: { id: PortfolioTab; label: string; badge?: number }[] = [
    { id: 'real', label: 'Danh mục thật' },
    { id: 'risk', label: 'Rủi ro' },
    { id: 'ai_monitor', label: 'AI Giám sát' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[var(--color-text-main)]">Quản lý vốn</h1>
          <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5">Theo dõi danh mục, vị thế và hiệu suất giao dịch</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('terminal')}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            + Đặt lệnh
          </button>
          <button
            onClick={onOpenSetup}
            className="px-3 py-2 rounded-lg text-[12px] border border-[var(--color-border-standard)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-panel-hover)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── TAB BAR (unified) ── */}
      <div className="flex gap-0.5 border-b border-[var(--color-divider)] -mt-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
            }`}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="text-[9px] font-black px-1 py-0.5 rounded bg-[var(--color-warning)]/20 text-[var(--color-warning)] leading-none">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── REAL TAB CONTENT ── */}
      {activeTab === 'real' && portfolioId && (
        <div className="space-y-4">
          {/* Hero Card — tổng quan dòng tiền + P&L */}
          <PortfolioHeroCard
            totalBalance={cashBalance.total_balance || totalBalance}
            availableCash={cashBalance.available_cash}
            pendingSettlement={cashBalance.pending_settlement_cash}
            totalPnl={realSummary?.total_pnl ?? 0}
            percentReturn={realSummary?.percent_return ?? 0}
            positionCount={realSummary?.position_count ?? 0}
            closedCount={realSummary?.closed_count ?? 0}
            loading={summaryLoading}
          />

          {/* 2-column layout: Left (positions + history) | Right (form + stats) */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
            {/* Left column */}
            <div className="space-y-4 min-w-0">
              <RealPositionsTable
                positions={realPositions}
                onClosePosition={setClosingPosition}
                loading={realPositionsLoading}
              />
              <TransactionHistory portfolioId={portfolioId} portfolio={portfolioConfig} />
            </div>

            {/* Right column — form + quick stats */}
            <div className="space-y-4">
              <RealOrderForm
                portfolioId={portfolioId}
                availableCash={cashBalance.available_cash}
                portfolio={portfolioConfig}
                onSuccess={fetchRealData}
              />

              {/* Quick Stats */}
              <div className="panel-section p-4">
                <p className="text-[10px] font-semibold text-[var(--color-text-dim)] uppercase tracking-wider mb-3">Thống kê nhanh</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[var(--color-background)] rounded-md p-2.5">
                    <p className="text-[9px] text-[var(--color-text-dim)] uppercase tracking-wider">Khả dụng</p>
                    <p className="text-[14px] font-bold tabular-nums text-[var(--color-positive)]">
                      {(cashBalance.available_cash / (cashBalance.total_balance || totalBalance || 1) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-[var(--color-background)] rounded-md p-2.5">
                    <p className="text-[9px] text-[var(--color-text-dim)] uppercase tracking-wider">Đã phân bổ</p>
                    <p className="text-[14px] font-bold tabular-nums text-[var(--color-accent)]">
                      {(Math.max(0, (cashBalance.total_balance || totalBalance) - cashBalance.available_cash - cashBalance.pending_settlement_cash) / (cashBalance.total_balance || totalBalance || 1) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-[var(--color-background)] rounded-md p-2.5">
                    <p className="text-[9px] text-[var(--color-text-dim)] uppercase tracking-wider">Vị thế mở</p>
                    <p className="text-[14px] font-bold tabular-nums text-[var(--color-text-main)]">
                      {realSummary?.position_count ?? 0}
                    </p>
                  </div>
                  <div className="bg-[var(--color-background)] rounded-md p-2.5">
                    <p className="text-[9px] text-[var(--color-text-dim)] uppercase tracking-wider">Đã đóng</p>
                    <p className="text-[14px] font-bold tabular-nums text-[var(--color-text-muted)]">
                      {realSummary?.closed_count ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ClosePositionModal
            position={closingPosition}
            portfolioId={portfolioId}
            portfolio={portfolioConfig}
            isOpen={!!closingPosition}
            onClose={() => setClosingPosition(null)}
            onSuccess={fetchRealData}
          />
        </div>
      )}

      {activeTab === 'real' && !portfolioId && (
        <EmptyState
          title="Chưa chọn danh mục"
          description="Vui lòng chọn hoặc tạo danh mục để bắt đầu quản lý vốn."
          actionLabel="Tạo danh mục"
          onAction={onOpenSetup}
        />
      )}

      {/* ── RISK TAB ── */}
      {activeTab === 'risk' && (
        <Suspense fallback={<div className="flex items-center justify-center h-64"><span className="text-[var(--color-text-muted)] text-sm">Đang tải...</span></div>}>
          <RiskManagerView
            portfolioId={portfolioId}
            positions={openPositions}
            totalBalance={totalBalance}
            maxRiskPercent={maxRiskPercent}
            onNavigate={onNavigate}
          />
        </Suspense>
      )}

      {/* ── AI MONITOR TAB ── */}
      {activeTab === 'ai_monitor' && (
        <AiMonitorPanel
          portfolioId={portfolioId}
          openPositions={openPositions}
          onNavigate={onNavigate}
        />
      )}

      {/* ── CLOSE POSITION MODAL ── */}
      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-panel)] w-full max-w-sm p-5 rounded-xl border border-[var(--color-border-standard)] shadow-2xl">
            <h3 className="text-[14px] font-semibold text-[var(--color-text-main)] mb-1">Đóng vị thế</h3>
            <p className="text-[11px] text-text-dim mb-4">
              {closeModal.pos.symbol} · {(closeModal.pos.side ?? 'LONG').toUpperCase()} · {Number(closeModal.pos.quantity ?? 0).toLocaleString('vi-VN')} CP
            </p>

            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2">Lý do đóng</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: 'CLOSED_TP', label: 'Chốt Lời', cls: 'text-positive border-positive/40 hover:bg-positive/10' },
                  { val: 'CLOSED_SL', label: 'Dừng Lỗ', cls: 'text-negative border-negative/40 hover:bg-negative/10' },
                  { val: 'CLOSED_MANUAL', label: 'Thủ Công', cls: 'text-text-muted border-border-standard hover:bg-white/5' },
                ] as const).map(({ val, label, cls }) => (
                  <button
                    key={val}
                    onClick={() => setCloseModal({ ...closeModal, reason: val })}
                    className={`py-2 rounded border text-[11px] font-semibold transition-colors ${cls} ${closeModal.reason === val ? 'ring-1 ring-current' : ''}`}
                  >{label}</button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-text-dim mb-4">Giá đóng sẽ lấy từ thị trường tại thời điểm xác nhận.</p>

            {closeMsg && <p className="text-[11px] text-negative mb-3">{closeMsg}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCloseModal(null)}
                className="px-4 py-2 rounded text-[12px] border border-border-standard text-text-muted hover:bg-white/5 transition-colors"
              >Hủy</button>
              <button
                onClick={handleClosePosition}
                disabled={closing}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--color-negative)] text-white hover:opacity-90 transition-colors disabled:opacity-50"
              >{closing ? 'Đang đóng...' : 'Xác nhận đóng'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SL/TP MODAL ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-panel)] w-full max-w-sm p-5 rounded-xl border border-[var(--color-border-standard)] shadow-2xl">
            <h3 className="text-[14px] font-semibold text-[var(--color-text-main)] mb-1">Sửa cắt lỗ / chốt lời</h3>
            <p className="text-[11px] text-text-dim mb-4">
              {editModal.pos.symbol} · Giá vào: {toPoint(Number(editModal.pos.entry_price ?? 0) / 1000).toFixed(2)}
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1">Cắt lỗ (nghìn ₫)</label>
                <input
                  value={editModal.stopLoss}
                  onChange={(e) => setEditModal({ ...editModal, stopLoss: e.target.value })}
                  placeholder="VD: 22.50"
                  className="w-full bg-[var(--color-background)] border border-[var(--color-negative)]/40 rounded-lg px-3 py-2.5 text-[12px] font-mono text-[var(--color-negative)] outline-none focus:border-[var(--color-negative)] focus:ring-1 focus:ring-[var(--color-negative)]/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1">Chốt lời (nghìn ₫)</label>
                <input
                  value={editModal.takeProfit}
                  onChange={(e) => setEditModal({ ...editModal, takeProfit: e.target.value })}
                  placeholder="VD: 26.00"
                  className="w-full bg-[var(--color-background)] border border-[var(--color-positive)]/40 rounded-lg px-3 py-2.5 text-[12px] font-mono text-[var(--color-positive)] outline-none focus:border-[var(--color-positive)] focus:ring-1 focus:ring-[var(--color-positive)]/20"
                />
              </div>
            </div>

            {editMsg && <p className="text-[11px] text-negative mb-3">{editMsg}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded-lg text-[12px] border border-[var(--color-border-standard)] text-[var(--color-text-muted)] hover:bg-[var(--color-panel-hover)] transition-colors"
              >Hủy</button>
              <button
                onClick={handleEditPosition}
                disabled={editing}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
              >{editing ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
