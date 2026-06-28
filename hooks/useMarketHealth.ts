import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';

/**
 * useMarketHealth — circuit breaker pattern for VPBS market data API.
 * Tracks consecutive failures and pauses polling when threshold exceeded.
 * Singleton state shared across all consumers to avoid duplicate tracking.
 *
 * Phase 10 quick task: stop console spam from 500 errors during VPBS outages.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketHealthState {
  isHealthy: boolean;           // false when circuit is open
  consecutiveFailures: number;  // count of failures
  circuitOpenUntil: number | null; // timestamp when circuit will close
  lastError: string | null;     // last error message for banner
}

// ─── Circuit Breaker Config ───────────────────────────────────────────────────

const FAILURE_THRESHOLD = 3;              // open circuit after 3 consecutive failures
const CIRCUIT_OPEN_DURATION_MS = 120_000; // 2 minutes

// ─── Singleton State (module-level) ───────────────────────────────────────────

let state: MarketHealthState = {
  isHealthy: true,
  consecutiveFailures: 0,
  circuitOpenUntil: null,
  lastError: null,
};

// Subscribers for external store pattern
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function getSnapshot(): MarketHealthState {
  return state;
}

// Auto-reset timer ref (module-level)
let resetTimer: ReturnType<typeof setTimeout> | null = null;

// ─── State Mutators ───────────────────────────────────────────────────────────

function recordSuccess() {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  state = {
    isHealthy: true,
    consecutiveFailures: 0,
    circuitOpenUntil: null,
    lastError: null,
  };
  notify();
}

function recordFailure(errorMessage: string) {
  const newFailures = state.consecutiveFailures + 1;

  if (newFailures >= FAILURE_THRESHOLD) {
    // Open circuit
    const circuitOpenUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
    state = {
      isHealthy: false,
      consecutiveFailures: newFailures,
      circuitOpenUntil,
      lastError: errorMessage,
    };

    // Schedule auto-reset when circuit closes
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      // Half-open: allow one retry by resetting to healthy
      state = {
        ...state,
        isHealthy: true,
        circuitOpenUntil: null,
      };
      notify();
    }, CIRCUIT_OPEN_DURATION_MS);
  } else {
    // Not yet at threshold, just increment
    state = {
      ...state,
      consecutiveFailures: newFailures,
      lastError: errorMessage,
    };
  }
  notify();
}

function shouldSkipRequest(): boolean {
  if (!state.circuitOpenUntil) return false;
  return Date.now() < state.circuitOpenUntil;
}

function resetCircuit() {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  state = {
    isHealthy: true,
    consecutiveFailures: 0,
    circuitOpenUntil: null,
    lastError: null,
  };
  notify();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarketHealth() {
  // useSyncExternalStore ensures all consumers share the same state and re-render together
  const currentState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    state: currentState,
    recordSuccess,
    recordFailure,
    shouldSkipRequest,
    resetCircuit,
  };
}

export default useMarketHealth;
