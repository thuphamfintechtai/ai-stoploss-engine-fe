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
  'ATR': { vi: 'Biên độ dao động trung bình', en: 'Average True Range', explain: 'Đo lường mức độ dao động giá của cổ phiếu trong 1 khoảng thời gian. ATR cao = cổ phiếu biến động mạnh.' },
  'VaR': { vi: 'Giá trị rủi ro', en: 'Value at Risk', explain: 'Số tiền tối đa bạn có thể mất trong 1 ngày với xác suất 95%. Ví dụ: VaR 5 triệu = 95% khả năng bạn không mất quá 5 triệu/ngày.' },
  'Stop Loss': { vi: 'Cắt lỗ', en: 'Stop Loss', explain: 'Mức giá bán tự động bán ra để hạn chế lỗ. Ví dụ: mua giá 25,000 đặt SL 23,000 = chấp nhận lỗ tối đa 8%.' },
  'Take Profit': { vi: 'Chốt lời', en: 'Take Profit', explain: 'Mức giá bán tự động bán ra để chốt lợi nhuận. Nên có kế hoạch trước khi mua.' },
  'R:R Ratio': { vi: 'Tỉ lệ Rủi ro/Lợi nhuận', en: 'Risk/Reward Ratio', explain: 'So sánh mức lỗ tối đa và lời tối đa. R:R 1:3 nghĩa là chấp nhận lỗ 1 để có thể lãi 3.' },
  'Kelly Criterion': { vi: 'Công thức Kelly', en: 'Kelly Criterion', explain: 'Công thức tính % vốn nên dùng cho mỗi lệnh, dựa trên tỷ lệ thắng và lời/lỗ trung bình.' },
  'Monte Carlo': { vi: 'Mô phỏng Monte Carlo', en: 'Monte Carlo Simulation', explain: 'Chạy 1000+ kịch bản ngẫu nhiên để dự đoán phạm vi kết quả có thể xảy ra cho danh mục.' },
  'Stress Test': { vi: 'Kiểm tra sức chịu đựng', en: 'Stress Test', explain: 'Xem danh mục sẽ ra sao nếu thị trường giảm mạnh (10%, 15%, 20%).' },
  'Trailing Stop': { vi: 'Điểm cắt lỗ di động', en: 'Trailing Stop', explain: 'SL tự động nâng lên khi giá tăng, giúp bảo vệ lợi nhuận đã có. SL chỉ tăng, không bao giờ giảm.' },
  'Win Rate': { vi: 'Tỷ lệ thắng', en: 'Win Rate', explain: 'Phần trăm số lệnh có lãi trên tổng số lệnh. Ví dụ: 60% win rate = cứ 10 lệnh thì 6 lệnh có lãi.' },
  'Drawdown': { vi: 'Sụt giảm từ đỉnh', en: 'Drawdown', explain: 'Mức giảm từ đỉnh cao nhất xuống đáy thấp nhất. Drawdown 20% nghĩa là danh mục đã giảm 20% từ đỉnh.' },
  'P&L': { vi: 'Lãi/Lỗ', en: 'Profit and Loss', explain: 'Tổng lãi hoặc lỗ của danh mục hoặc một vị thế cụ thể.' },
  'Sharpe Ratio': { vi: 'Tỉ số Sharpe', en: 'Sharpe Ratio', explain: 'Đo lường lợi nhuận điều chỉnh theo rủi ro. Sharpe > 1 là tốt, > 2 là rất tốt.' },
  'Profit Factor': { vi: 'Hệ số lợi nhuận', en: 'Profit Factor', explain: 'Tổng lãi / Tổng lỗ. PF > 1.5 là tốt, > 2 là xuất sắc.' },
  'Settlement T+2': { vi: 'Thanh toán T+2', en: 'T+2 Settlement', explain: 'Sau khi bán cổ phiếu, tiền sẽ về tài khoản sau 2 ngày làm việc (không tính T7, CN, lễ).' },
  'Sector Concentration': { vi: 'Tập trung ngành', en: 'Sector Concentration', explain: 'Tỷ lệ vốn đầu tư vào 1 ngành. Tập trung quá cao (>30-40%) tăng rủi ro khi ngành đó gặp khó khăn.' },
};

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  WS_URL: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
  TIMEOUT: 10000,
};
