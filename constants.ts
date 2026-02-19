// VN Stock Exchanges
export const EXCHANGES = {
  HOSE: 'HOSE',
  HNX: 'HNX',
  UPCOM: 'UPCOM',
} as const;

// Index codes for VPBS intraday API (dropdown on overview)
export const MARKET_INDEX_CODES = [
  { code: 'VNINDEX', name: 'VNINDEX' },
  { code: 'VN30', name: 'VN30' },
  { code: 'HNX', name: 'HNX' },
  { code: 'HNX30', name: 'HNX30' },
  { code: 'UPCOM', name: 'UPCOM' },
  { code: 'VNX50', name: 'VNX50' },
  { code: 'VNSI', name: 'VNSI' },
  { code: 'VNSML', name: 'VNSML' },
  { code: 'VNALL', name: 'VNALL' },
  { code: 'VNXALL', name: 'VNXALL' },
  { code: 'VNMID', name: 'VNMID' },
  { code: 'VN100', name: 'VN100' },
];

/** Nhóm "Một lựa chọn" trong dropdown bảng giá: cùng hệ thì nằm chung một nhóm */
export const SINGLE_CHOICE_GROUPS: { label: string; codes: string[] }[] = [
  { label: 'Chứng khoán cơ sở', codes: ['BOND', 'CQ', 'EF'] },
  { label: 'HĐTL (Phái sinh)', codes: ['FUVN30', 'FUVN100', 'FUGB'] },
  { label: 'Thỏa thuận', codes: ['PT_HOSE', 'PT_HNX', 'PT_UPCOM'] },
  { label: 'Lô lẻ', codes: ['OL_HOSE', 'OL_HNX', 'OL_UPCOM'] },
];

/** Mã ngành VPBS stockDetailByIndustry (industryCode) → tên hiển thị */
export const INDUSTRY_CODES: { code: string; name: string }[] = [
  { code: '0500', name: 'Dầu khí' },
  { code: '1300', name: 'Hoá chất' },
  { code: '1700', name: 'Tài nguyên cơ bản' },
  { code: '2300', name: 'Xây dựng và vật liệu' },
  { code: '2700', name: 'Hàng và dịch vụ công nghiệp' },
  { code: '3300', name: 'Ô tô và phụ tùng' },
  { code: '3500', name: 'Thực phẩm và đồ uống' },
  { code: '3700', name: 'Hàng cá nhân và gia dụng' },
  { code: '4500', name: 'Y tế' },
  { code: '5300', name: 'Bán lẻ' },
  { code: '5500', name: 'Truyền thông' },
  { code: '5700', name: 'Du lịch và giải trí' },
  { code: '6500', name: 'Viễn thông' },
  { code: '7500', name: 'Điện, nước và xăng dầu khí đốt' },
  { code: '8300', name: 'Ngân hàng' },
  { code: '8500', name: 'Bảo hiểm' },
  { code: '8600', name: 'Bất động sản' },
  { code: '8700', name: 'Dịch vụ tài chính' },
  { code: '9500', name: 'Công nghệ thông tin' },
];

