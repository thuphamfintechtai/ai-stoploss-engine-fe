import React from 'react';

interface ConfidenceBarProps {
  /** Giá trị 0-100 (auto clamp nếu ngoài range). */
  value: number;
  /** Hiển thị label text "Thấp/Trung bình/Cao" bên phải. */
  showLabel?: boolean;
  /** Hiển thị tooltip giải thích. Default true. */
  showTooltip?: boolean;
  className?: string;
}

type Tier = 'low' | 'mid' | 'high';

function getTier(value: number): Tier {
  if (value <= 40) return 'low';
  if (value <= 70) return 'mid';
  return 'high';
}

const TIER_LABEL: Record<Tier, string> = {
  low: 'Thấp',
  mid: 'Trung bình',
  high: 'Cao',
};

const TIER_TEXT_CLS: Record<Tier, string> = {
  low: 'text-negative',
  mid: 'text-warning',
  high: 'text-positive',
};

/**
 * 3-segment colored confidence bar (AIT-04, D-04).
 * Layout: segment 0-40 (đỏ 40%), 40-70 (vàng 30%), 70-100 (xanh 30%).
 * Marker arrow ▼ ở vị trí `value`, segment active được filled đậm.
 */
export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  value,
  showLabel = true,
  showTooltip = true,
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const tier = getTier(clamped);
  const title = showTooltip
    ? `Độ tin cậy ${Math.round(clamped)}/100. Gemini tự đánh giá — không phải xác suất thực tế.`
    : undefined;

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      title={title}
      aria-label={`Confidence ${Math.round(clamped)}/100 (${TIER_LABEL[tier]})`}
      data-testid="confidence-bar"
    >
      <div className="relative flex-1 min-w-[80px]">
        {/* Marker arrow ▼ trên đỉnh */}
        <div
          className="absolute -top-1.5 text-[9px] leading-none text-[var(--color-text-main)] pointer-events-none transition-all"
          style={{ left: `${clamped}%`, transform: 'translateX(-50%)' }}
          aria-hidden
        >
          ▼
        </div>
        {/* 3-segment bar: 40% red, 30% yellow, 30% green */}
        <div className="flex h-2 rounded-full overflow-hidden border border-border-subtle">
          <div
            className={`h-full ${tier === 'low' ? 'bg-negative' : 'bg-negative/20'}`}
            style={{ width: '40%' }}
          />
          <div
            className={`h-full ${tier === 'mid' ? 'bg-warning' : 'bg-warning/20'}`}
            style={{ width: '30%' }}
          />
          <div
            className={`h-full ${tier === 'high' ? 'bg-positive' : 'bg-positive/20'}`}
            style={{ width: '30%' }}
          />
        </div>
      </div>
      {showLabel && (
        <span className={`text-[10px] font-semibold whitespace-nowrap ${TIER_TEXT_CLS[tier]}`}>
          {TIER_LABEL[tier]} {Math.round(clamped)}
        </span>
      )}
    </div>
  );
};

export default ConfidenceBar;
