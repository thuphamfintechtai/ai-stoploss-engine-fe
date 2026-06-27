import React, { useState, useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { useTheme } from '../../contexts/ThemeContext';

// --- Helper: Convert Vietnamese date to Lightweight Charts format ---
export function convertToLightweightTime(dateStr: string): string {
  // Input: "12/2/2026" (dd/mm/yyyy)
  // Output: "2026-02-12" (yyyy-mm-dd)
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// --- Helper: Calculate Simple Moving Average ---
export function calculateSMA(data: any[], period: number) {
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
const chartColors = (light: boolean) => light
  ? { bg: '#FFFFFF', text: '#334155', grid: 'rgba(0,0,0,0.06)', border: 'rgba(0,0,0,0.10)' }
  : { bg: '#090812', text: '#9CA3AF', grid: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' };

export const CandlestickChartLW = ({ data, loading }: { data: any[], loading: boolean }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ma20SeriesRef = useRef<any>(null);
  const ma50SeriesRef = useRef<any>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Phase 10 A-02 — subscribe theme từ ThemeContext thay vì poll DOM attribute
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Effect 1: Initialize chart on mount
  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    const c = chartColors(isLight);
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: c.bg },
        textColor: c.text,
      },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      timeScale: {
        borderColor: c.border,
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12,
        minBarSpacing: 8,
      },
      rightPriceScale: {
        borderColor: c.border,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    });

    // Assign to refs for external access (drawing tools)
    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Add volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#22C55E',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 1b: Re-apply chart colors when theme changes (replaces MutationObserver
  // — A-02 ThemeContext subscription).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const cc = chartColors(isLight);
    chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: cc.bg }, textColor: cc.text },
      grid: { vertLines: { color: cc.grid }, horzLines: { color: cc.grid } },
      timeScale: { borderColor: cc.border },
      rightPriceScale: { borderColor: cc.border },
    });
  }, [isLight]);

  // Effect 2: Update data when changed
  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) {
      return;
    }

    // Transform data: { time: '12/2/2026', ... } → { time: '2026-02-12', ... }
    // Raw data transform
    const transformed = data.map(d => ({
      time: convertToLightweightTime(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume || 0,
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

    // Set chart data

    // Set candlestick data
    seriesRef.current.setData(sortedData);

    // Set volume data (with colors based on price direction)
    if (volumeSeriesRef.current) {
      const volumeData = sortedData.map((d: any) => ({
        time: d.time,
        value: d.volume || 0,
        color: d.close >= d.open ? '#22C55E80' : '#EF444480',
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

  return (
    <div style={{ ...containerStyle, position: 'relative', minWidth: 0 }}>
      {/* Nút phóng to chart */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
      }}>
        <button
          onClick={toggleFullscreen}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-panel border border-border-standard text-text-main hover:bg-panel hover:border-[#1E3A5F] transition-colors shadow-sm"
          title={isFullscreen ? 'Thu nhỏ' : 'Phóng to'}
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          )}
        </button>
      </div>

      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'default',
        }}
      />

      {loading && (
        <div className="flex items-center justify-center" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff' }}>
          <div className="text-text-muted">Đang tải...</div>
        </div>
      )}
    </div>
  );
};
