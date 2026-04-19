/**
 * Quy tắc thị trường VN — refactored Phase 2 để đồng bộ BE vnMarketRules.js.
 *
 * Unit convention:
 * - Internal logic: VND integer (khớp BE)
 * - Backward-compat API cũ: điểm (giá/1000) để TradingTerminal + existing consumers không break
 *
 * MIRROR rule tables với BE — nếu BE thay đổi, FE phải cập nhật (hardcoded, F0 chấp nhận).
 */

// ─── Types (giữ nguyên) ────────────────────────────────────────────────────

export type Exchange = 'HOSE' | 'HNX' | 'UPCOM' | string;
export type OrderTypeCode = 'LO' | 'ATO' | 'ATC' | 'MP' | 'MOK' | 'MAK';
export type SessionName =
  | 'PRE_OPEN'       // Trước giờ mở cửa
  | 'ATO'            // Khớp lệnh định kỳ mở cửa
  | 'CONTINUOUS_1'   // Liên tục buổi sáng
  | 'LUNCH'          // Nghỉ trưa
  | 'CONTINUOUS_2'   // Liên tục buổi chiều
  | 'ATC'            // Khớp lệnh định kỳ đóng cửa
  | 'PUT_THROUGH'    // Phiên thỏa thuận
  | 'CLOSED';        // Đóng cửa / cuối tuần

export interface TradingSession {
  name: SessionName;
  label: string;
  colorCls: string; // tailwind class
}

// ─── VND_RULES — mirror BE vnMarketRules.js (LOCKED) ───────────────────────

const TICK_TABLE_VND: Record<string, Array<{ maxPrice: number; tick: number }>> = {
  HOSE: [
    { maxPrice: 9_999,    tick: 10  },
    { maxPrice: 49_950,   tick: 50  },
    { maxPrice: Infinity, tick: 100 },
  ],
  HNX:   [{ maxPrice: Infinity, tick: 100 }],
  UPCOM: [{ maxPrice: Infinity, tick: 100 }],
};

const LOT_SIZE_CP: Record<string, number> = { HOSE: 100, HNX: 100, UPCOM: 100 };
const PRICE_BAND_PCT: Record<string, number> = { HOSE: 0.07, HNX: 0.10, UPCOM: 0.15 };

// Session boundaries theo phút-trong-ngày (VN time UTC+7).
// Format: [cutoffMinute, sessionName] — first-match-wins (minutes < cutoff).
const SESSION_TABLE: Record<string, Array<[number, SessionName]>> = {
  HOSE: [
    [ 9 * 60,       'PRE_OPEN'     ],
    [ 9 * 60 + 15,  'ATO'          ],
    [11 * 60 + 30,  'CONTINUOUS_1' ],
    [13 * 60,       'LUNCH'        ],
    [14 * 60 + 30,  'CONTINUOUS_2' ],
    [14 * 60 + 45,  'ATC'          ],
    [15 * 60,       'PUT_THROUGH'  ],
    [24 * 60,       'CLOSED'       ],
  ],
  HNX: [
    [ 9 * 60,       'PRE_OPEN'     ],
    [ 9 * 60 + 15,  'ATO'          ],
    [11 * 60 + 30,  'CONTINUOUS_1' ],
    [13 * 60,       'LUNCH'        ],
    [14 * 60 + 30,  'CONTINUOUS_2' ],
    [14 * 60 + 45,  'ATC'          ],
    [15 * 60,       'PUT_THROUGH'  ],
    [24 * 60,       'CLOSED'       ],
  ],
  UPCOM: [
    [ 9 * 60,       'PRE_OPEN'     ],
    [11 * 60 + 30,  'CONTINUOUS_1' ],
    [13 * 60,       'LUNCH'        ],
    [15 * 60,       'CONTINUOUS_2' ],
    [24 * 60,       'CLOSED'       ],
  ],
};

