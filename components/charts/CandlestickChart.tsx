import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';

function convertToLightweightTime(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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

interface Props {
  data: any[];
  loading: boolean;
  bgColor?: string;
}

export const CandlestickChart: React.FC<Props> = ({ data, loading, bgColor = '#0D1526' }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ma20SeriesRef = useRef<any>(null);
  const ma50SeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor: '#8896A4',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 10,
        minBarSpacing: 6,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 3 },
        horzLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 3 },
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

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [bgColor]);

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

  return (
    <div className="relative w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: bgColor }}>
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <div className="w-4 h-4 border-2 border-border-standard border-t-accent rounded-full animate-spin" />
            Đang tải...
          </div>
        </div>
      )}
    </div>
  );
};
