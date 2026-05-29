import React from 'react';

type ProgressVariant = 'default' | 'positive' | 'negative' | 'warning';
type ProgressSize = 'sm' | 'md' | 'lg';

interface ProgressProps {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  showLabel?: boolean;
  label?: string;
  className?: string;
  animated?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  className = '',
  animated = false,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variantClasses = {
    default: 'progress-bar',
    positive: 'progress-bar-positive',
    negative: 'progress-bar-negative',
    warning: 'progress-bar-warning',
  };

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div className="flex justify-between text-caption text-muted mb-1">
          <span>{label}</span>
          {showLabel && <span>{Math.round(percentage)}%</span>}
        </div>
      )}
      <div
        className={`progress ${sizeClasses[size]}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`${variantClasses[variant]} ${animated ? 'transition-all duration-500' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: ProgressVariant;
  showLabel?: boolean;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  variant = 'default',
  showLabel = false,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const colorClasses = {
    default: 'var(--color-accent)',
    positive: 'var(--color-positive)',
    negative: 'var(--color-negative)',
    warning: 'var(--color-warning)',
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-panel-hover)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorClasses[variant]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      {showLabel && (
        <span className="absolute text-caption font-medium text-main">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};

export const RiskMeter: React.FC<{
  value: number;
  maxRisk?: number;
  className?: string;
}> = ({ value, maxRisk = 100, className = '' }) => {
  const percentage = Math.min(100, Math.max(0, (value / maxRisk) * 100));

  const getVariant = (): ProgressVariant => {
    if (percentage < 30) return 'positive';
    if (percentage < 70) return 'warning';
    return 'negative';
  };

  const getLabel = () => {
    if (percentage < 30) return 'Rủi ro thấp';
    if (percentage < 70) return 'Rủi ro trung bình';
    return 'Rủi ro cao';
  };

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-caption text-muted">Mức độ rủi ro</span>
        <span className={`text-caption font-medium ${
          percentage < 30 ? 'text-positive' : percentage < 70 ? 'text-warning' : 'text-negative'
        }`}>
          {getLabel()}
        </span>
      </div>
      <Progress value={value} max={maxRisk} variant={getVariant()} animated />
    </div>
  );
};
