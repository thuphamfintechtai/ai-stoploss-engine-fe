import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...props
}) => {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="spinner spinner-sm" />
      ) : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
};

export const IconButton: React.FC<
  Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'children'> & {
    icon: React.ReactNode;
    'aria-label': string;
  }
> = ({ icon, size = 'md', className = '', ...props }) => {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  };

  return (
    <button
      className={`btn btn-ghost ${sizeClasses[size]} !p-0 ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
};

export const ButtonGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`flex gap-trading-sm ${className}`}>
    {children}
  </div>
);
