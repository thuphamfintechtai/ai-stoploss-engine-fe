import axios, { AxiosInstance, AxiosError } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for slow queries
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
    }
    return Promise.reject(error);
  }
);

// Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  fullName?: string;
}

export interface CreatePortfolioRequest {
  name: string;
  totalBalance: number;
  maxRiskPercent: number;
  expectedReturnPercent?: number;
}

// Position types (theo plan stop-loss & take-profit)
export type StopType = 'FIXED' | 'PERCENT' | 'MAX_LOSS' | 'TRAILING' | 'ATR' | 'SUPPORT_RESISTANCE' | 'MA';
export type TakeProfitType = 'FIXED' | 'PERCENT' | 'R_RATIO';
export type PositionStatus = 'OPEN' | 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL';

export interface Position {
  id: string;
  portfolio_id: string;
  symbol: string;
  exchange: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number | null;
  quantity: number;
  risk_value_vnd: number;
  status: PositionStatus;
  opened_at: string;
  closed_at?: string | null;
  closed_price?: number | null;
  profit_loss_vnd?: number | null;
  side?: string;
  stop_type?: string;
  stop_params?: Record<string, unknown> | null;
  take_profit_type?: string | null;
  take_profit_params?: Record<string, unknown> | null;
  trailing_current_stop?: number | null;
  notes?: string | null;
  risk_reward?: number | null;
}

export interface CreatePositionRequest {
  symbol: string;
  exchange: string;
  /** Khi true (mặc định), BE lấy giá từ VPBS; không cần gửi entry_price. */
  use_market_entry?: boolean;
  entry_price?: number;
  /** Khi use_market_quantity true, BE lấy khối lượng từ thị trường; không cần gửi quantity. */
  use_market_quantity?: boolean;
  quantity?: number;
  stop_type?: StopType;
  stop_params?: Record<string, unknown>;
  stop_price?: number;
  take_profit_type?: TakeProfitType;
  take_profit_params?: Record<string, unknown>;
  take_profit_price?: number;
  signal_source_id?: string;
  notes?: string;
}

export interface CalculatePositionRequest {
  entry_price: number;
  quantity: number;
  stop_type?: StopType;
  stop_params?: Record<string, unknown>;
  stop_price?: number;
  take_profit_type?: TakeProfitType;
  take_profit_params?: Record<string, unknown>;
  take_profit_price?: number;
}

export interface ClosePositionPayload {
  reason: 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL';
  /** Mặc định true: BE lấy giá đóng từ VPBS tại thời điểm đóng. Chỉ gửi closed_price khi use_market_price: false. */
  use_market_price?: boolean;
  closed_price?: number;
}

// Auth API
export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post('/auth/login', data),

  register: (data: RegisterRequest) =>
    apiClient.post('/auth/register', data),

  me: () =>
    apiClient.get('/auth/me'),

  logout: () => {
    const token = localStorage.getItem('auth_token');
    const clearStorage = () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    };
    if (!token) {
      clearStorage();
      return Promise.resolve();
    }
    return apiClient.post('/auth/logout').then(() => clearStorage()).catch(() => clearStorage());
  },
};

// Portfolio API
export const portfolioApi = {
  getAll: () =>
    apiClient.get('/portfolios'),

  getById: (id: string) =>
    apiClient.get(`/portfolios/${id}`),

  create: (data: CreatePortfolioRequest) =>
    apiClient.post('/portfolios', data),

  update: (id: string, data: Partial<CreatePortfolioRequest>) =>
    apiClient.put(`/portfolios/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/portfolios/${id}`),

  getRisk: (id: string) =>
    apiClient.get(`/portfolios/${id}/risk`),

  getPerformance: (id: string) =>
    apiClient.get(`/portfolios/${id}/performance`),
};

