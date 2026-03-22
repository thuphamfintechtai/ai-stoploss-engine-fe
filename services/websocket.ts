import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private hasLoggedConnectionRefused = false;

  /**
   * Connect to WebSocket server
   */
  connect() {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      return;
    }

    this.socket = io(WS_URL, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 8000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.hasLoggedConnectionRefused = false;
    });

    this.socket.on('disconnect', (reason) => {
      // Chỉ log khi đã từng kết nối thành công (tránh spam khi backend chưa chạy)
      if (this.reconnectAttempts > 0) return;
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      // Chỉ log 1 lần khi backend không chạy (ERR_CONNECTION_REFUSED)
      if (!this.hasLoggedConnectionRefused) {
        this.hasLoggedConnectionRefused = true;
        console.warn('WebSocket: Không kết nối được server. Kiểm tra backend đã chạy chưa (ví dụ port 3000).');
      }
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.socket?.removeAllListeners();
      }
    });

    this.socket.on('subscribed', () => {});
  }

  /**
   * Subscribe to portfolio updates
   */
  subscribeToPortfolio(portfolioId: string) {
    if (!this.socket) {
      console.warn('WebSocket not connected');
      return;
    }

    this.socket.emit('subscribe_portfolio', portfolioId);
  }

  /**
   * Unsubscribe from portfolio updates
   */
  unsubscribeFromPortfolio(portfolioId: string) {
    if (!this.socket) return;
    this.socket.emit('unsubscribe_portfolio', portfolioId);
  }

  /**
   * Subscribe to symbol price updates
   */
  subscribeToSymbol(symbol: string) {
    if (!this.socket) {
      console.warn('WebSocket not connected');
      return;
    }

    this.socket.emit('subscribe_symbol', symbol);
  }

  /**
   * Unsubscribe from symbol price updates
   */
  unsubscribeFromSymbol(symbol: string) {
    if (!this.socket) return;
    this.socket.emit('unsubscribe_symbol', symbol);
  }

  /**
   * Listen to price updates
   */
  onPriceUpdate(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('price_update', callback);
  }

  /**
   * Listen to risk updates
   */
  onRiskUpdate(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('risk_update', callback);
  }

  /**
   * Listen to notifications
   */
  onNotification(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('notification', callback);
  }

  /**
   * Listen to market updates
   */
  onMarketUpdate(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('market_update', callback);
  }

  /**
   * Listen to trade alerts (price alerts triggered, SL/TP approaching)
   */
  onTradeAlert(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('trade_alert', callback);
  }

  /**
   * Remove listener for an event. If callback provided, removes only that listener.
   */
  off(event: string, callback?: (...args: any[]) => void) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
const wsService = new WebSocketService();
export default wsService;
