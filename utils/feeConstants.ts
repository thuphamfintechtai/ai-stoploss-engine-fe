/**
 * Fee constants — fallback khi portfolio config missing (MAP-04).
 *
 * Source of truth: `financial.portfolios.buy_fee_percent / sell_fee_percent / sell_tax_percent`
 * backend (migration 006). Components PHẢI consume qua portfolio prop.
 * Constants này chỉ là safety net, KHÔNG dùng inline magic number trong components.
 */

export const DEFAULT_BUY_FEE_PCT = 0.0015; // 0.15%
export const DEFAULT_SELL_FEE_PCT = 0.0015; // 0.15%
export const DEFAULT_SELL_TAX_PCT = 0.001; // 0.10%

export interface FeeRates {
  buyFeePct: number;
  sellFeePct: number;
  sellTaxPct: number;
}

export interface PortfolioFeeConfig {
  buy_fee_percent?: number | string | null;
  sell_fee_percent?: number | string | null;
  sell_tax_percent?: number | string | null;
}

/**
 * Safe-parse một giá trị thành fee percent dương. Trả về fallback nếu invalid / non-finite / <= 0.
 * DB DECIMAL có thể trả string từ pg → cần coerce qua Number().
 */
function safePct(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Resolve fee rates cho component. Ưu tiên portfolio config, fallback default constants.
 *
 * @param portfolio - Portfolio fee config từ API (có thể null/undefined khi chưa load).
 * @returns FeeRates với 3 rate đã safe-parse (luôn là number dương).
 */
export function resolveFeeRates(portfolio?: PortfolioFeeConfig | null): FeeRates {
  return {
    buyFeePct: safePct(portfolio?.buy_fee_percent, DEFAULT_BUY_FEE_PCT),
    sellFeePct: safePct(portfolio?.sell_fee_percent, DEFAULT_SELL_FEE_PCT),
    sellTaxPct: safePct(portfolio?.sell_tax_percent, DEFAULT_SELL_TAX_PCT),
  };
}
