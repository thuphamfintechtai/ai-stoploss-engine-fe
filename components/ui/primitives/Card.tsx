import React from 'react';

type CardPadding = 'none' | 'compact' | 'default' | 'dense';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: CardPadding;
  hoverable?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'default',
  hoverable = false,
  onClick,
}) => {
  const paddingClasses = {
    none: '',
    dense: 'card-body-dense',
    compact: 'card-body-compact',
    default: 'card-body',
  };

  const baseClass = hoverable ? 'card interactive' : 'card';

  return (
    <div
      className={`${baseClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === CardHeader || child.type === CardFooter) {
            return child;
          }
          if (child.type === CardBody) {
            return React.cloneElement(child as React.ReactElement<CardBodyProps>, {
              padding: (child.props as CardBodyProps).padding || padding,
            });
          }
        }
        return <div className={paddingClasses[padding]}>{child}</div>;
      })}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  title,
  subtitle,
  action,
  className = '',
}) => {
  if (title || subtitle) {
    return (
      <div className={`card-header ${className}`}>
        <div>
          {title && <h3 className="text-heading text-main">{title}</h3>}
          {subtitle && <p className="text-caption text-muted mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    );
  }

  return <div className={`card-header ${className}`}>{children}</div>;
};

interface CardBodyProps {
  children: React.ReactNode;
  padding?: CardPadding;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({
  children,
  padding = 'default',
  className = '',
}) => {
  const paddingClasses = {
    none: '',
    dense: 'card-body-dense',
    compact: 'card-body-compact',
    default: 'card-body',
  };

  return (
    <div className={`${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
};

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = '',
}) => (
  <div className={`card-footer ${className}`}>{children}</div>
);

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  change?: string | number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}> = ({ label, value, change, changeType = 'neutral', icon, className = '' }) => (
  <div className={`stat-card ${className}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-micro text-muted">{label}</span>
      {icon && <span className="text-dim">{icon}</span>}
    </div>
    <div className="text-title text-main text-price">{value}</div>
    {change !== undefined && (
      <div className={`text-caption mt-1 ${
        changeType === 'positive' ? 'text-positive' :
        changeType === 'negative' ? 'text-negative' : 'text-muted'
      }`}>
        {changeType === 'positive' && '+'}
        {change}
      </div>
    )}
  </div>
);
