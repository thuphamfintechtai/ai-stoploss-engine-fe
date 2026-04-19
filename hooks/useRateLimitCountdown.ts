import { useEffect, useState } from 'react';

export interface RateLimitEventDetail {
  /** Số giây countdown từ BE (header Retry-After hoặc body retry_after_seconds). */
  retryAfterSeconds: number;
  /** Message tiếng Việt từ BE (optional). */
  message?: string;
}

export interface RateLimitState {
  /** True khi còn giây đếm ngược. Banner/buttons dùng flag này. */
  active: boolean;
  /** Số giây còn lại (giảm dần mỗi giây, clamp >= 0). */
  secondsLeft: number;
  /** Message tiếng Việt hiển thị trong banner. */
  message: string;
}

const EVENT_NAME = 'api:rate-limit';

/**
 * Hook listen CustomEvent 'api:rate-limit' (dispatched từ services/api.ts interceptor khi 429).
 * Expose countdown state. Khi timer về 0 → active flip false, banner tự ẩn.
 * AIT-05, D-05.
 */
export function useRateLimitCountdown(): RateLimitState {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [message, setMessage] = useState('');

  // Subscribe custom event: capture retry countdown + message
  useEffect(() => {
    const onRateLimit = (e: Event) => {
      const detail = (e as CustomEvent<RateLimitEventDetail>).detail;
      if (!detail) return;
      const seconds = Math.max(0, Math.floor(Number(detail.retryAfterSeconds) || 60));
      setSecondsLeft(seconds);
      setMessage(detail.message || 'Đã dùng hết lượt AI');
    };
    window.addEventListener(EVENT_NAME, onRateLimit);
    return () => window.removeEventListener(EVENT_NAME, onRateLimit);
  }, []);

  // Decrement timer every second; clears when reaches 0
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  return {
    active: secondsLeft > 0,
    secondsLeft,
    message,
  };
}

export default useRateLimitCountdown;
