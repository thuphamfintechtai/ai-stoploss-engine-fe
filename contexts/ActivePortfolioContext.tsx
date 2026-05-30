import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { portfolioApi } from '../services/api';
import type { PortfolioType } from '../utils/portfolioPresets';

/**
 * ActivePortfolioContext (Phase 8 — MP-04).
 *
 * Quản lý activePortfolioId + danh sách portfolios.
 * Persist activePortfolioId qua localStorage `tradeguard_active_portfolio_id`.
 * Hydration validate stored ID còn tồn tại trong danh sách (đề phòng portfolio đã xoá).
 */

export interface Portfolio {
  id: string;
  name: string;
  portfolio_type: PortfolioType;
  total_balance: number | string;
  available_cash: number | string;
  pending_settlement_cash?: number | string;
  pending_buy_lock?: number | string;
  max_risk_percent: number | string;
  expected_return_percent: number | string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  // Allow extension — model has extra columns (preset_label, etc.)
  [key: string]: any;
}

interface ActivePortfolioContextValue {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  activePortfolio: Portfolio | null;
  setActivePortfolioId: (id: string) => void;
  refreshPortfolios: () => Promise<Portfolio[]>;
  isLoading: boolean;
  error: string | null;
}

const STORAGE_KEY = 'tradeguard_active_portfolio_id';

function readStoredId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota/permission */
  }
}

const ActivePortfolioContext = createContext<ActivePortfolioContextValue | null>(null);

export const ActivePortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const setActivePortfolioId = useCallback((id: string) => {
    setActivePortfolioIdState(id);
    writeStoredId(id);
  }, []);

  const refreshPortfolios = useCallback(async (): Promise<Portfolio[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await portfolioApi.getAll();
      if (res?.data?.success && Array.isArray(res.data.data)) {
        const list = res.data.data as Portfolio[];
        setPortfolios(list);

        // Hydrate active ID — validate stored ID còn tồn tại; fallback portfolios[0]
        const stored = readStoredId();
        const validStored = stored && list.some((p) => p.id === stored);
        const pick = validStored ? (stored as string) : list[0]?.id ?? null;

        if (pick) {
          setActivePortfolioIdState(pick);
          writeStoredId(pick);
        } else {
          setActivePortfolioIdState(null);
          writeStoredId(null);
        }
        return list;
      }
      setPortfolios([]);
      setActivePortfolioIdState(null);
      writeStoredId(null);
      return [];
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Không tải được danh mục';
      setError(msg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load — chỉ fetch khi có auth_token
  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? (() => {
            try {
              return window.localStorage.getItem('auth_token');
            } catch {
              return null;
            }
          })()
        : null;
    if (token) {
      refreshPortfolios();
    } else {
      setIsLoading(false);
    }
  }, [refreshPortfolios]);

  // Lắng nghe sự kiện auth:logout → reset state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      setPortfolios([]);
      setActivePortfolioIdState(null);
      writeStoredId(null);
      setError(null);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) || null;

  const value: ActivePortfolioContextValue = {
    portfolios,
    activePortfolioId,
    activePortfolio,
    setActivePortfolioId,
    refreshPortfolios,
    isLoading,
    error,
  };

  return (
    <ActivePortfolioContext.Provider value={value}>
      {children}
    </ActivePortfolioContext.Provider>
  );
};

export function useActivePortfolio(): ActivePortfolioContextValue {
  const ctx = useContext(ActivePortfolioContext);
  if (!ctx) {
    throw new Error('useActivePortfolio must be used within ActivePortfolioProvider');
  }
  return ctx;
}
