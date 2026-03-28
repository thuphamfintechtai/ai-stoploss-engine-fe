import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { positionApi, portfolioApi, orderApi, realPortfolioApi } from '../services/api';
import type { Position, Order, RealPosition } from '../services/api';
import { PaperVirtualBalance } from './PaperVirtualBalance';
import { PaperOrderManager } from './PaperOrderManager';
import { PaperPerformanceReport } from './PaperPerformanceReport';
import { StatCard } from './ui/StatCard';
import { EmptyState } from './ui/EmptyState';
import { FinancialTooltip } from './ui/Tooltip';
import { SkeletonCard, SkeletonTable } from './ui/SkeletonLoader';
import { formatNumberVI, PRICE_LOCALE, PRICE_FRACTION_OPTIONS, STOCK_PRICE_DISPLAY_SCALE } from '../constants';
// Heavy components — lazy loaded để giảm initial bundle size
const RiskManagerView = React.lazy(() => import('./RiskManagerView').then(m => ({ default: m.RiskManagerView })));
import { AiMonitorPanel } from './AiMonitorPanel';
import { CashBalanceCard } from './portfolio/CashBalanceCard';
import { RealOrderForm } from './portfolio/RealOrderForm';
import { RealPositionsTable } from './portfolio/RealPositionsTable';
import { ClosePositionModal } from './portfolio/ClosePositionModal';
import { TransactionHistory } from './portfolio/TransactionHistory';
import { PortfolioSummaryCard } from './portfolio/PortfolioSummaryCard';

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

