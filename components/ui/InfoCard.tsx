import React, { useState } from 'react';

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'info' | 'warning' | 'tip';
}

const variantConfig = {
  info: {
    borderColor: 'border-l-[var(--color-info)]',
    bgColor: 'bg-[var(--color-info)]/5',
    iconColor: 'text-[var(--color-info)]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  warning: {
    borderColor: 'border-l-[var(--color-warning)]',
    bgColor: 'bg-[var(--color-warning)]/5',
    iconColor: 'text-[var(--color-warning)]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  tip: {
    borderColor: 'border-l-[var(--color-positive)]',
    bgColor: 'bg-[var(--color-positive)]/5',
    iconColor: 'text-[var(--color-positive)]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
};

export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  children,
  defaultOpen = false,
  variant = 'info',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const config = variantConfig[variant];

  return (
    <div
      className={`border-l-3 ${config.borderColor} ${config.bgColor} rounded-r-[var(--radius-md)] overflow-hidden`}
    >
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={config.iconColor}>{config.icon}</span>
        <span className="flex-1 text-[13px] font-medium text-[var(--color-text-main)]">
          {title}
        </span>
        <svg
          className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 text-[12px] text-[var(--color-text-muted)] leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
};
