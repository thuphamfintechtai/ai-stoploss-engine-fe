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

// Financial Terms Dictionary (D-10) -- Vietnamese explanations for F0 investors
export const FINANCIAL_TERMS: Record<string, { vi: string; en: string; explain: string }> = {
  'ATR': { vi: 'Bien do dao dong trung binh', en: 'Average True Range', explain: 'Do luong muc do dao dong gia cua co phieu trong 1 khoang thoi gian. ATR cao = co phieu bien dong manh.' },
  'VaR': { vi: 'Gia tri rui ro', en: 'Value at Risk', explain: 'So tien toi da ban co the mat trong 1 ngay voi xac suat 95%. Vi du: VaR 5 trieu = 95% kha nang ban khong mat qua 5 trieu/ngay.' },
  'Stop Loss': { vi: 'Cat lo', en: 'Stop Loss', explain: 'Muc gia ban tu dong ban ra de han che lo. Vi du: mua gia 25,000 dat SL 23,000 = chap nhan lo toi da 8%.' },
  'Take Profit': { vi: 'Chot loi', en: 'Take Profit', explain: 'Muc gia ban tu dong ban ra de chot loi nhuan. Nen co ke hoach truoc khi mua.' },
  'R:R Ratio': { vi: 'Ti le Rui ro/Loi nhuan', en: 'Risk/Reward Ratio', explain: 'So sanh muc lo toi da va loi toi da. R:R 1:3 nghia la chap nhan lo 1 de co the lai 3.' },
  'Kelly Criterion': { vi: 'Cong thuc Kelly', en: 'Kelly Criterion', explain: 'Cong thuc tinh % von nen dung cho moi lenh, dua tren ty le thang va loi/lo trung binh.' },
  'Monte Carlo': { vi: 'Mo phong Monte Carlo', en: 'Monte Carlo Simulation', explain: 'Chay 1000+ kich ban ngau nhien de du doan pham vi ket qua co the xay ra cho danh muc.' },
  'Stress Test': { vi: 'Kiem tra suc chiu dung', en: 'Stress Test', explain: 'Xem danh muc se ra sao neu thi truong giam manh (10%, 15%, 20%).' },
  'Trailing Stop': { vi: 'Diem cat lo di dong', en: 'Trailing Stop', explain: 'SL tu dong nang len khi gia tang, giup bao ve loi nhuan da co. SL chi tang, khong bao gio giam.' },
  'Win Rate': { vi: 'Ty le thang', en: 'Win Rate', explain: 'Phan tram so lenh co lai tren tong so lenh. Vi du: 60% win rate = cu 10 lenh thi 6 lenh co lai.' },
  'Drawdown': { vi: 'Sut giam tu dinh', en: 'Drawdown', explain: 'Muc giam tu dinh cao nhat xuong day thap nhat. Drawdown 20% nghia la danh muc da giam 20% tu dinh.' },
  'P&L': { vi: 'Lai/Lo', en: 'Profit and Loss', explain: 'Tong lai hoac lo cua danh muc hoac mot vi the cu the.' },
  'Sharpe Ratio': { vi: 'Ti so Sharpe', en: 'Sharpe Ratio', explain: 'Do luong loi nhuan dieu chinh theo rui ro. Sharpe > 1 la tot, > 2 la rat tot.' },
  'Profit Factor': { vi: 'He so loi nhuan', en: 'Profit Factor', explain: 'Tong lai / Tong lo. PF > 1.5 la tot, > 2 la xuat sac.' },
  'Settlement T+2': { vi: 'Thanh toan T+2', en: 'T+2 Settlement', explain: 'Sau khi ban co phieu, tien se ve tai khoan sau 2 ngay lam viec (khong tinh T7, CN, le).' },
  'Sector Concentration': { vi: 'Tap trung nganh', en: 'Sector Concentration', explain: 'Ty le von dau tu vao 1 nganh. Tap trung qua cao (>30-40%) tang rui ro khi nganh do gap kho khan.' },
};

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  WS_URL: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
  TIMEOUT: 10000,
};
