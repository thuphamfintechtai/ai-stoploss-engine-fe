import React from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const icons: Record<AlertVariant, React.ReactNode> = {
  info: (
    <svg className="w-5 h-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-negative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  action,
  className = '',
}) => (
  <div className={`alert alert-${variant} ${className}`} role="alert">
    <div className="flex-shrink-0">{icons[variant]}</div>
    <div className="flex-1 min-w-0">
      {title && <p className="text-subheading text-main mb-1">{title}</p>}
      <div className="text-body-sm text-muted">{children}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
    {onClose && (
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded hover:bg-panel-hover transition-base"
        aria-label="Đóng"
      >
        <svg className="w-4 h-4 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

export const InlineAlert: React.FC<{
  variant?: AlertVariant;
  children: React.ReactNode;
}> = ({ variant = 'info', children }) => {
  const colorClasses = {
    info: 'text-info',
    success: 'text-positive',
    warning: 'text-warning',
    error: 'text-negative',
  };

  return (
    <div className={`flex items-center gap-2 text-body-sm ${colorClasses[variant]}`}>
      {icons[variant]}
      <span>{children}</span>
    </div>
  );
};

export const Banner: React.FC<{
  variant?: AlertVariant;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}> = ({ variant = 'info', children, onClose, className = '' }) => {
  const bgClasses = {
    info: 'bg-info-bg',
    success: 'bg-positive-bg',
    warning: 'bg-warning-bg',
    error: 'bg-negative-bg',
  };

  return (
    <div className={`${bgClasses[variant]} px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between gap-4 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          {icons[variant]}
          <span className="text-body-sm text-main">{children}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-panel-hover rounded transition-base">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
