import React, { useMemo } from 'react';

/**
 * PriceFreshness — hiển thị nhãn "Delayed ~Xs" khi tuổi giá vượt threshold.
 * MDI-04 (D-04): thay thế label "Real-time" tĩnh không chính xác.
 *
 * - Khi ageMs ≤ threshold → render null (không hiện gì → giá được coi là tươi).
 * - Khi ageMs > threshold → render span màu amber với icon cảnh báo + text "Delayed ~Xs".
 *
 * Lý do dùng "Delayed" thay vì "Stale" / "Outdated": VPBS trả dữ liệu
 * có thể trễ 30–60s trong giờ giao dịch bình thường (rate-limit polling),
 * hoàn toàn hợp lệ — ta chỉ cảnh báo người dùng để họ biết.
 */
export interface PriceFreshnessProps {
  /** Tuổi giá tính bằng millisecond (Date.now() - lastReceivedAt). */
  ageMs: number;
  /** Ngưỡng coi là "delayed". Default: 10_000ms (10s) theo spec D-04. */
  threshold?: number;
  /** Extra Tailwind class cho span wrapper. */
  className?: string;
  /**
   * W2.8 — stale_reason từ marketPriceService.
   * 'circuit_breaker_open' → badge đỏ "VPBS tạm dừng — giá từ cache" (ưu tiên hơn Delayed).
   */
  staleReason?: string;
}

const DEFAULT_THRESHOLD_MS = 10_000;

export const PriceFreshness: React.FC<PriceFreshnessProps> = ({
  ageMs,
  threshold = DEFAULT_THRESHOLD_MS,
  className = '',
  staleReason,
}) => {
  const { shouldShow, ageSeconds, titleText } = useMemo(() => {
    const age = Number.isFinite(ageMs) ? Math.max(0, Math.floor(ageMs)) : 0;
    const seconds = Math.round(age / 1000);
    return {
      shouldShow: age > threshold,
      ageSeconds: seconds,
      titleText: `Giá được nhận cách đây ~${seconds}s (vượt ngưỡng ${Math.round(
        threshold / 1000
      )}s). VPBS trễ ~60s là bình thường — không phải lỗi.`,
    };
  }, [ageMs, threshold]);

  // W2.8 — VPBS circuit breaker OPEN: hiển thị badge ưu tiên thay vì "Delayed".
  if (staleReason === 'circuit_breaker_open') {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] text-[var(--color-negative)] ${className}`}
        title="VPBS API tạm dừng (circuit breaker mở) — đang dùng giá từ cache. Không nên cắt lỗ/chốt lời thủ công trên giá này."
        data-testid="price-freshness"
        role="status"
      >
        <span aria-hidden="true">⛔</span>
        VPBS tạm dừng — giá từ cache
      </span>
    );
  }

  if (!shouldShow) return null;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] text-warning ${className}`}
      title={titleText}
      data-testid="price-freshness"
      role="status"
    >
      <span aria-hidden="true">⚠</span>
      Delayed ~{ageSeconds}s
    </span>
  );
};

export default PriceFreshness;
