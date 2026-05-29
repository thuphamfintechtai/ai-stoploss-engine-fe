import React from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

const DefaultSeparator = () => (
  <svg className="w-4 h-4 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  separator = <DefaultSeparator />,
  className = '',
}) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-2 text-body-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isClickable = item.href || item.onClick;

          return (
            <li key={index} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-dim" aria-hidden="true">
                  {separator}
                </span>
              )}
              {isLast ? (
                <span className="text-main font-medium flex items-center gap-1.5" aria-current="page">
                  {item.icon}
                  {item.label}
                </span>
              ) : isClickable ? (
                <a
                  href={item.href}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                  className="text-muted hover:text-main transition-colors flex items-center gap-1.5"
                >
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <span className="text-muted flex items-center gap-1.5">
                  {item.icon}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, breadcrumbs, actions, className = '' }) => (
  <div className={`mb-6 ${className}`}>
    {breadcrumbs && breadcrumbs.length > 0 && (
      <Breadcrumbs items={breadcrumbs} className="mb-3" />
    )}
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-title text-main">{title}</h1>
        {subtitle && <p className="text-body text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  </div>
);
