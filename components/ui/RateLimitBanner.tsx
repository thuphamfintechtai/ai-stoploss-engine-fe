import React from 'react';
import { useRateLimitCountdown } from '../../hooks/useRateLimitCountdown';

/**
 * Global banner hiển thị khi user bị rate-limit 429 từ /api/ai/* (AIT-05).
 * Mount một lần ở App root. Subscribe CustomEvent 'api:rate-limit' qua hook.
 * Ẩn tự động khi countdown về 0.
 */
export const RateLimitBanner: React.FC = () => {
  const { active, secondsLeft, message } = useRateLimitCountdown();

  if (!active) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="rate-limit-banner"
      className="fixed top-0 left-0 right-0 z-[100] bg-amber-500/20 border-b border-amber-500/50 backdrop-blur-sm"
    >
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-[12px] text-amber-100">
        <span aria-hidden>⏳</span>
        <span className="font-semibold">
          {message}. Thử lại sau <span className="font-mono tabular-nums">{secondsLeft}</span> giây.
        </span>
      </div>
    </div>
  );
};

export default RateLimitBanner;