// Position API (nested under portfolio)
export const positionApi = {
  list: (portfolioId: string, params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get(`/portfolios/${portfolioId}/positions`, { params }),

  get: (portfolioId: string, positionId: string) =>
    apiClient.get(`/portfolios/${portfolioId}/positions/${positionId}`),

  create: (portfolioId: string, body: CreatePositionRequest) =>
    apiClient.post(`/portfolios/${portfolioId}/positions`, body),

  update: (portfolioId: string, positionId: string, body: { trailing_current_stop?: number }) =>
    apiClient.patch(`/portfolios/${portfolioId}/positions/${positionId}`, body),

  close: (portfolioId: string, positionId: string, payload: ClosePositionPayload) =>
    apiClient.post(`/portfolios/${portfolioId}/positions/${positionId}/close`, payload),

  calculate: (portfolioId: string, body: CalculatePositionRequest) =>
    apiClient.post(`/portfolios/${portfolioId}/positions/calculate`, body),
};

// Signal API (stub – BE không còn /signals, trả về rỗng để FE không lỗi)
export const signalApi = {
  getAll: () => Promise.resolve({ data: { success: true, data: [] } }),
  getActive: () => Promise.resolve({ data: { success: true, data: [] } }),
  getRecommended: () => Promise.resolve({ data: { success: true, data: [] } }),
  getById: (_id: string) => Promise.resolve({ data: { success: true, data: null } }),
};

// ─── AI API ─────────────────────────────────────────────────────────────────

export interface SuggestSLTPRequest {
  symbol: string;
  exchange?: string;
  current_price?: number;
  rr_ratio?: number;
  side?: 'LONG' | 'SHORT';
  ohlcv_data?: Array<{ open: number; high: number; low: number; close: number; volume?: number }>;
}

export interface AnalyzeTrendRequest {
  symbol: string;
  exchange?: string;
  ohlcv_data?: Array<{ open: number; high: number; low: number; close: number; volume?: number }>;
  indicators?: Record<string, unknown>;
}

export interface EvaluateRiskRequest {
  symbol: string;
  exchange?: string;
  portfolio_id: string;
  entry_price: number;
  stop_loss: number;
  take_profit?: number;
  quantity: number;
}

export interface GenerateSignalRequest {
  symbol: string;
  exchange?: string;
}

export const aiApi = {
  /** AI gợi ý Stop Loss và Take Profit */
  suggestSLTP: (data: SuggestSLTPRequest) =>
    apiClient.post('/ai/suggest-sltp', data, { timeout: 60000 }),

  /** Phân tích xu hướng thị trường */
  analyzeTrend: (data: AnalyzeTrendRequest) =>
    apiClient.post('/ai/analyze-trend', data, { timeout: 60000 }),

  /** Đánh giá mức độ rủi ro giao dịch */
  evaluateRisk: (data: EvaluateRiskRequest) =>
    apiClient.post('/ai/evaluate-risk', data, { timeout: 60000 }),

  /** AI tạo tín hiệu giao dịch */
  generateSignal: (data: GenerateSignalRequest) =>
    apiClient.post('/ai/generate-signal', data, { timeout: 60000 }),

  /** Lấy danh sách tín hiệu AI */
  getSignals: (params?: { symbol?: string; limit?: number; offset?: number }) =>
    apiClient.get('/ai/signals', { params }),

  /** Dashboard tổng hợp AI */
  getDashboard: (portfolioId?: string) =>
    apiClient.get('/ai/dashboard', { params: portfolioId ? { portfolio_id: portfolioId } : undefined, timeout: 60000 }),

  /** Lịch sử đánh giá AI */
  getEvaluations: (params?: { symbol?: string; limit?: number; offset?: number }) =>
    apiClient.get('/ai/evaluations', { params }),
};

// ─── Notifications API ───────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  is_read: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
}

