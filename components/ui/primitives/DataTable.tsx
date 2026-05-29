import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T, index: number) => string | number;
  variant?: 'default' | 'dense' | 'striped';
  stickyHeader?: boolean;
  onRowClick?: (row: T, index: number) => void;
  emptyMessage?: string;
  loading?: boolean;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  className?: string;
  rowClassName?: (row: T, index: number) => string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  variant = 'default',
  stickyHeader = true,
  onRowClick,
  emptyMessage = 'Không có dữ liệu',
  loading = false,
  sortKey,
  sortDirection,
  onSort,
  className = '',
  rowClassName,
}: DataTableProps<T>) {
  const variantClass = variant === 'dense' ? 'data-table-dense' : variant === 'striped' ? 'data-table-striped' : '';

  if (loading) {
    return (
      <div className={`data-table ${variantClass} ${className}`}>
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>
                  <div className="skeleton h-4 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key}>
                    <div className="skeleton h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg className="w-12 h-12 text-dim mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p className="text-body text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto dense-scroll ${className}`}>
      <table className={`data-table ${variantClass}`}>
        <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';

              return (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`${alignClass} ${col.sortable ? 'cursor-pointer select-none hover:text-main' : ''} ${col.className || ''}`}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && isSorted && (
                      <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            const rowKey = keyExtractor(row, index);
            const extraClass = rowClassName?.(row, index) || '';

            return (
              <tr
                key={rowKey}
                className={`${onRowClick ? 'cursor-pointer' : ''} ${extraClass}`}
                onClick={() => onRowClick?.(row, index)}
              >
                {columns.map((col) => {
                  const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                  const value = col.render
                    ? col.render(row, index)
                    : (row as Record<string, unknown>)[col.key];

                  return (
                    <td key={col.key} className={`${alignClass} ${col.className || ''}`}>
                      {value as React.ReactNode}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const TableCell: React.FC<{
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
  className?: string;
}> = ({ children, mono, muted, className = '' }) => (
  <span className={`${mono ? 'text-price' : ''} ${muted ? 'text-muted' : ''} ${className}`}>
    {children}
  </span>
);

export const PriceCell: React.FC<{
  value: number;
  change?: number;
  decimals?: number;
}> = ({ value, change, decimals = 0 }) => {
  const colorClass = change && change > 0 ? 'text-positive' : change && change < 0 ? 'text-negative' : 'text-main';

  return (
    <span className={`text-price ${colorClass}`}>
      {value.toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
};

export const ChangeCell: React.FC<{
  value: number;
  showPercent?: boolean;
  showSign?: boolean;
}> = ({ value, showPercent = false, showSign = true }) => {
  const isPositive = value > 0;
  const colorClass = isPositive ? 'text-positive' : value < 0 ? 'text-negative' : 'text-muted';
  const sign = showSign && isPositive ? '+' : '';
  const display = showPercent ? `${sign}${value.toFixed(2)}%` : `${sign}${value.toLocaleString('vi-VN')}`;

  return <span className={`text-price ${colorClass}`}>{display}</span>;
};
