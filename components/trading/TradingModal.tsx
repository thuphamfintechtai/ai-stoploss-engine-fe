import React from 'react';
import { CandlestickChartLW } from '../charts/CandlestickChartLW';
import { marketApi } from '../../services/api';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_FRACTION_OPTIONS, PRICE_LOCALE, formatNumberVI } from '../../constants';

export interface TradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  exchange: string;
  data: any[];
  loading: boolean;
  onTimeframeChange: (symbol: string, exchange: string, timeframe: string) => void;
}

// --- Trading Modal Component (TradingView-like) ---
export const TradingModal = ({ isOpen, onClose, symbol, exchange, data, loading, onTimeframeChange }: TradingModalProps) => {
  const [timeframe, setTimeframe] = React.useState('1d');
  const [activeTab, setActiveTab] = React.useState('Giao dịch');
  const [symbolDetail, setSymbolDetail] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // Tab-specific data states
  const [companyInfo, setCompanyInfo] = React.useState<any>(null);
  const [shareholders, setShareholders] = React.useState<any>(null);
  const [financialData, setFinancialData] = React.useState<any>(null);
  const [loadingTabData, setLoadingTabData] = React.useState(false);

  // Right sidebar states
  const [sidebarTab, setSidebarTab] = React.useState('Khớp lệnh');
  const [matchingHistory, setMatchingHistory] = React.useState<any>(null);
  const [orderBook, setOrderBook] = React.useState<any>(null);
  const [loadingSidebar, setLoadingSidebar] = React.useState(false);

  // Fetch symbol details when modal opens
  React.useEffect(() => {
    if (isOpen && symbol) {
      setLoadingDetail(true);
      marketApi.getSymbolDetail(symbol, { exchange })
        .then(res => {
          if (res.data.success) {
            setSymbolDetail(res.data.data);
          }
        })
        .catch(err => console.error('Load symbol detail error:', err))
        .finally(() => setLoadingDetail(false));
    }
  }, [isOpen, symbol, exchange]);

  // Fetch sidebar data (matching history & order book)
  React.useEffect(() => {
    if (isOpen && symbol) {
      setLoadingSidebar(true);
      Promise.all([
        marketApi.getMatchingHistory(symbol, { pageSize: 50 }),
        marketApi.getOrderBook(symbol)
      ])
        .then(([matchingRes, orderBookRes]) => {
          if (matchingRes.data.success) {
            setMatchingHistory(matchingRes.data.data);
          }
          if (orderBookRes.data.success) {
            setOrderBook(orderBookRes.data.data);
          }
        })
        .catch(err => console.error('Load sidebar data error:', err))
        .finally(() => setLoadingSidebar(false));
    }
  }, [isOpen, symbol]);

  // Fetch tab-specific data when activeTab changes
  React.useEffect(() => {
    if (!isOpen || !symbol) return;

    const fetchTabData = async () => {
      setLoadingTabData(true);
      try {
        switch (activeTab) {
          case 'Hồ sơ':
          case 'Vốn & Cổ tức':
            const companyRes = await marketApi.getCompanyInfo(symbol);
            setCompanyInfo(companyRes.data);
            break;

          case 'Cổ đông':
            const shareholdersRes = await marketApi.getShareholders(symbol);
            setShareholders(shareholdersRes.data);
            break;

          case 'Tài chính':
          case 'Thống kê':
            const financialRes = await marketApi.getAdvancedInfo(symbol);
            setFinancialData(financialRes.data);
            break;

          default:
            break;
        }
      } catch (error) {
        console.error(`Error fetching ${activeTab} data:`, error);
      } finally {
        setLoadingTabData(false);
      }
    };

    if (activeTab !== 'Giao dịch') {
      fetchTabData();
    }
  }, [activeTab, symbol, isOpen]);

  if (!isOpen) return null;

  const latestCandle = data.length > 0 ? data[data.length - 1] : null;
  const detail = symbolDetail || {};

  // API trả giá (đơn vị theo STOCK_PRICE_DISPLAY_SCALE). Fallback từ candle khi detail thiếu.
  const rawClose = detail.closePrice != null ? Number(detail.closePrice) : null;
  const currentPriceRaw = rawClose != null
    ? rawClose * STOCK_PRICE_DISPLAY_SCALE
    : (latestCandle?.close ?? 0);
  const priceChangeRaw = (Number(detail.change) || 0) * STOCK_PRICE_DISPLAY_SCALE;
  const priceChangePercent = detail.percentChange ?? 0;
  const companyName = detail.companyName || symbol;
  const isNegative = priceChangeRaw < 0;
  const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);
  const currentPrice = toPoint(currentPriceRaw);
  const priceChange = toPoint(priceChangeRaw);

  // Giá Sàn/TC/Trần: ưu tiên detail từ API, nếu 0 hoặc thiếu thì lấy từ candle (đã scale khi load)
  const rawFloor = (Number(detail.floor) || 0) * STOCK_PRICE_DISPLAY_SCALE;
  const rawRef = (Number(detail.reference) || 0) * STOCK_PRICE_DISPLAY_SCALE;
  const rawCeiling = (Number(detail.ceiling) || 0) * STOCK_PRICE_DISPLAY_SCALE;
  const floorDisplay = rawFloor > 0 ? toPoint(rawFloor) : toPoint(latestCandle?.low ?? currentPriceRaw);
  const referenceDisplay = rawRef > 0 ? toPoint(rawRef) : toPoint(latestCandle?.open ?? currentPriceRaw);
  const ceilingDisplay = rawCeiling > 0 ? toPoint(rawCeiling) : toPoint(latestCandle?.high ?? currentPriceRaw);
  const totalTradingDisplay = Number(detail.totalTrading) || latestCandle?.volume || 0;
  // GTGD (tỷ): detail.totalValue hoặc ước lượng từ giá đóng cửa * KL (tỷ = 1e9)
  const totalValueDisplay = Number(detail.totalValue) ?? (totalTradingDisplay && currentPriceRaw ? (currentPriceRaw * totalTradingDisplay) / 1e9 : null);

  const tabs = ['Giao dịch', 'Hồ sơ', 'Cổ đông', 'Vốn & Cổ tức', 'Tài chính', 'Thống kê'];
  const timeframes = ['1m', '1d', '1w', '1M'];

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-[#111827]/50 animate-fade-in p-4">
      <div className="w-full max-w-7xl h-[90vh] bg-panel rounded-lg overflow-hidden flex flex-col shadow-2xl border border-border-standard">
        {/* Header */}
        <div className="bg-panel border-b border-border-standard px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-main">
                {symbol} <span className="text-text-muted">({exchange})</span>
              </h1>
              <span className="text-sm text-text-muted">{companyName}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-2 hover:bg-panel rounded text-text-muted transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Price Info */}
          {!loadingDetail && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-8">
                <div>
                  <div className={`text-3xl font-bold font-mono ${isNegative ? 'text-negative' : 'text-positive'}`}>
                    {currentPrice.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}
                  </div>
                  <div className={`text-sm font-mono mt-1 ${isNegative ? 'text-negative' : 'text-positive'}`}>
                    {isNegative ? '↓' : '↑'} {Math.abs(priceChange).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <div><span className="text-text-muted">Sàn:</span> <span className="text-accent font-mono ml-1">{(floorDisplay != null && floorDisplay > 0 ? Number(floorDisplay).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—')}</span></div>
                  <div><span className="text-text-muted">TC:</span> <span className="text-amber-600 font-mono ml-1">{(referenceDisplay != null && referenceDisplay > 0 ? Number(referenceDisplay).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—')}</span></div>
                  <div><span className="text-text-muted">Trần:</span> <span className="text-purple-600 font-mono ml-1">{(ceilingDisplay != null && ceilingDisplay > 0 ? Number(ceilingDisplay).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—')}</span></div>
                  <div><span className="text-text-muted">Cao:</span> <span className="text-positive font-mono ml-1">{toPoint(latestCandle?.high ?? currentPriceRaw).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span></div>
                  <div><span className="text-text-muted">Thấp:</span> <span className="text-negative font-mono ml-1">{toPoint(latestCandle?.low ?? currentPriceRaw).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span></div>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div><span className="text-text-muted">Tổng KL:</span> <span className="text-text-main font-mono ml-1">{totalTradingDisplay > 0 ? formatNumberVI(totalTradingDisplay, { maximumFractionDigits: 0 }) : '—'}</span></div>
                <div><span className="text-text-muted">KLGD TB 10 phiên:</span> <span className="text-text-main font-mono ml-1">{formatNumberVI(detail.avgVol10s || 0, { maximumFractionDigits: 0 })}</span></div>
                <div><span className="text-text-muted">GTGD:</span> <span className="text-text-main font-mono ml-1">{totalValueDisplay != null && totalValueDisplay > 0 ? totalValueDisplay.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—'} tỷ</span></div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-6 mt-4 border-b border-border-standard overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`pb-2 px-1 text-sm whitespace-nowrap transition ${activeTab === tab ? 'text-accent border-b-2 border-[#1E3A5F]' : 'text-text-muted hover:text-text-main'}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Center - Main Content */}
          <div className={`flex-1 bg-panel p-4 min-h-0 flex flex-col ${activeTab === 'Giao dịch' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            {/* Tab: Giao dịch (Chart) - một thanh cuộn cho cả chart + timeframe bên dưới */}
            {activeTab === 'Giao dịch' && (
              <div className="flex flex-col min-h-[420px]">
                {/* Chart Header - TradingView Style */}
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <div className="flex items-center gap-6">
                    {/* Symbol with dot indicator */}
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-text-main">{symbol} · {timeframe} · {exchange}</span>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>

                    {/* OHLC Inline - TradingView Style (đã scale khi load) */}
                    <div className="flex items-center gap-2 text-sm font-mono">
                      <span className="text-accent">O</span>
                      <span className="text-accent font-semibold">{toPoint(latestCandle?.open ?? 0).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span>
                      <span className="text-accent ml-2">H</span>
                      <span className="text-accent font-semibold">{toPoint(latestCandle?.high ?? 0).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span>
                      <span className="text-accent ml-2">L</span>
                      <span className="text-accent font-semibold">{toPoint(latestCandle?.low ?? 0).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span>
                      <span className="text-accent ml-2">C</span>
                      <span className="text-accent font-semibold">{toPoint(latestCandle?.close ?? 0).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}</span>
                      <span className={`ml-3 ${(latestCandle?.close ?? 0) >= (latestCandle?.open ?? 0) ? 'text-positive' : 'text-negative'}`}>
                        {priceChange >= 0 ? '+' : ''}{priceChange.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                      </span>
                    </div>

                    {/* Volume */}
                    <div className="text-sm">
                      <span className="text-text-muted">Khối lượng</span>
                      <span className="text-text-main font-mono font-semibold ml-2">
                        {formatNumberVI(latestCandle?.volume || 0, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chart Area - nền trắng, chiều cao nhỏ hơn */}
                <div className="relative h-[300px] flex-shrink-0 bg-panel rounded-lg border border-border-standard overflow-hidden">
                  <CandlestickChartLW data={data} loading={loading} />

                  {/* TradingView Logo */}
                  <div style={{
                    position: 'absolute',
                    bottom: '50px',
                    left: '12px',
                    zIndex: 5,
                    background: 'rgba(243, 244, 246, 0.95)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#374151',
                    fontFamily: 'monospace',
                    border: '1px solid #E5E7EB'
                  }}>
                    TV
                  </div>
                </div>

                {/* Bottom Timeframe Bar - TradingView Style */}
                <div className="flex items-center justify-between pt-2 pb-1 border-t border-border-standard flex-shrink-0">
                  <div className="flex gap-1">
                    {['1m', '1h', '1d', '1w', '1M'].map(tf => (
                      <button
                        key={tf}
                        onClick={() => {
                          setTimeframe(tf);
                          onTimeframeChange(symbol, exchange, tf);
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${timeframe === tf
                          ? 'bg-accent text-white'
                          : 'bg-transparent text-text-muted hover:text-text-main hover:bg-panel'
                          }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span className="font-mono">{new Date().toLocaleTimeString('vi-VN')} UTC+7</span>
                    <button className="hover:text-text-main transition">%</button>
                    <button className="hover:text-text-main transition">log</button>
                    <button className="hover:text-text-main transition">tự động</button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Hồ sơ (Company Info) */}
            {activeTab === 'Hồ sơ' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : companyInfo?.data?.data ? (
                  <div className="space-y-6">
                    {/* Header - Company Name & Industry */}
                    <div className="bg-panel rounded-lg p-5 border border-border-standard">
                      <h1 className="text-2xl font-bold text-text-main mb-2">
                        {symbol} - {companyInfo.data.data.basicInformation?.symbol || 'N/A'}
                      </h1>
                      <p className="text-text-muted text-sm">
                        {companyInfo.data.data.basicInformation?.icbNameLevel2 || 'N/A'}
                      </p>
                    </div>

                    {/* Basic Information Grid */}
                    <div className="bg-panel rounded-lg p-5 border border-border-standard">
                      <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                        Thông tin cơ bản
                      </h2>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Ngày thành lập:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.basicInformation?.foundingDate
                              ? new Date(companyInfo.data.data.basicInformation.foundingDate).toLocaleDateString('vi-VN')
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Vốn điều lệ:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.basicInformation?.charterCapital
                              ? (companyInfo.data.data.basicInformation.charterCapital / 1000000000).toFixed(2) + ' tỷ VNĐ'
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Ngày niêm yết:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.listedInformation?.listingDate
                              ? new Date(companyInfo.data.data.listedInformation.listingDate).toLocaleDateString('vi-VN')
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Sàn giao dịch:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.listedInformation?.marketCode || 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Vốn hóa thị trường:</span>
                          <span className="text-positive font-medium">
                            {companyInfo.data.data.listedInformation?.marketCap
                              ? (companyInfo.data.data.listedInformation.marketCap / 1000000000).toFixed(2) + ' tỷ VNĐ'
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">CP đang lưu hành:</span>
                          <span className="text-text-main font-medium">
                            {companyInfo.data.data.listedInformation?.sharesOutstanding
                              ? formatNumberVI(companyInfo.data.data.listedInformation.sharesOutstanding)
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Company Profile */}
                    {companyInfo.data.data.basicInformation?.companyProfile && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Giới thiệu công ty
                        </h2>
                        <p className="text-text-main text-sm leading-relaxed">
                          {companyInfo.data.data.basicInformation.companyProfile}
                        </p>
                      </div>
                    )}

                    {/* Leadership Table */}
                    {companyInfo.data.data.leaderInformation && companyInfo.data.data.leaderInformation.length > 0 && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Ban lãnh đạo
                        </h2>
                        <div className="overflow-x-auto">
                          <table className="trading-table">
                            <thead>
                              <tr className="border-b border-border-standard">
                                <th className="text-left text-text-muted font-medium pb-3">Họ tên</th>
                                <th className="text-left text-text-muted font-medium pb-3">Chức vụ</th>
                                <th className="text-right text-text-muted font-medium pb-3">Tỷ lệ sở hữu</th>
                              </tr>
                            </thead>
                            <tbody>
                              {companyInfo.data.data.leaderInformation.map((leader: any, idx: number) => (
                                <tr key={idx} className="border-b border-border-standard">
                                  <td className="py-3 text-text-main">{leader.fullName}</td>
                                  <td className="py-3 text-text-main">{leader.positionName}</td>
                                  <td className="py-3 text-right text-accent font-medium">
                                    {leader.shareholderRate > 0 ? `${leader.shareholderRate.toFixed(2)}%` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Cổ đông (Shareholders) */}
            {activeTab === 'Cổ đông' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : shareholders?.data?.data ? (
                  <div className="space-y-6">
                    {/* Shareholders Table */}
                    {shareholders.data.data.inforShareholder && shareholders.data.data.inforShareholder.length > 0 && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Danh sách cổ đông
                        </h2>
                        <div className="overflow-x-auto">
                          <table className="trading-table">
                            <thead>
                              <tr className="border-b border-border-standard">
                                <th className="text-left text-text-muted font-medium pb-3">Tên cổ đông</th>
                                <th className="text-left text-text-muted font-medium pb-3">Loại</th>
                                <th className="text-right text-text-muted font-medium pb-3">Số lượng CP</th>
                                <th className="text-right text-text-muted font-medium pb-3">Tỷ lệ (%)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shareholders.data.data.inforShareholder.map((sh: any, idx: number) => (
                                <tr key={idx} className="border-b border-border-standard/50">
                                  <td className="py-3 text-text-main">{sh.owner || 'N/A'}</td>
                                  <td className="py-3 text-text-main">
                                    {sh.ownerType === 0 ? 'Cá nhân' : sh.ownerType === 2 ? 'Tổ chức' : 'Khác'}
                                  </td>
                                  <td className="py-3 text-right text-text-main font-mono">
                                    {sh.quantity ? formatNumberVI(sh.quantity) : '-'}
                                  </td>
                                  <td className="py-3 text-right text-accent font-medium">
                                    {sh.shareholderRate !== undefined ? `${sh.shareholderRate.toFixed(2)}%` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Shareholder Rate Summary */}
                    {shareholders.data.data.shareholderRate && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Tỷ lệ sở hữu
                        </h2>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-panel rounded p-4 border border-border-standard">
                            <div className="text-text-muted text-xs mb-1">Nhà nước</div>
                            <div className="text-text-main text-xl font-bold">
                              {shareholders.data.data.shareholderRate.corpGovRate?.toFixed(2) || '0.00'}%
                            </div>
                          </div>
                          <div className="bg-panel rounded p-4 border border-border-standard">
                            <div className="text-text-muted text-xs mb-1">Nước ngoài</div>
                            <div className="text-accent text-xl font-bold">
                              {shareholders.data.data.shareholderRate.corpForeignRate?.toFixed(2) || '0.00'}%
                            </div>
                          </div>
                          <div className="bg-panel rounded p-4 border border-border-standard">
                            <div className="text-text-muted text-xs mb-1">Khác</div>
                            <div className="text-positive text-xl font-bold">
                              {shareholders.data.data.shareholderRate.otherRate?.toFixed(2) || '0.00'}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Vốn & Cổ tức */}
            {activeTab === 'Vốn & Cổ tức' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : companyInfo?.data?.data ? (
                  <div className="space-y-6">
                    {/* Capital Information */}
                    <div className="bg-panel rounded-lg p-5 border border-border-standard">
                      <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                        Thông tin vốn
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between bg-panel rounded p-4 border border-border-standard">
                          <span className="text-text-muted">Vốn điều lệ:</span>
                          <span className="text-text-main font-bold">
                            {companyInfo.data.data.basicInformation?.charterCapital
                              ? (companyInfo.data.data.basicInformation.charterCapital / 1000000000).toFixed(2) + ' tỷ VNĐ'
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between bg-panel rounded p-4 border border-border-standard">
                          <span className="text-text-muted">CP niêm yết:</span>
                          <span className="text-text-main font-bold">
                            {companyInfo.data.data.listedInformation?.sharesListed
                              ? formatNumberVI(companyInfo.data.data.listedInformation.sharesListed)
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between bg-panel rounded p-4 border border-border-standard">
                          <span className="text-text-muted">CP lưu hành:</span>
                          <span className="text-text-main font-bold">
                            {companyInfo.data.data.listedInformation?.sharesOutstanding
                              ? formatNumberVI(companyInfo.data.data.listedInformation.sharesOutstanding)
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between bg-panel rounded p-4 border border-border-standard">
                          <span className="text-text-muted">Room NN còn lại:</span>
                          <span className="text-positive font-bold">
                            {companyInfo.data.data.listedInformation?.foreignCurrentRoom
                              ? formatNumberVI(companyInfo.data.data.listedInformation.foreignCurrentRoom)
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Information from companyInfo */}
                    {companyInfo.data.data.financeInformation && (
                      <div className="bg-panel rounded-lg p-5 border border-border-standard">
                        <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                          Thông tin tài chính bổ sung
                        </h2>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          <div className="flex justify-between bg-panel rounded p-3 border border-border-standard">
                            <span className="text-text-muted">EPS:</span>
                            <span className="text-text-main font-bold">
                              {companyInfo.data.data.financeInformation.eps != null
                                ? formatNumberVI(Number(companyInfo.data.data.financeInformation.eps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between bg-panel rounded p-3 border border-border-standard">
                            <span className="text-text-muted">BVPS:</span>
                            <span className="text-text-main font-bold">
                              {companyInfo.data.data.financeInformation.bvps != null
                                ? formatNumberVI(Number(companyInfo.data.data.financeInformation.bvps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between bg-panel rounded p-3 border border-border-standard">
                            <span className="text-text-muted">ROE:</span>
                            <span className="text-positive font-bold">
                              {companyInfo.data.data.financeInformation.roe !== null
                                ? (companyInfo.data.data.financeInformation.roe * 100).toFixed(2) + '%'
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Tài chính */}
            {activeTab === 'Tài chính' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : financialData?.data?.data?.length > 0 ? (
                  <div className="space-y-6">
                    {(() => {
                      const info = financialData.data.data[0];
                      return (
                        <>
                          {/* Valuation Metrics */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Định giá
                            </h2>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">P/E</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.pe !== null && info.pe !== undefined ? info.pe.toFixed(2) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">P/B</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.pb !== null && info.pb !== undefined ? info.pb.toFixed(2) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">EPS</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.eps !== null && info.eps !== undefined ? formatNumberVI(Number(info.eps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">BVPS</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.bvps !== null && info.bvps !== undefined ? formatNumberVI(Number(info.bvps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Profitability */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Hiệu suất hoạt động
                            </h2>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">ROE:</span>
                                <span className="text-positive font-bold">
                                  {info.roe !== null && info.roe !== undefined ? (info.roe * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">ROA:</span>
                                <span className="text-positive font-bold">
                                  {info.roa !== null && info.roa !== undefined ? (info.roa * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">ROIC:</span>
                                <span className="text-positive font-bold">
                                  {info.roic !== null && info.roic !== undefined ? (info.roic * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">Biên LN gộp:</span>
                                <span className="text-accent font-bold">
                                  {info.grossProfitMargin !== null && info.grossProfitMargin !== undefined ? (info.grossProfitMargin * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">Biên LN ròng:</span>
                                <span className="text-accent font-bold">
                                  {info.netProfitMargin !== null && info.netProfitMargin !== undefined ? (info.netProfitMargin * 100).toFixed(2) + '%' : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-panel rounded p-3 border border-border-standard">
                                <span className="text-text-muted">Beta:</span>
                                <span className="text-text-main font-bold">
                                  {info.beta !== null && info.beta !== undefined ? info.beta.toFixed(2) : '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Liquidity */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Khả năng thanh khoản
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Current Ratio</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.currentRatio !== null && info.currentRatio !== undefined ? info.currentRatio.toFixed(2) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Quick Ratio</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.quickRatio !== null && info.quickRatio !== undefined ? info.quickRatio.toFixed(2) : '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Thống kê */}
            {activeTab === 'Thống kê' && (
              <div className="h-full overflow-y-auto p-6 bg-panel">
                {loadingTabData ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Đang tải dữ liệu...</div>
                  </div>
                ) : financialData?.data?.data?.length > 0 ? (
                  <div className="space-y-6">
                    {(() => {
                      const info = financialData.data.data[0];
                      return (
                        <>
                          {/* Trading Statistics */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Biến động giao dịch
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Giá hiện tại</div>
                                <div className={`text-2xl font-bold ${info.stockPercentChange > 0 ? 'text-positive' :
                                  info.stockPercentChange < 0 ? 'text-negative' : 'text-amber-600'
                                  }`}>
                                  {info.closePrice != null ? (info.closePrice * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '-'}
                                </div>
                                <div className={`text-xs mt-1 ${info.stockPercentChange > 0 ? 'text-positive' :
                                  info.stockPercentChange < 0 ? 'text-negative' : 'text-amber-600'
                                  }`}>
                                  {info.change !== null && info.change !== undefined ?
                                    `${info.change > 0 ? '+' : ''}${(info.change * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}` : '-'}
                                  {' '}
                                  ({info.stockPercentChange !== null && info.stockPercentChange !== undefined ?
                                    `${info.stockPercentChange > 0 ? '+' : ''}${info.stockPercentChange.toFixed(2)}%` : '-'})
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Tham chiếu</div>
                                <div className="text-amber-600 text-xl font-bold">
                                  {info.reference != null ? (info.reference * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Trần</div>
                                <div className="text-purple-400 text-xl font-bold">
                                  {info.ceiling != null ? (info.ceiling * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Sàn</div>
                                <div className="text-cyan-400 text-xl font-bold">
                                  {info.floor != null ? (info.floor * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">KL giao dịch</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.totalTrading ? formatNumberVI(info.totalTrading) : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">GT giao dịch</div>
                                <div className="text-text-main text-xl font-bold">
                                  {info.totalValue
                                    ? (info.totalValue / 1000000000).toFixed(2) + ' tỷ'
                                    : '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Market Cap & Volume */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Vốn hóa & Thanh khoản
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">Vốn hóa thị trường</div>
                                <div className="text-text-main text-2xl font-bold">
                                  {info.marketCap
                                    ? (info.marketCap / 1000000000).toFixed(2) + ' tỷ VNĐ'
                                    : '-'}
                                </div>
                              </div>
                              <div className="bg-panel rounded p-4 border border-border-standard">
                                <div className="text-text-muted text-xs mb-1">KL TB 10 phiên</div>
                                <div className="text-text-main text-2xl font-bold">
                                  {info.avgVol10s ? formatNumberVI(info.avgVol10s) : '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Foreign Trading */}
                          <div className="bg-panel rounded-lg p-5 border border-border-standard">
                            <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                              Giao dịch nước ngoài
                            </h2>
                            <div className="flex items-center justify-between bg-panel rounded p-4 border border-border-standard">
                              <span className="text-text-muted">Mua/Bán ròng:</span>
                              <div className="text-right">
                                <div className={`text-xl font-bold ${info.isForeignNetBuy ? 'text-positive' : 'text-negative'
                                  }`}>
                                  {info.foreignNetBSVal
                                    ? `${info.isForeignNetBuy ? '+' : ''}${(info.foreignNetBSVal / 1000000).toFixed(2)} triệu VNĐ`
                                    : '-'}
                                </div>
                                <div className="text-xs text-text-muted mt-1">
                                  {info.isForeignNetBuy ? 'Mua ròng' : 'Bán ròng'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Indices */}
                          {info.indexs && info.indexs.length > 0 && (
                            <div className="bg-panel rounded-lg p-5 border border-border-standard">
                              <h2 className="text-lg font-semibold text-text-main mb-4 pb-2 border-b border-border-standard">
                                Thuộc chỉ số
                              </h2>
                              <div className="flex flex-wrap gap-2">
                                {info.indexs.map((index: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="bg-blue-900/30 text-blue-300 px-3 py-1 rounded text-sm font-medium border border-blue-700/50"
                                  >
                                    {index}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-text-muted">Chưa có dữ liệu</div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right Sidebar - Stats & Metrics */}
          <div className="w-80 bg-panel border-l border-border-standard flex flex-col min-h-0">
            {/* Tabs */}
            <div className="border-b border-border-standard p-3 flex-shrink-0">
              <div className="flex gap-4 text-sm">
                <button
                  onClick={() => setSidebarTab('Khớp lệnh')}
                  className={`pb-1 font-medium transition ${sidebarTab === 'Khớp lệnh'
                    ? 'text-accent border-b-2 border-[#1E3A5F]'
                    : 'text-text-muted hover:text-text-main'
                    }`}
                >
                  Khớp lệnh
                </button>
                <button
                  onClick={() => setSidebarTab('Bước giá')}
                  className={`pb-1 font-medium transition ${sidebarTab === 'Bước giá'
                    ? 'text-accent border-b-2 border-[#1E3A5F]'
                    : 'text-text-muted hover:text-text-main'
                    }`}
                >
                  Bước giá
                </button>
              </div>
            </div>

            {/* Scrollable area: stats + table + ĐỊNH GIÁ + HIỆU SUẤT */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Trading Stats – BE trả data: { arrayList, totalTradingVolume, buyUpVolume, sellDownVolume } */}
              {matchingHistory && (
                <div className="p-3 pb-4 border-b border-border-standard">
                  <div className="flex justify-between text-xs text-text-muted gap-4">
                    <span className="py-1">KL: <span className="text-text-main font-mono">{formatNumberVI(matchingHistory.totalTradingVolume ?? matchingHistory.data?.totalTradingVolume ?? 0, { maximumFractionDigits: 0 })}</span></span>
                    <span className="py-1">M: <span className="text-positive font-mono">{formatNumberVI(matchingHistory.buyUpVolume ?? matchingHistory.data?.buyUpVolume ?? 0, { maximumFractionDigits: 0 })}</span></span>
                    <span className="py-1">B: <span className="text-negative font-mono">{formatNumberVI(matchingHistory.sellDownVolume ?? matchingHistory.data?.sellDownVolume ?? 0, { maximumFractionDigits: 0 })}</span></span>
                  </div>
                </div>
              )}

              {/* Tab Content: Khớp lệnh – arrayList ở root hoặc data.arrayList */}
              {sidebarTab === 'Khớp lệnh' && (matchingHistory?.arrayList ?? matchingHistory?.data?.arrayList) && (
                <div className="overflow-y-auto">
                  <table className="trading-table">
                    <thead className="sticky top-0 bg-panel">
                      <tr className="border-b border-border-standard">
                        <th className="text-left text-text-muted font-medium py-2 px-3">Giá</th>
                        <th className="text-right text-text-muted font-medium py-2 px-3">KL</th>
                        <th className="text-right text-text-muted font-medium py-2 px-3">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(matchingHistory.arrayList ?? matchingHistory.data?.arrayList ?? []).map((trade: any, idx: number) => {
                        const price = Number(trade.matchPrice ?? trade.price ?? 0);
                        const vol = Number(trade.tradingVolume ?? trade.volume ?? 0);
                        const timeStr = (trade.time ?? trade.matchTime ?? '').toString();
                        return (
                          <tr key={idx} className="border-b border-border-standard hover:bg-panel">
                            <td className={`py-3 px-3 font-mono ${(trade.style ?? trade.side ?? '') === 'B' ? 'text-positive' :
                              (trade.style ?? trade.side ?? '') === 'S' ? 'text-negative' : 'text-amber-600'
                              }`}>
                              {(price * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}
                            </td>
                            <td className="py-3 px-3 text-right text-text-main font-mono">
                              {(vol / 100).toFixed(1)}
                            </td>
                            <td className="py-3 px-3 text-right text-text-muted">
                              {timeStr.substring(0, 5)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab Content: Bước giá – BE trả data: { priceStatistic } */}
              {sidebarTab === 'Bước giá' && (
                <div className="overflow-y-auto">
                  {((orderBook?.priceStatistic ?? orderBook?.data?.priceStatistic)?.length ?? 0) > 0 ? (
                    <table className="trading-table">
                      <thead className="sticky top-0 bg-panel">
                        <tr className="border-b border-border-standard">
                          <th className="text-left text-text-muted font-medium py-2 px-3">Giá</th>
                          <th className="text-right text-text-muted font-medium py-2 px-3">Mua</th>
                          <th className="text-right text-text-muted font-medium py-2 px-3">Bán</th>
                          <th className="text-right text-text-muted font-medium py-2 px-3">Tổng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orderBook?.priceStatistic ?? orderBook?.data?.priceStatistic ?? []).map((step: any, idx: number) => {
                          const stepPrice = Number(step.priceStep ?? step.price ?? 0);
                          const buyVol = Number(step.buyUpVolume ?? step.buyVolume ?? 0);
                          const sellVol = Number(step.sellDownVolume ?? step.sellVolume ?? 0);
                          const totalVol = Number(step.stepVolume ?? step.volume ?? step.totalVolume ?? 0);
                          return (
                            <tr key={idx} className="border-b border-border-standard hover:bg-panel">
                              <td className="py-3 px-3 font-mono text-amber-600">
                                {(stepPrice * STOCK_PRICE_DISPLAY_SCALE).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-positive">
                                {buyVol ? (buyVol / 100).toFixed(1) : '-'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-negative">
                                {sellVol ? (sellVol / 100).toFixed(1) : '-'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-text-main">
                                {totalVol ? (totalVol / 100).toFixed(1) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center text-text-muted py-8">
                      {loadingSidebar ? 'Đang tải...' : 'Chưa có dữ liệu bước giá'}
                    </div>
                  )}
                </div>
              )}

              {/* Valuation Metrics - Always show below */}
              <div className="p-4 pt-5 border-t border-border-standard">
                <h3 className="text-xs font-bold text-text-muted uppercase mb-4">ĐỊNH GIÁ</h3>
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">P/E:</span>
                    <span className="text-text-main font-mono text-right">{detail.pe ? detail.pe.toFixed(2) : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">P/B:</span>
                    <span className="text-text-main font-mono text-right">{detail.pb ? detail.pb.toFixed(2) : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">EPS:</span>
                    <span className="text-text-main font-mono text-right">{detail.eps != null ? formatNumberVI(Number(detail.eps) * STOCK_PRICE_DISPLAY_SCALE, { maximumFractionDigits: 0 }) : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">ROE:</span>
                    <span className="text-positive font-mono text-right">{detail.roe ? detail.roe.toFixed(2) + '%' : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">ROA:</span>
                    <span className="text-positive font-mono text-right">{detail.roa ? detail.roa.toFixed(2) + '%' : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">Beta:</span>
                    <span className="text-text-main font-mono text-right">{detail.beta ? detail.beta.toFixed(2) : '-'}</span>
                  </div>
                  <div className="flex justify-between border-t border-border-standard pt-4 mt-3 py-1">
                    <span className="text-text-muted">Vốn hóa:</span>
                    <span className="text-text-main font-mono text-right">{detail.marketCap ? detail.marketCap.toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) + ' tỷ' : '-'}</span>
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div className="p-4 pt-5 border-t border-border-standard">
                <h3 className="text-xs font-bold text-text-muted uppercase mb-4">HIỆU SUẤT</h3>
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">1 tuần:</span>
                    <span className={`font-mono text-right ${(detail.raw?.stockPercentChange1w || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {detail.raw?.stockPercentChange1w ? detail.raw.stockPercentChange1w.toFixed(2) + '%' : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">1 tháng:</span>
                    <span className={`font-mono text-right ${(detail.raw?.stockPercentChange1m || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {detail.raw?.stockPercentChange1m ? detail.raw.stockPercentChange1m.toFixed(2) + '%' : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted">3 tháng:</span>
                    <span className={`font-mono text-right ${(detail.raw?.stockPercentChange3m || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {detail.raw?.stockPercentChange3m ? detail.raw.stockPercentChange3m.toFixed(2) + '%' : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
