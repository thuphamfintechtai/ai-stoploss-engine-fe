import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';

function convertToLightweightTime(dateVal: string | number): string | number {
  // Unix timestamp (seconds) — intraday — trả về nguyên
  if (typeof dateVal === 'number') return dateVal;
  // yyyy-mm-dd — đã đúng format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal;
  // dd/mm/yyyy — convert sang yyyy-mm-dd
  const parts = dateVal.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateVal;
}

function calculateSMA(data: any[], period: number) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

function getThemeColors(isLight: boolean) {
  return isLight
    ? {
        bg: '#FFFFFF',
        text: '#334155',
        gridLine: 'rgba(0,0,0,0.06)',
        border: 'rgba(0,0,0,0.10)',
        crosshair: 'rgba(0,0,0,0.25)',
      }
    : {
        bg: '#0D1526',
        text: '#8896A4',
        gridLine: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)',
        crosshair: 'rgba(255,255,255,0.2)',
      };
}

interface Props {
  data: any[];
  loading: boolean;
  bgColor?: string;
}

export const CandlestickChart: React.FC<Props> = ({ data, loading }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ma20SeriesRef = useRef<any>(null);
  const ma50SeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const colors = getThemeColors(isLight);

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.gridLine },
        horzLines: { color: colors.gridLine },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 10,
        minBarSpacing: 6,
      },
      rightPriceScale: {
        borderColor: colors.border,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: colors.crosshair, width: 1, style: 3 },
        horzLine: { color: colors.crosshair, width: 1, style: 3 },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#22C55E',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

    const ma20Series = chart.addSeries(LineSeries, { color: '#3B82F6', lineWidth: 1, title: 'MA20' });
    const ma50Series = chart.addSeries(LineSeries, { color: '#F59E0B', lineWidth: 1, title: 'MA50' });

    volumeSeriesRef.current = volumeSeries;
    ma20SeriesRef.current = ma20Series;
    ma50SeriesRef.current = ma50Series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // Watch theme changes
    const observer = new MutationObserver(() => {
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      const c = getThemeColors(light);
      chart.applyOptions({
        layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text },
        grid: { vertLines: { color: c.gridLine }, horzLines: { color: c.gridLine } },
        timeScale: { borderColor: c.border },
        rightPriceScale: { borderColor: c.border },
        crosshair: {
          vertLine: { color: c.crosshair },
          horzLine: { color: c.crosshair },
        },
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;

    const transformed = data.map((d) => ({
      time: convertToLightweightTime(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const uniqueData = transformed.reduce((acc: any[], curr) => {
      if (!acc.find((item) => item.time === curr.time)) acc.push(curr);
      return acc;
    }, []);

    const sortedData = uniqueData.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    seriesRef.current.setData(sortedData);

    if (volumeSeriesRef.current) {
      const volumeData = sortedData.map((d, i) => ({
        time: d.time,
        value: data[i]?.volume || 0,
        color: d.close >= d.open ? '#22C55E60' : '#EF444460',
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    if (ma20SeriesRef.current && sortedData.length >= 20) {
      ma20SeriesRef.current.setData(calculateSMA(sortedData, 20));
    }
    if (ma50SeriesRef.current && sortedData.length >= 50) {
      ma50SeriesRef.current.setData(calculateSMA(sortedData, 50));
    }
  }, [data]);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  return (
    <div className="relative w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ background: isLight ? '#FFFFFF' : '#0D1526' }}>
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <div className="w-4 h-4 border-2 border-border-standard border-t-accent rounded-full animate-spin" />
            Đang tải...
          </div>
        </div>
      )}
    </div>
  );
};