const OPEN_SESSIONS = new Set<SessionName>(['ATO', 'CONTINUOUS_1', 'CONTINUOUS_2', 'ATC']);

// ─── Error messages — Vietnamese user-facing (LOCKED, match BE) ────────────

export const ERRORS = {
  LOT_INVALID: 'Khối lượng phải là bội số 100 (tối thiểu 100 CP)',
  TICK_INVALID: (tick: number, exchange: string) =>
    `Giá phải là bội số ${tick}đ theo quy tắc sàn ${exchange}`,
  BAND_INVALID: (price: number, floor: number, ceiling: number, exchange: string) =>
    `Giá ${price.toLocaleString('vi-VN')}đ ngoài biên độ ngày. Sàn ${exchange} cho phép ${floor.toLocaleString('vi-VN')}-${ceiling.toLocaleString('vi-VN')}đ`,
  MARKET_CLOSED: (nextSession: string, time: string) =>
    `Thị trường đóng cửa. Phiên ${nextSession} mở lúc ${time}`,
};

// ─── VND-native helpers (NEW — đồng bộ BE vnMarketRules.js) ────────────────

/**
 * Tick size theo VND cho một mức giá + sàn.
 */
export function getTickSizeVnd(priceVnd: number, exchange: Exchange = 'HOSE'): number {
  const ex = (exchange || 'HOSE').toUpperCase();
  const rules = TICK_TABLE_VND[ex] ?? TICK_TABLE_VND.HOSE;
  const rule = rules.find(r => priceVnd <= r.maxPrice);
  return rule?.tick ?? 100;
}

/**
 * Snap giá VND về tick hợp lệ.
 */
export function snapToTickVnd(
  priceVnd: number,
  exchange: Exchange = 'HOSE',
  direction: 'nearest' | 'up' | 'down' = 'nearest',
): number {
  const tick = getTickSizeVnd(priceVnd, exchange);
  if (direction === 'up')   return Math.ceil(priceVnd / tick)  * tick;
  if (direction === 'down') return Math.floor(priceVnd / tick) * tick;
  return Math.round(priceVnd / tick) * tick;
}

/**
 * Kiểm tra giá VND có đúng tick không.
 */
export function isValidTickVnd(priceVnd: number, exchange: Exchange = 'HOSE'): boolean {
  return priceVnd === snapToTickVnd(priceVnd, exchange, 'nearest');
}

/**
 * Lô giao dịch theo sàn (CP) — 100 cho HOSE/HNX/UPCOM F0.
 */
export function getLotSizeVnd(exchange: Exchange = 'HOSE'): number {
  const ex = (exchange || 'HOSE').toUpperCase();
  return LOT_SIZE_CP[ex] ?? 100;
}

/**
 * Kiểm tra khối lượng hợp lệ (bội số lô).
 * Reuse cho cả VND-native và backward-compat (qty luôn là CP, không đổi đơn vị).
 */
export function validateLotSize(qty: number, exchange: Exchange = 'HOSE'): { ok: boolean; reason?: string } {
  const lot = getLotSizeVnd(exchange);
  if (!Number.isInteger(qty) || qty <= 0 || qty % lot !== 0) {
    return { ok: false, reason: ERRORS.LOT_INVALID };
  }
  return { ok: true };
}

/**
 * Biên độ giao dịch ngày (ceiling/floor) — snap về tick hợp lệ.
 * Ceiling snap DOWN để không vượt raw band, floor snap UP để không thấp hơn raw band.
 */
export function getPriceBandVnd(
  referenceVnd: number,
  exchange: Exchange = 'HOSE',
): { floor: number; ceiling: number; pct: number; reference: number } {
  const ex = (exchange || 'HOSE').toUpperCase();
  const pct = PRICE_BAND_PCT[ex] ?? 0.07;
  const rawFloor   = referenceVnd * (1 - pct);
  const rawCeiling = referenceVnd * (1 + pct);
  return {
    floor:     snapToTickVnd(Math.ceil(rawFloor),    exchange, 'up'),
    ceiling:   snapToTickVnd(Math.floor(rawCeiling), exchange, 'down'),
    pct,
    reference: referenceVnd,
  };
}

