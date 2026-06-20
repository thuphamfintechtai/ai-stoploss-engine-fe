import React from 'react';

interface SkeletonCardProps {
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ className = '', style }) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={style}
    />
  );
};

interface SkeletonTableProps {
  rows?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5 }) => {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-3 px-3 py-2">
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className="skeleton h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 px-3 py-2">
          {[1, 2, 3, 4].map((col) => (
            <div key={col} className="skeleton h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
};
