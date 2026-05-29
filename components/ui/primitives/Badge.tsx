import React from 'react';

type BadgeVariant = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'accent';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: '',
  };

  return (
    <span className={`badge badge-${variant} ${sizeClasses[size]} ${className}`}>
      {dot && <span className={`status-dot status-dot-${variant === 'positive' ? 'positive' : variant === 'negative' ? 'negative' : variant === 'warning' ? 'warning' : 'neutral'} mr-1.5`} />}
      {children}
    </span>
  );
};

export const TradeBadge: React.FC<{ side: 'LONG' | 'SHORT' | 'BUY' | 'SELL' }> = ({ side }) => {
  const isLong = side === 'LONG' || side === 'BUY';
  return (
    <Badge variant={isLong ? 'positive' : 'negative'} size="sm">
      {side}
    </Badge>
  );
};

export const StatusBadge: React.FC<{
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'expired' | 'active' | 'closed';
}> = ({ status }) => {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'warning', label: 'Chờ khớp' },
    filled: { variant: 'positive', label: 'Đã khớp' },
    partial: { variant: 'info', label: 'Khớp 1 phần' },
    cancelled: { variant: 'neutral', label: 'Đã hủy' },
    expired: { variant: 'neutral', label: 'Hết hạn' },
    active: { variant: 'positive', label: 'Đang mở' },
    closed: { variant: 'neutral', label: 'Đã đóng' },
  };

  const { variant, label } = config[status] || { variant: 'neutral', label: status };

  return <Badge variant={variant}>{label}</Badge>;
};

export const RiskBadge: React.FC<{ level: 'low' | 'medium' | 'high' | 'critical' }> = ({ level }) => {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    low: { variant: 'positive', label: 'Thấp' },
    medium: { variant: 'warning', label: 'Trung bình' },
    high: { variant: 'negative', label: 'Cao' },
    critical: { variant: 'negative', label: 'Nguy hiểm' },
  };

  const { variant, label } = config[level];

  return <Badge variant={variant} dot>{label}</Badge>;
};

export const PnLBadge: React.FC<{ value: number; showPercent?: boolean }> = ({ value, showPercent = false }) => {
  const isPositive = value > 0;
  const displayValue = showPercent
    ? `${isPositive ? '+' : ''}${value.toFixed(2)}%`
    : `${isPositive ? '+' : ''}${value.toLocaleString('vi-VN')}`;

  return (
    <Badge variant={isPositive ? 'positive' : value < 0 ? 'negative' : 'neutral'}>
      {displayValue}
    </Badge>
  );
};
