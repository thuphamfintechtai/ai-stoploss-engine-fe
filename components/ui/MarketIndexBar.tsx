import React, { useCallback, useEffect, useRef, useState } from 'react';
import { marketApi, type MarketIndex } from '../../services/api';

/**
 * MarketIndexBar — thanh header hiển thị 3 chỉ số VN: VN-Index / VN30 / HNX-Index.
 * MDI-06 (D-06): poll endpoint /api/market/indices mỗi 30s, graceful error.
 *
 * - Loading: 3 skeleton pill.
 * - Error (tất cả 3 index fail): 1 line "Dữ liệu thị trường tạm thời không khả dụng".
 * - Partial success: vẫn render các index có data; index fail hiển thị "—".
 * - Unmount: clearInterval + AbortController.abort() để tránh leak.
 */
export interface MarketIndexBarProps {
  /** Khoảng poll (ms). Default: 30_000. */
  pollMs?: number;
  className?: string;
}

const DEFAULT_POLL_MS = 30_000;

const INDEX_ORDER: MarketIndex['indexCode'][] = ['VNINDEX', 'VN30', 'HNXINDEX'];

const DISPLAY_NAME: Record<MarketIndex['indexCode'], string> = {
  VNINDEX: 'VN-Index',
  VN30: 'VN30',
  HNXINDEX: 'HNX-Index',
};

const numberFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatValue(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return numberFormatter.format(value);
}

function getArrow(change?: number | null): { symbol: string; colorClass: string } {
  if (change == null || !Number.isFinite(change) || change === 0) {
    return { symbol: '−', colorClass: 'text-[var(--color-text-muted)]' };
  }
  return change > 0
    ? { symbol: '▲', colorClass: 'text-[var(--color-positive)]' }
    : { symbol: '▼', colorClass: 'text-[var(--color-negative)]' };
}

function formatPercent(pct?: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export const MarketIndexBar: React.FC<MarketIndexBarProps> = ({
  pollMs = DEFAULT_POLL_MS,
  className = '',
}) => {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dùng ref để cleanup chỉ gọi lần duy nhất trong useEffect strict mode.
  const mountedRef = useRef(true);

  const fetchIndices = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await marketApi.getIndices(signal);
      if (!mountedRef.current || signal.aborted) return;

      const data = Array.isArray(res?.data) ? res.data : [];
      if (res?.success === false && data.length === 0) {
        setError('Dữ liệu thị trường tạm thời không khả dụng');
        setIndices([]);
      } else {
        setIndices(data);
        setError(null);
      }
    } catch (err: any) {
      if (signal.aborted) return;
      // Axios cancel / abort: bỏ qua, không set error
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
      if (!mountedRef.current) return;
      setError('Dữ liệu thị trường tạm thời không khả dụng');
    } finally {
      if (mountedRef.current && !signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    const signal = controller.signal;

    // Initial fetch
    fetchIndices(signal);

    // Poll
    const intervalId = setInterval(() => {
      if (!signal.aborted) {
        fetchIndices(signal);
      }
    }, pollMs);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      controller.abort();
    };
  }, [fetchIndices, pollMs]);

  // Loading state: 3 skeleton pill
  if (loading && indices.length === 0 && !error) {
    return (
      <div
        className={`flex flex-wrap items-center gap-4 ${className}`}
        data-testid="market-index-bar-loading"
      >
        {INDEX_ORDER.map((code) => (
          <div
            key={code}
            className="flex items-center gap-2 animate-pulse"
            aria-hidden="true"
          >
            <span className="text-[10px] text-[var(--color-text-dim)]">
              {DISPLAY_NAME[code]}
            </span>
            <span className="inline-block h-3 w-20 rounded bg-[var(--color-panel-hover)]" />
          </div>
        ))}
      </div>
    );
  }

  // All-error state
  if (error && indices.length === 0) {
    return (
      <div
        className={`text-[11px] text-[var(--color-text-muted)] ${className}`}
        data-testid="market-index-bar-error"
        role="status"
      >
        Dữ liệu thị trường tạm thời không khả dụng
      </div>
    );
  }

  // Success (có thể có partial fail — render theo thứ tự INDEX_ORDER)
  const byCode = new Map<string, MarketIndex>();
  for (const item of indices) byCode.set(item.indexCode, item);

  return (
    <div
      className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] ${className}`}
      data-testid="market-index-bar"
    >
      {INDEX_ORDER.map((code) => {
        const item = byCode.get(code);
        const ok = !!item && item.success !== false && item.value != null;
        const arrow = getArrow(item?.change);
        return (
          <span
            key={code}
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
            data-testid={`market-index-${code}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {DISPLAY_NAME[code]}
            </span>
            {ok ? (
              <>
                <strong className="tabular-nums text-[var(--color-text-main)]">
                  {formatValue(item!.value)}
                </strong>
                <span className={`tabular-nums inline-flex items-center gap-0.5 ${arrow.colorClass}`}>
                  <span aria-hidden="true">{arrow.symbol}</span>
                  {formatPercent(item!.changePercent)}
                </span>
              </>
            ) : (
              <span className="text-[var(--color-text-dim)]">—</span>
            )}
          </span>
        );
      })}
    </div>
  );
};

export default MarketIndexBar;
