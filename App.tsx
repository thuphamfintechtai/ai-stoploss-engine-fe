import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ComposedChart } from 'recharts';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { TraderProfile, AiAnalysis } from './types';
import { RiskProgressBar } from './components/RiskProgressBar';
import { TraderCard } from './components/TraderCard';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { MarketNewsView } from './components/MarketNewsView';
import { AuthView } from './components/AuthView';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { analyzeTrader } from './services/geminiService';
import { portfolioApi, marketApi, authApi } from './services/api';
import wsService from './services/websocket';
import { STOCK_PRICE_DISPLAY_SCALE } from './constants';

// --- Helper: Convert Vietnamese date to Lightweight Charts format ---
function convertToLightweightTime(dateStr: string): string {
    // Input: "12/2/2026" (dd/mm/yyyy)
    // Output: "2026-02-12" (yyyy-mm-dd)
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// --- Helper: Calculate Simple Moving Average ---
function calculateSMA(data: any[], period: number) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            continue; // Not enough data yet
        }
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        result.push({
            time: data[i].time,
            value: sum / period,
        });
    }
    return result;
}

// --- Candlestick Chart Component (TradingView Lightweight Charts) ---
const CandlestickChartLW = ({ data, loading }: { data: any[], loading: boolean }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<any>(null);
    const volumeSeriesRef = useRef<any>(null);
    const ma20SeriesRef = useRef<any>(null);
    const ma50SeriesRef = useRef<any>(null);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedTool, setSelectedTool] = useState<'cursor' | 'trendline' | 'hline' | 'text'>('cursor');
    const [drawings, setDrawings] = useState<any[]>([]);
    const [pendingTrendline, setPendingTrendline] = useState<any>(null);

    // Listen to tool changes from left sidebar
    useEffect(() => {
        const handleToolChange = (e: any) => {
            const tool = e.detail.tool;
            console.log('📍 Tool changed:', tool);
            if (tool === 'clear') {
                // Clear all drawings
                drawings.forEach(drawing => {
                    if (drawing.type === 'hline' && drawing.priceLine) {
                        seriesRef.current?.removePriceLine(drawing.priceLine);
                    } else if (drawing.type === 'trendline' && drawing.series) {
                        chartRef.current?.removeSeries(drawing.series);
                    }
                });
                seriesRef.current?.setMarkers([]);
                setDrawings([]);
                setPendingTrendline(null);
                console.log('🧹 Cleared all drawings');
            } else {
                setSelectedTool(tool);
                console.log('🎨 Selected tool:', tool);
            }
        };

        window.addEventListener('chartToolChange', handleToolChange);
        console.log('👂 Event listener attached');
        return () => {
            window.removeEventListener('chartToolChange', handleToolChange);
            console.log('🔇 Event listener removed');
        };
    }, [drawings]);

    // Effect 1: Initialize chart on mount
    useEffect(() => {
        console.log('CandlestickChartLW: Initializing chart, container:', chartContainerRef.current);
        if (!chartContainerRef.current) {
            console.error('CandlestickChartLW: Container ref is null!');
            return;
        }

        console.log('CandlestickChartLW: Creating chart...');
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            layout: {
                background: { type: ColorType.Solid, color: '#ffffff' },
                textColor: '#374151',
            },
            grid: {
                vertLines: { color: '#E5E7EB' },
                horzLines: { color: '#E5E7EB' },
            },
            timeScale: {
                borderColor: '#E5E7EB',
                timeVisible: true,
                secondsVisible: false,
                barSpacing: 12,
                minBarSpacing: 8,
            },
            rightPriceScale: {
                borderColor: '#E5E7EB',
            },
        });

        console.log('CandlestickChartLW: Chart created, adding series...');
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // Assign to refs for external access (drawing tools)
        chartRef.current = chart;
        seriesRef.current = candlestickSeries;
        console.log('✅ Chart and series refs assigned');

        // Add volume histogram
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume',
        });

        // Configure volume scale (separate from price)
        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.7, // Volume takes bottom 30%
                bottom: 0,
            },
        });

        // Add MA20 (blue)
        const ma20Series = chart.addSeries(LineSeries, {
            color: '#2962FF',
            lineWidth: 2,
            title: 'MA20',
        });

        // Add MA50 (orange)
        const ma50Series = chart.addSeries(LineSeries, {
            color: '#FF6D00',
            lineWidth: 2,
            title: 'MA50',
        });

        chartRef.current = chart;
        seriesRef.current = candlestickSeries;
        volumeSeriesRef.current = volumeSeries;
        ma20SeriesRef.current = ma20Series;
        ma50SeriesRef.current = ma50Series;
        console.log('CandlestickChartLW: Chart initialized successfully!', { chart, series: candlestickSeries, volume: volumeSeries });

        // Responsive resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    // Effect 2: Update data when changed
    useEffect(() => {
        if (!seriesRef.current || !data || data.length === 0) {
            console.log('CandlestickChartLW: Skipping data update', { hasRef: !!seriesRef.current, dataLength: data?.length });
            return;
        }

        // Transform data: { time: '12/2/2026', ... } → { time: '2026-02-12', ... }
        console.log('CandlestickChartLW: Raw data sample:', data[0]);
        const transformed = data.map(d => ({
            time: convertToLightweightTime(d.time),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));

        // Remove duplicates and sort ascending by time
        const uniqueData = transformed.reduce((acc: any[], curr) => {
            if (!acc.find(item => item.time === curr.time)) {
                acc.push(curr);
            }
            return acc;
        }, []);

        const sortedData = uniqueData.sort((a, b) => {
            const timeA = new Date(a.time).getTime();
            const timeB = new Date(b.time).getTime();
            return timeA - timeB; // Ascending order
        });

        console.log('CandlestickChartLW: Transformed data sample:', sortedData[0]);
        console.log('CandlestickChartLW: All transformed times:', sortedData.map(d => d.time));
        console.log('CandlestickChartLW: Setting data, count:', sortedData.length);

        // Set candlestick data
        seriesRef.current.setData(sortedData);

        // Set volume data (with colors based on price direction)
        if (volumeSeriesRef.current) {
            const volumeData = sortedData.map((d, i) => ({
                time: d.time,
                value: data[i]?.volume || 0,
                color: d.close >= d.open ? '#26a69a80' : '#ef535080', // Green/Red with transparency
            }));
            volumeSeriesRef.current.setData(volumeData);
        }

        // Set MA20 data
        if (ma20SeriesRef.current && sortedData.length >= 20) {
            const ma20Data = calculateSMA(sortedData, 20);
            ma20SeriesRef.current.setData(ma20Data);
        }

        // Set MA50 data
        if (ma50SeriesRef.current && sortedData.length >= 50) {
            const ma50Data = calculateSMA(sortedData, 50);
            ma50SeriesRef.current.setData(ma50Data);
        }
    }, [data]);

    // Toggle fullscreen mode
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Handle chart click for drawing
    const handleChartClick = (event: any) => {
        console.log('🖱️ Chart clicked!');
        console.log('   - Selected tool:', selectedTool);
        console.log('   - chartRef.current:', chartRef.current);
        console.log('   - seriesRef.current:', seriesRef.current);
        console.log('   - Event:', event);

        if (!chartRef.current || selectedTool === 'cursor') {
            console.log('⏭️ Skipping - cursor mode or no chart');
            return;
        }

        const chart = chartRef.current;
        const rect = chartContainerRef.current?.getBoundingClientRect();
        if (!rect) {
            console.log('❌ No rect');
            return;
        }

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Convert pixel coordinates to price/time (lightweight-charts v5 API)
        try {
            const timeScale = chart.timeScale();
            const priceScale = chart.priceScale();

            // Get logical coordinates
            const timePoint = timeScale.coordinateToTime(x);
            const priceValue = priceScale.coordinateToPrice(y);

            console.log('📍 Click position:', { x, y, price: priceValue, time: timePoint, tool: selectedTool });

            if (!timePoint || priceValue === null) {
                console.warn('⚠️ Invalid coordinates');
                return;
            }

            const price = priceValue;
            const time = timePoint;

            if (selectedTool === 'trendline') {
            // Trendline requires 2 clicks
            if (!pendingTrendline) {
                // First click - save starting point
                setPendingTrendline({ time, price });
            } else {
                // Second click - draw line from point1 to point2
                const trendlineSeries = chart.addSeries(LineSeries, {
                    color: '#2962FF',
                    lineWidth: 2,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });

                // Set data for the line (2 points)
                trendlineSeries.setData([
                    { time: pendingTrendline.time, value: pendingTrendline.price },
                    { time: time, value: price }
                ]);

                setDrawings([...drawings, { type: 'trendline', series: trendlineSeries }]);
                setPendingTrendline(null);
                setSelectedTool('cursor');
            }
        } else if (selectedTool === 'hline') {
            // Create horizontal price line
            const priceLine = seriesRef.current?.createPriceLine({
                price: price,
                color: '#2962FF',
                lineWidth: 2,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: `${(price * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN')} ₫`,
            });

            setDrawings([...drawings, { type: 'hline', priceLine }]);
            setSelectedTool('cursor'); // Return to cursor after drawing
        } else if (selectedTool === 'text') {
            // Add text annotation (using marker)
            const textContent = prompt('Nhập nội dung chú thích:', 'Ghi chú');
            if (textContent) {
                const marker = {
                    time: time,
                    position: 'aboveBar',
                    color: '#2962FF',
                    shape: 'circle',
                    text: textContent,
                };

                const existingMarkers = seriesRef.current?.markers() || [];
                seriesRef.current?.setMarkers([...existingMarkers, marker]);

                setDrawings([...drawings, { type: 'text', marker }]);
                setSelectedTool('cursor');
            }
            }
        } catch (error) {
            console.error('❌ Error in handleChartClick:', error);
        }
    };

    // Update chart size when fullscreen changes
    useEffect(() => {
        if (chartRef.current && chartContainerRef.current) {
            const newHeight = isFullscreen ? window.innerHeight - 80 : 450;
            chartRef.current.applyOptions({
                width: chartContainerRef.current.clientWidth,
                height: newHeight
            });
        }
    }, [isFullscreen]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedTool('cursor');
            }
        };
        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, []);

    const containerStyle: React.CSSProperties = isFullscreen
        ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: '#ffffff',
            padding: '20px'
          }
        : {
            position: 'relative',
            width: '100%',
            height: '100%',
            background: '#ffffff'
          };

    const toolButtonStyle = (isActive: boolean, isDelete?: boolean) => ({
        background: isActive
            ? 'linear-gradient(135deg, #5B8FF9 0%, #4E7FE8 100%)'
            : 'rgba(35, 38, 50, 0.95)',
        border: isDelete
            ? '1.5px solid rgba(239, 83, 80, 0.6)'
            : isActive
                ? 'none'
                : '1px solid rgba(45, 50, 65, 0.8)',
        borderRadius: '14px',
        padding: '0',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '20px',
        transition: 'all 0.15s ease',
        boxShadow: isActive
            ? '0 4px 16px rgba(91, 143, 249, 0.35)'
            : '0 1px 3px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '52px',
        height: '52px',
        position: 'relative' as const,
    });

    return (
        <div style={containerStyle}>
            {/* Pending trendline indicator (top center) */}
            {pendingTrendline && (
                <div style={{
                    position: 'absolute',
                    top: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    background: 'rgba(35, 38, 50, 0.95)',
                    border: '1px solid rgba(91, 143, 249, 0.4)',
                    padding: '12px 18px',
                    borderRadius: '14px',
                    color: '#5B8FF9',
                    fontSize: '13px',
                    fontWeight: '600',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span style={{ fontSize: '8px' }}>●</span> Click điểm thứ 2...
                </div>
            )}

            {/* Nút phóng to chart */}
            <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 10,
            }}>
                <button
                    onClick={toggleFullscreen}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] hover:border-[#1E3A5F] transition-colors shadow-sm"
                    title={isFullscreen ? 'Thu nhỏ' : 'Phóng to'}
                >
                    {isFullscreen ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                        </svg>
                    )}
                </button>
            </div>

            <div
                ref={chartContainerRef}
                onClick={handleChartClick}
                style={{
                    width: '100%',
                    height: '100%',
                    cursor: selectedTool === 'cursor' ? 'default' : 'crosshair'
                }}
            />

            {loading && (
                <div className="flex items-center justify-center" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff' }}>
                    <div className="text-[#6B7280]">Đang tải...</div>
                </div>
            )}
        </div>
    );
};