/**
 * Kiểm tra giá VND trong biên độ ngày.
 */
export function validatePriceInBandVnd(
  priceVnd: number,
  exchange: Exchange = 'HOSE',
  referenceVnd: number | null | undefined,
): { ok: boolean; reason?: string; floor?: number; ceiling?: number } {
  if (!referenceVnd || referenceVnd <= 0) return { ok: true };
  const ex = (exchange || 'HOSE').toUpperCase();
  const { floor, ceiling } = getPriceBandVnd(referenceVnd, exchange);
  if (priceVnd < floor || priceVnd > ceiling) {
    return {
      ok: false,
      reason: ERRORS.BAND_INVALID(priceVnd, floor, ceiling, ex),
      floor,
      ceiling,
    };
  }
  return { ok: true, floor, ceiling };
}

/**
 * Phút-trong-ngày theo VN time (UTC+7).
 */
function _minutesInVN(now?: Date): { day: number; minutes: number } {
  const d = now ?? new Date();
  const vnTime = new Date(d.getTime() + 7 * 3600_000);
  return {
    day: vnTime.getUTCDay(), // 0=CN, 6=T7
    minutes: vnTime.getUTCHours() * 60 + vnTime.getUTCMinutes(),
  };
}

/**
 * Phiên giao dịch hiện tại của sàn (match BE).
 */
export function getMarketSession(exchange: Exchange = 'HOSE', now?: Date): SessionName {
  const ex = (exchange || 'HOSE').toUpperCase();
  const { day, minutes } = _minutesInVN(now);
  if (day === 0 || day === 6) return 'CLOSED';
  const table = SESSION_TABLE[ex] ?? SESSION_TABLE.HOSE;
  for (const [cutoff, name] of table) {
    if (minutes < cutoff) return name;
  }
  return 'CLOSED';
}

/**
 * Thị trường có đang mở khớp lệnh không.
 */
export function isMarketOpen(exchange: Exchange = 'HOSE', now?: Date): boolean {
  return OPEN_SESSIONS.has(getMarketSession(exchange, now));
}

// ─── Backward-compat API (điểm-unit wrappers) ──────────────────────────────

/**
 * @deprecated Prefer getTickSizeVnd. Trả về tick size theo ĐIỂM (VND/1000).
 */
export function getPriceStep(priceInPoints: number, exchange: Exchange): number {
  const priceVnd = priceInPoints * 1000;
  return getTickSizeVnd(priceVnd, exchange) / 1000;
}

/**
 * @deprecated Prefer snapToTickVnd. Snap theo điểm (preserve 2-decimal output).
 */
export function snapToTickSize(price: number, exchange: Exchange): number {
  const priceVnd = price * 1000;
  const snappedVnd = snapToTickVnd(priceVnd, exchange, 'nearest');
  // Preserve 2-decimal điểm output (tick 10đ = 0.01 điểm, tick 50đ = 0.05, tick 100đ = 0.1)
  return Math.round(snappedVnd / 10) / 100;
}

/** Tăng giá 1 bước theo tick size (điểm). */
export function stepPriceUp(price: number, exchange: Exchange): number {
  const step = getPriceStep(price, exchange);
  return snapToTickSize(price + step, exchange);
}

/** Giảm giá 1 bước theo tick size (điểm). */
export function stepPriceDown(price: number, exchange: Exchange): number {
  const step = getPriceStep(price, exchange);
  return snapToTickSize(price - step, exchange);
}

/**
 * Kích thước 1 lô — FIXED Phase 2: HOSE/HNX/UPCOM = 100 CP (UPCOM FIX từ 1).
 * Lô lẻ (odd-lot) 1-99 CP có flow riêng, out-of-scope F0.
 */
