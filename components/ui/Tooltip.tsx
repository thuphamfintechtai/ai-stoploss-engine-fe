import React, { useState, useRef, useCallback } from 'react';
import { FINANCIAL_TERMS } from '../../constants';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, position = 'top' }) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 200);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 },
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <div
          className="tooltip-content absolute pointer-events-none text-[var(--color-text-main)]"
          style={positionStyles[position]}
        >
          {content}
        </div>
      )}
    </div>
  );
};

interface FinancialTooltipProps {
  term: string;
}

export const FinancialTooltip: React.FC<FinancialTooltipProps> = ({ term }) => {
  const entry = FINANCIAL_TERMS[term];

  if (!entry) {
    return <span>{term}</span>;
  }

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-semibold text-[var(--color-text-main)]">{entry.vi}</div>
      <div className="text-[var(--color-text-muted)] text-[11px] italic">{entry.en}</div>
      <div className="text-[var(--color-text-main)] text-[12px] leading-relaxed mt-1">{entry.explain}</div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <span
        className="border-b border-dotted border-[var(--color-info)] cursor-help text-[var(--color-info)]"
      >
        {term}
      </span>
    </Tooltip>
  );
};
