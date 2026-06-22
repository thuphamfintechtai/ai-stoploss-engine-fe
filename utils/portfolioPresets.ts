/**
 * Portfolio Type Presets (Phase 8 — MP-02 FE mirror).
 *
 * SYNC WITH: ai-stoploss-engine-be/services/portfolio/portfolioPresets.js
 * Source of truth là BE; đây là FE mirror cho preset card rendering (không cần API call).
 *
 * Khi BE thay đổi numeric values → cập nhật ở đây để FE preview khớp với behavior backend.
 */

export type PortfolioType = 'LONG_TERM' | 'SWING' | 'DAY_TRADE';

export interface PortfolioPreset {
  label: string;
  description: string;
  max_risk_percent: number;
  expected_return_percent: number;
  sl_atr_multiplier: number;
  holding_horizon_days: number;
  ai_strategy_hint: string;
  icon: string;
  risk_label: string;
}

export const PORTFOLIO_PRESETS: Record<PortfolioType, PortfolioPreset> = {
  LONG_TERM: {
    label: 'Đầu tư dài hạn',
    description: 'Mua giữ blue-chip, SL rộng, ít giao dịch',
    max_risk_percent: 2.0,
    expected_return_percent: 12.0,
    sl_atr_multiplier: 2.75,
    holding_horizon_days: 90,
    ai_strategy_hint: 'long-term value investing, wide SL, focus on fundamentals',
    icon: '🏛️',
    risk_label: 'Rủi ro thấp',
  },
  SWING: {
    label: 'Swing trade',
    description: 'Giữ vài tuần, SL trung bình, balanced risk',
    max_risk_percent: 2.5,
    expected_return_percent: 25.0,
    sl_atr_multiplier: 1.75,
    holding_horizon_days: 14,
    ai_strategy_hint: 'swing trading, balanced SL, weekly horizon',
    icon: '📊',
    risk_label: 'Rủi ro trung bình',
  },
  DAY_TRADE: {
    label: 'Lướt sóng / Day trade',
    description: 'Giữ trong ngày-vài ngày, SL hẹp, target nhanh',
    max_risk_percent: 4.0,
    expected_return_percent: 40.0,
    sl_atr_multiplier: 1.0,
    holding_horizon_days: 3,
    ai_strategy_hint: 'short-term momentum, tight SL, quick TP',
    icon: '⚡',
    risk_label: 'Rủi ro cao',
  },
};

export const PRESET_KEYS: PortfolioType[] = ['LONG_TERM', 'SWING', 'DAY_TRADE'];

export function getPresetLabel(type: PortfolioType | string | null | undefined): string {
  if (!type || !(type in PORTFOLIO_PRESETS)) return 'Danh mục';
  return PORTFOLIO_PRESETS[type as PortfolioType].label;
}

export function isValidPortfolioType(type: unknown): type is PortfolioType {
  return typeof type === 'string' && type in PORTFOLIO_PRESETS;
}

export function getPresetIcon(type: PortfolioType | string | null | undefined): string {
  if (!type || !(type in PORTFOLIO_PRESETS)) return '📁';
  return PORTFOLIO_PRESETS[type as PortfolioType].icon;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9 PHS-04 — Data Scope Selector (FE mirror)
// Source of truth: ai-stoploss-engine-be/services/portfolio/portfolioPresets.js
// ─────────────────────────────────────────────────────────────────────────────

export type IndicatorSetName = 'DAY' | 'SWING' | 'LONG';

export interface DataScope {
  timeframe: '5m' | '1D';
  history_bars: number;
  indicator_set: IndicatorSetName;
  extra_sources: readonly string[];
  prompt_token_budget: number;
}

export const DATA_SCOPE: Readonly<Record<PortfolioType, DataScope>> = Object.freeze({
  LONG_TERM: Object.freeze({
    timeframe: '1D' as const,
    history_bars: 250,
    indicator_set: 'LONG' as const,
    extra_sources: Object.freeze(['valuation', 'sector_metrics', 'macro_quarterly']) as readonly string[],
    prompt_token_budget: 2000,
  }),
  SWING: Object.freeze({
    timeframe: '1D' as const,
    history_bars: 60,
    indicator_set: 'SWING' as const,
    extra_sources: Object.freeze(['sector_label', 'news_7d']) as readonly string[],
    prompt_token_budget: 1200,
  }),
  DAY_TRADE: Object.freeze({
    timeframe: '5m' as const,
    history_bars: 200,
    indicator_set: 'DAY' as const,
    extra_sources: Object.freeze(['news_24h']) as readonly string[],
    prompt_token_budget: 600,
  }),
});

/**
 * Lookup data scope by portfolio type. Invalid input → SWING fallback.
 * Mirror of BE getDataScope — keep shape in sync.
 *
 * Used by PHS-10 DataDepthChip to render text like "5m · 200 bars · Tin 24h".
 */
export function getDataScope(type: PortfolioType | string | null | undefined): DataScope {
  if (!isValidPortfolioType(type)) return DATA_SCOPE.SWING;
  return DATA_SCOPE[type as PortfolioType];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9 PHS-10 — DataDepthChip display helper
// ─────────────────────────────────────────────────────────────────────────────

const EXTRA_SOURCE_LABELS: Record<string, string> = {
  news_24h: 'Tin 24h',
  news_7d: 'Tin 7 ngày',
  sector_label: 'Ngành',
  valuation: 'P/E',
  sector_metrics: 'Ngành',
  macro_quarterly: 'Macro',
};

/**
 * Format data scope for display in DataDepthChip.
 * Example: "1D · 60 bars · Ngành" (SWING)
 *          "5m · 200 bars · Tin 24h" (DAY_TRADE)
 *          "1D · 250 bars · P/E + Ngành + Macro" (LONG_TERM)
 */
export function formatDataScopeForDisplay(scope: Pick<DataScope, 'timeframe' | 'history_bars' | 'extra_sources'>): string {
  const sourceLabels = [...scope.extra_sources]
    .map(s => EXTRA_SOURCE_LABELS[s] || s)
    .filter((v, i, a) => a.indexOf(v) === i) // dedupe
    .join(' + ');

  return `${scope.timeframe} · ${scope.history_bars} bars · ${sourceLabels}`;
}
