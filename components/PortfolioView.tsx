import React, { useState, useEffect, useCallback, useRef } from 'react';
import { portfolioApi, realPortfolioApi, getSectorConcentration } from '../services/api';
import type { Position, RealPosition } from '../services/api';
import wsService from '../services/websocket';
import { EmptyState } from './ui/EmptyState';
import { PortfolioHeroCard } from './portfolio/PortfolioHeroCard';
import { PortfolioHealthCard } from './portfolio/PortfolioHealthCard';
import { SectorAllocationCard, type SectorAllocation } from './portfolio/SectorAllocationCard';
// W3.6: AiBriefingCard gỡ — endpoint /briefing chưa implement, briefing luôn null → card không render.
// AI Monitor (dưới) đã cover use-case briefing + tiết kiệm Gemini cost. Bỏ import + render.
// import { AiBriefingCard } from './portfolio/AiBriefingCard';
import { AiMonitorSection, type MonitorState, type AiAlert } from './portfolio/AiMonitorSection';
import { RealPositionsTable } from './portfolio/RealPositionsTable';
import { TransactionHistory } from './portfolio/TransactionHistory';
import { PendingOrdersPanel } from './portfolio/PendingOrdersPanel';
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

// Quick Stats Card Component
const QuickStatCard: React.FC<{
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}> = ({ label, value, subValue, trend, icon }) => {
  const trendColor = trend === 'up'
    ? 'text-[var(--color-positive)]'
    : trend === 'down'
      ? 'text-[var(--color-negative)]'
      : 'text-[var(--color-text-muted)]';

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-lg p-4 hover:border-[var(--color-border-standard)] transition-colors">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)]">
          {label}
        </span>
        {icon && <span className="text-[var(--color-text-dim)]">{icon}</span>}
      </div>
      <div className={`text-[20px] font-bold tabular-nums leading-tight ${trendColor}`}>
        {value}
      </div>
      {subValue && (
        <div className={`text-[11px] mt-1 ${trendColor}`}>
          {subValue}
        </div>
      )}
    </div>
  );
};

// Section Header Component
const SectionHeader: React.FC<{
  title: string;
  action?: { label: string; onClick: () => void };
}> = ({ title, action }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-[13px] font-semibold text-[var(--color-text-main)] uppercase tracking-wide">
      {title}
    </h2>
    {action && (
      <button
        onClick={action.onClick}
        className="text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
      >
        {action.label}
      </button>
    )}
  </div>
);

// Format helpers
const formatVND = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

// Sector mapping (mirrors backend VN_SECTOR_MAP)
const VN_SECTOR_MAP: Record<string, string> = {
  VCB: 'BANKING', BID: 'BANKING', CTG: 'BANKING', TCB: 'BANKING', MBB: 'BANKING',
  ACB: 'BANKING', VPB: 'BANKING', STB: 'BANKING', HDB: 'BANKING', TPB: 'BANKING',
  LPB: 'BANKING', OCB: 'BANKING', MSB: 'BANKING', VIB: 'BANKING', EIB: 'BANKING',
  SHB: 'BANKING', NAB: 'BANKING', BVB: 'BANKING',
  VHM: 'REAL_ESTATE', VIC: 'REAL_ESTATE', NVL: 'REAL_ESTATE', KDH: 'REAL_ESTATE',
  DIG: 'REAL_ESTATE', PDR: 'REAL_ESTATE', NLG: 'REAL_ESTATE', DXG: 'REAL_ESTATE',
  VRE: 'REAL_ESTATE', KBC: 'REAL_ESTATE', IDC: 'REAL_ESTATE', SZC: 'REAL_ESTATE',
  FPT: 'TECHNOLOGY', CMG: 'TECHNOLOGY', ELC: 'TECHNOLOGY', VGI: 'TECHNOLOGY', ITD: 'TECHNOLOGY',
  MWG: 'RETAIL', PNJ: 'RETAIL', DGW: 'RETAIL', FRT: 'RETAIL', VGC: 'RETAIL',
  HPG: 'STEEL', HSG: 'STEEL', NKG: 'STEEL', TLH: 'STEEL', VGS: 'STEEL', SMC: 'STEEL',
  SSI: 'SECURITIES', VCI: 'SECURITIES', HCM: 'SECURITIES', SHS: 'SECURITIES',
  VDS: 'SECURITIES', CTS: 'SECURITIES', BSI: 'SECURITIES', MBS: 'SECURITIES',
  GAS: 'ENERGY', POW: 'ENERGY', PLX: 'ENERGY', PVD: 'ENERGY', PVS: 'ENERGY',
  BSR: 'ENERGY', OIL: 'ENERGY', PGS: 'ENERGY',
  VNM: 'CONSUMER', SAB: 'CONSUMER', MSN: 'CONSUMER', QNS: 'CONSUMER',
  KDC: 'CONSUMER', MCH: 'CONSUMER', ANV: 'CONSUMER', VHC: 'CONSUMER',
};
const getSectorForSymbol = (symbol: string): string => VN_SECTOR_MAP[symbol?.toUpperCase()] ?? 'OTHER';

