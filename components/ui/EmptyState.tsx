import React from 'react';

type EmptyStateVariant = 'default' | 'compact' | 'inline';
type EmptyStateTheme = 'neutral' | 'info' | 'warning' | 'error';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: EmptyStateVariant;
  theme?: EmptyStateTheme;
  className?: string;
}

const icons = {
  default: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  search: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  ),
  portfolio: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  notification: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
};

export const EmptyStateIcon = icons;

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default',
  theme = 'neutral',
  className = '',
}) => {
  const themeColors = {
    neutral: 'text-dim',
    info: 'text-info',
    warning: 'text-warning',
    error: 'text-negative',
  };

  const variantClasses = {
    default: 'py-12 px-6',
    compact: 'py-6 px-4',
    inline: 'py-4 px-4 flex-row gap-4 text-left',
  };

  const iconSizes = {
    default: 'w-12 h-12',
    compact: 'w-8 h-8',
    inline: 'w-6 h-6',
  };

  const isInline = variant === 'inline';

  return (
    <div
      className={`flex ${isInline ? 'flex-row items-center' : 'flex-col items-center justify-center text-center'} ${variantClasses[variant]} animate-fade-in ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={`${isInline ? '' : 'mb-4'} ${themeColors[theme]}`}>
        {icon ? (
          <div className={iconSizes[variant]}>{icon}</div>
        ) : (
          <div className={iconSizes[variant]}>{icons.default}</div>
        )}
      </div>
      <div className={isInline ? 'flex-1' : ''}>
        <h3 className={`font-semibold text-main ${variant === 'compact' ? 'text-body' : variant === 'inline' ? 'text-body-sm' : 'text-subheading'} ${isInline ? '' : 'mb-2'}`}>
          {title}
        </h3>
        {description && (
          <p className={`text-muted max-w-sm leading-relaxed ${variant === 'inline' ? 'text-caption' : 'text-body-sm mb-4'}`}>
            {description}
          </p>
        )}
      </div>
      {(actionLabel || secondaryActionLabel) && (
        <div className={`flex gap-3 ${isInline ? '' : 'mt-2'}`}>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="btn btn-primary btn-md"
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="btn btn-secondary btn-md"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}> = ({
  title = 'Đã xảy ra lỗi',
  message = 'Không thể tải dữ liệu. Vui lòng thử lại.',
  onRetry,
  retryLabel = 'Thử lại',
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center py-8 px-6 text-center animate-fade-in ${className}`} role="alert">
    <div className="w-12 h-12 rounded-full bg-negative-bg flex items-center justify-center mb-4">
      <svg className="w-6 h-6 text-negative" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <h3 className="text-subheading text-main mb-2">{title}</h3>
    <p className="text-body-sm text-muted max-w-sm mb-4">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn btn-secondary btn-md gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {retryLabel}
      </button>
    )}
  </div>
);

export const NoDataState: React.FC<{
  entity?: string;
  suggestion?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({
  entity = 'dữ liệu',
  suggestion,
  actionLabel,
  onAction,
}) => (
  <EmptyState
    icon={icons.default}
    title={`Chưa có ${entity}`}
    description={suggestion || `Bạn chưa có ${entity} nào. Hãy tạo mới để bắt đầu.`}
    actionLabel={actionLabel}
    onAction={onAction}
    variant="compact"
  />
);

export const NoSearchResults: React.FC<{
  query?: string;
  onClear?: () => void;
}> = ({ query, onClear }) => (
  <EmptyState
    icon={icons.search}
    title="Không tìm thấy kết quả"
    description={query ? `Không có kết quả nào cho "${query}". Thử tìm kiếm khác.` : 'Không có kết quả phù hợp với bộ lọc.'}
    actionLabel={onClear ? 'Xóa bộ lọc' : undefined}
    onAction={onClear}
    variant="compact"
  />
);
