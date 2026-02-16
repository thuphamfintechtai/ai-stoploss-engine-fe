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

/** Giá cổ phiếu từ API/DB: sàn VN thường dùng đơn vị "nghìn đồng" (33 = 33.000 ₫). Nhân với hệ số này khi hiển thị. Nếu API đã trả "đồng" thì để 1. */
export const STOCK_PRICE_DISPLAY_SCALE = 1000;

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  WS_URL: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
  TIMEOUT: 10000,
};
