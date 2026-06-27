import React from 'react';
import { SkeletonCard } from './SkeletonLoader';

interface SkeletonViewProps {
  /** Number of skeleton row blocks to render. Default 4. */
  rows?: number;
  /** Optional className for outer container */
  className?: string;
}

/**
 * SkeletonView — full-page placeholder shown while a React.lazy() route
 * chunk loads. Used as Suspense fallback in MainApp routing.
 *
 * Phase 10 D-02.
 */
export const SkeletonView: React.FC<SkeletonViewProps> = ({ rows = 4, className = '' }) => (
  <div className={`p-4 space-y-3 ${className}`} role="status" aria-live="polite" aria-label="Đang tải nội dung">
    <SkeletonCard className="h-10 w-1/3" />
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonCard key={i} className="h-24" />
    ))}
  </div>
);