export function getLotSize(exchange: Exchange): number {
  return getLotSizeVnd(exchange);
}

/** Kiểm tra xem khối lượng có phải lô lẻ không (không chia hết cho lotSize). */
export function isOddLotQty(qty: number, exchange: Exchange): boolean {
  const lot = getLotSize(exchange);
  return lot > 1 && qty > 0 && qty % lot !== 0;
}

/** Làm tròn khối lượng về bội số lô gần nhất (xuống). */
export function roundDownToLot(qty: number, exchange: Exchange): number {
  const lot = getLotSize(exchange);
  return Math.floor(qty / lot) * lot;
}

// ─── Session with label/colorCls (backward-compat UI) ──────────────────────

const SESSION_LABELS_HOSE: Record<SessionName, { label: string; colorCls: string }> = {
  PRE_OPEN:     { label: 'Chưa mở cửa',              colorCls: 'text-text-dim' },
  ATO:          { label: 'ATO 9:00–9:15',            colorCls: 'text-warning'  },
  CONTINUOUS_1: { label: 'Liên tục 9:15–11:30',      colorCls: 'text-positive' },
  LUNCH:        { label: 'Nghỉ trưa 11:30–13:00',    colorCls: 'text-text-dim' },
  CONTINUOUS_2: { label: 'Liên tục 13:00–14:30',     colorCls: 'text-positive' },
  ATC:          { label: 'ATC 14:30–14:45',          colorCls: 'text-warning'  },
  PUT_THROUGH:  { label: 'Thỏa thuận 14:45–15:00',   colorCls: 'text-accent'   },
  CLOSED:       { label: 'Đóng cửa',                 colorCls: 'text-text-dim' },
};

const SESSION_LABELS_UPCOM: Record<SessionName, { label: string; colorCls: string }> = {
  PRE_OPEN:     { label: 'Chưa mở cửa',              colorCls: 'text-text-dim' },
  ATO:          { label: 'ATO (N/A)',                colorCls: 'text-text-dim' },
  CONTINUOUS_1: { label: 'Liên tục 9:00–11:30',      colorCls: 'text-positive' },
  LUNCH:        { label: 'Nghỉ trưa 11:30–13:00',    colorCls: 'text-text-dim' },
  CONTINUOUS_2: { label: 'Liên tục 13:00–15:00',     colorCls: 'text-positive' },
  ATC:          { label: 'ATC (N/A)',                colorCls: 'text-text-dim' },
  PUT_THROUGH:  { label: 'Thỏa thuận (N/A)',         colorCls: 'text-text-dim' },
  CLOSED:       { label: 'Đóng cửa',                 colorCls: 'text-text-dim' },
};

/**
 * Session hiện tại với label + colorCls (backward-compat UI).
 */
export function getCurrentSession(exchange: Exchange, now?: Date): TradingSession {
  const name = getMarketSession(exchange, now);
  const ex = (exchange || 'HOSE').toUpperCase();
  const labels = ex === 'UPCOM' ? SESSION_LABELS_UPCOM : SESSION_LABELS_HOSE;
  return { name, ...labels[name] };
}

// ─── Order type logic (giữ nguyên logic cũ) ────────────────────────────────

/**
 * Trả về danh sách loại lệnh hợp lệ cho phiên + sàn hiện tại.
 * isOddLotOrder = true → chỉ giao dịch thỏa thuận, chỉ LO.
 */
