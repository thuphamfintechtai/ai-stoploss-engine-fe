import { describe, it, expect } from 'vitest';
import {
  // VND-native
  getTickSizeVnd, snapToTickVnd, isValidTickVnd,
  getLotSizeVnd, validateLotSize, getPriceBandVnd, validatePriceInBandVnd,
  getMarketSession, isMarketOpen,
  // Backward-compat (điểm-unit)
  getPriceStep, snapToTickSize, getLotSize, isOddLotQty, getCurrentSession,
  ERRORS,
} from './vnStockRules';

// Helper: construct Date từ ISO string VN time (UTC+7).
const vnDate = (iso: string) => new Date(iso + '+07:00');

describe('VND-native parity với BE vnMarketRules', () => {
  it('HOSE tick boundaries match BE', () => {
    expect(getTickSizeVnd(5_000,  'HOSE')).toBe(10);   // < 10k
    expect(getTickSizeVnd(9_999,  'HOSE')).toBe(10);   // boundary upper
    expect(getTickSizeVnd(10_000, 'HOSE')).toBe(50);   // boundary+1
    expect(getTickSizeVnd(49_950, 'HOSE')).toBe(50);   // boundary upper
    expect(getTickSizeVnd(50_000, 'HOSE')).toBe(100);  // boundary+1
  });

  it('HNX/UPCOM tick always 100đ', () => {
    expect(getTickSizeVnd(5_000,  'HNX')).toBe(100);
    expect(getTickSizeVnd(100_000,'HNX')).toBe(100);
    expect(getTickSizeVnd(5_000,  'UPCOM')).toBe(100);
    expect(getTickSizeVnd(100_000,'UPCOM')).toBe(100);
  });

  it('snapToTickVnd direction nearest/up/down', () => {
    expect(snapToTickVnd(50_123, 'HOSE', 'nearest')).toBe(50_100);
    expect(snapToTickVnd(50_123, 'HOSE', 'up')).toBe(50_200);
    expect(snapToTickVnd(50_123, 'HOSE', 'down')).toBe(50_100);
  });

  it('isValidTickVnd verify boundary', () => {
    expect(isValidTickVnd(50_000, 'HOSE')).toBe(true);
    expect(isValidTickVnd(50_050, 'HOSE')).toBe(false);  // tick 100 bucket
    expect(isValidTickVnd(50_100, 'HOSE')).toBe(true);
  });

  it('HOSE price band reference 50_000 → [46_500, 53_500]', () => {
    const b = getPriceBandVnd(50_000, 'HOSE');
    expect(b.floor).toBe(46_500);
    expect(b.ceiling).toBe(53_500);
    expect(b.pct).toBe(0.07);
  });

  it('HOSE price band reference 14_250 → ceiling snap DOWN về tick 50 = 15_200', () => {
    // 14_250 × 1.07 = 15_247.5 raw → snap DOWN về tick 50 trong bucket 10k-49.95k = 15_200
    const b = getPriceBandVnd(14_250, 'HOSE');
    expect(b.ceiling).toBe(15_200);
  });

  it('validatePriceInBandVnd within band OK', () => {
    const r = validatePriceInBandVnd(52_000, 'HOSE', 50_000);
    expect(r.ok).toBe(true);
  });

  it('validatePriceInBandVnd out of band fails', () => {
    const r = validatePriceInBandVnd(60_000, 'HOSE', 50_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('ngoài biên độ ngày');
  });

  it('validateLotSize exact error message (match BE)', () => {
    const r = validateLotSize(99, 'HOSE');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('Khối lượng phải là bội số 100 (tối thiểu 100 CP)');
  });

  it('validateLotSize accepts multiple of 100', () => {
    expect(validateLotSize(100, 'HOSE').ok).toBe(true);
    expect(validateLotSize(500, 'HOSE').ok).toBe(true);
    expect(validateLotSize(1000, 'HOSE').ok).toBe(true);
  });

  it('Session 09:00 HOSE = ATO, 09:15 = CONTINUOUS_1 (boundary semantic)', () => {
    // Monday 2026-04-20
    expect(getMarketSession('HOSE', vnDate('2026-04-20T09:00:00'))).toBe('ATO');
    expect(getMarketSession('HOSE', vnDate('2026-04-20T09:14:59'))).toBe('ATO');
    expect(getMarketSession('HOSE', vnDate('2026-04-20T09:15:00'))).toBe('CONTINUOUS_1');
  });

  it('Session 14:30 HOSE = ATC, 14:45 = PUT_THROUGH', () => {
    expect(getMarketSession('HOSE', vnDate('2026-04-20T14:30:00'))).toBe('ATC');
    expect(getMarketSession('HOSE', vnDate('2026-04-20T14:45:00'))).toBe('PUT_THROUGH');
  });

  it('isMarketOpen weekend = false', () => {
    // Saturday 2026-04-18
    expect(isMarketOpen('HOSE', vnDate('2026-04-18T10:00:00'))).toBe(false);
    // Sunday 2026-04-19
    expect(isMarketOpen('HOSE', vnDate('2026-04-19T10:00:00'))).toBe(false);
  });

  it('isMarketOpen Monday during CONTINUOUS_1 = true', () => {
    expect(isMarketOpen('HOSE', vnDate('2026-04-20T10:00:00'))).toBe(true);
  });
});

describe('UPCOM lot size FIX (phase 2) — from 1 → 100', () => {
  it('getLotSize(UPCOM) = 100 (FIX từ 1 pre-Phase-2)', () => {
    expect(getLotSize('UPCOM')).toBe(100);
    expect(getLotSizeVnd('UPCOM')).toBe(100);
  });

  it('getLotSize HOSE/HNX = 100 (unchanged)', () => {
    expect(getLotSize('HOSE')).toBe(100);
    expect(getLotSize('HNX')).toBe(100);
  });

  it('isOddLotQty(50, UPCOM) = true (50 không chia hết 100)', () => {
    expect(isOddLotQty(50, 'UPCOM')).toBe(true);
    expect(isOddLotQty(100, 'UPCOM')).toBe(false);
    expect(isOddLotQty(150, 'UPCOM')).toBe(true);
  });

  it('validateLotSize UPCOM 50 → rejected (lô lẻ out-of-scope F0)', () => {
    expect(validateLotSize(50, 'UPCOM').ok).toBe(false);
    expect(validateLotSize(100, 'UPCOM').ok).toBe(true);
  });

  it('UPCOM 14:44 = CONTINUOUS_2 (UPCOM không có ATC)', () => {
    expect(getMarketSession('UPCOM', vnDate('2026-04-20T14:44:00'))).toBe('CONTINUOUS_2');
  });

  it('UPCOM 15:00 = CLOSED', () => {
    expect(getMarketSession('UPCOM', vnDate('2026-04-20T15:00:00'))).toBe('CLOSED');
  });

  it('UPCOM 09:00 = CONTINUOUS_1 (không có ATO)', () => {
    expect(getMarketSession('UPCOM', vnDate('2026-04-20T09:00:00'))).toBe('CONTINUOUS_1');
  });

  it('UPCOM price band reference 50_000 → ±15% snap DOWN (IEEE 754 float)', () => {
    // 50_000 × 1.15 = 57_499.999...9 (IEEE 754) → Math.floor = 57_499 → snap DOWN tick 100 = 57_400
    // 50_000 × 0.85 = 42_500.0 exact → Math.ceil = 42_500 → snap UP tick 100 = 42_500
    // Match BE parity (vnMarketRules.js same algo).
    const b = getPriceBandVnd(50_000, 'UPCOM');
    expect(b.pct).toBe(0.15);
    expect(b.floor).toBe(42_500);
    expect(b.ceiling).toBe(57_400);
  });
});

describe('Backward-compat điểm-unit API', () => {
  it('getPriceStep(72.5, HOSE) = 0.1 (điểm, ≥ 50k bucket)', () => {
    // 72.5 điểm = 72_500đ → tick 100đ → 0.1 điểm
    expect(getPriceStep(72.5, 'HOSE')).toBeCloseTo(0.1, 4);
  });

  it('getPriceStep(9, HOSE) = 0.01 (điểm, < 10k)', () => {
    expect(getPriceStep(9, 'HOSE')).toBeCloseTo(0.01, 4);
  });

  it('getPriceStep(25, HOSE) = 0.05 (điểm, bucket 10-50k)', () => {
    expect(getPriceStep(25, 'HOSE')).toBeCloseTo(0.05, 4);
  });

  it('getPriceStep(50, HOSE) = 0.1 (điểm, ≥ 50k)', () => {
    expect(getPriceStep(50, 'HOSE')).toBeCloseTo(0.1, 4);
  });

  it('snapToTickSize(72.51, HOSE) round về 72.50 (điểm)', () => {
    expect(snapToTickSize(72.51, 'HOSE')).toBeCloseTo(72.50, 4);
  });

  it('snapToTickSize(25.03, HOSE) round về 25.05 (điểm, tick 0.05)', () => {
    // 25.03 điểm = 25_030đ → tick 50đ → snap nearest = 25_050 → 25.05 điểm
    expect(snapToTickSize(25.03, 'HOSE')).toBeCloseTo(25.05, 4);
  });

  it('getCurrentSession returns label + colorCls (HOSE CONTINUOUS_1)', () => {
    const s = getCurrentSession('HOSE', vnDate('2026-04-20T09:30:00'));
    expect(s.name).toBe('CONTINUOUS_1');
    expect(s.label).toContain('Liên tục');
    expect(s.colorCls).toBe('text-positive');
  });

  it('getCurrentSession UPCOM CONTINUOUS_1 label', () => {
    const s = getCurrentSession('UPCOM', vnDate('2026-04-20T10:00:00'));
    expect(s.name).toBe('CONTINUOUS_1');
    expect(s.label).toContain('9:00');
  });

  it('getCurrentSession CLOSED weekend', () => {
    const s = getCurrentSession('HOSE', vnDate('2026-04-18T10:00:00'));
    expect(s.name).toBe('CLOSED');
    expect(s.colorCls).toBe('text-text-dim');
  });
});

describe('ERRORS table locked strings', () => {
  it('LOT_INVALID match BE exact', () => {
    expect(ERRORS.LOT_INVALID).toBe('Khối lượng phải là bội số 100 (tối thiểu 100 CP)');
  });

  it('TICK_INVALID formatter', () => {
    expect(ERRORS.TICK_INVALID(50, 'HOSE')).toBe('Giá phải là bội số 50đ theo quy tắc sàn HOSE');
  });

  it('BAND_INVALID formatter includes price, floor, ceiling, exchange', () => {
    const msg = ERRORS.BAND_INVALID(60_000, 46_500, 53_500, 'HOSE');
    expect(msg).toContain('ngoài biên độ ngày');
    expect(msg).toContain('HOSE');
  });

  it('MARKET_CLOSED formatter', () => {
    expect(ERRORS.MARKET_CLOSED('ATO', '09:00')).toBe('Thị trường đóng cửa. Phiên ATO mở lúc 09:00');
  });
});