export const notificationsApi = {
  /** Lấy danh sách notifications */
  getAll: (params?: { limit?: number; offset?: number; unread_only?: boolean }) =>
    apiClient.get('/notifications', { params }),

  /** Lấy số lượng chưa đọc */
  getUnreadCount: () =>
    apiClient.get('/notifications/unread-count'),

  /** Đánh dấu 1 notification đã đọc */
  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`, {}),

  /** Đánh dấu tất cả đã đọc */
  markAllRead: () =>
    apiClient.post('/notifications/mark-all-read', {}),

  /** Xóa 1 notification */
  delete: (id: string) =>
    apiClient.delete(`/notifications/${id}`),

  /** Xóa tất cả đã đọc */
  deleteRead: () =>
    apiClient.delete('/notifications/read'),
};

// Market API
export const marketApi = {
  getSymbols: (params?: { exchange?: string; is_enabled?: boolean }) =>
    apiClient.get('/market/symbols', { params }),

  getPrice: (symbol: string, params?: { exchange?: string }) =>
    apiClient.get(`/market/symbols/${symbol}/price`, { params }),

  getOHLCV: (symbol: string, params?: { timeframe?: string; limit?: number; exchange?: string }) =>
    apiClient.get(`/market/symbols/${symbol}/ohlcv`, { params }),

  getIndicators: (symbol: string, params?: { timeframe?: string; exchange?: string }) =>
    apiClient.get(`/market/symbols/${symbol}/indicators`, { params }),

  getOverview: (params?: { exchange?: string; limit?: number }) =>
    apiClient.get('/market/overview', { params }),

  getIntradayIndex: (indexCode: string) =>
    apiClient.get('/market/intraday-index', { params: { indexCode } }),

  getIntradayIndices: (codes?: string[]) =>
    apiClient.get('/market/intraday-indices', {
      params: codes?.length ? { codes: codes.join(',') } : undefined,
    }),

  /** Tóm tắt chỉ số (Neopro marketIndexDetail). indexCode: VNINDEX,VN30,VNXALL,HNX30,... */
  getMarketIndexDetail: (params?: { indexCode?: string }) => {
    const indexCode = params?.indexCode && params.indexCode.trim() ? params.indexCode.trim() : 'VNINDEX,VN30,VNXALL,HNX30';
    return apiClient.get('/market/market-index-detail', { params: { indexCode }, timeout: 15000 });
  },

  getNews: (params?: { limit?: number; search?: string; format?: 'json' | 'markdown' | 'text' }) =>
    apiClient.get('/market/news', { params: params || { format: 'json' } }),

  getStocks: (params?: { exchange?: string; search?: string; sort?: string; order?: string; page?: number; limit?: number }, config?: { timeout?: number }) =>
    apiClient.get('/market/stocks', { params, timeout: config?.timeout ?? 60000 }),

  /** Bảng chi tiết theo một hoặc nhiều index (VPBS stockDetailByIndex). indexCode(s): VNXALL, HOSE, HNX, UPCOM... */
  getStockDetailByIndex: (params?: { indexCode?: string; indexCodes?: string | string[]; pageNo?: number; pageSize?: number }) => {
    const p = params || {};
    const indexCodesStr = Array.isArray(p.indexCodes) ? p.indexCodes.join(',') : (p.indexCodes ?? p.indexCode ?? 'VNXALL');
    return apiClient.get('/market/stock-detail-by-index', { params: { indexCodes: indexCodesStr, pageNo: p.pageNo ?? 1, pageSize: p.pageSize ?? 500 }, timeout: 20000 });
  },

  /** Danh sách chứng quyền (VPBS stockCWDetail). Cùng format bảng giá để hiển thị chung. */
  getStockCWDetail: (params?: { stockType?: string; pageNo?: number; pageSize?: number }) => {
    const p = params || {};
    return apiClient.get('/market/stock-cw-detail', {
      params: { stockType: p.stockType ?? 'CW', pageNo: p.pageNo ?? 1, pageSize: p.pageSize ?? 5000 },
      timeout: 20000,
    });
  },

  /** Danh sách ETF (VPBS stockDetail?stockType=EF). Cùng format bảng giá để hiển thị chung. */
  getStockEFDetail: (params?: { stockType?: string; pageNo?: number; pageSize?: number }) => {
    const p = params || {};
    return apiClient.get('/market/stock-ef-detail', {
      params: { stockType: p.stockType ?? 'EF', pageNo: p.pageNo ?? 1, pageSize: p.pageSize ?? 5000 },
      timeout: 20000,
    });
  },

  /** Danh sách phái sinh (VPBS fuStockDetail). stockType: FUVN30 | FUVN100 | FUGB. */
  getStockFUDetail: (params?: { stockType?: string; pageNo?: number; pageSize?: number }) => {
    const p = params || {};
    return apiClient.get('/market/stock-fu-detail', {
      params: { stockType: p.stockType ?? 'FUVN30', pageNo: p.pageNo ?? 1, pageSize: p.pageSize ?? 5000 },
      timeout: 20000,
    });
  },

  /** Danh sách CP theo ngành (VPBS stockDetailByIndustry). industryCode: 0500, 1300, 5300, 8300... */
  getStockDetailByIndustry: (params: { industryCode: string; pageNo?: number; pageSize?: number }) => {
    const p = params;
    return apiClient.get('/market/stock-detail-by-industry', {
      params: { industryCode: p.industryCode, pageNo: p.pageNo ?? 1, pageSize: p.pageSize ?? 5000 },
      timeout: 20000,
    });
  },

  /** Khớp lệnh thoả thuận (VPBS ptStockMatch). marketCode: HOSE | HNX | UPCOM. */
  getPtStockMatch: (params?: { marketCode?: string }) => {
    const marketCode = (params?.marketCode && params.marketCode.trim()) || 'HOSE';
    return apiClient.get('/market/pt-stock-match', { params: { marketCode }, timeout: 15000 });
  },

  /** Chào mua thoả thuận (VPBS ptStockBid). marketCode: HOSE | HNX | UPCOM. */
  getPtStockBid: (params?: { marketCode?: string }) => {
    const marketCode = (params?.marketCode && params.marketCode.trim()) || 'HOSE';
    return apiClient.get('/market/pt-stock-bid', { params: { marketCode }, timeout: 15000 });
  },

  /** Chào bán thoả thuận (VPBS ptStockAsk). marketCode: HOSE | HNX | UPCOM. */
  getPtStockAsk: (params?: { marketCode?: string }) => {
    const marketCode = (params?.marketCode && params.marketCode.trim()) || 'HOSE';
    return apiClient.get('/market/pt-stock-ask', { params: { marketCode }, timeout: 15000 });
  },

  /** Chi tiết thoả thuận (VPBS ptStockDetail). marketCode: HOSE | HNX | UPCOM. */
  getPtStockDetail: (params?: { marketCode?: string }) => {
    const marketCode = (params?.marketCode && params.marketCode.trim()) || 'HOSE';
    return apiClient.get('/market/pt-stock-detail', { params: { marketCode }, timeout: 15000 });
  },

  /** Chi tiết lô lẻ (VPBS oddLotStockDetail). marketCode: HOSE | HNX | UPCOM. */
  getOddLotStockDetail: (params?: { marketCode?: string; pageNo?: number; pageSize?: number }) => {
    const p = params || {};
    const marketCode = (p.marketCode && p.marketCode.trim()) || 'HOSE';
    return apiClient.get('/market/odd-lot-stock-detail', {
      params: { marketCode, pageNo: p.pageNo ?? 1, pageSize: p.pageSize ?? 5000 },
      timeout: 20000,
    });
  },

  getSymbolInfo: (symbol: string) =>
    apiClient.get(`/market/symbols/${encodeURIComponent(symbol.trim())}/info`),

  /** Exchange + giá thị trường (VPBS). quantity tuỳ chọn để nhận total_value. Đơn vị giá: nghìn đồng. */
  getEntryInfo: (symbol: string, params?: { quantity?: number }) =>
    apiClient.get(`/market/symbols/${encodeURIComponent(symbol.trim())}/entry-info`, { params }),

  getSymbolDetail: (symbol: string, params?: { exchange?: string }) =>
    apiClient.get(`/market/symbols/${symbol}/detail`, { params }),

  // VPBank proxy endpoints
  getCompanyInfo: (symbol: string) =>
    apiClient.get(`/market/symbols/${symbol}/company-info`),

  getShareholders: (symbol: string, params?: { type?: string }) =>
    apiClient.get(`/market/symbols/${symbol}/shareholders`, { params }),

  getAdvancedInfo: (symbol: string) =>
    apiClient.get(`/market/symbols/${symbol}/advanced-info`),

  getMatchingHistory: (symbol: string, params?: { pageSize?: number }) =>
    apiClient.get(`/market/symbols/${symbol}/matching-history`, { params }),

  getOrderBook: (symbol: string) =>
    apiClient.get(`/market/symbols/${symbol}/order-book`),

  /** Danh sách trái phiếu doanh nghiệp (Neopro corpBondDetail). symbols=ALL hoặc mã cách nhau dấu phẩy. */
  getCorpBondList: (params?: { symbols?: string }) =>
    apiClient.get('/market/corp-bond-list', { params: params || { symbols: 'ALL' }, timeout: 15000 }),

  /** Chi tiết trái phiếu (Neopro corpBondInfo). */
  getCorpBondInfo: (symbol: string) =>
    apiClient.get(`/market/corp-bond-info/${encodeURIComponent(symbol.trim())}`, { timeout: 10000 }),
};

// ─── Watchlist API ───────────────────────────────────────────────────────────

export interface WatchlistItem {
  id: string;
  symbol: string;
  exchange: string;
  created_at: string;
}

export const watchlistApi = {
  /** Lấy watchlist từ BE */
  getAll: () => apiClient.get('/watchlist'),

  /** Thêm 1 mã */
  add: (symbol: string, exchange: string) =>
    apiClient.post('/watchlist', { symbol, exchange }),

  /** Sync toàn bộ từ localStorage lên BE */
  sync: (items: { symbol: string; exchange: string }[]) =>
    apiClient.post('/watchlist/bulk', { items }),

  /** Xóa 1 mã */
  remove: (symbol: string) => apiClient.delete(`/watchlist/${symbol}`),
};

// ─── Price Alerts API ────────────────────────────────────────────────────────

export type AlertCondition = 'ABOVE' | 'BELOW' | 'PERCENT_UP' | 'PERCENT_DOWN';

export interface PriceAlert {
  id: string;
  user_id: string;
  symbol: string;
  exchange: string;
  condition: AlertCondition;
  target_value: number;
  reference_price: number | null;
  note: string | null;
  is_active: boolean;
  is_triggered: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
  created_at: string;
}

export interface CreateAlertRequest {
  symbol: string;
  exchange?: string;
  condition: AlertCondition;
  target_value: number;
  reference_price?: number;
  note?: string;
}

export const priceAlertsApi = {
  /** Lấy tất cả alerts */
  getAll: (params?: { symbol?: string; active_only?: boolean }) =>
    apiClient.get('/price-alerts', { params }),

  /** Tạo alert mới */
  create: (data: CreateAlertRequest) => apiClient.post('/price-alerts', data),

  /** Xóa alert */
  delete: (id: string) => apiClient.delete(`/price-alerts/${id}`),

  /** Bật/tắt alert */
  toggle: (id: string) => apiClient.patch(`/price-alerts/${id}/toggle`, {}),

  /** Reset alert đã triggered */
  reset: (id: string) => apiClient.patch(`/price-alerts/${id}/reset`, {}),
};

// Export default client
export default apiClient;