type PortfolioTab = 'portfolio' | 'orders' | 'risk' | 'ai_monitor';
type MainTab = 'REAL' | 'PAPER';

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
  const [activeTab, setActiveTab] = useState<PortfolioTab>('portfolio');

  // ── Main Real/Paper tab ──
  const [mainTab, setMainTab] = useState<MainTab>('REAL');
  const [realPositions, setRealPositions] = useState<RealPosition[]>([]);
  const [realPositionsLoading, setRealPositionsLoading] = useState(false);
  const [closingPosition, setClosingPosition] = useState<RealPosition | null>(null);
  const [cashBalance, setCashBalance] = useState({
    total_balance: 0,
    available_cash: 0,
    pending_settlement_cash: 0,
  });
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

  // ── Pending Orders ──
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

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

  // ── Paper Trading extras ──
  const [simulationMode, setSimulationMode] = useState<'INSTANT' | 'REALISTIC'>('REALISTIC');
  const [paperBalanceRefresh, setPaperBalanceRefresh] = useState(0);

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
    } catch {
      // fallback
    } finally {
      setLoadingClosed(false);
    }
  }, [portfolioId, closedPage]);

  useEffect(() => {
    if (!portfolioId) return;
    loadClosed();
  }, [loadClosed]);

  const loadOrders = useCallback(async () => {
    if (!portfolioId) return;
    setLoadingOrders(true);
    try {
      const res = await orderApi.list(portfolioId, { status: 'PENDING,PARTIALLY_FILLED', limit: 50 });
      if (res.data?.success) setPendingOrders(res.data.data ?? []);
    } catch { /* ignore */ } finally {
      setLoadingOrders(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
  }, [activeTab, loadOrders]);

  const loadPerformance = useCallback(async () => {
    if (!portfolioId) return;
    setPerfLoading(true);
    try {
      const res = await portfolioApi.getPerformance(portfolioId);
      if (res.data?.success) setPerformance(res.data.data);
    } catch { /* optional */ } finally {
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
    } catch {
      // fallback
    } finally {
      setRealPositionsLoading(false);
      setSummaryLoading(false);
    }
  }, [portfolioId, totalBalance]);

  useEffect(() => {
    if (mainTab === 'REAL' && portfolioId) {
      fetchRealData();
    }
  }, [mainTab, portfolioId, fetchRealData]);

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

  // ── Cancel Order ──
  const handleCancelOrder = async (orderId: string) => {
    if (!portfolioId) return;
    setCancellingOrderId(orderId);
    try {
      await orderApi.cancel(portfolioId, orderId);
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Hủy lệnh thất bại');
    } finally {
      setCancellingOrderId(null);
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
  const totalClosedPnl = closedPositions.reduce((s, p) => s + getPositionPnl(p), 0);
  const winCount = closedPositions.filter((p) => getPositionPnl(p) >= 0).length;
  const winRate = closedPositions.length > 0 ? (winCount / closedPositions.length) * 100 : 0;
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
    { id: 'portfolio', label: 'Danh Mục' },
    { id: 'orders', label: 'Lệnh Chờ', badge: pendingOrders.length || undefined },
    { id: 'risk', label: 'Quản Lý Rủi Ro' },
    { id: 'ai_monitor', label: 'AI Giám Sát' },
  ];

  return (
    <div className="space-y-4 animate-fade-in border-l-4 border-blue-600 pl-3">
      {/* Badge Portfolio Thật */}
      <div className="flex items-center gap-2 pt-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-600/10 text-blue-400">
          THẬT
        </span>
        <span className="text-[11px] text-text-muted">Portfolio Thật — Giao dịch thực tế</span>
      </div>
      {/* ── MAIN TAB: REAL / PAPER ── */}
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setMainTab('REAL')}
          className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
            mainTab === 'REAL'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Portfolio That
        </button>
        <button
          onClick={() => setMainTab('PAPER')}
          className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
            mainTab === 'PAPER'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Paper Trading
        </button>
      </div>

      {/* ── REAL TAB CONTENT ── */}
      {mainTab === 'REAL' && portfolioId && (
        <div className="space-y-4">
          <CashBalanceCard
            totalBalance={cashBalance.total_balance || totalBalance}
            availableCash={cashBalance.available_cash}
            pendingSettlement={cashBalance.pending_settlement_cash}
          />
          {realSummary !== null && (
            <PortfolioSummaryCard
              totalValue={realSummary.total_value}
              totalPnl={realSummary.total_pnl}
              percentReturn={realSummary.percent_return}
              positionCount={realSummary.position_count}
              closedCount={realSummary.closed_count}
              loading={summaryLoading}
            />
          )}
          <RealOrderForm
            portfolioId={portfolioId}
            availableCash={cashBalance.available_cash}
            onSuccess={fetchRealData}
          />
          <RealPositionsTable
            positions={realPositions}
            onClosePosition={setClosingPosition}
            loading={realPositionsLoading}
          />
          <TransactionHistory portfolioId={portfolioId} />
          <ClosePositionModal
            position={closingPosition}
            portfolioId={portfolioId}
            isOpen={!!closingPosition}
            onClose={() => setClosingPosition(null)}
            onSuccess={fetchRealData}
          />
        </div>
      )}

      {mainTab === 'REAL' && !portfolioId && (
        <div className="text-center py-12 text-gray-500 text-[12px]">
          Vui long chon portfolio de xem
        </div>
      )}

      {/* ── PAPER TAB CONTENT (existing content) ── */}
      {mainTab === 'PAPER' && (<>

      {/* ── PAPER: Virtual Balance + Simulation Mode ── */}
      {portfolioId && (
        <div className="space-y-3">
          <PaperVirtualBalance portfolioId={portfolioId} refreshTrigger={paperBalanceRefresh} />
          <div className="panel-section px-4 py-3 flex items-center gap-3">
            <p className="text-[11px] font-semibold text-text-muted">Chế Độ Đặt Lệnh:</p>
            <div className="flex gap-1">
              {(['REALISTIC', 'INSTANT'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSimulationMode(mode)}
                  className={`px-3 py-1.5 rounded text-[10px] font-semibold transition-colors ${
                    simulationMode === mode
                      ? mode === 'REALISTIC'
                        ? 'bg-purple-600 text-white'
                        : 'bg-orange-600 text-white'
                      : 'bg-white/5 text-text-muted hover:bg-white/10'
                  }`}
                >
                  {mode === 'REALISTIC' ? 'REALISTIC (Chờ Khớp)' : 'INSTANT (Khớp Ngay)'}
                </button>
              ))}
            </div>
            <span className="text-[9px] text-text-dim">
              {simulationMode === 'REALISTIC'
                ? 'Lệnh LO sẽ chờ giá thị trường; MP có slippage thực tế'
                : 'Mọi lệnh khớp ngay lập tức theo giá thị trường'}
            </span>
          </div>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <div className="flex gap-1 border-b border-border-standard">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="text-[9px] font-black px-1 py-0.5 rounded bg-warning/20 text-warning leading-none">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── RISK TAB ── */}
      {activeTab === 'risk' && (
        <Suspense fallback={<div className="flex items-center justify-center h-64"><span className="text-text-muted text-sm">Dang tai...</span></div>}>
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

      {/* ── PENDING ORDERS TAB ── */}
      {activeTab === 'orders' && portfolioId && (
        <PaperOrderManager
          portfolioId={portfolioId}
          orders={pendingOrders}
          onRefresh={() => {
            loadOrders();
            setPaperBalanceRefresh((n) => n + 1);
          }}
        />
      )}
      {activeTab === 'orders' && !portfolioId && (
        <div className="text-center py-12 text-gray-500 text-[12px]">Vui lòng chọn portfolio để xem</div>
      )}

      {activeTab === 'portfolio' && (<>
      {/* ── HEADER BAR ── */}
      {perfLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
          <SkeletonTable rows={5} />
        </div>
      ) : (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Tong Von"
            value={formatNumberVI(totalBalance)}
            suffix=" VND"
            tooltip="Tong so von dau tu ban dau"
            size="md"
          />
          <StatCard
            label="P&L Mo"
            value={totalOpenPnl !== 0 ? formatNumberVI(totalOpenPnl, { maximumFractionDigits: 0 }) : '0'}
            change={totalOpenPnl}
            suffix=" VND"
            tooltip="Lai/lo chua hien thuc tu cac vi the dang mo"
            size="md"
          />
          <StatCard
            label="P&L Da Chot"
            value={performance?.total_pnl_vnd != null
              ? formatNumberVI(performance.total_pnl_vnd, { maximumFractionDigits: 0 })
              : totalClosedPnl !== 0 ? formatNumberVI(totalClosedPnl, { maximumFractionDigits: 0 }) : '0'}
            change={performance?.total_pnl_vnd ?? totalClosedPnl}
            suffix=" VND"
            tooltip="Lai/lo da hien thuc tu cac lenh da dong"
            size="md"
          />
          <StatCard
            label="Ti Le Thang"
            value={performance?.win_rate != null
              ? Number(performance.win_rate).toFixed(1)
              : closedPositions.length > 0 ? winRate.toFixed(1) : '0'}
            change={performance?.win_rate != null ? Number(performance.win_rate) - 50 : winRate - 50}
            suffix="%"
            tooltip="Ti le lenh co lai tren tong so lenh da dong"
            size="md"
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Profit Factor"
            value={(performance?.profit_factor ?? 0) > 0
              ? Number(performance!.profit_factor).toFixed(2)
              : '0'}
            change={(performance?.profit_factor ?? 0) > 0 ? (performance!.profit_factor >= 1 ? 1 : -1) : undefined}
            tooltip="Ti so giua tong lai va tong lo. > 1.5 la xuat sac"
            size="sm"
          />
          <StatCard
            label="Han Muc Rui Ro"
            value={maxRiskPercent.toFixed(0)}
            suffix="%"
            tooltip="Phan tram von toi da co the mat"
            size="sm"
          />
          <div className="col-span-2 flex items-center justify-end gap-2">
            <button
              onClick={() => onNavigate('terminal')}
              className="px-4 py-2 rounded-md text-[12px] font-semibold bg-positive text-white hover:bg-green-600 transition-colors"
            >
              + Dat Lenh Moi
            </button>
            <button
              onClick={onOpenSetup}
              className="px-4 py-2 rounded-md text-[12px] font-semibold border border-border-standard text-text-muted hover:text-text-main hover:bg-white/5 transition-colors"
            >
              Cau Hinh
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ── ROW 2: Holdings + Equity Curve ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        {/* Holdings Table */}
        <div className="xl:col-span-3 panel-section flex flex-col" style={{ maxHeight: 420 }}>
          <div className="px-4 py-2.5 border-b border-border-subtle shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Vị Thế Đang Mở ({openPositions.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto dense-scroll">
            {openPositions.length === 0 ? (
              <EmptyState
                title="Chua co vi the nao"
                description="Nhap lenh dau tien de bat dau theo doi danh muc cua ban."
                actionLabel="Nhap Lenh Moi"
                onAction={() => onNavigate('terminal')}
              />
            ) : (<>
              {/* Desktop table */}
              <div className="hidden lg:block">
              <table className="table-terminal w-full">
                <thead>
                  <tr>
                    <th className="text-left">Ma</th>
                    <th className="text-left">S/L</th>
                    <th>Gia Vao</th>
                    <th>Hien Tai</th>
                    <th>KL</th>
                    <th><FinancialTooltip term="P&L" /> (VND)</th>
                    <th><FinancialTooltip term="P&L" /> (%)</th>
                    <th><FinancialTooltip term="Stop Loss" /></th>
                    <th><FinancialTooltip term="Take Profit" /></th>
                    <th className="text-left">Hanh Dong</th>
                  </tr>
                </thead>
                <tbody>
                  {openPositions.map((pos) => {
                    const entry = Number(pos.entry_price ?? 0);
                    const current = Number((pos as any).current_price ?? pos.entry_price ?? 0);
                    const qty = Number(pos.quantity ?? 0);
                    const isShort = (pos.side ?? 'LONG').toUpperCase() === 'SHORT';
                    const pnl = isShort ? (entry - current) * qty : (current - entry) * qty;
                    const pnlPct = entry > 0 ? (isShort ? ((entry - current) / entry) : ((current - entry) / entry)) * 100 : 0;
                    const sl = Number((pos as any).stop_loss ?? 0);
                    const tp = Number((pos as any).take_profit ?? 0);
                    return (
                      <tr key={pos.id} className={pnl >= 0 ? 'row-profit' : 'row-loss'}>
                        <td className="text-left">
                          <span className="font-bold text-text-main">{pos.symbol}</span>
                          <span className={`ml-1 text-[9px] font-bold px-1 rounded ${isShort ? 'text-negative bg-negative/10' : 'text-positive bg-positive/10'}`}>
                            {isShort ? 'SHORT' : 'LONG'}
                          </span>
                        </td>
                        <td className="text-left text-text-muted text-[10px]">{pos.exchange || '—'}</td>
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
                        <td className="text-positive">{tp > 0 ? toPoint(tp / 1000).toFixed(2) : '—'}</td>
                        <td className="text-left">
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditMsg('');
                                setEditModal({
                                  pos,
                                  stopLoss: sl > 0 ? toPoint(sl / 1000).toFixed(2) : '',
                                  takeProfit: tp > 0 ? toPoint(tp / 1000).toFixed(2) : '',
                                });
                              }}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent/15 text-accent hover:bg-accent/30 transition-colors"
                              title="Sửa SL/TP"
                            >Sửa</button>
                            <button
                              onClick={() => { setCloseMsg(''); setCloseModal({ pos, reason: 'CLOSED_MANUAL' }); }}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-negative/15 text-negative hover:bg-negative/30 transition-colors"
                              title="Đóng vị thế"
                            >Đóng</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              {/* Mobile cards */}
              <div className="lg:hidden space-y-2">
                {openPositions.map((pos) => {
                  const entry = Number(pos.entry_price ?? 0);
                  const current = Number((pos as any).current_price ?? pos.entry_price ?? 0);
                  const qty = Number(pos.quantity ?? 0);
                  const isShort = (pos.side ?? 'LONG').toUpperCase() === 'SHORT';
                  const pnl = isShort ? (entry - current) * qty : (current - entry) * qty;
                  const sl = Number((pos as any).stop_loss ?? 0);
                  const tp = Number((pos as any).take_profit ?? 0);
                  return (
                    <div key={pos.id} className="card-flat p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-main text-[13px]">{pos.symbol}</span>
                          <span className={`text-[9px] font-bold px-1 rounded ${isShort ? 'text-negative bg-negative/10' : 'text-positive bg-positive/10'}`}>
                            {isShort ? 'SHORT' : 'LONG'}
                          </span>
                        </div>
                        <span className={`text-[13px] font-bold font-mono ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {pnl !== 0 ? (pnl >= 0 ? '+' : '') + formatNumberVI(pnl, { maximumFractionDigits: 0 }) : '0'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-text-muted">
                        <div>Vao: <span className="text-text-main font-mono">{entry > 0 ? toPoint(entry / 1000).toFixed(2) : '-'}</span></div>
                        <div>HT: <span className="text-text-main font-mono">{current > 0 ? toPoint(current / 1000).toFixed(2) : '-'}</span></div>
                        <div>KL: <span className="text-text-main font-mono">{qty > 0 ? formatNumberVI(qty, { maximumFractionDigits: 0 }) : '-'}</span></div>
                      </div>
                      <div className="flex gap-3 text-[10px]">
                        {sl > 0 && <span className="text-negative">SL: {toPoint(sl / 1000).toFixed(2)}</span>}
                        {tp > 0 && <span className="text-positive">TP: {toPoint(tp / 1000).toFixed(2)}</span>}
                      </div>
                      <div className="flex gap-1 pt-1">
                        <button
                          onClick={() => {
                            setEditMsg('');
                            setEditModal({
                              pos,
                              stopLoss: sl > 0 ? toPoint(sl / 1000).toFixed(2) : '',
                              takeProfit: tp > 0 ? toPoint(tp / 1000).toFixed(2) : '',
                            });
                          }}
                          className="px-2 py-1 rounded text-[10px] font-bold bg-accent/15 text-accent hover:bg-accent/30 transition-colors"
                        >Sua SL/TP</button>
                        <button
                          onClick={() => { setCloseMsg(''); setCloseModal({ pos, reason: 'CLOSED_MANUAL' }); }}
                          className="px-2 py-1 rounded text-[10px] font-bold bg-negative/15 text-negative hover:bg-negative/30 transition-colors"
                        >Dong</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>)}
          </div>
        </div>

        {/* Equity Curve */}
        <div className="xl:col-span-2 panel-section flex flex-col">
          <div className="px-4 py-2.5 border-b border-border-subtle shrink-0 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Đường Vốn (90 ngày)</span>
            {perfLoading && <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />}
          </div>
          <div className="flex-1 p-3" style={{ minHeight: 200 }}>
            {equityCurve.length < 2 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-dim gap-2">
                <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
                <p className="text-[11px]">Chưa đủ dữ liệu để vẽ đường vốn</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={equityCurve}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#8896A4', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8896A4', fontSize: 9 }} tickLine={false} axisLine={false} width={55}
                    tickFormatter={(v) => (v / 1e6).toFixed(0) + 'M'} />
                  <ReferenceLine y={totalBalance} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-border-standard)', borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: 'var(--color-text-muted)' }}
                    formatter={(v: any, name: string) => [
                      formatNumberVI(v, { maximumFractionDigits: 0 }),
                      name === 'value' ? 'Tổng vốn' : 'P&L ngày'
                    ]}
                  />
                  <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-border-subtle">
            <div className="p-3">
              <p className="text-[9px] text-text-dim uppercase tracking-wide mb-0.5">Max Drawdown</p>
              <p className={`text-[13px] font-bold font-mono ${(performance?.max_drawdown_pct ?? 0) > 15 ? 'text-negative' : (performance?.max_drawdown_pct ?? 0) > 5 ? 'text-warning' : 'text-positive'}`}>
                {performance?.max_drawdown_pct != null ? `-${Number(performance.max_drawdown_pct).toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="p-3">
              <p className="text-[9px] text-text-dim uppercase tracking-wide mb-0.5">TB Lãi / TB Lỗ</p>
              <p className="text-[13px] font-bold font-mono text-text-muted">
                {performance?.avg_win_vnd > 0
                  ? `${(performance.avg_win_vnd / 1000).toFixed(0)}K / ${(performance.avg_loss_vnd / 1000).toFixed(0)}K`
                  : '—'}
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
            <span className="text-[10px] text-text-dim">{closedTotal} vi the</span>
            <button onClick={() => setClosedPage(Math.max(1, closedPage - 1))} disabled={closedPage <= 1} className="px-2 py-0.5 rounded border border-border-standard disabled:opacity-40">Truoc</button>
            <span>{closedPage}/{totalPages}</span>
            <button onClick={() => setClosedPage(p => Math.min(totalPages, p + 1))} disabled={closedPage >= totalPages} className="px-2 py-0.5 rounded border border-border-standard disabled:opacity-40">Sau</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loadingClosed ? (
            <div className="p-3"><SkeletonTable rows={3} /></div>
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
                  <th><FinancialTooltip term="P&L" /> (VND)</th>
                  <th><FinancialTooltip term="P&L" /> (%)</th>
                  <th className="text-left">Ly Do</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((pos) => {
                  const entry = Number(pos.entry_price ?? 0);
                  const close = Number((pos as any).closed_price ?? (pos as any).current_price ?? entry);
                  const qty = Number(pos.quantity ?? 0);
                  const isShort = (pos.side ?? 'LONG').toUpperCase() === 'SHORT';
                  // Ưu tiên dùng profit_loss_vnd từ DB (chính xác nhất)
                  const pnl = pos.profit_loss_vnd != null
                    ? Number(pos.profit_loss_vnd)
                    : (isShort ? (entry - close) * qty : (close - entry) * qty);
                  const grossPnl = (pos as any).gross_pnl_vnd != null ? Number((pos as any).gross_pnl_vnd) : null;
                  const totalFee = (() => {
                    const bf = Number((pos as any).buy_fee_vnd ?? 0);
                    const sf = Number((pos as any).sell_fee_vnd ?? 0);
                    const st = Number((pos as any).sell_tax_vnd ?? 0);
                    return bf + sf + st;
                  })();
                  // P&L% = pnl / (entry * qty) × 100 (không phụ thuộc chiều vào)
                  const invested = entry * qty;
                  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                  return (
                    <tr key={pos.id} className={pnl >= 0 ? 'row-profit' : 'row-loss'}>
                      <td className="text-left">
                        <span className="font-bold text-text-main">{pos.symbol}</span>
                        <span className={`ml-1 text-[9px] font-bold px-1 rounded ${isShort ? 'text-negative bg-negative/10' : 'text-positive bg-positive/10'}`}>
                          {isShort ? 'SHORT' : 'LONG'}
                        </span>
                      </td>
                      <td className="text-left text-text-muted">{pos.exchange || '—'}</td>
                      <td>{entry > 0 ? toPoint(entry / 1000).toFixed(2) : '—'}</td>
                      <td>{close > 0 ? toPoint(close / 1000).toFixed(2) : '—'}</td>
                      <td>{qty > 0 ? formatNumberVI(qty, { maximumFractionDigits: 0 }) : '—'}</td>
                      <td className={pnl >= 0 ? 'text-positive' : 'text-negative'}>
                        <div>{pnl !== 0 ? (pnl >= 0 ? '+' : '') + formatNumberVI(pnl, { maximumFractionDigits: 0 }) : '—'}</div>
                        {grossPnl != null && totalFee > 0 && (
                          <div className="text-[8px] text-text-dim">
                            Gộp {grossPnl >= 0 ? '+' : ''}{formatNumberVI(grossPnl, { maximumFractionDigits: 0 })} / Phí {formatNumberVI(totalFee, { maximumFractionDigits: 0 })}
                          </div>
                        )}
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

      {/* ── PAPER PERFORMANCE REPORT ── */}
      {portfolioId && (
        <PaperPerformanceReport portfolioId={portfolioId} refreshTrigger={paperBalanceRefresh} />
      )}
      </>)}

      {/* ── CLOSE POSITION MODAL ── */}
      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="panel-section w-full max-w-sm p-5 rounded-xl border border-border-standard shadow-2xl">
            <h3 className="text-[13px] font-semibold text-text-main mb-1">Đóng Vị Thế</h3>
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
                className="px-4 py-2 rounded text-[12px] font-semibold bg-negative text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >{closing ? 'Đang đóng...' : 'Xác Nhận Đóng'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SL/TP MODAL ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="panel-section w-full max-w-sm p-5 rounded-xl border border-border-standard shadow-2xl">
            <h3 className="text-[13px] font-semibold text-text-main mb-1">Sửa Stop Loss / Take Profit</h3>
            <p className="text-[11px] text-text-dim mb-4">
              {editModal.pos.symbol} · Giá vào: {toPoint(Number(editModal.pos.entry_price ?? 0) / 1000).toFixed(2)}
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted block mb-1">Stop Loss (nghìn ₫)</label>
                <input
                  value={editModal.stopLoss}
                  onChange={(e) => setEditModal({ ...editModal, stopLoss: e.target.value })}
                  placeholder="VD: 22.50"
                  className="w-full bg-background border border-negative/40 rounded px-3 py-2 text-[12px] font-mono text-negative outline-none focus:border-negative"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted block mb-1">Take Profit (nghìn ₫)</label>
                <input
                  value={editModal.takeProfit}
                  onChange={(e) => setEditModal({ ...editModal, takeProfit: e.target.value })}
                  placeholder="VD: 26.00"
                  className="w-full bg-background border border-positive/40 rounded px-3 py-2 text-[12px] font-mono text-positive outline-none focus:border-positive"
                />
              </div>
            </div>

            {editMsg && <p className="text-[11px] text-negative mb-3">{editMsg}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded text-[12px] border border-border-standard text-text-muted hover:bg-white/5 transition-colors"
              >Hủy</button>
              <button
                onClick={handleEditPosition}
                disabled={editing}
                className="px-4 py-2 rounded text-[12px] font-semibold bg-accent text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
              >{editing ? 'Đang lưu...' : 'Lưu Thay Đổi'}</button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
};