/** Toàn bộ index cho dropdown bảng giá (VPBS stockDetailByIndex) – chọn nhiều */
export const MARKET_INDEX_CODES_BANG_GIA: { code: string; name: string }[] = [
  { code: 'VNXALL', name: 'VNXALL' },
  { code: 'VN30', name: 'VN30' },
  { code: 'VN100', name: 'VN100' },
  { code: 'VNX50', name: 'VNX50' },
  { code: 'HNX30', name: 'HNX30' },
  { code: 'HOSE', name: 'HOSE' },
  { code: 'HNX', name: 'HNX' },
  { code: 'UPCOM', name: 'UPCOM' },
  { code: 'CQ', name: 'Chứng quyền' },
  { code: 'EF', name: 'ETF' },
  { code: 'BOND', name: 'Trái phiếu riêng lẻ' },
  { code: 'PT_HOSE', name: 'Thỏa thuận (HOSE)' },
  { code: 'PT_HNX', name: 'Thỏa thuận (HNX)' },
  { code: 'PT_UPCOM', name: 'Thỏa thuận (UPCOM)' },
  { code: 'OL_HOSE', name: 'Lô lẻ HOSE' },
  { code: 'OL_HNX', name: 'Lô lẻ HNX' },
  { code: 'OL_UPCOM', name: 'Lô lẻ Upcom' },
  { code: 'FUVN30', name: 'HĐTL chỉ số VN30' },
  { code: 'FUVN100', name: 'HĐTL chỉ số VN100' },
  { code: 'FUGB', name: 'HĐTL Trái phiếu Chính phủ' },
  { code: 'DERIVATIVES', name: 'Phái sinh' },
  ...INDUSTRY_CODES.map((i) => ({ code: `INDUSTRY_${i.code}`, name: `CP ngành: ${i.name}` })),
  { code: 'VNALL', name: 'VNALL' },
  { code: 'VNCONS', name: 'VNCONS' },
  { code: 'VNSML', name: 'VNSML' },
  { code: 'VNHEAL', name: 'VNHEAL' },
  { code: 'VNMID', name: 'VNMID' },
  { code: 'VNREAL', name: 'VNREAL' },
  { code: 'VNDIVIDEND', name: 'VNDIVIDEND' },
  { code: 'VNDIAMOND', name: 'VNDIAMOND' },
  { code: 'VNFIN', name: 'VNFIN' },
  { code: 'VNUTI', name: 'VNUTI' },
  { code: 'VNCOND', name: 'VNCOND' },
  { code: 'VNMAT', name: 'VNMAT' },
  { code: 'VNIND', name: 'VNIND' },
  { code: 'VNMITECH', name: 'VNMITECH' },
  { code: 'VNSHINE', name: 'VNSHINE' },
  { code: 'VNFINLEAD', name: 'VNFINLEAD' },
  { code: 'VNIT', name: 'VNIT' },
  { code: 'VNENE', name: 'VNENE' },
  { code: 'VNFINSELECT', name: 'VNFINSELECT' },
  { code: 'VNSI', name: 'VNSI' },
  { code: 'VN50GROWTH', name: 'VN50GROWTH' },
];

// Timeframes for charts
export const TIMEFRAMES = [
  { value: '1m', label: '1 Phút' },
  { value: '5m', label: '5 Phút' },
  { value: '15m', label: '15 Phút' },
  { value: '1h', label: '1 Giờ' },
  { value: '1d', label: '1 Ngày' },
] as const;

// Risk levels
export const RISK_LEVELS = {
  SAFE: { label: 'An toàn', color: 'green', max: 50 },
  MODERATE: { label: 'Trung bình', color: 'yellow', max: 80 },
  WARNING: { label: 'Cảnh báo', color: 'orange', max: 90 },
  CRITICAL: { label: 'Nguy hiểm', color: 'red', max: 100 },
} as const;

// Exchange rate (VND/USD)
export const VND_USD_RATE = 25000;

/** Giá cổ phiếu: hiển thị theo ĐIỂM (1 điểm = 1.000). API VPBS trả sẵn theo nghìn = điểm; không nhân thêm. */
export const STOCK_PRICE_DISPLAY_SCALE = 1;

/** Format số khi hiển thị giá (điểm): 2 chữ số thập phân, dấu chấm (.) thập phân. */
export const PRICE_FRACTION_OPTIONS: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
export const PRICE_LOCALE = 'en-US';

/**
 * Hiển thị giá theo đơn vị ĐIỂM (1 điểm = 1.000 VND).
 * API/DB lưu VND → chia 1000 để hiển thị đúng số user nhập (vd: 28.30).
 */
export function formatPricePoints(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const points = n >= 1000 ? n / 1000 : n;
  return points.toFixed(2);
}

/**
 * Format số kiểu Việt Nam với dấu phẩy (,) làm phân cách hàng nghìn (ví dụ: 6,457,400).
 * Dùng cho khối lượng, tiền VND, volume...
 */
export function formatNumberVI(value: number, options?: Intl.NumberFormatOptions): string {
  const s = value.toLocaleString('vi-VN', options);
  const parts = s.split(',');
  if (parts.length === 2) {
    return parts[0].replace(/\./g, ',') + ',' + parts[1];
  }
  return s.replace(/\./g, ',');
}

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  WS_URL: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
  TIMEOUT: 10000,
};
