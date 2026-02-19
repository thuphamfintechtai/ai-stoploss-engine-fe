/**
 * Helper assertions - from TradingView lightweight-charts plugin-examples
 */
export function ensureDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Value is undefined');
  }
  return value;
}

export function ensureNotNull<T>(value: T | null): T {
  if (value === null) {
    throw new Error('Value is null');
  }
  return value;
}
