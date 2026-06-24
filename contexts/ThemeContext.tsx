import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

/**
 * ThemeContext (Phase 10 — A-02).
 *
 * Single source of truth cho theme state ('dark' | 'light').
 * Persist vào localStorage key 'theme'. Broadcast qua context để tất cả
 * call sites (Sidebar, MobileBottomNav, SettingsView, chart components)
 * cùng update khi toggle — không còn desync 3 nơi như trước.
 *
 * Pattern mirror ActivePortfolioContext.tsx (createContext + Provider +
 * named hook throwing nếu gọi ngoài provider). Dùng useReducer theo
 * locked decision A-02 trong .planning/phases/10-fe-polish-ux-ui/10-CONTEXT.md.
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'dark';

type ThemeAction =
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'TOGGLE' };

interface ThemeState {
  theme: Theme;
}

function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case 'SET_THEME':
      return { theme: action.payload };
    case 'TOGGLE':
      return { theme: state.theme === 'dark' ? 'light' : 'dark' };
    default:
      return state;
  }
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function persistTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    /* ignore quota/permission */
  }
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(themeReducer, undefined, () => ({
    theme: readStoredTheme(),
  }));

  // Sync DOM + localStorage on every theme change (including initial mount)
  useEffect(() => {
    persistTheme(state.theme);
  }, [state.theme]);

  const setTheme = useCallback((t: Theme) => {
    dispatch({ type: 'SET_THEME', payload: t });
  }, []);

  const toggleTheme = useCallback(() => {
    dispatch({ type: 'TOGGLE' });
  }, []);

  const value: ThemeContextValue = {
    theme: state.theme,
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
