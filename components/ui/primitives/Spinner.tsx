import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => (
  <div className={`spinner ${size !== 'md' ? `spinner-${size}` : ''} ${className}`} role="status">
    <span className="sr-only">Đang tải...</span>
  </div>
);

export const LoadingOverlay: React.FC<{
  loading: boolean;
  children: React.ReactNode;
  message?: string;
}> = ({ loading, children, message }) => (
  <div className="relative">
    {children}
    {loading && (
      <div className="absolute inset-0 bg-overlay flex flex-col items-center justify-center gap-3 rounded-lg z-20">
        <Spinner size="lg" />
        {message && <p className="text-body-sm text-muted">{message}</p>}
      </div>
    )}
  </div>
);

export const PageLoader: React.FC<{ message?: string }> = ({ message = 'Đang tải...' }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
    <Spinner size="lg" />
    <p className="text-body text-muted">{message}</p>
  </div>
);

export const ButtonSpinner: React.FC = () => (
  <div className="spinner spinner-sm" />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`}>
    {[...Array(lines)].map((_, i) => (
      <div
        key={i}
        className="skeleton h-4"
        style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`card p-4 space-y-3 ${className}`}>
    <div className="skeleton h-5 w-1/3" />
    <div className="skeleton h-8 w-2/3" />
    <div className="skeleton h-4 w-1/2" />
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div className="space-y-2">
    <div className="flex gap-4 py-2">
      {[...Array(cols)].map((_, i) => (
        <div key={i} className="skeleton h-4 flex-1" />
      ))}
    </div>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="flex gap-4 py-3 border-b border-subtle">
        {[...Array(cols)].map((_, j) => (
          <div key={j} className="skeleton h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);
