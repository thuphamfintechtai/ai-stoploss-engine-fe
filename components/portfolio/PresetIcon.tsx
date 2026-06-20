import React from 'react';
import type { PortfolioType } from '../../utils/portfolioPresets';

interface Props {
  type: PortfolioType | string | null | undefined;
  size?: number;
  className?: string;
}

const ICON_PATHS: Record<PortfolioType, React.ReactNode> = {
  LONG_TERM: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 4l9 5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18" />
    </>
  ),
  SWING: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l5.5-5.5 4 4L21 5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5h6v6" />
    </>
  ),
  DAY_TRADE: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 2L4.5 13.5h5.5L11 22l8.5-11.5h-5.5L13 2z"
    />
  ),
};

export const PresetIcon: React.FC<Props> = ({ type, size = 24, className }) => {
  const path = type && type in ICON_PATHS ? ICON_PATHS[type as PortfolioType] : null;
  if (!path) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className={className}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
};
