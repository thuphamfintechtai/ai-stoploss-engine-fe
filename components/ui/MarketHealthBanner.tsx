import React from 'react';
import { Banner } from './primitives';
import { useMarketHealth } from '../../hooks/useMarketHealth';

/**
 * MarketHealthBanner — renders a fixed top banner when VPBS market data API
 * is unavailable (circuit breaker open). Provides manual retry action.
 *
 * Phase 10 quick task: UX feedback during VPBS outages.
 */
export const MarketHealthBanner: React.FC = () => {
  const { state, resetCircuit } = useMarketHealth();

  if (state.isHealthy) return null;

  return (
    <Banner
      variant="warning"
      className="fixed top-0 left-0 right-0 z-toast"
    >
      <div className="flex items-center justify-between w-full">
        <span>Du lieu thi truong tam thoi khong kha dung. Tu dong thu lai sau 2 phut.</span>
        <button
          onClick={resetCircuit}
          className="text-caption underline ml-4 hover:text-main transition-colors"
        >
          Thu lai ngay
        </button>
      </div>
    </Banner>
  );
};

export default MarketHealthBanner;
