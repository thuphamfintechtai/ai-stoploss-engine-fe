import React from 'react';
import { Tooltip } from './Tooltip';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changePercent?: number;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: { padding: 'px-3 py-2', valueText: 'text-[15px]', labelText: 'text-[10px]' },
  md: { padding: 'px-4 py-3', valueText: 'text-[18px]', labelText: 'text-[11px]' },
  lg: { padding: 'px-5 py-4', valueText: 'text-[24px]', labelText: 'text-[12px]' },
};

const ArrowUp: React.FC = () => (
  <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path d="M5 15l7-7 7 7" />
  </svg>
);

const ArrowDown: React.FC = () => (
  <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path d="M19 9l-7 7-7-7" />
  </svg>
);

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  changePercent,
  prefix = '',
  suffix = '',
  tooltip,
  size = 'md',
}) => {
  const styles = sizeStyles[size];
  const hasChange = change !== undefined && change !== null;
  const isPositive = hasChange && change > 0;
  const isNegative = hasChange && change < 0;

  const changeColor = isPositive
    ? 'text-[var(--color-positive)]'
    : isNegative
      ? 'text-[var(--color-negative)]'
      : 'text-[var(--color-text-muted)]';

  const labelElement = (
    <span className={`${styles.labelText} font-medium text-[var(--color-text-muted)] uppercase tracking-wider`}>
      {label}
    </span>
  );

  return (
    <div className={`stat-card ${styles.padding}`}>
      <div className="mb-1">
        {tooltip ? (
          <Tooltip content={tooltip} position="top">
            {labelElement}
          </Tooltip>
        ) : (
          labelElement
        )}
      </div>
      <div className={`${styles.valueText} font-semibold tabular-nums text-[var(--color-text-main)]`}>
        {prefix}{value}{suffix}
      </div>
      {hasChange && (
        <div className={`flex items-center gap-1 mt-1 text-[11px] ${changeColor}`}>
          {isPositive ? <ArrowUp /> : isNegative ? <ArrowDown /> : null}
          <span className="tabular-nums">
            {isPositive ? '+' : ''}{change.toLocaleString('vi-VN')}
          </span>
          {changePercent !== undefined && (
            <span className="tabular-nums">
              ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
            </span>
          )}
        </div>
      )}
    </div>
  );
};
