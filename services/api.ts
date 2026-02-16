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

// Signal API (stub – BE không còn /signals, trả về rỗng để FE không lỗi)
export const signalApi = {
  getAll: () => Promise.resolve({ data: { success: true, data: [] } }),
  getActive: () => Promise.resolve({ data: { success: true, data: [] } }),
  getRecommended: () => Promise.resolve({ data: { success: true, data: [] } }),
  getById: (_id: string) => Promise.resolve({ data: { success: true, data: null } }),
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

  getNews: (params?: { limit?: number; search?: string; format?: 'json' | 'markdown' | 'text' }) =>
    apiClient.get('/market/news', { params: params || { format: 'json' } }),

  getStocks: (params?: { exchange?: string; search?: string; sort?: string; order?: string; page?: number; limit?: number }, config?: { timeout?: number }) =>
    apiClient.get('/market/stocks', { params, timeout: config?.timeout ?? 60000 }),

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
};

// Export default client
export default apiClient;