export const PortfolioView: React.FC<Props> = ({
  portfolioId,
  totalBalance,
  openPositions: _openPositions,
  onNavigate,
  onOpenSetup,
}) => {
  const [realPositions, setRealPositions] = useState<RealPosition[]>([]);
  const [realPositionsLoading, setRealPositionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'history'>('positions');

  const priceReceivedAtRef = useRef<Record<string, number>>({});
  const [priceReceivedAtBySymbol, setPriceReceivedAtBySymbol] = useState<Record<string, number>>({});
  const [ageTick, setAgeTick] = useState(0);

  const [cashBalance, setCashBalance] = useState({
    total_balance: 0,
    available_cash: 0,
    pending_settlement_cash: 0,
  });
  const [portfolioConfig, setPortfolioConfig] = useState<PortfolioFeeConfig | null>(null);
  const [initialCapital, setInitialCapital] = useState<number | null>(null);
  const [realSummary, setRealSummary] = useState<{
    total_value: number;
    total_pnl: number;
    total_realized_pnl: number;
    total_unrealized_pnl: number;
    percent_return: number;
    position_count: number;
    closed_count: number;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sectorData, setSectorData] = useState<SectorAllocation[]>([]);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [monitorState, setMonitorState] = useState<MonitorState | undefined>(undefined);
  const [aiAlerts, setAiAlerts] = useState<AiAlert[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);

  const fetchRealData = useCallback(async () => {
    if (!portfolioId) return;
    setRealPositionsLoading(true);
    setSummaryLoading(true);
    setSectorLoading(true);
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
        setPortfolioConfig({
          buy_fee_percent: p.buy_fee_percent,
          sell_fee_percent: p.sell_fee_percent,
          sell_tax_percent: p.sell_tax_percent,
        });
        if (p.initial_capital != null) setInitialCapital(Number(p.initial_capital));
      }
      if (summaryRes.data?.success && summaryRes.data?.data) {
        const s = summaryRes.data.data;
        setRealSummary({
          total_value: Number(s.total_value ?? 0),
          total_pnl: Number(s.total_pnl ?? 0),
          total_realized_pnl: Number(s.total_realized_pnl ?? 0),
          total_unrealized_pnl: Number(s.total_unrealized_pnl ?? 0),
          percent_return: Number(s.percent_return ?? 0),
          position_count: Number(s.position_count ?? 0),
          closed_count: Number(s.closed_count ?? 0),
        });
      }
      // Fetch sector concentration data
      try {
        const sectorRes = await getSectorConcentration(portfolioId);
        if (sectorRes?.sectors && Array.isArray(sectorRes.sectors)) {
          // Get positions to count per sector
          const positions = posRes.data?.data ?? [];
          const mapped: SectorAllocation[] = sectorRes.sectors.map((s: any) => {
            const sectorKey = s.sector;
            // Count positions that belong to this sector
            const posCount = positions.filter((p: any) => {
              const sym = p.symbol?.toUpperCase();
              // Simple sector lookup - matches the backend VN_SECTOR_MAP logic
              const posSector = getSectorForSymbol(sym);
              return posSector === sectorKey;
            }).length;
            return {
              name: s.sectorLabel || s.sector || 'Khác',
              value_vnd: Number(s.totalValueVnd ?? 0),
              pct: Number(s.percent ?? 0),
              position_count: posCount,
            };
          });
          setSectorData(mapped);
        }
      } catch {
        // Sector data is optional, don't fail the whole fetch
      }
      // Fetch AI monitor state and alerts
      try {
        const [monitorRes, alertsRes] = await Promise.all([
          realPortfolioApi.getMonitorState(portfolioId),
          realPortfolioApi.getAlerts(portfolioId),
        ]);
        if (monitorRes.data?.success) {
          setMonitorState(monitorRes.data.data);
        }
        if (alertsRes.data?.success && Array.isArray(alertsRes.data.data)) {
          setAiAlerts(alertsRes.data.data);
        }
      } catch {
        // Monitor data is optional
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('PortfolioView fetchRealData failed:', err);
    } finally {
      setRealPositionsLoading(false);
      setSummaryLoading(false);
      setSectorLoading(false);
    }
  }, [portfolioId, totalBalance]);

  // AI Monitor toggle handler
  const handleMonitorToggle = useCallback(async (enabled: boolean) => {
    if (!portfolioId) return;
    setMonitorLoading(true);
    try {
      const res = await realPortfolioApi.toggleMonitor(portfolioId, enabled);
      if (res.data?.success) {
        setMonitorState(res.data.data);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Toggle monitor failed:', err);
    } finally {
      setMonitorLoading(false);
    }
  }, [portfolioId]);

  // Dismiss alert handler
  const handleDismissAlert = useCallback(async (alertId: string) => {
    if (!portfolioId) return;
    try {
      await realPortfolioApi.dismissAlert(portfolioId, alertId);
      setAiAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Dismiss alert failed:', err);
    }
  }, [portfolioId]);

  useEffect(() => {
    if (portfolioId) fetchRealData();
  }, [portfolioId, fetchRealData]);

  // WS price update: refresh freshness + update current_price/unrealized_pnl per position
  useEffect(() => {
    const handler = (data: any) => {
      const symbol = data?.symbol;
      if (!symbol || typeof symbol !== 'string') return;
      const incomingPrice = Number(data?.price);
      const validPrice = Number.isFinite(incomingPrice) && incomingPrice > 0;

      priceReceivedAtRef.current = {
        ...priceReceivedAtRef.current,
        [symbol]: Date.now(),
      };
      setPriceReceivedAtBySymbol((prev) => {
        if (prev[symbol] != null) return prev;
        return { ...prev, [symbol]: Date.now() };
      });

      // W1.1 — Mark-to-market: update P&L per row khi WS push giá.
      // Server seed current_price/unrealized_pnl khi initial load; WS chỉ patch khi giá đổi.
      if (validPrice) {
        setRealPositions((prev) => {
          let changed = false;
          const next = prev.map((p) => {
            if (p.symbol !== symbol) return p;
            const entry = Number(p.entry_price ?? 0);
            const qty = Number(p.quantity ?? 0);
            const buyFee = Number((p as any).buy_fee_vnd ?? 0);
            const newPnl = Math.round((incomingPrice - entry) * qty - buyFee);
            if (
              (p as any).current_price === incomingPrice &&
              (p as any).unrealized_pnl === newPnl
            ) {
              return p;
            }
            changed = true;
            return { ...p, current_price: incomingPrice, unrealized_pnl: newPnl };
          });
          return changed ? next : prev;
        });
      }
    };
    wsService.onPriceUpdate(handler);
    return () => {
      wsService.off('price_update', handler);
    };
  }, []);

  useEffect(() => {
    if (!portfolioId) return;
    const intervalId = setInterval(() => {
      setPriceReceivedAtBySymbol({ ...priceReceivedAtRef.current });
      setAgeTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(intervalId);
  }, [portfolioId]);

  // Computed values
  const totalPnl = realSummary?.total_pnl ?? 0;
  const percentReturn = realSummary?.percent_return ?? 0;
  const pnlTrend = totalPnl > 0 ? 'up' : totalPnl < 0 ? 'down' : 'neutral';

  return (
    <div className="space-y-5 animate-fade-in max-w-[1600px] mx-auto">
      {/* ═══ HEADER ═══ */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--color-text-main)] flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            Quản lý vốn
          </h1>
          <p className="text-[12px] text-[var(--color-text-dim)] mt-1">
            Theo dõi danh mục đầu tư và hiệu suất giao dịch
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRealData}
            className="p-2 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-dim)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-panel-hover)] transition-colors"
            title="Làm mới dữ liệu"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          <button
            onClick={onOpenSetup}
            className="p-2 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-dim)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-panel-hover)] transition-colors"
            title="Cài đặt danh mục"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => onNavigate('terminal')}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Đặt lệnh
          </button>
        </div>
      </header>

      {!portfolioId && (
        <EmptyState
          title="Chưa chọn danh mục"
          description="Vui lòng chọn hoặc tạo danh mục để bắt đầu quản lý vốn."
          actionLabel="Tạo danh mục"
          onAction={onOpenSetup}
        />
      )}

      {portfolioId && (
        <>
          {/* ═══ QUICK STATS GRID — 3 cards (P&L moved to Hero) ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <QuickStatCard
              label="Tổng vốn"
              value={`${formatVND(cashBalance.total_balance || totalBalance)}đ`}
              subValue={percentReturn !== 0 ? `${formatPct(percentReturn)} ROI` : undefined}
              trend={pnlTrend}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <QuickStatCard
              label="Tiền khả dụng"
              value={`${formatVND(cashBalance.available_cash)}đ`}
              subValue={cashBalance.pending_settlement_cash > 0 ? `+${formatVND(cashBalance.pending_settlement_cash)} chờ TT` : undefined}
              trend="neutral"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              }
            />
            <QuickStatCard
              label="Vị thế"
              value={realSummary?.position_count ?? 0}
              subValue={`${realSummary?.closed_count ?? 0} đã đóng`}
              trend="neutral"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
              }
            />
          </div>

          {/* ═══ HERO CARD — Capital allocation + P&L detail ═══ */}
          <PortfolioHeroCard
            totalBalance={cashBalance.total_balance || totalBalance}
            availableCash={cashBalance.available_cash}
            pendingSettlement={cashBalance.pending_settlement_cash}
            totalPnl={realSummary?.total_pnl ?? 0}
            percentReturn={realSummary?.percent_return ?? 0}
            realizedPnl={realSummary?.total_realized_pnl ?? 0}
            unrealizedPnl={realSummary?.total_unrealized_pnl ?? 0}
            positionCount={realSummary?.position_count ?? 0}
            closedCount={realSummary?.closed_count ?? 0}
            loading={summaryLoading}
          />

          {/* ═══ POSITIONS & HISTORY TABS — moved up for faster action access ═══ */}
          <div className="bg-[var(--color-panel)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
            {/* Tab Header */}
            <div className="flex items-center border-b border-[var(--color-border-subtle)]">
              <button
                onClick={() => setActiveTab('positions')}
                className={`px-5 py-3 text-[13px] font-medium transition-colors relative ${
                  activeTab === 'positions'
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                Vị thế đang mở
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                  {realSummary?.position_count ?? 0}
                </span>
                {activeTab === 'positions' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-5 py-3 text-[13px] font-medium transition-colors relative ${
                  activeTab === 'history'
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                Lịch sử giao dịch
                {activeTab === 'history' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]" />
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 space-y-4">
              {activeTab === 'positions' && (
                <>
                  {/* W2.5 — Lệnh PENDING chờ khớp (hiển thị nếu có) */}
                  <PendingOrdersPanel portfolioId={portfolioId} onConfirmed={fetchRealData} />
                  <RealPositionsTable
                    positions={realPositions}
                    portfolioId={portfolioId}
                    portfolio={portfolioConfig}
                    onPositionClosed={fetchRealData}
                    loading={realPositionsLoading}
                    priceReceivedAtBySymbol={priceReceivedAtBySymbol}
                    ageTick={ageTick}
                  />
                </>
              )}
              {activeTab === 'history' && (
                <TransactionHistory portfolioId={portfolioId} portfolio={portfolioConfig} />
              )}
            </div>
          </div>

          {/* ═══ HEALTH + SECTOR GRID ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PortfolioHealthCard
              totalBalance={cashBalance.total_balance || totalBalance}
              availableCash={cashBalance.available_cash}
              realPositions={realPositions}
              realizedPnl={realSummary?.total_realized_pnl ?? 0}
              unrealizedPnl={realSummary?.total_unrealized_pnl ?? 0}
              initialCapital={initialCapital}
              onOpenAdvanced={() => {}}
            />
            <SectorAllocationCard portfolioId={portfolioId} sectors={sectorData} loading={sectorLoading} />
          </div>

          {/* ═══ AI MONITOR ═══ */}
          <AiMonitorSection
            portfolioId={portfolioId}
            state={monitorState}
            alerts={aiAlerts}
            loading={monitorLoading}
            onToggle={handleMonitorToggle}
            onDismissAlert={handleDismissAlert}
          />

        </>
      )}
    </div>
  );
};
