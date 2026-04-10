/**
 * Quy tắc nghiệp vụ thị trường chứng khoán Việt Nam (HOSE / HNX / UPCOM).
 * File thuần TypeScript, không có React dependency.
 */

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

// ─── Bước giá (Tick size) ──────────────────────────────────────────────────

/**
 * Tính bước giá (tick size) theo đơn vị ĐIỂM (nghìn đồng).
 * HOSE: <10 → 0.01 ; 10–50 → 0.05 ; ≥50 → 0.1
 * HNX / UPCOM: 0.1 cố định
 */
export function getPriceStep(priceInPoints: number, exchange: Exchange): number {
  const ex = (exchange || 'HOSE').toUpperCase();
  if (ex === 'HNX' || ex === 'UPCOM') return 0.1;
  if (priceInPoints < 10) return 0.01;
  if (priceInPoints < 50) return 0.05;
  return 0.1;
}

/** Làm tròn giá về bước giá gần nhất hợp lệ. */
export function snapToTickSize(price: number, exchange: Exchange): number {
  const step = getPriceStep(price, exchange);
  return Math.round(Math.round(price / step) * step * 10000) / 10000;
}

/** Tăng giá 1 bước theo tick size. */
export function stepPriceUp(price: number, exchange: Exchange): number {
  const step = getPriceStep(price, exchange);
  return snapToTickSize(price + step, exchange);
}

/** Giảm giá 1 bước theo tick size. */
export function stepPriceDown(price: number, exchange: Exchange): number {
  const step = getPriceStep(price, exchange);
  return snapToTickSize(price - step, exchange);
}

// ─── Lô giao dịch ─────────────────────────────────────────────────────────

/** Kích thước 1 lô: HOSE/HNX = 100 CP, UPCOM = 1 CP. */
export function getLotSize(exchange: Exchange): number {
  return (exchange || 'HOSE').toUpperCase() === 'UPCOM' ? 1 : 100;
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

// ─── Phiên giao dịch ───────────────────────────────────────────────────────

/** Trả về phiên giao dịch hiện tại theo giờ Việt Nam (UTC+7). */
export function getCurrentSession(exchange: Exchange, now?: Date): TradingSession {
  const ex = (exchange || 'HOSE').toUpperCase();
  const d = now ?? new Date();
  const vnTime = new Date(d.getTime() + 7 * 3600_000);
  const day = vnTime.getUTCDay(); // 0=CN, 6=T7

  if (day === 0 || day === 6) {
    return { name: 'CLOSED', label: 'Đóng cửa (cuối tuần)', colorCls: 'text-text-dim' };
  }

  const h = vnTime.getUTCHours();
  const m = vnTime.getUTCMinutes();
  const t = h * 60 + m;

  if (ex === 'HOSE') {
    if (t < 8 * 60 + 45)  return { name: 'PRE_OPEN',     label: 'Chưa mở cửa',              colorCls: 'text-text-dim' };
    if (t < 9 * 60)        return { name: 'ATO',           label: 'ATO 8:45–9:00',             colorCls: 'text-warning' };
    if (t < 11 * 60 + 30)  return { name: 'CONTINUOUS_1', label: 'Liên tục 9:00–11:30',       colorCls: 'text-positive' };
    if (t < 13 * 60)       return { name: 'LUNCH',         label: 'Nghỉ trưa 11:30–13:00',    colorCls: 'text-text-dim' };
    if (t < 14 * 60 + 30)  return { name: 'CONTINUOUS_2', label: 'Liên tục 13:00–14:30',      colorCls: 'text-positive' };
    if (t < 14 * 60 + 45)  return { name: 'ATC',           label: 'ATC 14:30–14:45',           colorCls: 'text-warning' };
    if (t < 15 * 60)       return { name: 'PUT_THROUGH',  label: 'Thỏa thuận 14:45–15:00',    colorCls: 'text-accent' };
    return { name: 'CLOSED', label: 'Đóng cửa', colorCls: 'text-text-dim' };
  }

  if (ex === 'HNX') {
    if (t < 9 * 60)        return { name: 'PRE_OPEN',     label: 'Chưa mở cửa',              colorCls: 'text-text-dim' };
    if (t < 9 * 60 + 15)   return { name: 'ATO',           label: 'ATO 9:00–9:15',             colorCls: 'text-warning' };
    if (t < 11 * 60 + 30)  return { name: 'CONTINUOUS_1', label: 'Liên tục 9:15–11:30',       colorCls: 'text-positive' };
    if (t < 13 * 60)       return { name: 'LUNCH',         label: 'Nghỉ trưa 11:30–13:00',    colorCls: 'text-text-dim' };
    if (t < 14 * 60 + 30)  return { name: 'CONTINUOUS_2', label: 'Liên tục 13:00–14:30',      colorCls: 'text-positive' };
    if (t < 14 * 60 + 45)  return { name: 'ATC',           label: 'ATC 14:30–14:45',           colorCls: 'text-warning' };
    if (t < 15 * 60)       return { name: 'PUT_THROUGH',  label: 'Thỏa thuận 14:45–15:00',    colorCls: 'text-accent' };
    return { name: 'CLOSED', label: 'Đóng cửa', colorCls: 'text-text-dim' };
  }

  // UPCOM
  if (t < 9 * 60)        return { name: 'PRE_OPEN',     label: 'Chưa mở cửa',           colorCls: 'text-text-dim' };
  if (t < 11 * 60 + 30)  return { name: 'CONTINUOUS_1', label: 'Liên tục 9:00–11:30',    colorCls: 'text-positive' };
  if (t < 13 * 60)       return { name: 'LUNCH',         label: 'Nghỉ trưa 11:30–13:00', colorCls: 'text-text-dim' };
  if (t < 14 * 60 + 30)  return { name: 'CONTINUOUS_2', label: 'Liên tục 13:00–14:30',   colorCls: 'text-positive' };
  if (t < 15 * 60)       return { name: 'PUT_THROUGH',  label: 'Thỏa thuận 14:30–15:00', colorCls: 'text-accent' };
  return { name: 'CLOSED', label: 'Đóng cửa', colorCls: 'text-text-dim' };
}

// ─── Loại lệnh hợp lệ theo phiên + sàn ────────────────────────────────────

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

  // Lệnh rỗ chỉ giao dịch trong phiên thỏa thuận
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
  orderType: OrderTypeCode,
): boolean {
  const { name } = session;
  if (name === 'CLOSED' || name === 'PRE_OPEN' || name === 'LUNCH') return false;
  if (isOddLotOrder && name !== 'PUT_THROUGH') return false;
  return true;
}

// ─── Thông tin loại lệnh ───────────────────────────────────────────────────

export const ORDER_TYPE_INFO: Record<OrderTypeCode, { label: string; desc: string; requiresPrice: boolean }> = {
  LO:  { label: 'LO',  desc: 'Giới hạn – nhập giá cụ thể',          requiresPrice: true  },
  ATO: { label: 'ATO', desc: 'Mở cửa – khớp giá mở cửa',            requiresPrice: false },
  ATC: { label: 'ATC', desc: 'Đóng cửa – khớp giá đóng cửa',        requiresPrice: false },
  MP:  { label: 'MP',  desc: 'Thị trường – chỉ HOSE',               requiresPrice: false },
  MOK: { label: 'MOK', desc: 'Khớp hết hoặc hủy – chỉ HNX',         requiresPrice: true  },
  MAK: { label: 'MAK', desc: 'Khớp một phần, hủy còn lại – chỉ HNX',requiresPrice: true  },
};

// ─── Validate giá ─────────────────────────────────────────────────────────

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
