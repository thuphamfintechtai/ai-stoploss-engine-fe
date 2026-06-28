/**
 * marketDataCache.ts — In-memory cache for VPBS market data with stale-while-error pattern.
 *
 * When API fails, returns cached (possibly stale) data instead of throwing.
 * This reduces error frequency and provides better UX during VPBS outages.
 *
 * Quick task 260628-l9c: Cache layer to complement circuit breaker.
 */

import { marketApi } from './api';

// ─── Cache Entry Type ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ─── In-Memory Cache Store ────────────────────────────────────────────────────

const cache = new Map<string, CacheEntry<any>>();

// ─── TTL Configuration (milliseconds) ─────────────────────────────────────────

const TTL = {
  PRICE: 30_000,           // 30 seconds for individual stock prices
  MARKET_INDEX: 60_000,    // 60 seconds for market indices
  INTRADAY_INDEX: 60_000,  // 60 seconds for intraday index data
  SYMBOL_DETAIL: 60_000,   // 60 seconds for symbol details
  STOCK_LIST: 120_000,     // 2 minutes for stock lists (less volatile)
};

// ─── Cache Helpers ────────────────────────────────────────────────────────────

function isFresh<T>(entry: CacheEntry<T> | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < entry.ttl;
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  return entry ? entry.data : null;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

// ─── Stale-While-Error Fetch Wrapper ──────────────────────────────────────────

async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<{ data: T; fromCache: boolean; stale: boolean }> {
  const cached = cache.get(key);
  const fresh = isFresh(cached);

  // If cache is fresh, return immediately
  if (fresh && cached) {
    return { data: cached.data, fromCache: true, stale: false };
  }

  // Try to fetch fresh data
  try {
    const data = await fetcher();
    setCache(key, data, ttl);
    return { data, fromCache: false, stale: false };
  } catch (error) {
    // On error, return stale cache if available
    if (cached) {
      return { data: cached.data, fromCache: true, stale: true };
    }
    // No cache available, rethrow
    throw error;
  }
}

// ─── Cached Market API Methods ────────────────────────────────────────────────

/**
 * Get stock price with cache. Returns stale data on API failure.
 */
export async function getCachedPrice(
  symbol: string,
  params?: { exchange?: string }
): Promise<{ data: any; fromCache: boolean; stale: boolean }> {
  const key = `price:${symbol}:${params?.exchange || ''}`;
  return fetchWithCache(
    key,
    async () => {
      const res = await marketApi.getPrice(symbol, params);
      return res.data;
    },
    TTL.PRICE
  );
}

/**
 * Get market index detail with cache. Returns stale data on API failure.
 */
export async function getCachedMarketIndexDetail(
  params?: { indexCode?: string }
): Promise<{ data: any; fromCache: boolean; stale: boolean }> {
  const indexCode = params?.indexCode || 'VNINDEX,VN30,VNXALL,HNX30';
  const key = `marketIndexDetail:${indexCode}`;
  return fetchWithCache(
    key,
    async () => {
      const res = await marketApi.getMarketIndexDetail(params);
      return res.data;
    },
    TTL.MARKET_INDEX
  );
}

/**
 * Get intraday indices with cache. Returns stale data on API failure.
 */
export async function getCachedIntradayIndices(
  codes?: string[]
): Promise<{ data: any; fromCache: boolean; stale: boolean }> {
  const key = `intradayIndices:${codes?.join(',') || 'default'}`;
  return fetchWithCache(
    key,
    async () => {
      const res = await marketApi.getIntradayIndices(codes);
      return res.data;
    },
    TTL.INTRADAY_INDEX
  );
}

/**
 * Get symbol detail with cache. Returns stale data on API failure.
 */
export async function getCachedSymbolDetail(
  symbol: string,
  params?: { exchange?: string }
): Promise<{ data: any; fromCache: boolean; stale: boolean }> {
  const key = `symbolDetail:${symbol}:${params?.exchange || ''}`;
  return fetchWithCache(
    key,
    async () => {
      const res = await marketApi.getSymbolDetail(symbol, params);
      return res.data;
    },
    TTL.SYMBOL_DETAIL
  );
}

/**
 * Get stock detail by index with cache. Returns stale data on API failure.
 */
export async function getCachedStockDetailByIndex(
  params?: { indexCode?: string; indexCodes?: string | string[]; pageNo?: number; pageSize?: number }
): Promise<{ data: any; fromCache: boolean; stale: boolean }> {
  const p = params || {};
  const indexCodesStr = Array.isArray(p.indexCodes) ? p.indexCodes.join(',') : (p.indexCodes ?? p.indexCode ?? 'VNXALL');
  const key = `stockDetailByIndex:${indexCodesStr}:${p.pageNo || 1}:${p.pageSize || 500}`;
  return fetchWithCache(
    key,
    async () => {
      const res = await marketApi.getStockDetailByIndex(params);
      return res.data;
    },
    TTL.STOCK_LIST
  );
}

// ─── Cache Management ─────────────────────────────────────────────────────────

/**
 * Clear all cached data. Call when user explicitly wants fresh data.
 */
export function clearMarketCache(): void {
  cache.clear();
}

/**
 * Clear cache for a specific symbol.
 */
export function clearSymbolCache(symbol: string): void {
  for (const key of cache.keys()) {
    if (key.includes(`:${symbol}:`)) {
      cache.delete(key);
    }
  }
}

/**
 * Get cache stats for debugging.
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

export default {
  getCachedPrice,
  getCachedMarketIndexDetail,
  getCachedIntradayIndices,
  getCachedSymbolDetail,
  getCachedStockDetailByIndex,
  clearMarketCache,
  clearSymbolCache,
  getCacheStats,
};
