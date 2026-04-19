import { useEffect, useMemo, useState } from 'react';
import {
  type Exchange, type SessionName,
  getTickSizeVnd, validateLotSize as validateLot,
  validatePriceInBandVnd,
  getMarketSession, isMarketOpen,
  getPriceBandVnd,
} from '../utils/vnStockRules';

export interface MarketRules {
  tickSize: (priceVnd: number) => number;
  validateLot: (qty: number) => { ok: boolean; reason?: string };
  validatePrice: (priceVnd: number, refVnd: number) => { ok: boolean; reason?: string };
  session: SessionName;
  isOpen: boolean;
  priceBand: (refVnd: number) => { floor: number; ceiling: number };
}

/**
 * Hook consume vnMarketRules VND-native.
 * Session + isOpen re-compute mỗi 30s (setInterval cleanup on unmount).
 * Helper functions memoize theo `exchange` — chỉ re-create khi exchange đổi.
 */
export function useMarketRules(exchange: Exchange): MarketRules {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return useMemo<MarketRules>(() => ({
    tickSize: (priceVnd: number) => getTickSizeVnd(priceVnd, exchange),
    validateLot: (qty: number) => validateLot(qty, exchange),
    validatePrice: (priceVnd: number, refVnd: number) =>
      validatePriceInBandVnd(priceVnd, exchange, refVnd),
    session: getMarketSession(exchange, now),
    isOpen: isMarketOpen(exchange, now),
    priceBand: (refVnd: number) => {
      const b = getPriceBandVnd(refVnd, exchange);
      return { floor: b.floor, ceiling: b.ceiling };
    },
  }), [exchange, now]);
}

export default useMarketRules;