// --- Mobile Navigation Component ---
const MobileNav = ({ currentView, onChangeView }: { currentView: string, onChangeView: (v: string) => void }) => {
    const navItems = [
        { id: 'home', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, label: '' },
        { id: 'terminal', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>, label: '' },
        { id: 'market', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>, label: '' },
    ];
    
    return (
        <div className="fixed bottom-4 left-4 right-4 bg-white border border-[#E5E7EB] z-[60] lg:hidden rounded-lg shadow-card-hover">
            <div className="flex justify-around items-center h-14">
                {navItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => onChangeView(item.id)}
                        className={`flex flex-col items-center justify-center w-full h-full rounded-md transition-colors duration-150 ${currentView === item.id ? 'text-[#1E3A5F] bg-[#F3F4F6]' : 'text-[#6B7280] hover:text-[#111827]'}`}
                    >
                        {item.icon}
                    </button>
                ))}
            </div>
        </div>
    )
}

// --- Trading Modal Component (TradingView-like) ---
const TradingModal = ({ isOpen, onClose, symbol, exchange, data, loading, onTimeframeChange }: {
    isOpen: boolean;
    onClose: () => void;
    symbol: string;
    exchange: string;
    data: any[];
    loading: boolean;
    onTimeframeChange: (symbol: string, exchange: string, timeframe: string) => void;
}) => {
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
                    console.log('🔍 MATCHING RESPONSE:', matchingRes.data);
                    console.log('🔍 ORDER BOOK RESPONSE:', orderBookRes.data);
                    if (matchingRes.data.success) {
                        console.log('✅ matchingHistory:', matchingRes.data.data);
                        setMatchingHistory(matchingRes.data.data);
                    }
                    if (orderBookRes.data.success) {
                        console.log('✅ orderBook:', orderBookRes.data.data);
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

    // API trả giá nghìn đồng → luôn * STOCK_PRICE_DISPLAY_SCALE khi hiển thị trong phần Giao dịch
    const rawClose = detail.closePrice != null ? Number(detail.closePrice) : null;
    const currentPrice = rawClose != null
      ? rawClose * STOCK_PRICE_DISPLAY_SCALE
      : (latestCandle?.close ?? 0);
    const priceChange = (Number(detail.change) || 0) * STOCK_PRICE_DISPLAY_SCALE;
    const priceChangePercent = detail.percentChange ?? 0;
    const companyName = detail.companyName || symbol;
    const isNegative = priceChange < 0;

    const tabs = ['Giao dịch', 'Hồ sơ', 'Cổ đông', 'Vốn & Cổ tức', 'Tài chính', 'Thống kê'];
    const timeframes = ['1m', '1d', '1w', '1M'];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/50 animate-fade-in p-4">
            <div className="w-full max-w-7xl h-[90vh] bg-white rounded-lg overflow-hidden flex flex-col shadow-2xl border border-[#E5E7EB]">
                {/* Header */}
                <div className="bg-[#F9FAFB] border-b border-[#E5E7EB] px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-[#111827]">
                                {symbol} <span className="text-[#6B7280]">({exchange})</span>
                            </h1>
                            <span className="text-sm text-[#6B7280]">{companyName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded text-[#6B7280] transition">
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
                                    <div className={`text-3xl font-bold font-mono ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                                        {currentPrice.toLocaleString('vi-VN')} ₫
                                    </div>
                                    <div className={`text-sm font-mono mt-1 ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                                        {isNegative ? '↓' : '↑'} {Math.abs(priceChange).toLocaleString('vi-VN')} ₫ ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                                    </div>
                                </div>
                                <div className="flex gap-6 text-sm">
                                    <div><span className="text-[#6B7280]">Sàn:</span> <span className="text-[#1E3A5F] font-mono ml-1">{((Number(detail.floor) || 0) * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN')} ₫</span></div>
                                    <div><span className="text-[#6B7280]">TC:</span> <span className="text-amber-600 font-mono ml-1">{((Number(detail.reference) || 0) * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN')} ₫</span></div>
                                    <div><span className="text-[#6B7280]">Trần:</span> <span className="text-purple-600 font-mono ml-1">{((Number(detail.ceiling) || 0) * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN')} ₫</span></div>
                                    <div><span className="text-[#6B7280]">Cao:</span> <span className="text-green-600 font-mono ml-1">{(latestCandle?.high ?? currentPrice).toLocaleString('vi-VN')} ₫</span></div>
                                    <div><span className="text-[#6B7280]">Thấp:</span> <span className="text-red-600 font-mono ml-1">{(latestCandle?.low ?? currentPrice).toLocaleString('vi-VN')} ₫</span></div>
                                </div>
                            </div>
                            <div className="flex gap-6 text-sm">
                                <div><span className="text-[#6B7280]">Tổng KL:</span> <span className="text-[#111827] font-mono ml-1">{(detail.totalTrading || 0).toLocaleString('vi-VN')}</span></div>
                                <div><span className="text-[#6B7280]">KLGD TB 10 phiên:</span> <span className="text-[#111827] font-mono ml-1">{(detail.avgVol10s || 0).toLocaleString('vi-VN', {maximumFractionDigits: 0})}</span></div>
                                <div><span className="text-[#6B7280]">GTGD:</span> <span className="text-[#111827] font-mono ml-1">{(detail.totalValue || 0).toLocaleString('vi-VN')} tỷ</span></div>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-6 mt-4 border-b border-[#E5E7EB] overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                className={`pb-2 px-1 text-sm whitespace-nowrap transition ${activeTab === tab ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]' : 'text-[#6B7280] hover:text-[#111827]'}`}
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
                    <div className={`flex-1 bg-[#F8F9FA] p-4 min-h-0 flex flex-col ${activeTab === 'Giao dịch' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                        {/* Tab: Giao dịch (Chart) - một thanh cuộn cho cả chart + timeframe bên dưới */}
                        {activeTab === 'Giao dịch' && (
                        <div className="flex flex-col min-h-[420px]">
                            {/* Chart Header - TradingView Style */}
                            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                                <div className="flex items-center gap-6">
                                    {/* Symbol with dot indicator */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-bold text-[#111827]">{symbol} · {timeframe} · {exchange}</span>
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    </div>

                                    {/* OHLC Inline - TradingView Style (đã scale khi load) */}
                                    <div className="flex items-center gap-2 text-sm font-mono">
                                        <span className="text-[#1E3A5F]">O</span>
                                        <span className="text-[#1E3A5F] font-semibold">{(latestCandle?.open ?? 0).toLocaleString('vi-VN')} ₫</span>
                                        <span className="text-[#1E3A5F] ml-2">H</span>
                                        <span className="text-[#1E3A5F] font-semibold">{(latestCandle?.high ?? 0).toLocaleString('vi-VN')} ₫</span>
                                        <span className="text-[#1E3A5F] ml-2">L</span>
                                        <span className="text-[#1E3A5F] font-semibold">{(latestCandle?.low ?? 0).toLocaleString('vi-VN')} ₫</span>
                                        <span className="text-[#1E3A5F] ml-2">C</span>
                                        <span className="text-[#1E3A5F] font-semibold">{(latestCandle?.close ?? 0).toLocaleString('vi-VN')} ₫</span>
                                        <span className={`ml-3 ${(latestCandle?.close ?? 0) >= (latestCandle?.open ?? 0) ? 'text-green-600' : 'text-red-600'}`}>
                                            {priceChange >= 0 ? '+' : ''}{priceChange.toLocaleString('vi-VN')} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                                        </span>
                                    </div>

                                    {/* Volume */}
                                    <div className="text-sm">
                                        <span className="text-[#6B7280]">Khối lượng</span>
                                        <span className="text-[#111827] font-mono font-semibold ml-2">
                                            {(latestCandle?.volume || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Chart Area - nền trắng, chiều cao nhỏ hơn */}
                            <div className="relative h-[300px] flex-shrink-0 bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
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
                            <div className="flex items-center justify-between pt-2 pb-1 border-t border-[#E5E7EB] flex-shrink-0">
                                <div className="flex gap-1">
                                    {['1m', '1h', '1d', '1w', '1M'].map(tf => (
                                        <button
                                            key={tf}
                                            onClick={() => {
                                                setTimeframe(tf);
                                                onTimeframeChange(symbol, exchange, tf);
                                            }}
                                            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                                timeframe === tf
                                                    ? 'bg-[#1E3A5F] text-white'
                                                    : 'bg-transparent text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]'
                                            }`}
                                        >
                                            {tf}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                                    <button className="hover:text-[#111827] transition">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                    </button>
                                    <span className="font-mono">{new Date().toLocaleTimeString('vi-VN')} UTC+7</span>
                                    <button className="hover:text-[#111827] transition">%</button>
                                    <button className="hover:text-[#111827] transition">log</button>
                                    <button className="hover:text-[#111827] transition">tự động</button>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* Tab: Hồ sơ (Company Info) */}
                        {activeTab === 'Hồ sơ' && (
                            <div className="h-full overflow-y-auto p-6 bg-white">
                                {loadingTabData ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-[#6B7280]">Đang tải dữ liệu...</div>
                                    </div>
                                ) : companyInfo?.data?.data ? (
                                    <div className="space-y-6">
                                        {/* Header - Company Name & Industry */}
                                        <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                            <h1 className="text-2xl font-bold text-[#111827] mb-2">
                                                {symbol} - {companyInfo.data.data.basicInformation?.symbol || 'N/A'}
                                            </h1>
                                            <p className="text-[#6B7280] text-sm">
                                                {companyInfo.data.data.basicInformation?.icbNameLevel2 || 'N/A'}
                                            </p>
                                        </div>

                                        {/* Basic Information Grid */}
                                        <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                            <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                Thông tin cơ bản
                                            </h2>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-[#6B7280]">Ngày thành lập:</span>
                                                    <span className="text-[#111827] font-medium">
                                                        {companyInfo.data.data.basicInformation?.foundingDate
                                                            ? new Date(companyInfo.data.data.basicInformation.foundingDate).toLocaleDateString('vi-VN')
                                                            : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[#6B7280]">Vốn điều lệ:</span>
                                                    <span className="text-[#111827] font-medium">
                                                        {companyInfo.data.data.basicInformation?.charterCapital
                                                            ? (companyInfo.data.data.basicInformation.charterCapital / 1000000000).toFixed(2) + ' tỷ VNĐ'
                                                            : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[#6B7280]">Ngày niêm yết:</span>
                                                    <span className="text-[#111827] font-medium">
                                                        {companyInfo.data.data.listedInformation?.listingDate
                                                            ? new Date(companyInfo.data.data.listedInformation.listingDate).toLocaleDateString('vi-VN')
                                                            : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[#6B7280]">Sàn giao dịch:</span>
                                                    <span className="text-[#111827] font-medium">
                                                        {companyInfo.data.data.listedInformation?.marketCode || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[#6B7280]">Vốn hóa thị trường:</span>
                                                    <span className="text-green-600 font-medium">
                                                        {companyInfo.data.data.listedInformation?.marketCap
                                                            ? (companyInfo.data.data.listedInformation.marketCap / 1000000000).toFixed(2) + ' tỷ VNĐ'
                                                            : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[#6B7280]">CP đang lưu hành:</span>
                                                    <span className="text-[#111827] font-medium">
                                                        {companyInfo.data.data.listedInformation?.sharesOutstanding
                                                            ? companyInfo.data.data.listedInformation.sharesOutstanding.toLocaleString('vi-VN')
                                                            : 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Company Profile */}
                                        {companyInfo.data.data.basicInformation?.companyProfile && (
                                            <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                    Giới thiệu công ty
                                                </h2>
                                                <p className="text-[#374151] text-sm leading-relaxed">
                                                    {companyInfo.data.data.basicInformation.companyProfile}
                                                </p>
                                            </div>
                                        )}

                                        {/* Leadership Table */}
                                        {companyInfo.data.data.leaderInformation && companyInfo.data.data.leaderInformation.length > 0 && (
                                            <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                    Ban lãnh đạo
                                                </h2>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-[#E5E7EB]">
                                                                <th className="text-left text-[#6B7280] font-medium pb-3">Họ tên</th>
                                                                <th className="text-left text-[#6B7280] font-medium pb-3">Chức vụ</th>
                                                                <th className="text-right text-[#6B7280] font-medium pb-3">Tỷ lệ sở hữu</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {companyInfo.data.data.leaderInformation.map((leader: any, idx: number) => (
                                                                <tr key={idx} className="border-b border-[#E5E7EB]">
                                                                    <td className="py-3 text-[#111827]">{leader.fullName}</td>
                                                                    <td className="py-3 text-[#374151]">{leader.positionName}</td>
                                                                    <td className="py-3 text-right text-[#1E3A5F] font-medium">
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
                                        <div className="text-[#6B7280]">Chưa có dữ liệu</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Cổ đông (Shareholders) */}
                        {activeTab === 'Cổ đông' && (
                            <div className="h-full overflow-y-auto p-6 bg-white">
                                {loadingTabData ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-[#6B7280]">Đang tải dữ liệu...</div>
                                    </div>
                                ) : shareholders?.data?.data ? (
                                    <div className="space-y-6">
                                        {/* Shareholders Table */}
                                        {shareholders.data.data.inforShareholder && shareholders.data.data.inforShareholder.length > 0 && (
                                            <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                    Danh sách cổ đông
                                                </h2>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-[#E5E7EB]">
                                                                <th className="text-left text-[#6B7280] font-medium pb-3">Tên cổ đông</th>
                                                                <th className="text-left text-[#6B7280] font-medium pb-3">Loại</th>
                                                                <th className="text-right text-[#6B7280] font-medium pb-3">Số lượng CP</th>
                                                                <th className="text-right text-[#6B7280] font-medium pb-3">Tỷ lệ (%)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {shareholders.data.data.inforShareholder.map((sh: any, idx: number) => (
                                                                <tr key={idx} className="border-b border-[#E5E7EB]/50">
                                                                    <td className="py-3 text-[#111827]">{sh.owner || 'N/A'}</td>
                                                                    <td className="py-3 text-[#374151]">
                                                                        {sh.ownerType === 0 ? 'Cá nhân' : sh.ownerType === 2 ? 'Tổ chức' : 'Khác'}
                                                                    </td>
                                                                    <td className="py-3 text-right text-[#111827] font-mono">
                                                                        {sh.quantity ? sh.quantity.toLocaleString('vi-VN') : '-'}
                                                                    </td>
                                                                    <td className="py-3 text-right text-[#1E3A5F] font-medium">
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
                                            <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                    Tỷ lệ sở hữu
                                                </h2>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                        <div className="text-[#6B7280] text-xs mb-1">Nhà nước</div>
                                                        <div className="text-[#111827] text-xl font-bold">
                                                            {shareholders.data.data.shareholderRate.corpGovRate?.toFixed(2) || '0.00'}%
                                                        </div>
                                                    </div>
                                                    <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                        <div className="text-[#6B7280] text-xs mb-1">Nước ngoài</div>
                                                        <div className="text-[#1E3A5F] text-xl font-bold">
                                                            {shareholders.data.data.shareholderRate.corpForeignRate?.toFixed(2) || '0.00'}%
                                                        </div>
                                                    </div>
                                                    <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                        <div className="text-[#6B7280] text-xs mb-1">Khác</div>
                                                        <div className="text-green-600 text-xl font-bold">
                                                            {shareholders.data.data.shareholderRate.otherRate?.toFixed(2) || '0.00'}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-[#6B7280]">Chưa có dữ liệu</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Vốn & Cổ tức */}
                        {activeTab === 'Vốn & Cổ tức' && (
                            <div className="h-full overflow-y-auto p-6 bg-white">
                                {loadingTabData ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-[#6B7280]">Đang tải dữ liệu...</div>
                                    </div>
                                ) : companyInfo?.data?.data ? (
                                    <div className="space-y-6">
                                        {/* Capital Information */}
                                        <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                            <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                Thông tin vốn
                                            </h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                <div className="flex justify-between bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                    <span className="text-[#6B7280]">Vốn điều lệ:</span>
                                                    <span className="text-[#111827] font-bold">
                                                        {companyInfo.data.data.basicInformation?.charterCapital
                                                            ? (companyInfo.data.data.basicInformation.charterCapital / 1000000000).toFixed(2) + ' tỷ VNĐ'
                                                            : '-'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                    <span className="text-[#6B7280]">CP niêm yết:</span>
                                                    <span className="text-[#111827] font-bold">
                                                        {companyInfo.data.data.listedInformation?.sharesListed
                                                            ? companyInfo.data.data.listedInformation.sharesListed.toLocaleString('vi-VN')
                                                            : '-'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                    <span className="text-[#6B7280]">CP lưu hành:</span>
                                                    <span className="text-[#111827] font-bold">
                                                        {companyInfo.data.data.listedInformation?.sharesOutstanding
                                                            ? companyInfo.data.data.listedInformation.sharesOutstanding.toLocaleString('vi-VN')
                                                            : '-'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                    <span className="text-[#6B7280]">Room NN còn lại:</span>
                                                    <span className="text-green-600 font-bold">
                                                        {companyInfo.data.data.listedInformation?.foreignCurrentRoom
                                                            ? companyInfo.data.data.listedInformation.foreignCurrentRoom.toLocaleString('vi-VN')
                                                            : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Financial Information from companyInfo */}
                                        {companyInfo.data.data.financeInformation && (
                                            <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                    Thông tin tài chính bổ sung
                                                </h2>
                                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                                    <div className="flex justify-between bg-[#F3F4F6] rounded p-3 border border-[#E5E7EB]">
                                                        <span className="text-[#6B7280]">EPS:</span>
                                                        <span className="text-[#111827] font-bold">
                                                            {companyInfo.data.data.financeInformation.eps
                                                                ? companyInfo.data.data.financeInformation.eps.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
                                                                : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between bg-[#F3F4F6] rounded p-3 border border-[#E5E7EB]">
                                                        <span className="text-[#6B7280]">BVPS:</span>
                                                        <span className="text-[#111827] font-bold">
                                                            {companyInfo.data.data.financeInformation.bvps
                                                                ? companyInfo.data.data.financeInformation.bvps.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
                                                                : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between bg-[#F3F4F6] rounded p-3 border border-[#E5E7EB]">
                                                        <span className="text-[#6B7280]">ROE:</span>
                                                        <span className="text-green-600 font-bold">
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
                                        <div className="text-[#6B7280]">Chưa có dữ liệu</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Tài chính */}
                        {activeTab === 'Tài chính' && (
                            <div className="h-full overflow-y-auto p-6 bg-white">
                                {loadingTabData ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-[#6B7280]">Đang tải dữ liệu...</div>
                                    </div>
                                ) : financialData?.data?.data?.length > 0 ? (
                                    <div className="space-y-6">
                                        {(() => {
                                            const info = financialData.data.data[0];
                                            return (
                                                <>
                                                    {/* Valuation Metrics */}
                                                    <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                        <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                            Định giá
                                                        </h2>
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">P/E</div>
                                                                <div className="text-[#111827] text-xl font-bold">
                                                                    {info.pe !== null && info.pe !== undefined ? info.pe.toFixed(2) : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">P/B</div>
                                                                <div className="text-[#111827] text-xl font-bold">
                                                                    {info.pb !== null && info.pb !== undefined ? info.pb.toFixed(2) : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">EPS</div>
                                                                <div className="text-[#111827] text-xl font-bold">
                                                                    {info.eps !== null && info.eps !== undefined ? info.eps.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">BVPS</div>
                                                                <div className="text-[#111827] text-xl font-bold">
                                                                    {info.bvps !== null && info.bvps !== undefined ? info.bvps.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Profitability */}
                                                    <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                        <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                            Hiệu suất hoạt động
                                                        </h2>
                                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                                            <div className="flex justify-between items-center bg-[#F3F4F6] rounded p-3 border border-[#E5E7EB]">
                                                                <span className="text-[#6B7280]">ROE:</span>
                                                                <span className="text-green-600 font-bold">
                                                                    {info.roe !== null && info.roe !== undefined ? (info.roe * 100).toFixed(2) + '%' : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center bg-[#F3F4F6] rounded p-3 border border-[#E5E7EB]">
                                                                <span className="text-[#6B7280]">ROA:</span>
                                                                <span className="text-green-600 font-bold">
                                                                    {info.roa !== null && info.roa !== undefined ? (info.roa * 100).toFixed(2) + '%' : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center bg-[#F3F4F6] rounded p-3 border border-[#E5E7EB]">
                                                                <span className="text-[#6B7280]">ROIC:</span>
                                                                <span className="text-green-600 font-bold">
                                                                    {info.roic !== null && info.roic !== undefined ? (info.roic * 100).toFixed(2) + '%' : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center bg-[#F3F4F6] rounded p-3 border border-[#E5E7EB]">
                                                                <span className="text-[#6B7280]">Biên LN gộp:</span>
                                                                <span className="text-[#1E3A5F] font-bold">
                                                                    {info.grossProfitMargin !== null && info.grossProfitMargin !== undefined ? (info.grossProfitMargin * 100).toFixed(2) + '%' : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center bg-[#F3F4F6] rounded p-3 border border-[#E5E7EB]">
                                                                <span className="text-[#6B7280]">Biên LN ròng:</span>
                                                                <span className="text-[#1E3A5F] font-bold">
                                                                    {info.netProfitMargin !== null && info.netProfitMargin !== undefined ? (info.netProfitMargin * 100).toFixed(2) + '%' : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center bg-[#F3F4F6] rounded p-3 border border-[#E5E7EB]">
                                                                <span className="text-[#6B7280]">Beta:</span>
                                                                <span className="text-[#111827] font-bold">
                                                                    {info.beta !== null && info.beta !== undefined ? info.beta.toFixed(2) : '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Liquidity */}
                                                    <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                        <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                            Khả năng thanh khoản
                                                        </h2>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">Current Ratio</div>
                                                                <div className="text-[#111827] text-xl font-bold">
                                                                    {info.currentRatio !== null && info.currentRatio !== undefined ? info.currentRatio.toFixed(2) : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">Quick Ratio</div>
                                                                <div className="text-[#111827] text-xl font-bold">
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
                                        <div className="text-[#6B7280]">Chưa có dữ liệu</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Thống kê */}
                        {activeTab === 'Thống kê' && (
                            <div className="h-full overflow-y-auto p-6 bg-white">
                                {loadingTabData ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-[#6B7280]">Đang tải dữ liệu...</div>
                                    </div>
                                ) : financialData?.data?.data?.length > 0 ? (
                                    <div className="space-y-6">
                                        {(() => {
                                            const info = financialData.data.data[0];
                                            return (
                                                <>
                                                    {/* Trading Statistics */}
                                                    <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                        <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                            Biến động giao dịch
                                                        </h2>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">Giá hiện tại</div>
                                                                <div className={`text-2xl font-bold ${
                                                                    info.stockPercentChange > 0 ? 'text-green-600' :
                                                                    info.stockPercentChange < 0 ? 'text-red-600' : 'text-amber-600'
                                                                }`}>
                                                                    {info.closePrice != null ? (info.closePrice * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN') + ' ₫' : '-'}
                                                                </div>
                                                                <div className={`text-xs mt-1 ${
                                                                    info.stockPercentChange > 0 ? 'text-green-600' :
                                                                    info.stockPercentChange < 0 ? 'text-red-600' : 'text-amber-600'
                                                                }`}>
                                                                    {info.change !== null && info.change !== undefined ?
                                                                        `${info.change > 0 ? '+' : ''}${(info.change * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN')} ₫` : '-'}
                                                                    {' '}
                                                                    ({info.stockPercentChange !== null && info.stockPercentChange !== undefined ?
                                                                        `${info.stockPercentChange > 0 ? '+' : ''}${info.stockPercentChange.toFixed(2)}%` : '-'})
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">Tham chiếu</div>
                                                                <div className="text-amber-600 text-xl font-bold">
                                                                    {info.reference != null ? (info.reference * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN') + ' ₫' : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">Trần</div>
                                                                <div className="text-purple-400 text-xl font-bold">
                                                                    {info.ceiling != null ? (info.ceiling * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN') + ' ₫' : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">Sàn</div>
                                                                <div className="text-cyan-400 text-xl font-bold">
                                                                    {info.floor != null ? (info.floor * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN') + ' ₫' : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">KL giao dịch</div>
                                                                <div className="text-[#111827] text-xl font-bold">
                                                                    {info.totalTrading ? info.totalTrading.toLocaleString('vi-VN') : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">GT giao dịch</div>
                                                                <div className="text-[#111827] text-xl font-bold">
                                                                    {info.totalValue
                                                                        ? (info.totalValue / 1000000000).toFixed(2) + ' tỷ'
                                                                        : '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Market Cap & Volume */}
                                                    <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                        <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                            Vốn hóa & Thanh khoản
                                                        </h2>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">Vốn hóa thị trường</div>
                                                                <div className="text-[#111827] text-2xl font-bold">
                                                                    {info.marketCap
                                                                        ? (info.marketCap / 1000000000).toFixed(2) + ' tỷ VNĐ'
                                                                        : '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                                <div className="text-[#6B7280] text-xs mb-1">KL TB 10 phiên</div>
                                                                <div className="text-[#111827] text-2xl font-bold">
                                                                    {info.avgVol10s ? info.avgVol10s.toLocaleString('vi-VN') : '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Foreign Trading */}
                                                    <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                        <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
                                                            Giao dịch nước ngoài
                                                        </h2>
                                                        <div className="flex items-center justify-between bg-[#F3F4F6] rounded p-4 border border-[#E5E7EB]">
                                                            <span className="text-[#6B7280]">Mua/Bán ròng:</span>
                                                            <div className="text-right">
                                                                <div className={`text-xl font-bold ${
                                                                    info.isForeignNetBuy ? 'text-green-600' : 'text-red-600'
                                                                }`}>
                                                                    {info.foreignNetBSVal
                                                                        ? `${info.isForeignNetBuy ? '+' : ''}${(info.foreignNetBSVal / 1000000).toFixed(2)} triệu VNĐ`
                                                                        : '-'}
                                                                </div>
                                                                <div className="text-xs text-[#6B7280] mt-1">
                                                                    {info.isForeignNetBuy ? 'Mua ròng' : 'Bán ròng'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Indices */}
                                                    {info.indexs && info.indexs.length > 0 && (
                                                        <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[#E5E7EB]">
                                                            <h2 className="text-lg font-semibold text-[#111827] mb-4 pb-2 border-b border-[#E5E7EB]">
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
                                        <div className="text-[#6B7280]">Chưa có dữ liệu</div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* Right Sidebar - Stats & Metrics */}
                    <div className="w-80 bg-white border-l border-[#E5E7EB] flex flex-col min-h-0">
                        {/* Tabs */}
                        <div className="border-b border-[#E5E7EB] p-3 flex-shrink-0">
                            <div className="flex gap-4 text-sm">
                                <button
                                    onClick={() => setSidebarTab('Khớp lệnh')}
                                    className={`pb-1 font-medium transition ${
                                        sidebarTab === 'Khớp lệnh'
                                            ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]'
                                            : 'text-[#6B7280] hover:text-[#111827]'
                                    }`}
                                >
                                    Khớp lệnh
                                </button>
                                <button
                                    onClick={() => setSidebarTab('Bước giá')}
                                    className={`pb-1 font-medium transition ${
                                        sidebarTab === 'Bước giá'
                                            ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]'
                                            : 'text-[#6B7280] hover:text-[#111827]'
                                    }`}
                                >
                                    Bước giá
                                </button>
                            </div>
                        </div>

                        {/* Scrollable area: stats + table + ĐỊNH GIÁ + HIỆU SUẤT */}
                        <div className="flex-1 overflow-y-auto min-h-0">
                        {/* Trading Stats */}
                        {matchingHistory?.data && (
                            <div className="p-3 pb-4 border-b border-[#E5E7EB]">
                                <div className="flex justify-between text-xs text-[#6B7280] gap-4">
                                    <span className="py-1">KL: <span className="text-[#111827] font-mono">{(matchingHistory.data.totalTradingVolume || 0).toLocaleString('vi-VN', {maximumFractionDigits: 0})}</span></span>
                                    <span className="py-1">M: <span className="text-green-600 font-mono">{(matchingHistory.data.buyUpVolume || 0).toLocaleString('vi-VN', {maximumFractionDigits: 0})}</span></span>
                                    <span className="py-1">B: <span className="text-red-600 font-mono">{(matchingHistory.data.sellDownVolume || 0).toLocaleString('vi-VN', {maximumFractionDigits: 0})}</span></span>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Khớp lệnh */}
                        {sidebarTab === 'Khớp lệnh' && matchingHistory?.data?.arrayList && (
                            <div className="overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-[#F9FAFB]">
                                        <tr className="border-b border-[#E5E7EB]">
                                            <th className="text-left text-[#6B7280] font-medium py-2 px-3">Giá</th>
                                            <th className="text-right text-[#6B7280] font-medium py-2 px-3">KL</th>
                                            <th className="text-right text-[#6B7280] font-medium py-2 px-3">Thời gian</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matchingHistory.data.arrayList.map((trade: any, idx: number) => (
                                            <tr key={idx} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
                                                <td className={`py-3 px-3 font-mono ${
                                                    trade.style === 'B' ? 'text-green-600' :
                                                    trade.style === 'S' ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                    {(trade.matchPrice * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN')} ₫
                                                </td>
                                                <td className="py-3 px-3 text-right text-[#111827] font-mono">
                                                    {(trade.tradingVolume / 100).toFixed(1)}
                                                </td>
                                                <td className="py-3 px-3 text-right text-[#6B7280]">
                                                    {trade.time.substring(0, 5)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Tab Content: Bước giá */}
                        {sidebarTab === 'Bước giá' && (
                            <div className="overflow-y-auto">
                                {orderBook?.priceStatistic && orderBook.data.data.priceStatistic.length > 0 ? (
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-[#F9FAFB]">
                                            <tr className="border-b border-[#E5E7EB]">
                                                <th className="text-left text-[#6B7280] font-medium py-2 px-3">Giá</th>
                                                <th className="text-right text-[#6B7280] font-medium py-2 px-3">Mua</th>
                                                <th className="text-right text-[#6B7280] font-medium py-2 px-3">Bán</th>
                                                <th className="text-right text-[#6B7280] font-medium py-2 px-3">Tổng</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orderBook.data.data.priceStatistic.map((step: any, idx: number) => (
                                                <tr key={idx} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
                                                    <td className="py-3 px-3 font-mono text-amber-600">
                                                        {(step.priceStep * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN')} ₫
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono text-green-600">
                                                        {step.buyUpVolume ? (step.buyUpVolume / 100).toFixed(1) : '-'}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono text-red-600">
                                                        {step.sellDownVolume ? (step.sellDownVolume / 100).toFixed(1) : '-'}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono text-[#111827]">
                                                        {(step.stepVolume / 100).toFixed(1)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="text-center text-[#6B7280] py-8">
                                        {loadingSidebar ? 'Đang tải...' : 'Chưa có dữ liệu bước giá'}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Valuation Metrics - Always show below */}
                        <div className="p-4 pt-5 border-t border-[#E5E7EB]">
                            <h3 className="text-xs font-bold text-[#6B7280] uppercase mb-4">ĐỊNH GIÁ</h3>
                            <div className="space-y-4 text-xs">
                                <div className="flex justify-between py-1">
                                    <span className="text-[#6B7280]">P/E:</span>
                                    <span className="text-[#111827] font-mono text-right">{detail.pe ? detail.pe.toFixed(2) : '-'}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-[#6B7280]">P/B:</span>
                                    <span className="text-[#111827] font-mono text-right">{detail.pb ? detail.pb.toFixed(2) : '-'}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-[#6B7280]">EPS:</span>
                                    <span className="text-[#111827] font-mono text-right">{detail.eps ? detail.eps.toLocaleString('vi-VN', {maximumFractionDigits: 0}) : '-'}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-[#6B7280]">ROE:</span>
                                    <span className="text-green-600 font-mono text-right">{detail.roe ? detail.roe.toFixed(2) + '%' : '-'}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-[#6B7280]">ROA:</span>
                                    <span className="text-green-600 font-mono text-right">{detail.roa ? detail.roa.toFixed(2) + '%' : '-'}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-[#6B7280]">Beta:</span>
                                    <span className="text-[#111827] font-mono text-right">{detail.beta ? detail.beta.toFixed(2) : '-'}</span>
                                </div>
                                <div className="flex justify-between border-t border-[#E5E7EB] pt-4 mt-3 py-1">
                                    <span className="text-[#6B7280]">Vốn hóa:</span>
                                    <span className="text-[#111827] font-mono text-right">{detail.marketCap ? detail.marketCap.toLocaleString('vi-VN') + ' tỷ' : '-'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Performance */}
                        <div className="p-4 pt-5 border-t border-[#E5E7EB]">
                            <h3 className="text-xs font-bold text-[#6B7280] uppercase mb-4">HIỆU SUẤT</h3>
                            <div className="space-y-4 text-xs">
                                <div className="flex justify-between py-1">
                                    <span className="text-[#6B7280]">1 tuần:</span>
                                    <span className={`font-mono text-right ${(detail.raw?.stockPercentChange1w || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {detail.raw?.stockPercentChange1w ? detail.raw.stockPercentChange1w.toFixed(2) + '%' : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-[#6B7280]">1 tháng:</span>
                                    <span className={`font-mono text-right ${(detail.raw?.stockPercentChange1m || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {detail.raw?.stockPercentChange1m ? detail.raw.stockPercentChange1m.toFixed(2) + '%' : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-[#6B7280]">3 tháng:</span>
                                    <span className={`font-mono text-right ${(detail.raw?.stockPercentChange3m || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

// --- Chart Modal Component ---
const ChartModal = ({ isOpen, onClose, symbol, exchange, data, loading, stocks, onSymbolChange }: {
    isOpen: boolean;
    onClose: () => void;
    symbol: string;
    exchange: string;
    data: any[];
    loading: boolean;
    stocks: any[];
    onSymbolChange: (symbol: string, exchange: string) => void;
}) => {
    if (!isOpen) return null;

    const latestPrice = data.length > 0 ? data[data.length - 1]?.close : 0;
    const previousPrice = data.length > 1 ? data[data.length - 2]?.close : 0;
    const priceChange = latestPrice - previousPrice;
    const priceChangePercent = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-[#E5E7EB] space-y-4">
                    {/* Top row - Icon, Title, Close button */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB]">
                                <svg className="w-6 h-6 text-[#1E3A5F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                                </svg>
                            </div>

                            {/* Symbol Dropdown */}
                            <div className="relative">
                                <select
                                    value={`${symbol}-${exchange}`}
                                    onChange={(e) => {
                                        const [newSymbol, newExchange] = e.target.value.split('-');
                                        onSymbolChange(newSymbol, newExchange);
                                    }}
                                    className="appearance-none bg-white border border-[#E5E7EB] rounded-lg pl-4 pr-10 py-2.5 text-lg font-bold text-[#111827] hover:border-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 cursor-pointer transition-all"
                                >
                                    {stocks.map((stock) => (
                                        <option key={`${stock.symbol}-${stock.exchange}`} value={`${stock.symbol}-${stock.exchange}`}>
                                            {stock.symbol} ({stock.exchange})
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#6B7280]">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            <p className="text-sm text-[#6B7280]">30 NGÀY GẦN NHẤT</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Bottom row - Price info */}
                    {!loading && data.length > 0 && (
                        <div className="flex items-center gap-6 pl-16">
                            <div>
                                <p className="text-xs text-[#6B7280] mb-1">Giá hiện tại</p>
                                <p className="text-3xl font-bold text-[#111827] font-mono">{latestPrice.toLocaleString('vi-VN')} ₫</p>
                            </div>
                            <div>
                                <p className="text-xs text-[#6B7280] mb-1">Thay đổi</p>
                                <p className={`text-xl font-semibold ${priceChange >= 0 ? 'text-[#0B6E4B]' : 'text-[#A63D3D]'}`}>
                                    {priceChange >= 0 ? '+' : ''}{priceChange.toLocaleString('vi-VN')} ₫ ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chart Body */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-96">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-[#E5E7EB] border-t-[#1E3A5F] rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-[#6B7280]">Đang tải dữ liệu...</p>
                            </div>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex items-center justify-center h-96">
                            <p className="text-[#6B7280]">Không có dữ liệu</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Price Chart */}
                            <div>
                                <h3 className="text-sm font-semibold text-[#6B7280] mb-4 uppercase">Biểu Đồ Giá</h3>
                                <ResponsiveContainer width="100%" height={350}>
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            tickLine={{ stroke: '#E5E7EB' }}
                                        />
                                        <YAxis
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            tickLine={{ stroke: '#E5E7EB' }}
                                            domain={['auto', 'auto']}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '6px',
                                                fontSize: '12px'
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="close"
                                            stroke="#1E3A5F"
                                            strokeWidth={2}
                                            dot={false}
                                            name="Giá đóng cửa"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="high"
                                            stroke="#0B6E4B"
                                            strokeWidth={1.5}
                                            dot={false}
                                            name="Giá cao nhất"
                                            strokeDasharray="5 5"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="low"
                                            stroke="#A63D3D"
                                            strokeWidth={1.5}
                                            dot={false}
                                            name="Giá thấp nhất"
                                            strokeDasharray="5 5"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Volume Chart */}
                            <div>
                                <h3 className="text-sm font-semibold text-[#6B7280] mb-4 uppercase">Khối Lượng Giao Dịch</h3>
                                <ResponsiveContainer width="100%" height={150}>
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            tickLine={{ stroke: '#E5E7EB' }}
                                        />
                                        <YAxis
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            tickLine={{ stroke: '#E5E7EB' }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '6px',
                                                fontSize: '12px'
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="volume"
                                            stroke="#6B7280"
                                            strokeWidth={2}
                                            dot={false}
                                            name="Khối lượng"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#E5E7EB]">
                                <div className="bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
                                    <p className="text-xs text-[#6B7280] mb-1">Mở cửa</p>
                                    <p className="text-lg font-bold text-[#111827] font-mono">{data[data.length - 1]?.open.toLocaleString('vi-VN')} ₫</p>
                                </div>
                                <div className="bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
                                    <p className="text-xs text-[#6B7280] mb-1">Cao nhất</p>
                                    <p className="text-lg font-bold text-[#0B6E4B] font-mono">{data[data.length - 1]?.high.toLocaleString('vi-VN')} ₫</p>
                                </div>
                                <div className="bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
                                    <p className="text-xs text-[#6B7280] mb-1">Thấp nhất</p>
                                    <p className="text-lg font-bold text-[#A63D3D] font-mono">{data[data.length - 1]?.low.toLocaleString('vi-VN')} ₫</p>
                                </div>
                                <div className="bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
                                    <p className="text-xs text-[#6B7280] mb-1">Khối lượng</p>
                                    <p className="text-lg font-bold text-[#111827] font-mono">{data[data.length - 1]?.volume.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} CP</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-[#E5E7EB] bg-[#F9FAFB]">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-semibold text-[#374151] hover:bg-white transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('auth_token'));

  useEffect(() => {
    const handler = () => setIsAuthenticated(false);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  if (!isAuthenticated) {
    return <AuthView onSuccess={() => setIsAuthenticated(true)} />;
  }

  const handleLogout = async () => {
    await authApi.logout();
    setIsAuthenticated(false);
  };

  return (
    <AppErrorBoundary onReset={handleLogout}>
      <MainApp onLogout={handleLogout} />
    </AppErrorBoundary>
  );
}

// Modal cấu hình danh mục — khai báo ngoài MainApp để tránh re-mount mỗi khi parent re-render (gây giựt sau F5).
function PortfolioSetupModalStandalone({
  isOpen,
  onClose,
  initialBalance,
  initialRisk,
  initialExpectedReturn,
  onSave,
  portfolioId,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialBalance: number;
  initialRisk: number;
  initialExpectedReturn?: number;
  onSave: (balance: number, riskPercent: number, expectedReturnPercent: number) => void | Promise<void>;
  portfolioId?: string | null;
  onDelete?: () => void | Promise<void>;
}) {
  const [localBalance, setLocalBalance] = useState(initialBalance.toString());
  const [localRisk, setLocalRisk] = useState(initialRisk);
  const [localExpectedReturn, setLocalExpectedReturn] = useState(initialExpectedReturn ?? 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cập nhật state local khi props đổi (vd. mở lại modal với giá trị mới)
  useEffect(() => {
    if (isOpen) {
      setLocalBalance(initialBalance.toString());
      setLocalRisk(initialRisk);
      setLocalExpectedReturn(initialExpectedReturn ?? 0);
    }
  }, [isOpen, initialBalance, initialRisk, initialExpectedReturn]);

  const calcMaxLoss = () => {
    const bal = parseFloat(localBalance) || 0;
    return (bal * localRisk) / 100;
  };

  const handleSave = async () => {
    const bal = parseFloat(localBalance);
    if (isNaN(bal) || bal < 0) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(bal, localRisk, localExpectedReturn));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !portfolioId) return;
    if (!confirm('Bạn có chắc muốn xóa danh mục này? Dữ liệu liên quan có thể bị ảnh hưởng.')) return;
    setDeleting(true);
    try {
      await Promise.resolve(onDelete());
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const riskLevel = localRisk <= 2 ? 'Bảo toàn (Safe)' : localRisk <= 5 ? 'Tiêu chuẩn (Standard)' : 'Mạo hiểm (High Risk)';
  const riskColor = localRisk <= 2 ? 'text-[#0B6E4B]' : localRisk <= 5 ? 'text-[#1E3A5F]' : 'text-[#A63D3D]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111827]/50 animate-fade-in">
      <div className="bg-white border border-[#E5E7EB] rounded-lg w-full max-w-lg shadow-card-hover overflow-hidden relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors z-10"
          aria-label="Đóng"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="p-8 space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-[#F3F4F6] rounded-lg flex items-center justify-center mx-auto mb-3 text-[#1E3A5F] border border-[#E5E7EB]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-[#111827]">Cấu hình danh mục</h2>
            <p className="text-[#6B7280] text-sm mt-0.5">Thiết lập vốn và giới hạn rủi ro.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider flex justify-between">
                Vốn ban đầu (VND)
                <span className="font-normal">Bước 1</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={localBalance}
                  onChange={(e) => setLocalBalance(e.target.value)}
                  className="input-fintech w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg py-3 pl-4 pr-12 text-[#111827] font-mono text-lg font-semibold placeholder-[#9CA3AF]"
                  placeholder="10000"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] text-base font-mono">VND</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Giới hạn rủi ro (%)
                </label>
                <span className={`text-sm font-semibold ${riskColor}`}>{riskLevel}</span>
              </div>
              <div className="bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
                <div className="flex justify-between mb-2 text-[10px] text-[#6B7280] font-semibold">
                  <span>An toàn (1%)</span>
                  <span>Mạo hiểm (10%)</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={localRisk}
                  onChange={(e) => setLocalRisk(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#E5E7EB] rounded-full appearance-none cursor-pointer accent-[#1E3A5F]"
                />
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-xl font-semibold text-[#111827] font-mono">{localRisk}%</span>
                  <div className="text-right">
                    <p className="text-[9px] text-[#6B7280] uppercase font-semibold">Mất tối đa</p>
                    <p className="text-sm font-semibold text-[#111827] font-mono">{calcMaxLoss().toLocaleString('vi-VN')} ₫</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">
                Lãi kỳ vọng (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="-100"
                  max="100"
                  step="0.5"
                  value={localExpectedReturn}
                  onChange={(e) => setLocalExpectedReturn(parseFloat(e.target.value) || 0)}
                  className="input-fintech w-24 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg py-2.5 pl-3 pr-8 text-[#111827] font-mono font-semibold placeholder-[#9CA3AF]"
                />
                <span className="text-[#6B7280] text-sm">% / kỳ</span>
                {parseFloat(localBalance) > 0 && (
                  <span className="text-[#6B7280] text-xs ml-auto">
                    ≈ {(parseFloat(localBalance) * localExpectedReturn / 100).toLocaleString('vi-VN')} ₫
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-lg bg-[#1E3A5F] hover:bg-[#2C4A6F] disabled:opacity-60 text-white font-semibold text-sm transition-colors duration-150"
            >
              {saving ? 'Đang lưu...' : 'Xác nhận cấu hình'}
            </button>
            {portfolioId && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="w-full py-2.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#FEF2F2] text-[#A63D3D] font-medium text-sm transition-colors disabled:opacity-60"
              >
                {deleting ? 'Đang xóa...' : 'Xóa danh mục'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MainApp({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const [currentView, setCurrentView] = useState('terminal');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Core State
  const [portfolio, setPortfolio] = useState<any>(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [maxRiskPercent, setMaxRiskPercent] = useState(5);
  const [expectedReturnPercent, setExpectedReturnPercent] = useState(0);
  const [signals] = useState<any[]>([]); // BE đã bỏ /signals – giữ state rỗng tránh ReferenceError
  const [marketData, setMarketData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stock List State
  const [stocks, setStocks] = useState<any[]>([]);
  const [stocksTotal, setStocksTotal] = useState(0);
  const [stocksPage, setStocksPage] = useState(1);
  const [stocksSearch, setStocksSearch] = useState('');
  const [stocksExchange, setStocksExchange] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('ACB');
  const [selectedExchange, setSelectedExchange] = useState('HOSE');
  const [previousPrices, setPreviousPrices] = useState<{[key: string]: number}>({});
  const [priceChanges, setPriceChanges] = useState<{[key: string]: 'up' | 'down' | null}>({});

  // UI State
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [insightTrader, setInsightTrader] = useState<TraderProfile | null>(null);
  const [insightContent, setInsightContent] = useState<AiAnalysis | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Chart Modal State
  const [showChartModal, setShowChartModal] = useState(false);
  const [chartModalSymbol, setChartModalSymbol] = useState('');
  const [chartModalExchange, setChartModalExchange] = useState('');
  const [chartModalData, setChartModalData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  // Derived Calculations (chức năng vị thế đã bỏ – risk dùng = 0)
  const maxRiskAmount = totalBalance > 0 ? (totalBalance * maxRiskPercent) / 100 : 0; 
  const currentRiskUsed = 0;
  const riskUsagePercent = 0;

  const availableRisk = maxRiskAmount;
  const riskData = [
    { name: 'Đã dùng', value: currentRiskUsed, color: '#1E3A5F' },
    { name: 'Khả dụng', value: availableRisk, color: '#E5E7EB' },
  ];
  const chartRiskPercentage = maxRiskAmount > 0 ? Math.round((currentRiskUsed / maxRiskAmount) * 100) : 0;

  // Load data from API
  useEffect(() => {
    loadData();
    connectWebSocket();

    return () => {
      wsService.disconnect();
    };
  }, []);

  // Load stocks when on home (tổng quan) so "Tất cả mã chứng khoán" has data
  useEffect(() => {
    if (currentView === 'home') {
      loadStocks();
    }
  }, [currentView]);

  // Reload stocks when filters change + Auto refresh every 5s for real-time updates
  useEffect(() => {
    loadStocks();
    const interval = setInterval(() => {
      if (!loading) {
        loadStocks();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [stocksPage, stocksSearch, stocksExchange]);

  async function loadData() {
    try {
      setLoading(true);

      // Only load auth-required data if token exists
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Load portfolio
        const portfolioRes = await portfolioApi.getAll();
        if (portfolioRes.data.success && portfolioRes.data.data.length > 0) {
          const p = portfolioRes.data.data[0];
          setPortfolio(p);
          setTotalBalance(parseFloat(p.total_balance));
          setMaxRiskPercent(parseFloat(p.max_risk_percent));
          setExpectedReturnPercent(parseFloat(p.expected_return_percent) ?? 0);
        } else {
          // No portfolio - show setup modal
          setShowSetupModal(true);
        }

      }

      // Load market data for VNINDEX
      await loadMarketData();

      // Load all stocks
      await loadStocks();

    } catch (error) {
      console.error('Load data error:', error);
      // Auth error is handled by axios interceptor (will reload page)
    } finally {
      setLoading(false);
    }
  }

  async function loadMarketData() {
    try {
      // Note: VNINDEX not available in DB, using ACB stock as market data example
      const res = await marketApi.getOHLCV('ACB', { exchange: 'HOSE', timeframe: '1d', limit: 30 });

      if (res.data.success && Array.isArray(res.data.data)) {
        const data = res.data.data.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleDateString(),
          open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
          high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
          low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
          close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
          volume: parseFloat(item.volume)
        }));
        setMarketData(data);
      } else {
        console.warn('No market data available');
        setMarketData([]);
      }
    } catch (error) {
      console.error('Load market data error:', error);
      setMarketData([]); // Set empty array on error
    }
  }


  async function loadStocks() {
    try {
      const res = await marketApi.getStocks(
        {
          page: stocksPage,
          limit: 50,
          search: stocksSearch || undefined,
          exchange: stocksExchange || undefined,
          sort: 'symbol',
          order: 'ASC'
        },
        { timeout: 60000 }
      );

      if (res.data.success) {
        const newStocks = res.data.data;

        // Detect price changes for flash effect
        const changes: {[key: string]: 'up' | 'down' | null} = {};
        newStocks.forEach((stock: any) => {
          const key = `${stock.symbol}-${stock.exchange}`;
          const newPrice = parseFloat(stock.price);
          const oldPrice = previousPrices[key];

          if (oldPrice !== undefined && oldPrice !== newPrice) {
            changes[key] = newPrice > oldPrice ? 'up' : 'down';
          }
        });

        // Update states
        setStocks(newStocks);
        setStocksTotal(res.data.pagination.total);
        setPriceChanges(changes);

        // Update previous prices
        const prices: {[key: string]: number} = {};
        newStocks.forEach((stock: any) => {
          const key = `${stock.symbol}-${stock.exchange}`;
          prices[key] = parseFloat(stock.price);
        });
        setPreviousPrices(prices);

        // Clear flash after 1 second
        setTimeout(() => {
          setPriceChanges({});
        }, 1000);
      }
    } catch (error) {
      console.error('Load stocks error:', error);
    }
  }

  async function handleStockClick(symbol: string, exchange: string) {
    setChartModalSymbol(symbol);
    setChartModalExchange(exchange);
    setShowChartModal(true);
    loadChartData(symbol, exchange, '1d');
  }

  async function loadChartData(symbol: string, exchange: string, timeframe: string) {
    setLoadingChart(true);
    setChartModalData([]);

    // Determine limit based on timeframe
    let limit = 90;
    if (timeframe === '1m') limit = 500;
    else if (timeframe === '1d') limit = 90;
    else if (timeframe === '1w') limit = 52;
    else if (timeframe === '1M') limit = 24;

    try {
      console.log('Loading chart:', { symbol, exchange, timeframe, limit });
      const res = await marketApi.getOHLCV(symbol, { exchange, timeframe, limit });
      if (res.data.success && Array.isArray(res.data.data)) {
        const data = res.data.data.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleDateString('vi-VN'),
          open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
          high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
          low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
          close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
          volume: parseFloat(item.volume)
        }));
        setChartModalData(data);
      }
    } catch (error) {
      console.error('Load chart error:', error);
      console.error('Error details:', (error as any)?.response?.data);
    } finally {
      setLoadingChart(false);
    }
  }

  async function handleSymbolChangeInModal(symbol: string, exchange: string) {
    setChartModalSymbol(symbol);
    setChartModalExchange(exchange);
    setLoadingChart(true);
    setChartModalData([]);

    // Load chart data for new symbol
    try {
      const res = await marketApi.getOHLCV(symbol, { exchange, timeframe: '1d', limit: 90 });
      if (res.data.success && Array.isArray(res.data.data)) {
        const data = res.data.data.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleDateString('vi-VN'),
          open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
          high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
          low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
          close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
          volume: parseFloat(item.volume)
        }));
        setChartModalData(data);
      }
    } catch (error) {
      console.error('Load chart error:', error);
    } finally {
      setLoadingChart(false);
    }
  }
  function connectWebSocket() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('No auth token, skipping WebSocket');
      return;
    }

    wsService.connect();

    if (portfolio) {
      wsService.subscribeToPortfolio(portfolio.id);
    }

    wsService.onRiskUpdate((data) => {
      console.log('Risk update:', data);
      if (portfolio) {
        loadData();
      }
    });

    wsService.onNotification((data) => {
      console.log('Notification:', data);
      alert(`${data.title}\n${data.message}`);
    });
  }

  const handleAiCheck = async (trader: TraderProfile) => {
    setAnalyzingId(trader.id);
    const marketContext = "Bitcoin (BTC) is trading around 50k support. Market sentiment is cautious. Expect volatility.";
    const result = await analyzeTrader(trader, marketContext);
    if (result) {
        setInsightTrader(trader);
        setInsightContent(result);
    } else {
        alert("Không thể phân tích. Vui lòng thử lại.");
    }
    setAnalyzingId(null);
  };

  const closeInsightModal = () => {
    setInsightContent(null);
    setInsightTrader(null);
  };

  return (
    <div className="flex min-h-screen overflow-hidden font-sans text-[#111827] bg-[#F8F9FA] selection:bg-[#1E3A5F]/10">

      <PortfolioSetupModalStandalone
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        initialBalance={totalBalance}
        initialRisk={maxRiskPercent}
        initialExpectedReturn={expectedReturnPercent}
        portfolioId={portfolio?.id}
        onSave={async (balance, riskPercent, expectedReturn) => {
          try {
            if (portfolio) {
              const res = await portfolioApi.update(portfolio.id, {
                name: portfolio.name,
                totalBalance: balance,
                maxRiskPercent: riskPercent,
                expectedReturnPercent: expectedReturn,
              });
              if (res.data?.data) {
                setPortfolio(res.data.data);
                setTotalBalance(parseFloat(res.data.data.total_balance));
                setMaxRiskPercent(parseFloat(res.data.data.max_risk_percent));
                setExpectedReturnPercent(parseFloat(res.data.data.expected_return_percent) ?? 0);
              }
            } else {
              const res = await portfolioApi.create({
                name: 'Default Portfolio',
                totalBalance: balance,
                maxRiskPercent: riskPercent,
                expectedReturnPercent: expectedReturn,
              });
              if (res.data?.data) {
                setPortfolio(res.data.data);
                setTotalBalance(parseFloat(res.data.data.total_balance));
                setMaxRiskPercent(parseFloat(res.data.data.max_risk_percent));
                setExpectedReturnPercent(parseFloat(res.data.data.expected_return_percent) ?? 0);
              }
            }
            setShowSetupModal(false);
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Lưu thất bại. Vui lòng thử lại.';
            alert(msg);
          }
        }}
        onDelete={portfolio ? async () => {
          try {
            await portfolioApi.delete(portfolio.id);
            setPortfolio(null);
            setTotalBalance(0);
            setMaxRiskPercent(5);
            setExpectedReturnPercent(0);
            setShowSetupModal(false);
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Xóa thất bại. Vui lòng thử lại.';
            alert(msg);
          }
        } : undefined}
      />

      <TradingModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        symbol={chartModalSymbol}
        exchange={chartModalExchange}
        data={chartModalData}
        loading={loadingChart}
        onTimeframeChange={loadChartData}
      />

      <ChartModal
        isOpen={false}
        onClose={() => setShowChartModal(false)}
        symbol={chartModalSymbol}
        exchange={chartModalExchange}
        data={chartModalData}
        loading={loadingChart}
        stocks={stocks}
        onSymbolChange={handleSymbolChangeInModal}
      />

      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onLogout={onLogout}
      />
      
      <MobileNav currentView={currentView} onChangeView={setCurrentView} />

      <main 
        className={`flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto h-screen scroll-smooth relative pb-24 lg:pb-8 transition-all duration-200 ${
            isSidebarOpen ? 'lg:ml-56' : 'lg:ml-[72px]'
        }`}
      >
        
        {currentView === 'home' && (
          <div className="space-y-8 max-w-[1600px] mx-auto animate-fade-in">
            <HomeView 
              totalBalance={totalBalance}
              activePositionsCount={0}
              riskUsed={currentRiskUsed}
              maxRisk={maxRiskAmount}
              onNavigate={setCurrentView}
              marketDataContent={
                /* Dữ liệu thị trường - Tất cả mã chứng khoán, cột trái */
                <>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                        <span className="w-1 h-4 bg-[#1E3A5F] rounded-full" />
                        Dữ Liệu Thị Trường
                      </h2>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">Tất cả mã chứng khoán • {stocksTotal} mã • Click để xem chart</p>
                    </div>
                    <div className="flex gap-1 p-1 bg-[#F3F4F6] rounded-lg border border-[#E5E7EB]">
                      <input
                        type="text"
                        placeholder="Tìm mã..."
                        value={stocksSearch}
                        onChange={(e) => { setStocksSearch(e.target.value); setStocksPage(1); }}
                        className="text-[10px] w-24 px-2 py-1.5 border border-[#E5E7EB] rounded font-medium focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                      />
                      <select
                        value={stocksExchange}
                        onChange={(e) => { setStocksExchange(e.target.value); setStocksPage(1); }}
                        className="text-[10px] px-2 py-1.5 border border-[#E5E7EB] rounded font-medium focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] bg-white"
                      >
                        <option value="">Tất cả sàn</option>
                        <option value="HOSE">HOSE</option>
                        <option value="HNX">HNX</option>
                        <option value="UPCOM">UPCOM</option>
                      </select>
                    </div>
                  </div>
                  <div className="card-flat rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                      <table className="w-full text-left border-collapse table-dense">
                        <thead className="bg-[#F9FAFB] text-[#6B7280] text-[10px] uppercase font-semibold border-b border-[#E5E7EB] sticky top-0">
                          <tr>
                            <th className="px-4 py-3">Mã CK</th>
                            <th className="px-4 py-3 text-right">Giá</th>
                            <th className="px-4 py-3 text-right">Khối lượng</th>
                            <th className="px-4 py-3 text-center">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#374151]">
                          {loading && stocks.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-[#6B7280] text-sm">
                                Đang tải dữ liệu mã chứng khoán...
                              </td>
                            </tr>
                          ) : stocks.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-[#6B7280] text-sm">
                                Chưa có dữ liệu. Kiểm tra kết nối API.
                              </td>
                            </tr>
                          ) : stocks.map((stock) => {
                            const stockKey = `${stock.symbol}-${stock.exchange}`;
                            const priceChange = priceChanges[stockKey];
                            return (
                              <tr
                                key={stockKey}
                                className={`hover:bg-[#F9FAFB] transition-colors duration-150 cursor-pointer ${
                                  selectedSymbol === stock.symbol ? 'bg-[#DBEAFE] border-l-4 border-l-[#1E3A5F]' : ''
                                } ${priceChange === 'up' ? 'flash-green' : priceChange === 'down' ? 'flash-red' : ''}`}
                              >
                                <td className="px-4 py-2.5 font-semibold text-[#111827]" onClick={() => handleStockClick(stock.symbol, stock.exchange)}>
                                  {stock.symbol}
                                  <span className="text-[9px] text-[#6B7280] block font-normal mt-0.5">{stock.exchange}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-medium" onClick={() => handleStockClick(stock.symbol, stock.exchange)}>
                                  {(parseFloat(stock.price) * STOCK_PRICE_DISPLAY_SCALE).toLocaleString('vi-VN')} ₫
                                </td>
                                <td className="px-4 py-2.5 text-right text-[#6B7280] text-xs font-mono" onClick={() => handleStockClick(stock.symbol, stock.exchange)}>
                                  {parseFloat(stock.volume).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
                                </td>
                                <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleStockClick(stock.symbol, stock.exchange)}
                                    className="text-[10px] border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white px-2.5 py-1 rounded font-semibold transition-colors duration-150"
                                  >
                                    Trade
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2 border-t border-[#E5E7EB] bg-[#FAFAFA]">
                      <p className="text-[10px] text-[#6B7280]">
                        Trang {stocksPage} / {Math.max(1, Math.ceil(stocksTotal / 50))} • {stocksTotal} mã
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setStocksPage(p => Math.max(1, p - 1))}
                          disabled={stocksPage === 1}
                          className="px-2 py-1 text-[10px] border border-[#E5E7EB] rounded font-semibold disabled:opacity-50 hover:bg-[#F3F4F6]"
                        >
                          ← Trước
                        </button>
                        <button
                          onClick={() => setStocksPage(p => p + 1)}
                          disabled={stocksPage >= Math.ceil(stocksTotal / 50) || stocksTotal === 0}
                          className="px-2 py-1 text-[10px] border border-[#E5E7EB] rounded font-semibold disabled:opacity-50 hover:bg-[#F3F4F6]"
                        >
                          Tiếp →
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              }
            />
          </div>
        )}

        {currentView === 'terminal' && (
          <div className="space-y-8 max-w-[1600px] mx-auto animate-fade-in">
            <div>
                <div className="flex justify-between items-center mb-5">
                    <h1 className="text-lg font-semibold text-[#111827]">RiskGuard Terminal</h1>
                    <button 
                        onClick={() => setShowSetupModal(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] transition-colors duration-150 text-sm font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Cấu hình
                    </button>
                </div>
                
                {/* Stats: 5 cards — accent border, value-first, hover lift */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                    <div className="group relative overflow-hidden rounded-xl bg-white border border-[#E5E7EB] pl-4 pr-4 py-4 shadow-sm hover:shadow-md hover:border-[#1E3A5F]/20 transition-all duration-200 border-l-4 border-l-[#1E3A5F]">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] mb-1">Tổng vốn</p>
                        <p className="text-xl font-bold text-[#111827] font-mono tabular-nums tracking-tight">{totalBalance.toLocaleString('vi-VN')} ₫</p>
                    </div>
                    <div className="group relative overflow-hidden rounded-xl bg-white border border-[#E5E7EB] pl-4 pr-4 py-4 shadow-sm hover:shadow-md hover:border-[#B45309]/30 transition-all duration-200 border-l-4 border-l-[#B45309]">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] mb-1">Hạn mức rủi ro</p>
                        <p className="text-xl font-bold text-[#111827] font-mono tabular-nums tracking-tight">{maxRiskAmount.toLocaleString('vi-VN')} ₫ <span className="text-sm font-semibold text-[#6B7280]">({maxRiskPercent}%)</span></p>
                    </div>
                    <div className="group relative overflow-hidden rounded-xl bg-white border border-[#E5E7EB] pl-4 pr-4 py-4 shadow-sm hover:shadow-md hover:border-[#0B6E4B]/30 transition-all duration-200 border-l-4 border-l-[#0B6E4B]">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] mb-1">Lãi kỳ vọng</p>
                        <p className="text-xl font-bold text-[#111827] font-mono tabular-nums tracking-tight">{expectedReturnPercent}% <span className="text-sm font-medium text-[#6B7280]">≈ {(totalBalance * expectedReturnPercent / 100).toLocaleString('vi-VN')} ₫</span></p>
                    </div>
                    <div className={`group relative overflow-hidden rounded-xl bg-white border pl-4 pr-4 py-4 shadow-sm hover:shadow-md transition-all duration-200 border-l-4 ${riskUsagePercent > 80 ? 'border-[#A63D3D] border-l-[#A63D3D] hover:border-[#A63D3D]/50' : 'border-[#E5E7EB] border-l-[#0B6E4B] hover:border-[#0B6E4B]/30'}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] mb-1">Rủi ro hiện tại</p>
                        <p className="text-xl font-bold text-[#111827] font-mono tabular-nums tracking-tight">{currentRiskUsed.toLocaleString('vi-VN')} ₫</p>
                    </div>
                    <div className="group relative overflow-hidden rounded-xl bg-white border border-[#E5E7EB] pl-4 pr-4 py-4 shadow-sm hover:shadow-md hover:border-[#9CA3AF]/30 transition-all duration-200 border-l-4 border-l-[#9CA3AF] opacity-90">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] mb-1">Lệnh mở</p>
                        <p className="text-xl font-bold text-[#111827] font-mono tabular-nums">—</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Market Data Chart */}
                <div className="lg:col-span-2 card-flat p-5 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[#F3F4F6] text-[#1E3A5F] border border-[#E5E7EB]">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>
                            </div>

                            {/* Symbol Dropdown */}
                            <div className="relative">
                                <select
                                    value={`${selectedSymbol}-${selectedExchange}`}
                                    onChange={async (e) => {
                                        const [newSymbol, newExchange] = e.target.value.split('-');
                                        setSelectedSymbol(newSymbol);
                                        setSelectedExchange(newExchange);
                                        // Load chart data
                                        try {
                                            const res = await marketApi.getOHLCV(newSymbol, { exchange: newExchange, timeframe: '1d', limit: 30 });
                                            if (res.data.success && Array.isArray(res.data.data)) {
                                                const data = res.data.data.map((item: any) => ({
                                                    time: new Date(item.timestamp).toLocaleDateString(),
                                                    open: parseFloat(item.open) * STOCK_PRICE_DISPLAY_SCALE,
                                                    high: parseFloat(item.high) * STOCK_PRICE_DISPLAY_SCALE,
                                                    low: parseFloat(item.low) * STOCK_PRICE_DISPLAY_SCALE,
                                                    close: parseFloat(item.close) * STOCK_PRICE_DISPLAY_SCALE,
                                                    volume: parseFloat(item.volume)
                                                }));
                                                setMarketData(data);
                                            }
                                        } catch (error) {
                                            console.error('Load chart error:', error);
                                        }
                                    }}
                                    className="appearance-none bg-white border border-[#E5E7EB] rounded-lg pl-3 pr-8 py-1.5 text-sm font-semibold text-[#111827] hover:border-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]/10 cursor-pointer transition-all"
                                >
                                    {stocks.map((stock) => (
                                        <option key={`${stock.symbol}-${stock.exchange}`} value={`${stock.symbol}-${stock.exchange}`}>
                                            {stock.symbol} ({stock.exchange})
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#6B7280]">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            <p className="text-[9px] text-[#6B7280] uppercase font-semibold">30 ngày gần nhất</p>
                        </div>
                        {marketData.length > 0 && (
                            <div className="text-right">
                                <p className="text-lg font-semibold text-[#111827] font-mono">{marketData[marketData.length - 1].close.toLocaleString('vi-VN')} ₫</p>
                                <p className={`text-xs font-semibold ${
                                    marketData[marketData.length - 1]?.close > marketData[marketData.length - 2]?.close ? 'text-[#0B6E4B]' : 'text-[#A63D3D]'
                                }`}>
                                    {marketData.length > 1 ? (
                                        ((marketData[marketData.length - 1]?.close - marketData[marketData.length - 2]?.close) / marketData[marketData.length - 2]?.close * 100).toFixed(2)
                                    ) : 0}%
                                </p>
                            </div>
                        )}
                    </div>
                    {marketData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={marketData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 10, fill: '#6B7280' }}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: '#6B7280' }}
                                    domain={['dataMin - 10', 'dataMax + 10']}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#FFFFFF',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="close"
                                    stroke="#1E3A5F"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="high"
                                    stroke="#0B6E4B"
                                    strokeWidth={1}
                                    strokeDasharray="3 3"
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="low"
                                    stroke="#A63D3D"
                                    strokeWidth={1}
                                    strokeDasharray="3 3"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-[#6B7280] text-sm">
                            Đang tải dữ liệu thị trường...
                        </div>
                    )}
                </div>

                {/* Risk Allocation */}
                <div className="card-flat p-5 rounded-lg flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 rounded-lg bg-[#F3F4F6] text-[#1E3A5F] border border-[#E5E7EB]">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                        </div>
                        <h3 className="font-semibold text-[#111827] text-sm">Phân bổ rủi ro</h3>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-5 flex-1">
                        <div className="relative w-32 h-32 min-w-[128px] min-h-[128px]">
                            <ResponsiveContainer width={128} height={128}>
                                <PieChart>
                                <Pie
                                    data={riskData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={44}
                                    outerRadius={58}
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {riskData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-lg font-semibold text-[#111827]">{chartRiskPercentage}%</span>
                                <span className="text-[9px] text-[#6B7280] uppercase font-semibold">Đã dùng</span>
                            </div>
                        </div>
                        <div className="flex-1 w-full space-y-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-[#6B7280] font-medium">Đã dùng</span>
                                    <span className="text-[#111827] font-semibold font-mono">{currentRiskUsed.toLocaleString('vi-VN')} ₫</span>
                                </div>
                                <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#1E3A5F] rounded-full transition-all duration-300" style={{ width: `${Math.min(chartRiskPercentage, 100)}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-[#6B7280] font-medium">Khả dụng</span>
                                    <span className="text-[#0B6E4B] font-semibold font-mono">{availableRisk.toLocaleString('vi-VN')} ₫</span>
                                </div>
                                <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#E5E7EB] rounded-full" style={{ width: '100%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Giao dịch / Vị thế đã ngừng */}
            <div className="card-flat rounded-lg min-h-[200px] flex flex-col items-center justify-center p-8 text-center">
              <p className="text-[#6B7280] text-sm">Chức năng vị thế (mở/đóng lệnh) đã ngừng.</p>
            </div>

          </div>
        )}

        {/* Trang Tin tức - dữ liệu từ CafeF */}
        {currentView === 'market' && <MarketNewsView />}

        {/* Placeholder Settings */}
        {currentView === 'settings' && (
           <div className="flex flex-col items-center justify-center h-full text-[#6B7280] animate-fade-in">
              <div className="w-16 h-16 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center mb-5">
                  <svg className="w-8 h-8 text-[#1E3A5F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
              </div>
              <h2 className="text-base font-semibold text-[#111827] mb-1">Tính năng đang phát triển</h2>
              <p className="text-sm">Vui lòng quay lại sau.</p>
           </div>
        )}

      </main>

      {/* --- AI Report Modal (Fintech style) --- */}
      {insightContent && insightTrader && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111827]/50 animate-fade-in">
             <div className="bg-white border border-[#E5E7EB] rounded-lg w-full max-w-2xl shadow-card-hover flex flex-col max-h-[90vh] overflow-hidden">
                 {/* Header */}
                 <div className="p-5 border-b border-[#E5E7EB] flex justify-between items-start bg-[#FAFAFA]">
                     <div className="flex gap-3">
                         <div className="w-12 h-12 rounded-lg border border-[#E5E7EB] overflow-hidden bg-[#F3F4F6] shrink-0">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${insightTrader.id}&backgroundColor=b6e3f4`} alt="Avatar" className="w-full h-full object-cover" />
                         </div>
                         <div>
                             <h3 className="text-[#111827] font-semibold text-base">{insightTrader.name}</h3>
                             <div className="flex items-center gap-2 mt-0.5">
                                 <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-[#F3F4F6] text-[#1E3A5F] border border-[#E5E7EB] uppercase tracking-wider">AI Report</span>
                                 <span className="text-[#6B7280] text-[10px] font-mono">{new Date().toLocaleDateString()}</span>
                             </div>
                         </div>
                     </div>
                     <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                         insightContent.verdict === 'RECOMMENDED' ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#0B6E4B]' :
                         insightContent.verdict === 'CAUTION' ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]' :
                         'bg-[#FEF2F2] border-[#FECACA] text-[#A63D3D]'
                     }`}>
                         {insightContent.verdict}
                     </div>
                 </div>

                 {/* Body */}
                 <div className="p-5 overflow-y-auto space-y-5">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
                            <div className="flex justify-between mb-2">
                                <span className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider">Mức độ phù hợp</span>
                                <span className="text-[#111827] font-mono font-semibold text-sm">{insightContent.marketFitScore}</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div className="h-full bg-[#1E3A5F] rounded-full transition-all" style={{ width: `${insightContent.marketFitScore}%` }} />
                            </div>
                            <p className="mt-1.5 text-[10px] text-[#6B7280] font-medium">{insightContent.strategyMatch}</p>
                        </div>
                        <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
                            <div className="flex justify-between mb-2">
                                <span className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider">Điểm an toàn</span>
                                <span className={`font-mono font-semibold text-sm ${insightContent.safetyScore > 70 ? 'text-[#0B6E4B]' : 'text-[#B45309]'}`}>
                                    {insightContent.safetyScore}
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${insightContent.safetyScore > 70 ? 'bg-[#0B6E4B]' : 'bg-[#B45309]'}`} style={{ width: `${insightContent.safetyScore}%` }} />
                            </div>
                            <p className="mt-1.5 text-[10px] text-[#6B7280] font-medium">Đảo ngược chỉ số rủi ro</p>
                        </div>
                     </div>

                     <div className="bg-[#F9FAFB] rounded-lg p-4 border-l-4 border-[#1E3A5F] border border-[#E5E7EB]">
                         <h4 className="text-[#1E3A5F] text-xs font-semibold mb-1.5 flex items-center gap-2">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                             Phân tích thị trường
                         </h4>
                         <p className="text-[#374151] text-sm leading-relaxed">
                             {insightContent.marketAnalysis}
                         </p>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                             <h4 className="flex items-center gap-2 text-[#0B6E4B] text-[10px] font-semibold uppercase mb-2 tracking-wider">
                                 <span className="w-1.5 h-1.5 bg-[#0B6E4B] rounded-full" />
                                 Điểm mạnh
                             </h4>
                             <ul className="space-y-2">
                                 {insightContent.pros.map((pro, idx) => (
                                     <li key={idx} className="flex gap-2 text-sm text-[#374151] bg-[#F9FAFB] p-2 rounded-lg border border-[#E5E7EB]">
                                         <svg className="w-4 h-4 text-[#0B6E4B] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                         <span>{pro}</span>
                                     </li>
                                 ))}
                             </ul>
                         </div>
                         <div>
                             <h4 className="flex items-center gap-2 text-[#A63D3D] text-[10px] font-semibold uppercase mb-2 tracking-wider">
                                 <span className="w-1.5 h-1.5 bg-[#A63D3D] rounded-full" />
                                 Rủi ro cần lưu ý
                             </h4>
                             <ul className="space-y-2">
                                 {insightContent.cons.map((con, idx) => (
                                     <li key={idx} className="flex gap-2 text-sm text-[#374151] bg-[#F9FAFB] p-2 rounded-lg border border-[#E5E7EB]">
                                         <svg className="w-4 h-4 text-[#A63D3D] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                                         <span>{con}</span>
                                     </li>
                                 ))}
                             </ul>
                         </div>
                     </div>
                 </div>

                 {/* Footer */}
                 <div className="p-4 border-t border-[#E5E7EB] bg-[#FAFAFA]">
                     <button onClick={closeInsightModal} className="w-full py-3 rounded-lg bg-[#1E3A5F] hover:bg-[#2C4A6F] text-white text-sm font-semibold transition-colors duration-150">
                         Đóng
                     </button>
                 </div>
             </div>
        </div>
      )}

    </div>
  );
}

export default App;
