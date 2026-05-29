import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = rect.left + scrollX + rect.width / 2;
        y = rect.top + scrollY - 8;
        break;
      case 'bottom':
        x = rect.left + scrollX + rect.width / 2;
        y = rect.bottom + scrollY + 8;
        break;
      case 'left':
        x = rect.left + scrollX - 8;
        y = rect.top + scrollY + rect.height / 2;
        break;
      case 'right':
        x = rect.right + scrollX + 8;
        y = rect.top + scrollY + rect.height / 2;
        break;
    }

    setCoords({ x, y });
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionClasses: Record<TooltipPosition, string> = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  const arrowClasses: Record<TooltipPosition, string> = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-t-[var(--color-panel)] border-x-transparent border-b-transparent',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-b-[var(--color-panel)] border-x-transparent border-t-transparent',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-full border-l-[var(--color-panel)] border-y-transparent border-r-transparent',
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-full border-r-[var(--color-panel)] border-y-transparent border-l-transparent',
  };

  const childWithRef = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleMouseEnter,
    onBlur: handleMouseLeave,
  });

  return (
    <>
      {childWithRef}
      {isVisible && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed z-[300] ${positionClasses[position]} pointer-events-none`}
          style={{ left: coords.x, top: coords.y }}
          role="tooltip"
        >
          <div className={`tooltip-content ${className}`}>
            {content}
            <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export const InfoTooltip: React.FC<{
  content: React.ReactNode;
  className?: string;
}> = ({ content, className }) => (
  <Tooltip content={content} className={className}>
    <button
      type="button"
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-panel-hover text-dim hover:text-muted transition-colors"
      aria-label="Thông tin thêm"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  </Tooltip>
);