export function getAvailableOrderTypes(
  exchange: Exchange,
  session: TradingSession,
  isOddLotOrder: boolean = false,
): OrderTypeCode[] {
  const ex = (exchange || 'HOSE').toUpperCase();
  const { name } = session;

  // Lệnh lô lẻ chỉ giao dịch trong phiên thỏa thuận
  if (isOddLotOrder) {
    return name === 'PUT_THROUGH' ? ['LO'] : [];
  }

  // Ngoài giờ: cho nhập form nhưng submit bị block
  if (name === 'PRE_OPEN' || name === 'LUNCH' || name === 'CLOSED') return ['LO'];

  if (ex === 'HOSE') {
    if (name === 'ATO') return ['LO', 'ATO'];
    if (name === 'CONTINUOUS_1' || name === 'CONTINUOUS_2') return ['LO', 'MP'];
    if (name === 'ATC') return ['LO', 'ATC'];
    if (name === 'PUT_THROUGH') return ['LO'];
  }

  if (ex === 'HNX') {
    if (name === 'ATO') return ['LO', 'ATO'];
    if (name === 'CONTINUOUS_1' || name === 'CONTINUOUS_2') return ['LO', 'MOK', 'MAK'];
    if (name === 'ATC') return ['LO', 'ATC'];
    if (name === 'PUT_THROUGH') return ['LO', 'MOK', 'MAK'];
  }

  // UPCOM: chỉ LO mọi phiên
  return ['LO'];
}

/** Kiểm tra có thể submit lệnh hay không (thị trường đang mở đúng phiên). */
export function canSubmitOrder(
  session: TradingSession,
  isOddLotOrder: boolean,
  _orderType: OrderTypeCode,
): boolean {
  const { name } = session;
  if (name === 'CLOSED' || name === 'PRE_OPEN' || name === 'LUNCH') return false;
  if (isOddLotOrder && name !== 'PUT_THROUGH') return false;
  return true;
}

// ─── Thông tin loại lệnh ───────────────────────────────────────────────────

export const ORDER_TYPE_INFO: Record<OrderTypeCode, { label: string; desc: string; requiresPrice: boolean }> = {
  LO:  { label: 'LO',  desc: 'Giới hạn – nhập giá cụ thể',           requiresPrice: true  },
  ATO: { label: 'ATO', desc: 'Mở cửa – khớp giá mở cửa',             requiresPrice: false },
  ATC: { label: 'ATC', desc: 'Đóng cửa – khớp giá đóng cửa',         requiresPrice: false },
  MP:  { label: 'MP',  desc: 'Thị trường – chỉ HOSE',                requiresPrice: false },
  MOK: { label: 'MOK', desc: 'Khớp hết hoặc hủy – chỉ HNX',          requiresPrice: true  },
  MAK: { label: 'MAK', desc: 'Khớp một phần, hủy còn lại – chỉ HNX', requiresPrice: true  },
};

// ─── validateLOPrice (điểm-unit, giữ nguyên API) ───────────────────────────

export interface PriceValidation {
  valid: boolean;
  snapTo?: number;          // gợi ý giá làm tròn nếu sai bước giá
  error?: string;
  warning?: string;
}

export function validateLOPrice(
  priceInPoints: number,
  exchange: Exchange,
  floorPrice: number | null,
  ceilPrice: number | null,
): PriceValidation {
  if (!Number.isFinite(priceInPoints) || priceInPoints <= 0) {
    return { valid: false, error: 'Giá không hợp lệ' };
  }
  if (floorPrice != null && priceInPoints < floorPrice - 0.001) {
    return { valid: false, error: `Giá thấp hơn Sàn (${floorPrice.toFixed(2)})` };
  }
  if (ceilPrice != null && priceInPoints > ceilPrice + 0.001) {
    return { valid: false, error: `Giá cao hơn Trần (${ceilPrice.toFixed(2)})` };
  }
  const snapped = snapToTickSize(priceInPoints, exchange);
  const step = getPriceStep(priceInPoints, exchange);
  if (Math.abs(snapped - priceInPoints) > 0.0001) {
    return {
      valid: false,
      snapTo: snapped,
      warning: `Giá không đúng bước (${step}). Làm tròn → ${snapped.toFixed(2)}?`,
    };
  }
  return { valid: true };
}
