import React from 'react';

interface AiDisclaimerProps {
  /** Render compact inline (không border-top, font nhỏ hơn) — dùng trong card dày. */
  compact?: boolean;
  className?: string;
}

const DISCLAIMER_TEXT =
  'Không phải lời khuyên đầu tư. AI có thể sai. Luôn verify trước khi đặt lệnh.';

/**
 * Footer disclaimer hiển thị ở mọi nơi render AI output (AIT-08, D-08).
 * Mandatory component — không được edit text mà không update CONTEXT.md.
 */
export const AiDisclaimer: React.FC<AiDisclaimerProps> = ({
  compact = false,
  className = '',
}) => {
  if (compact) {
    return (
      <p
        role="note"
        aria-label="AI disclaimer"
        className={`text-[11px] text-[var(--color-text-dim)] leading-relaxed ${className}`}
      >
        <span aria-hidden className="text-[var(--color-warning)]">⚠ </span>
        {DISCLAIMER_TEXT}
      </p>
    );
  }
  return (
    <div
      role="note"
      aria-label="AI disclaimer"
      className={`border-t border-border-subtle pt-2 mt-2 text-[11px] text-[var(--color-text-muted)] flex items-start gap-1.5 ${className}`}
    >
      <span aria-hidden className="text-[var(--color-warning)] shrink-0">⚠</span>
      <span className="leading-relaxed">{DISCLAIMER_TEXT}</span>
    </div>
  );
};

export default AiDisclaimer;
