import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Connect to WebSocket server
   */
  connect() {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      console.warn('No auth token found, skipping WebSocket connection');
      return;
    }

    this.socket = io(WS_URL, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('subscribed', (data) => {
      console.log('📡 Subscribed:', data);
    });
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
   * Remove all listeners for an event
   */
  off(event: string) {
    if (!this.socket) return;
    this.socket.off(event);
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('WebSocket disconnected');
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
