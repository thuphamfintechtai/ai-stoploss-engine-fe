import React from 'react';

interface SkeletonCardProps {
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-white/5 rounded-[var(--radius-md)] ${className}`}
      style={{ minHeight: 80 }}
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
          <div
            key={col}
            className="animate-pulse bg-white/5 h-3 rounded flex-1"
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 px-3 py-2">
          {[1, 2, 3, 4].map((col) => (
            <div
              key={col}
              className="animate-pulse bg-white/5 h-4 rounded flex-1"
            />
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
          className="animate-pulse bg-white/5 h-3 rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
};
