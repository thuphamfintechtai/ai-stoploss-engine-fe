import { useCallback, useEffect, useState } from 'react';

/**
 * Phase 10 B-03 — Hash-based routing (no react-router).
 *
 * Single source of truth cho `currentView` state. Replace ad-hoc
 * `useState('home')` trong MainApp.
 *
 * - Hash format: `#viewId` (vd `#portfolio`, `#terminal`)
 * - Deep linking: refresh `/#portfolio` → PortfolioView mounts
 * - Fallback: unknown / empty hash → DEFAULT_VIEW ('home')
 */
export const VIEW_IDS = [
  'overview',
  'dashboard',
  'portfolio',
  'terminal',
  'watchlist',
  'market',
  'notifications',
  'settings',
  'signals',
  'home',
] as const;

export type ViewId = typeof VIEW_IDS[number];

const DEFAULT_VIEW: ViewId = 'home';

function parseHash(): ViewId {
  if (typeof window === 'undefined') return DEFAULT_VIEW;
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return (VIEW_IDS as readonly string[]).includes(raw) ? (raw as ViewId) : DEFAULT_VIEW;
}

export function useHashRoute(): [ViewId, (next: ViewId) => void] {
  const [view, setView] = useState<ViewId>(() => parseHash());

  useEffect(() => {
    const onHashChange = () => setView(parseHash());
    window.addEventListener('hashchange', onHashChange);
    // Sync hash với default on first mount nếu hash empty hoặc invalid.
    const currentHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (!currentHash || !(VIEW_IDS as readonly string[]).includes(currentHash)) {
      window.history.replaceState(null, '', `#${DEFAULT_VIEW}`);
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: ViewId) => {
    if (next === view) return;
    // Setting window.location.hash triggers 'hashchange' → setView via listener.
    window.location.hash = next;
  }, [view]);

  return [view, navigate];
}

export default useHashRoute;
