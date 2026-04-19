import React from 'react';

interface ClampedBadgeProps {
  /** Giá gốc AI đề xuất (VND). Nếu undefined → chỉ render badge đơn giản. */
  original?: number;
  /** Giá đã clamp về biên độ sàn (VND). */
  adjusted?: number;
  /** Sàn giao dịch (HOSE/HNX/UPCOM) — dùng trong tooltip. */
  exchange?: string;
  className?: string;
}

/**
 * Chia giá VND / 1000 để hiển thị dạng điểm (vd 74400 → 74.40).
 * Giữ nguyên formatter cho giá "điểm" (< 1000) khi BE đã convert.
 */
function formatPricePoint(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const point = v >= 1000 ? v / 1000 : v;
  return point.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Badge nhỏ cảnh báo giá AI đã được điều chỉnh về biên độ sàn (AIT-02, D-02).
 * Wire ở mọi chỗ render SL/TP có flag `_clamped` từ BE (Plan 04-01 output).
 */
export const ClampedBadge: React.FC<ClampedBadgeProps> = ({
  original,
  adjusted,
  exchange,
  className = '',
}) => {
  const hasDetail = original != null && adjusted != null;
  const title = hasDetail
    ? `Giá AI đề xuất (${formatPricePoint(original)}) vượt biên độ ${exchange ?? 'sàn'}. Đã điều chỉnh về ${formatPricePoint(adjusted)}.`
    : 'Giá AI đề xuất đã được điều chỉnh về biên độ sàn.';

  return (
    <span
      role="status"
      aria-label="Giá AI đã điều chỉnh theo biên độ sàn"
      title={title}
      data-testid="clamped-badge"
      className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 cursor-help ${className}`}
    >
      <span aria-hidden>⚡</span>
      <span>Giá điều chỉnh</span>
    </span>
  );
};

export default ClampedBadge;
