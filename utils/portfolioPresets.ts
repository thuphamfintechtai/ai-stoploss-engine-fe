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
