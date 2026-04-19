import React from 'react';

interface OrderFieldErrorProps {
  message?: string | null;
}

/**
 * Inline per-field error display — icon cảnh báo + message tiếng Việt.
 * Không render nếu message null/empty.
 */
export const OrderFieldError: React.FC<OrderFieldErrorProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-1 mt-1 text-[10px] text-[var(--color-negative)]"
    >
      <svg
        className="w-3 h-3 mt-0.5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
};

export default OrderFieldError;
