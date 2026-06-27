import { useState, useEffect } from 'react';

/**
 * useDebounce — returns a debounced version of `value` that only updates
 * after `delayMs` of inactivity. Use for search/filter inputs to reduce
 * API calls or expensive computations.
 *
 * Phase 10 D-03. No lodash — minimal local implementation.
 */
export function useDebounce<T>(value: T, delayMs: number = 200): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default useDebounce;
