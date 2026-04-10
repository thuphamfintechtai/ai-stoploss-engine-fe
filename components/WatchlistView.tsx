import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CandlestickChart } from './charts/CandlestickChart';
import { marketApi, watchlistApi, priceAlertsApi, notificationsApi, aiApi } from '../services/api';
import type { PriceAlert, CreateAlertRequest, AlertCondition, Notification } from '../services/api';
import { formatNumberVI, STOCK_PRICE_DISPLAY_SCALE } from '../constants';
import wsService from '../services/websocket';

interface WatchItem {
  symbol: string;
  exchange: string;
}

interface SymbolQuote {
  symbol: string;
  exchange: string;
  price: number;       // nghìn đồng (hiển thị)
  change: number;
  changePercent: number;
  volume: number;
}

interface Props {
  onNavigate: (view: string) => void;
  onOpenTrading?: (symbol: string, exchange: string, opts?: { stopLoss?: number; takeProfit?: number; side?: 'LONG' | 'SHORT'; quantity?: number }) => void;
}

const STORAGE_KEY = 'riskguard_watchlist';
const toPoint = (v: number) => (v >= 1000 ? v / 1000 : v);

// Label conditions
const CONDITION_LABELS: Record<AlertCondition, string> = {
  ABOVE:       '▲ Giá vượt lên',
  BELOW:       '▼ Giá xuống dưới',
  PERCENT_UP:  'MẠNH Tăng ≥ ...%',
  PERCENT_DOWN:'CẢNH BÁO Giảm ≥ ...%',
};

export const WatchlistView: React.FC<Props> = ({ onNavigate, onOpenTrading }) => {
  // ─── Watchlist state ───────────────────────────────────────────────────
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [quotes, setQuotes] = useState<Record<string, SymbolQuote>>({});
  const [selectedSymbol, setSelectedSymbol] = useState<WatchItem | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [symbolDetail, setSymbolDetail] = useState<any>(null);
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // ─── Price alerts state ────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTarget, setAlertTarget] = useState<WatchItem | null>(null);
  const [alertForm, setAlertForm] = useState<{ condition: AlertCondition; target_value: string; note: string }>({
    condition: 'ABOVE',
    target_value: '',
    note: '',
  });
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertError, setAlertError] = useState('');

  // ─── Tab state ─────────────────────────────────────────────────────────
  const [detailTab, setDetailTab] = useState<'detail' | 'signal'>('detail');

  // ─── AI Analysis state ─────────────────────────────────────────────────
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, any>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [aiHistoryLoading, setAiHistoryLoading] = useState(false);

  // ─── Trading Signal state ───────────────────────────────────────────────
  const [tradeSignal, setTradeSignal] = useState<Record<string, any>>({});
  const [tradeSignalLoading, setTradeSignalLoading] = useState<Record<string, boolean>>({});
  const [tradeForm, setTradeForm] = useState({
    capital: '',       // Vốn đầu tư (VND)
    risk_percent: '2', // % rủi ro
    rr_ratio: '2',     // R:R
    side: 'LONG' as 'LONG' | 'SHORT',
  });

  // ─── Notifications panel ───────────────────────────────────────────────
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  // ─── BACKEND SYNC ──────────────────────────────────────────────────────

  // Load watchlist từ BE khi mount, merge với localStorage
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    watchlistApi.getAll()
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const beItems: WatchItem[] = res.data.data.map((i: any) => ({ symbol: i.symbol, exchange: i.exchange }));
          // Merge: ưu tiên BE, bổ sung các mã chỉ có ở localStorage
          const localOnly = watchlist.filter(w => !beItems.find(b => b.symbol === w.symbol));
          const merged = [...beItems, ...localOnly];
          setWatchlist(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          // Sync local-only items lên BE
          if (localOnly.length > 0) {
            watchlistApi.sync(merged).catch(() => {});
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist watchlist vào localStorage khi thay đổi
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  // Load price alerts
  const loadAlerts = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    priceAlertsApi.getAll()
      .then((res) => { if (res.data?.success) setAlerts(res.data.data || []); })
      .catch(() => {});
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // Load notifications
  const loadNotifications = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    Promise.all([
      notificationsApi.getAll({ limit: 20 }),
      notificationsApi.getUnreadCount(),
    ]).then(([nRes, cRes]) => {
      if (nRes.data?.success) setNotifications(nRes.data.data || []);
      if (cRes.data?.success) setUnreadCount(cRes.data.data?.count || 0);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // ─── WEBSOCKET: price_update + notification ────────────────────────────

  useEffect(() => {
    // Lắng nghe price_update để cập nhật quotes realtime
    wsService.onPriceUpdate((data: any) => {
      if (!data?.symbol) return;
      const priceDisplay = data.price != null ? parseFloat(data.price) : null;
      if (priceDisplay == null) return;
      const refClose = priceDisplay;
      setQuotes((prev) => {
        const old = prev[data.symbol];
        return {
          ...prev,
          [data.symbol]: {
            symbol: data.symbol,
            exchange: data.exchange || old?.exchange || '',
            price: refClose * STOCK_PRICE_DISPLAY_SCALE,
            change: old?.change ?? 0,
            changePercent: data.change_percent != null ? parseFloat(data.change_percent) : (old?.changePercent ?? 0),
            volume: data.volume != null ? parseFloat(data.volume) : (old?.volume ?? 0),
          },
        };
      });
    });

    // Lắng nghe notifications mới từ WS
    wsService.onNotification((notif: any) => {
      if (notif?.type === 'PRICE_ALERT') {
        setNotifications((prev) => [notif, ...prev.slice(0, 19)]);
        setUnreadCount((c) => c + 1);
        // Reload alerts để cập nhật trạng thái triggered
        loadAlerts();
      }
    });

    return () => {
      wsService.off('price_update');
      wsService.off('notification');
    };
  }, [loadAlerts]);

  // Load AI history khi chọn symbol khác, reset tab về detail
  useEffect(() => {
    if (selectedSymbol) {
      setAiHistory([]);
      setDetailTab('detail');
      loadAiHistory(selectedSymbol.symbol, selectedSymbol.exchange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol?.symbol]);

  // Subscribe symbols của watchlist khi danh sách thay đổi
  useEffect(() => {
    watchlist.forEach((item) => wsService.subscribeToSymbol(item.symbol));
    return () => {
      watchlist.forEach((item) => wsService.unsubscribeFromSymbol(item.symbol));
    };
  }, [watchlist]);

  // ─── FETCH QUOTES (polling dự phòng) ──────────────────────────────────

  const fetchQuotes = useCallback(async () => {
    for (const item of watchlist) {
      try {
        const res = await marketApi.getPrice(item.symbol, item.exchange ? { exchange: item.exchange } : undefined);
        if (res.data?.success && res.data.data) {
          const d = res.data.data;
          const rawClose = Number(d.closePrice ?? d.price ?? 0);
          const close = rawClose * STOCK_PRICE_DISPLAY_SCALE;
          const ref = Number(d.open ?? d.reference ?? 0) * STOCK_PRICE_DISPLAY_SCALE;
          setQuotes((prev) => ({
            ...prev,
            [item.symbol]: {
              symbol: item.symbol,
              exchange: item.exchange,
              price: close,
              change: close - ref,
              changePercent: ref > 0 ? ((close - ref) / ref) * 100 : 0,
              volume: Number(d.volume ?? 0),
            },
          }));
        }
      } catch { /* ignore */ }
    }
  }, [watchlist]);

  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 30_000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  // ─── CHART & DETAIL ────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedSymbol) return;
    setLoadingChart(true);
    setSymbolDetail(null);
    Promise.allSettled([
      marketApi.getOHLCV(selectedSymbol.symbol, { exchange: selectedSymbol.exchange, timeframe: '1d', limit: 90 }),
      marketApi.getSymbolDetail(selectedSymbol.symbol, { exchange: selectedSymbol.exchange }),
    ]).then(([ohlcvRes, detailRes]) => {
      if (ohlcvRes.status === 'fulfilled' && ohlcvRes.value.data?.success) {
        const data = ohlcvRes.value.data.data.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleDateString('vi-VN'),
          open:   parseFloat(item.open)   * STOCK_PRICE_DISPLAY_SCALE,
          high:   parseFloat(item.high)   * STOCK_PRICE_DISPLAY_SCALE,
          low:    parseFloat(item.low)    * STOCK_PRICE_DISPLAY_SCALE,
          close:  parseFloat(item.close)  * STOCK_PRICE_DISPLAY_SCALE,
          volume: parseFloat(item.volume),
        }));
        setChartData(data);
      }
      if (detailRes.status === 'fulfilled' && detailRes.value.data?.success) {
        setSymbolDetail(detailRes.value.data.data);
      }
    }).finally(() => setLoadingChart(false));
  }, [selectedSymbol]);

  // ─── ADD / REMOVE ──────────────────────────────────────────────────────

  const addToWatchlist = async () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym) return;
    if (watchlist.find((w) => w.symbol === sym)) {
      setAddError('Mã này đã có trong danh sách'); return;
    }
    setAdding(true); setAddError('');
    try {
      const res = await marketApi.getEntryInfo(sym);
      if (res.data?.success && res.data.data) {
        const newItem: WatchItem = { symbol: sym, exchange: res.data.data.exchange || 'HOSE' };
        setWatchlist((prev) => [...prev, newItem]);
        setAddInput('');
        setSelectedSymbol(newItem);
        // Sync lên BE
        watchlistApi.add(newItem.symbol, newItem.exchange).catch(() => {});
        wsService.subscribeToSymbol(sym);
      } else {
        setAddError('Không tìm thấy mã này');
      }
    } catch { setAddError('Không tìm thấy mã này'); }
    finally { setAdding(false); }
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));
    if (selectedSymbol?.symbol === symbol) setSelectedSymbol(null);
    wsService.unsubscribeFromSymbol(symbol);
    watchlistApi.remove(symbol).catch(() => {});
  };

  // ─── PRICE ALERTS ──────────────────────────────────────────────────────

  const openAlertModal = (item: WatchItem) => {
    setAlertTarget(item);
    const currentPrice = quotes[item.symbol]?.price;
    setAlertForm({
      condition: 'ABOVE',
      target_value: currentPrice ? (currentPrice / 1000).toFixed(2) : '',
      note: '',
    });
    setAlertError('');
    setShowAlertModal(true);
  };

  const saveAlert = async () => {
    if (!alertTarget) return;
    const val = parseFloat(alertForm.target_value);
    if (isNaN(val) || val <= 0) { setAlertError('Nhập giá trị hợp lệ (> 0)'); return; }

    const isPercent = alertForm.condition === 'PERCENT_UP' || alertForm.condition === 'PERCENT_DOWN';
    if (isPercent && val > 100) { setAlertError('% không hợp lệ (0–100)'); return; }

    // Kiểm tra điều kiện ABOVE/BELOW có nghĩa với giá hiện tại
    const currentPricePoint = quotes[alertTarget.symbol]?.price;
    if (!isPercent && currentPricePoint != null && currentPricePoint > 0) {
      const targetPoint = val; // user nhập nghìn đồng (điểm)
      if (alertForm.condition === 'ABOVE' && targetPoint <= currentPricePoint / 1000) {
        setAlertError(`Giá cảnh báo (${val}) phải > giá hiện tại (${(currentPricePoint / 1000).toFixed(2)})`);
        return;
      }
      if (alertForm.condition === 'BELOW' && targetPoint >= currentPricePoint / 1000) {
        setAlertError(`Giá cảnh báo (${val}) phải < giá hiện tại (${(currentPricePoint / 1000).toFixed(2)})`);
        return;
      }
    }

    setAlertSaving(true); setAlertError('');
    try {
      const targetVND = isPercent ? val : val * 1000;
      const refPriceVND = isPercent
        ? (quotes[alertTarget.symbol]?.price != null ? quotes[alertTarget.symbol].price : undefined)
        : undefined;

      const payload: CreateAlertRequest = {
        symbol:      alertTarget.symbol,
        exchange:    alertTarget.exchange,
        condition:   alertForm.condition,
        target_value: targetVND,
        reference_price: refPriceVND,
        note:        alertForm.note || undefined,
      };
      const res = await priceAlertsApi.create(payload);
      if (res.data?.success) {
        setAlerts((prev) => [res.data.data, ...prev]);
        setShowAlertModal(false);
      } else {
        setAlertError(res.data?.message || 'Lỗi tạo cảnh báo');
      }
    } catch { setAlertError('Lỗi tạo cảnh báo'); }
    finally { setAlertSaving(false); }
  };

  const deleteAlert = async (id: string) => {
    await priceAlertsApi.delete(id).catch(() => {});
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const resetAlert = async (id: string) => {
    const res = await priceAlertsApi.reset(id).catch(() => null);
    if (res?.data?.success) {
      setAlerts((prev) => prev.map((a) => a.id === id ? res.data.data : a));
    }
  };

  // ─── NOTIFICATIONS PANEL ───────────────────────────────────────────────

  const markNotifRead = async (id: string) => {
    await notificationsApi.markRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    if (showNotifPanel) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifPanel]);

  // ─── HELPERS ───────────────────────────────────────────────────────────

  const activeAlertsForSymbol = (symbol: string) =>
    alerts.filter((a) => a.symbol === symbol && a.is_active && !a.is_triggered);

  const triggeredAlertsForSymbol = (symbol: string) =>
    alerts.filter((a) => a.symbol === symbol && a.is_triggered);

  const detail = symbolDetail || {};

  // ─── AI ANALYSIS ───────────────────────────────────────────────────────
  const loadAiHistory = async (symbol: string, exchange: string) => {
    setAiHistoryLoading(true);
    try {
      const res = await aiApi.getWatchlistHistory(symbol, exchange);
      if (res.data?.success) setAiHistory(res.data.data || []);
    } catch { /* ignore */ }
    finally { setAiHistoryLoading(false); }
  };

  const runAiAnalysis = async (symbol: string, exchange: string) => {
    if (aiLoading[symbol]) return;
    setAiLoading((prev) => ({ ...prev, [symbol]: true }));
    try {
      const res = await aiApi.analyzeWatchlistSymbol(symbol, exchange);
      if (res.data?.success) {
        setAiAnalysis((prev) => ({ ...prev, [symbol]: res.data.data }));
        // Reload history sau khi phân tích xong
        await loadAiHistory(symbol, exchange);
      }
    } catch { /* ignore */ }
    finally { setAiLoading((prev) => ({ ...prev, [symbol]: false })); }
  };

  const [tradeSignalError, setTradeSignalError] = useState<Record<string, string>>({});

  const generateTradeSignal = async (symbol: string, exchange: string) => {
    if (tradeSignalLoading[symbol]) return;
    setTradeSignalLoading((prev) => ({ ...prev, [symbol]: true }));
    setTradeSignalError((prev) => ({ ...prev, [symbol]: '' }));
    try {
      const body: any = {
        symbol, exchange,
        rr_ratio: parseFloat(tradeForm.rr_ratio) || 2,
        side: tradeForm.side,
      };
      if (tradeForm.capital) body.capital = parseFloat(tradeForm.capital.replace(/\D/g, ''));
      if (tradeForm.risk_percent) body.risk_percent = parseFloat(tradeForm.risk_percent);
      const res = await aiApi.suggestSLTP(body as any);
      if (res.data?.success) {
        setTradeSignal((prev) => ({ ...prev, [symbol]: res.data.data }));
      } else {
        setTradeSignalError((prev) => ({ ...prev, [symbol]: res.data?.message || 'AI không trả về gợi ý' }));
      }
    } catch (e: any) {
      setTradeSignalError((prev) => ({ ...prev, [symbol]: e?.response?.data?.message || 'Lỗi khi gọi AI' }));
    } finally {
      setTradeSignalLoading((prev) => ({ ...prev, [symbol]: false }));
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-3 h-[calc(100vh-120px)] animate-fade-in relative">

      {/* ── LEFT: Watchlist ─────────────────────────────────────────── */}
      <div className="w-72 shrink-0 panel-section flex flex-col">
        <div className="px-3 py-2.5 border-b border-border-subtle shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Danh Sách Theo Dõi</p>

            {/* Bell icon + notification panel */}
            <div className="relative" ref={notifPanelRef}>
              <button
                onClick={() => setShowNotifPanel((v) => !v)}
                className="relative p-1 rounded hover:bg-white/10 transition-colors"
                title="Thông báo"
              >
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-negative text-white text-[9px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {showNotifPanel && (
                <div className="absolute right-0 top-7 w-80 panel-section shadow-xl z-50 border border-border-standard rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Thông báo</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[10px] text-accent hover:underline">Đọc tất cả</button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto dense-scroll">
                    {notifications.length === 0 ? (
                      <p className="text-[11px] text-text-dim text-center py-6">Không có thông báo</p>
                    ) : notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => !n.is_read && markNotifRead(n.id)}
                        className={`px-3 py-2 border-b border-border-subtle cursor-pointer hover:bg-white/5 transition-colors ${!n.is_read ? 'bg-accent/5' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-[14px] mt-0.5 shrink-0">
                            {n.type === 'PRICE_ALERT' ? '🔔' : n.type === 'SL_TRIGGERED' ? '🔴' : n.type === 'TP_TRIGGERED' ? '🟢' : '📢'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[11px] font-semibold truncate ${!n.is_read ? 'text-text-main' : 'text-text-muted'}`}>{n.title}</p>
                            <p className="text-[10px] text-text-dim mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[9px] text-text-dim mt-0.5">{new Date(n.created_at).toLocaleString('vi-VN')}</p>
                          </div>
                          {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add symbol input */}
          <div className="flex gap-1.5">
            <input
              value={addInput}
              onChange={(e) => { setAddInput(e.target.value.toUpperCase()); setAddError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && addToWatchlist()}
              placeholder="Thêm mã CK..."
              className="flex-1 bg-panel border border-border-standard rounded px-2 py-1.5 text-[12px] text-text-main placeholder-text-muted outline-none focus:border-accent font-mono"
            />
            <button
              onClick={addToWatchlist}
              disabled={adding || !addInput.trim()}
              className="px-3 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-[11px] font-semibold disabled:opacity-50"
            >
              {adding ? '...' : '+'}
            </button>
          </div>
          {addError && <p className="text-[10px] text-negative mt-1">{addError}</p>}
        </div>

        <div className="flex-1 overflow-y-auto dense-scroll">
          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-dim py-8">
              <svg className="w-8 h-8 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <p className="text-[11px]">Thêm mã CK để theo dõi</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0" style={{ background: 'var(--color-panel)' }}>
                <tr>
                  <th className="text-left px-3 py-2 text-[9px] font-semibold text-text-dim uppercase tracking-wide border-b border-border-subtle">Mã</th>
                  <th className="text-right px-2 py-2 text-[9px] font-semibold text-text-dim uppercase tracking-wide border-b border-border-subtle">Giá</th>
                  <th className="text-right px-2 py-2 text-[9px] font-semibold text-text-dim uppercase tracking-wide border-b border-border-subtle">%</th>
                  <th className="px-1 py-2 border-b border-border-subtle w-6" />
                  <th className="px-1 py-2 border-b border-border-subtle w-6" />
                </tr>
              </thead>
              <tbody>
                {watchlist.map((item) => {
                  const q = quotes[item.symbol];
                  const isSelected = selectedSymbol?.symbol === item.symbol;
                  const chgPct = q?.changePercent ?? 0;
                  const activeAlerts = activeAlertsForSymbol(item.symbol);
                  const hasTriggered = triggeredAlertsForSymbol(item.symbol).length > 0;

                  return (
                    <tr
                      key={item.symbol}
                      onClick={() => setSelectedSymbol(item)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-accent/10' : 'hover:bg-white/5'}`}
                    >
                      <td className="px-3 py-2">
                        <div className={`text-[12px] font-bold ${isSelected ? 'text-accent' : 'text-text-main'}`}>{item.symbol}</div>
                        <div className="text-[9px] text-text-dim">{item.exchange}</div>
                      </td>
                      <td className={`px-2 py-2 text-right text-[12px] font-mono ${chgPct > 0 ? 'text-positive' : chgPct < 0 ? 'text-negative' : 'text-warning'}`}>
                        {q?.price ? toPoint(q.price).toFixed(2) : '—'}
                      </td>
                      <td className={`px-2 py-2 text-right text-[11px] font-mono ${chgPct > 0 ? 'text-positive' : chgPct < 0 ? 'text-negative' : 'text-text-muted'}`}>
                        {chgPct !== 0 ? (chgPct > 0 ? '+' : '') + chgPct.toFixed(2) + '%' : '—'}
                      </td>

                      {/* Alert bell button */}
                      <td className="px-1 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openAlertModal(item); }}
                          className="p-0.5 rounded transition-colors"
                          title={activeAlerts.length > 0 ? `${activeAlerts.length} cảnh báo đang hoạt động` : 'Đặt cảnh báo giá'}
                        >
                          {hasTriggered ? (
                            <svg className="w-3.5 h-3.5 text-warning" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                            </svg>
                          ) : activeAlerts.length > 0 ? (
                            <svg className="w-3.5 h-3.5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-text-dim hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                            </svg>
                          )}
                        </button>
                      </td>

                      {/* Remove button */}
                      <td className="px-1 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromWatchlist(item.symbol); }}
                          className="p-0.5 rounded text-text-dim hover:text-negative transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── MIDDLE: Detail Panel (tabbed) ───────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-0 overflow-hidden">
        {!selectedSymbol ? (
          <div className="panel-section flex-1 flex items-center justify-center text-text-dim">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
              <p className="text-[13px]">Chọn mã từ danh sách để xem chi tiết</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 h-full">
            {/* ── Symbol Header ── */}
            <div className="panel-section p-4 shrink-0">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[20px] font-bold text-text-main">{selectedSymbol.symbol}</h2>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-border-standard text-text-muted">{selectedSymbol.exchange}</span>
                  </div>
                  {detail.companyName && <p className="text-[12px] text-text-muted mt-0.5">{detail.companyName}</p>}
                </div>
                {quotes[selectedSymbol.symbol] && (
                  <div className="text-right">
                    <div className={`text-[22px] font-bold font-mono ${(quotes[selectedSymbol.symbol]?.changePercent ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {toPoint(quotes[selectedSymbol.symbol].price).toFixed(2)}
                    </div>
                    <div className={`text-[11px] font-mono ${(quotes[selectedSymbol.symbol]?.changePercent ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {(quotes[selectedSymbol.symbol].changePercent >= 0 ? '▲ +' : '▼ ')}
                      {quotes[selectedSymbol.symbol].changePercent.toFixed(2)}%
                    </div>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openAlertModal(selectedSymbol)} className="px-3 py-1.5 rounded-md bg-warning/20 text-warning font-semibold text-[11px] hover:bg-warning/30 transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                    Cảnh báo
                  </button>
                  <button onClick={() => onOpenTrading?.(selectedSymbol.symbol, selectedSymbol.exchange)} className="px-3 py-1.5 rounded-md bg-positive text-white font-semibold text-[11px] hover:bg-positive/80 transition-colors">
                    Mở Terminal
                  </button>
                </div>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3 pt-3 border-t border-border-subtle">
                {[
                  { label: 'P/E',    val: detail.pe?.toFixed(2) },
                  { label: 'P/B',    val: detail.pb?.toFixed(2) },
                  { label: 'ROE',    val: detail.roe ? detail.roe.toFixed(2) + '%' : null },
                  { label: 'Beta',   val: detail.beta?.toFixed(2) },
                  { label: 'Vốn hóa', val: detail.marketCap ? (detail.marketCap / 1000).toFixed(0) + ' tỷ' : null },
                  { label: 'KL Ngày', val: quotes[selectedSymbol.symbol] ? formatNumberVI(quotes[selectedSymbol.symbol].volume, { maximumFractionDigits: 0 }) : null },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-text-dim mb-0.5">{label}</p>
                    <p className="text-[13px] font-mono font-semibold text-text-main">{val ?? '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Tab switcher ── */}
            <div className="flex gap-0 border-b border-border-subtle shrink-0 px-1">
              {([
                { id: 'detail', label: 'Chi Tiết & Biểu Đồ' },
                { id: 'signal', label: 'AI Phân Tích & Tín Hiệu' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDetailTab(t.id)}
                  className={`px-4 py-2.5 text-[11px] font-semibold border-b-2 transition-colors ${
                    detailTab === t.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
                >
                  {t.label}
                  {t.id === 'signal' && aiHistory.length > 0 && (
                    <span className="ml-1.5 text-[9px] bg-purple-500/30 text-purple-300 rounded-full px-1.5 py-0.5">{aiHistory.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Tab: Chi Tiết ── */}
            {detailTab === 'detail' && (
              <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto dense-scroll pb-2">
                {/* Active Price Alerts */}
                {alerts.filter(a => a.symbol === selectedSymbol.symbol).length > 0 && (
                  <div className="panel-section p-3 shrink-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-2">Cảnh Báo Giá</p>
                    <div className="space-y-1.5">
                      {alerts.filter(a => a.symbol === selectedSymbol.symbol).map((alert) => (
                        <div key={alert.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] ${alert.is_triggered ? 'bg-warning/10 border border-warning/30' : alert.is_active ? 'bg-accent/5 border border-accent/20' : 'opacity-50'}`}>
                          <span className={`shrink-0 font-bold text-[10px] ${alert.condition === 'ABOVE' || alert.condition === 'PERCENT_UP' ? 'text-positive' : 'text-negative'}`}>{alert.condition === 'ABOVE' || alert.condition === 'PERCENT_UP' ? '▲' : '▼'}</span>
                          <span className="flex-1 text-text-main">
                            {alert.condition === 'ABOVE' && `Giá ≥ ${(alert.target_value / 1000).toFixed(2)}`}
                            {alert.condition === 'BELOW' && `Giá ≤ ${(alert.target_value / 1000).toFixed(2)}`}
                            {alert.condition === 'PERCENT_UP' && `Tăng ≥ ${alert.target_value}%`}
                            {alert.condition === 'PERCENT_DOWN' && `Giảm ≥ ${alert.target_value}%`}
                            {alert.note && <span className="text-text-dim ml-1">– {alert.note}</span>}
                          </span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${alert.is_triggered ? 'bg-warning/20 text-warning' : 'bg-accent/20 text-accent'}`}>
                            {alert.is_triggered ? 'Kích hoạt' : 'Đang theo dõi'}
                          </span>
                          {alert.is_triggered && <button onClick={() => resetAlert(alert.id)} className="text-[9px] text-accent hover:underline">Reset</button>}
                          <button onClick={() => deleteAlert(alert.id)} className="text-text-dim hover:text-negative transition-colors">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chart */}
                <div className="panel-section flex flex-col shrink-0" style={{ height: 360 }}>
                  <div className="px-4 py-2 border-b border-border-subtle shrink-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Biểu Đồ 90 Ngày</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <CandlestickChart data={chartData} loading={loadingChart} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: AI Phân Tích & Tín Hiệu ── */}
            {detailTab === 'signal' && (() => {
              const sym = selectedSymbol.symbol;
              const exch = selectedSymbol.exchange;
              const sig = tradeSignal[sym]?.signal;
              const currentPrice = tradeSignal[sym]?.current_price;
              const ai = aiAnalysis[sym];

              const fmtP = (v: number | null | undefined) =>
                v != null ? (v >= 1000 ? v / 1000 : v).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

              const actionCls = (a?: string) =>
                a === 'BUY' ? 'text-positive bg-positive/10 border-positive/30'
                : a === 'SELL' ? 'text-negative bg-negative/10 border-negative/30'
                : 'text-warning bg-warning/10 border-warning/30';
              const actionLabel = (a?: string) =>
                a === 'BUY' ? 'MUA' : a === 'SELL' ? 'BÁN' : a === 'HOLD' ? 'GIỮ' : '—';

              return (
                <div className="flex gap-3 flex-1 min-h-0 overflow-hidden pb-2">
                  {/* Left: Trend Analysis + History */}
                  <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto dense-scroll">
                    {/* Run analysis button */}
                    <div className="panel-section p-3 shrink-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">Phân tích xu hướng</p>
                        <button
                          onClick={() => runAiAnalysis(sym, exch)}
                          disabled={aiLoading[sym]}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-500/20 text-purple-300 text-[11px] font-semibold hover:bg-purple-500/30 transition-colors disabled:opacity-60"
                        >
                          {aiLoading[sym] ? <span className="w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" /> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>}
                          {aiLoading[sym] ? 'Đang phân tích...' : 'Phân tích ngay'}
                        </button>
                      </div>
                      {ai ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${ai.trend === 'BULLISH' ? 'text-positive bg-positive/10 border-positive/20' : ai.trend === 'BEARISH' ? 'text-negative bg-negative/10 border-negative/20' : 'text-warning bg-warning/10 border-warning/20'}`}>
                              {ai.trend === 'BULLISH' ? '▲ Tăng' : ai.trend === 'BEARISH' ? '▼ Giảm' : '→ Đi ngang'}{ai.strength > 0 ? ` ${ai.strength}%` : ''}
                            </span>
                            {ai.recommendation && (
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${ai.recommendation === 'BUY' ? 'text-positive bg-positive/10 border-positive/30' : ai.recommendation === 'SELL' ? 'text-negative bg-negative/10 border-negative/30' : 'text-warning bg-warning/10 border-warning/30'}`}>
                                {ai.recommendation}
                              </span>
                            )}
                            <span className="text-[9px] text-text-dim ml-auto">{new Date(ai.analyzed_at).toLocaleTimeString('vi-VN')}</span>
                          </div>
                          {ai.summary && <p className="text-[11px] text-text-muted leading-relaxed mb-2">{ai.summary}</p>}
                          {ai.signals?.length > 0 && (
                            <div className="space-y-1">
                              {ai.signals.map((s: any, i: number) => {
                                const label = typeof s === 'string' ? s : (s.indicator || s.type || '');
                                const msg = typeof s === 'string' ? '' : (s.message || '');
                                const sc = (typeof s === 'object' && s.type === 'BUY') ? 'text-positive' : (typeof s === 'object' && s.type === 'SELL') ? 'text-negative' : 'text-text-muted';
                                return (
                                  <div key={i} className={`text-[10px] px-2 py-1 rounded bg-white/5 ${sc}`}>
                                    {label && <span className="font-semibold">{label}: </span>}
                                    <span>{msg || label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex gap-4 text-[10px] text-text-dim mt-2 pt-2 border-t border-border-subtle">
                            {ai.support_levels?.length > 0 && <span>Hỗ trợ: <span className="text-positive">{ai.support_levels.map((v: number) => typeof v === 'number' ? (v/1000).toFixed(2) : v).join(', ')}</span></span>}
                            {ai.resistance_levels?.length > 0 && <span>Kháng cự: <span className="text-negative">{ai.resistance_levels.map((v: number) => typeof v === 'number' ? (v/1000).toFixed(2) : v).join(', ')}</span></span>}
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-text-dim">Chưa có kết quả phân tích. Nhấn "Phân tích ngay" để bắt đầu.</p>
                      )}
                    </div>

                    {/* History */}
                    <div className="panel-section flex-1 min-h-0 flex flex-col">
                      <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between shrink-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Lịch sử phân tích</p>
                        {aiHistoryLoading && <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />}
                      </div>
                      <div className="flex-1 overflow-y-auto dense-scroll">
                        {aiHistory.length === 0 ? (
                          <p className="text-[11px] text-text-dim text-center py-6">Chưa có lịch sử</p>
                        ) : (
                          <div className="divide-y divide-border-subtle">
                            {aiHistory.map((item: any, idx: number) => {
                              const trendCls = item.trend === 'BULLISH' ? 'text-positive' : item.trend === 'BEARISH' ? 'text-negative' : 'text-warning';
                              return (
                                <details key={item.id} open={idx === 0} className="group">
                                  <summary className="px-3 py-2 cursor-pointer list-none hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[9px] text-text-dim">{new Date(item.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                      <span className={`text-[9px] font-bold ${trendCls}`}>{item.trend === 'BULLISH' ? '▲ Tăng' : item.trend === 'BEARISH' ? '▼ Giảm' : '→ Ngang'}</span>
                                      {item.recommendation && <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${item.recommendation === 'BUY' ? 'text-positive border-positive/20' : item.recommendation === 'SELL' ? 'text-negative border-negative/20' : 'text-warning border-warning/20'}`}>{item.recommendation}</span>}
                                      {idx === 0 && <span className="text-[8px] text-purple-300 ml-auto">MỚI NHẤT</span>}
                                    </div>
                                    {item.summary && <p className="text-[10px] text-text-muted mt-1 line-clamp-2">{item.summary}</p>}
                                  </summary>
                                  <div className="px-3 pb-2 text-[10px] space-y-1 border-t border-border-subtle bg-white/3">
                                    {(() => { const kl = item.key_levels || {}; const sup = kl.support || []; const res = kl.resistance || [];
                                      return (<>
                                        {sup.length > 0 && <div className="mt-1">Hỗ trợ: <span className="text-positive">{sup.map((v: number) => typeof v === 'number' ? (v/1000).toFixed(2) : v).join(', ')}</span></div>}
                                        {res.length > 0 && <div>Kháng cự: <span className="text-negative">{res.map((v: number) => typeof v === 'number' ? (v/1000).toFixed(2) : v).join(', ')}</span></div>}
                                      </>);
                                    })()}
                                    {item.volume_analysis && <div className="text-text-dim">{item.volume_analysis}</div>}
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: SL/TP Calculator với form nhập */}
                  <div className="w-64 shrink-0 panel-section flex flex-col">
                    <div className="px-3 py-2.5 border-b border-border-subtle shrink-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Gợi Ý SL/TP Theo Rủi Ro</p>
                    </div>
                    <div className="flex-1 overflow-y-auto dense-scroll">
                      {/* Form nhập thông số */}
                      <div className="p-3 space-y-3 border-b border-border-subtle">
                        {/* Side toggle */}
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">Chiều giao dịch</p>
                          <div className="flex gap-1">
                            {(['LONG', 'SHORT'] as const).map(s => (
                              <button key={s} onClick={() => setTradeForm(f => ({ ...f, side: s }))}
                                className={`flex-1 py-1.5 rounded text-[11px] font-bold transition-colors border ${tradeForm.side === s ? (s === 'LONG' ? 'bg-positive/20 text-positive border-positive/40' : 'bg-negative/20 text-negative border-negative/40') : 'bg-white/5 text-text-muted border-border-standard hover:border-accent/40'}`}>
                                {s === 'LONG' ? '▲ MUA' : '▼ BÁN'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Vốn đầu tư */}
                        <div>
                          <label className="block text-[9px] font-semibold uppercase tracking-wider text-text-dim mb-1">Vốn đầu tư (VND)</label>
                          <input
                            type="text"
                            placeholder="vd: 50000000"
                            value={tradeForm.capital}
                            onChange={e => setTradeForm(f => ({ ...f, capital: e.target.value }))}
                            className="w-full bg-panel border border-border-standard rounded px-2.5 py-1.5 text-[12px] font-mono text-text-main outline-none focus:border-accent"
                          />
                          {tradeForm.capital && !isNaN(parseFloat(tradeForm.capital.replace(/\D/g, ''))) && (
                            <p className="text-[9px] text-text-dim mt-0.5">{parseFloat(tradeForm.capital.replace(/\D/g, '')).toLocaleString('vi-VN')} VND</p>
                          )}
                        </div>

                        {/* % rủi ro + R:R trên 1 hàng */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-semibold uppercase tracking-wider text-text-dim mb-1">Rủi ro (%)</label>
                            <input type="number" step="0.5" min="0.1" max="20"
                              value={tradeForm.risk_percent}
                              onChange={e => setTradeForm(f => ({ ...f, risk_percent: e.target.value }))}
                              className="w-full bg-panel border border-border-standard rounded px-2.5 py-1.5 text-[12px] font-mono text-text-main outline-none focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-semibold uppercase tracking-wider text-text-dim mb-1">R:R ratio</label>
                            <input type="number" step="0.5" min="0.5" max="10"
                              value={tradeForm.rr_ratio}
                              onChange={e => setTradeForm(f => ({ ...f, rr_ratio: e.target.value }))}
                              className="w-full bg-panel border border-border-standard rounded px-2.5 py-1.5 text-[12px] font-mono text-text-main outline-none focus:border-accent"
                            />
                          </div>
                        </div>

                        {/* Hiển thị số tiền rủi ro tối đa */}
                        {tradeForm.capital && tradeForm.risk_percent && (
                          <div className="flex justify-between text-[10px] px-2 py-1.5 rounded bg-negative/5 border border-negative/20">
                            <span className="text-text-dim">Rủi ro tối đa</span>
                            <span className="font-mono font-semibold text-negative">
                              {Math.round(parseFloat(tradeForm.capital.replace(/\D/g, '') || '0') * parseFloat(tradeForm.risk_percent || '0') / 100).toLocaleString('vi-VN')} VND
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => generateTradeSignal(sym, exch)}
                          disabled={tradeSignalLoading[sym]}
                          className="w-full py-2 rounded bg-accent/20 text-accent font-semibold text-[11px] hover:bg-accent/30 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 border border-accent/30"
                        >
                          {tradeSignalLoading[sym]
                            ? <><span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" /> Đang tính toán...</>
                            : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>AI Gợi Ý SL/TP</>}
                        </button>
                        {/* Hiển thị lỗi nếu AI thất bại */}
                        {tradeSignalError[sym] && !tradeSignal[sym] && (
                          <p className="text-[10px] text-negative text-center mt-1">{tradeSignalError[sym]}</p>
                        )}
                      </div>

                      {/* Kết quả */}
                      {tradeSignal[sym] && (() => {
                        const d = tradeSignal[sym];
                        const recs: any[] = d.suggestions || [];
                        const recType = d.recommended || 'moderate';
                        const ps = d.position_sizing;
                        const fmtVND = (v: number) => v != null ? Math.round(v).toLocaleString('vi-VN') : '—';
                        const fmtPt = (v: number) => v != null ? (v >= 1000 ? v / 1000 : v).toFixed(2) : '—';

                        return (
                          <div className="p-3 space-y-3">
                            {/* Giá thị trường hiện tại */}
                            {d.current_price && (
                              <div className="flex justify-between text-[11px] px-2 py-1.5 rounded bg-white/5">
                                <span className="text-text-dim">Giá thị trường</span>
                                <span className="font-mono font-bold text-text-main">{fmtPt(d.current_price)}</span>
                              </div>
                            )}

                            {/* 3 mức SL/TP */}
                            {recs.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-text-dim">3 Mức Gợi Ý</p>
                                {recs.map((r: any) => {
                                  const isRec = r.type === recType;
                                  const typeCls = r.type === 'aggressive' ? 'border-negative/30 bg-negative/5' : r.type === 'conservative' ? 'border-positive/20 bg-positive/5' : 'border-accent/40 bg-accent/5';
                                  return (
                                    <div key={r.type} className={`rounded border p-2 ${typeCls} ${isRec ? 'ring-1 ring-accent/50' : ''}`}>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[9px] font-bold text-text-muted">{r.label}</span>
                                        {isRec && <span className="text-[8px] text-accent font-bold">✓ KHUYẾN NGHỊ</span>}
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                                        <div>
                                          <span className="text-text-dim">SL: </span>
                                          <span className="font-mono font-semibold text-negative">{fmtPt(r.stop_loss)}</span>
                                          {r.stop_loss_percent && <span className="text-negative text-[9px]"> ({r.stop_loss_percent.toFixed(1)}%)</span>}
                                        </div>
                                        <div>
                                          <span className="text-text-dim">TP: </span>
                                          <span className="font-mono font-semibold text-positive">{fmtPt(r.take_profit)}</span>
                                          {r.take_profit_percent && <span className="text-positive text-[9px]"> ({r.take_profit_percent.toFixed(1)}%)</span>}
                                        </div>
                                        <div className="col-span-2">
                                          <span className="text-text-dim">R/R: </span>
                                          <span className="font-mono text-accent">1:{typeof r.rr_ratio === 'number' ? r.rr_ratio.toFixed(2) : r.rr_ratio}</span>
                                          {r.confidence && <span className="text-text-dim ml-2">Độ tin cậy: <span className={r.confidence >= 70 ? 'text-positive' : r.confidence >= 40 ? 'text-warning' : 'text-negative'}>{r.confidence}%</span></span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Position Sizing */}
                            {ps && (
                              <div className="rounded border border-accent/20 bg-accent/5 p-2 space-y-1.5">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-accent mb-2">Quản Lý Vị Thế</p>
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-text-dim">Số lượng CP</span>
                                  <span className="font-mono font-bold text-text-main">{ps.suggested_quantity?.toLocaleString('vi-VN')} CP</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-text-dim">Vốn cần</span>
                                  <span className="font-mono font-semibold text-text-main">{fmtVND(ps.capital_required)} ₫</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-text-dim">Rủi ro thực tế</span>
                                  <span className="font-mono font-semibold text-negative">{fmtVND(ps.risk_amount_vnd)} ₫{ps.risk_percent_actual ? ` (${ps.risk_percent_actual}%)` : ''}</span>
                                </div>
                                {ps.potential_profit_vnd && (
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-text-dim">Lợi nhuận kỳ vọng</span>
                                    <span className="font-mono font-semibold text-positive">{fmtVND(ps.potential_profit_vnd)} ₫</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Analysis */}
                            {d.analysis && (
                              <div className="border-t border-border-subtle pt-2">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-text-dim mb-1">Phân tích kỹ thuật</p>
                                <p className="text-[10px] text-text-muted leading-relaxed">{d.analysis}</p>
                              </div>
                            )}
                            {d.market_context && (
                              <div className="border-t border-border-subtle pt-2">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-text-dim mb-1">Bối cảnh thị trường</p>
                                <p className="text-[10px] text-text-muted leading-relaxed">{d.market_context}</p>
                              </div>
                            )}

                            {/* Nút mở terminal với tín hiệu này */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (!onOpenTrading) return;
                                  // Lấy mức khuyến nghị (moderate) để pass SL/TP vào terminal
                                  const recommended = recs.find((r: any) => r.type === recType) || recs[0];
                                  onOpenTrading(sym, exch, {
                                    stopLoss: recommended?.stop_loss,
                                    takeProfit: recommended?.take_profit,
                                    side: tradeForm.side,
                                  });
                                }}
                                className="flex-1 py-1.5 rounded bg-positive/15 border border-positive/30 text-[10px] text-positive font-semibold hover:bg-positive/25 transition-colors flex items-center justify-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Áp Dụng vào Terminal
                              </button>
                              <button onClick={() => generateTradeSignal(sym, exch)} disabled={tradeSignalLoading[sym]}
                                className="flex-1 py-1.5 rounded bg-white/5 border border-border-standard text-[10px] text-text-dim hover:text-text-main hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                                Tính lại
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── ALERT MODAL ─────────────────────────────────────────────── */}
      {showAlertModal && alertTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAlertModal(false)}>
          <div className="panel-section w-full max-w-sm p-5 rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-text-main">
                🔔 Cảnh báo giá – {alertTarget.symbol}
              </h3>
              <button onClick={() => setShowAlertModal(false)} className="text-text-dim hover:text-text-main">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current price */}
            {quotes[alertTarget.symbol] && (
              <div className="mb-4 p-2 rounded bg-white/5 border border-border-subtle">
                <span className="text-[10px] text-text-dim">Giá hiện tại: </span>
                <span className={`text-[14px] font-mono font-bold ${quotes[alertTarget.symbol].changePercent >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {toPoint(quotes[alertTarget.symbol].price).toFixed(2)}
                </span>
                <span className="text-[10px] text-text-dim ml-1">nghìn đồng</span>
              </div>
            )}

            {/* Condition */}
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Điều kiện cảnh báo</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['ABOVE', 'BELOW', 'PERCENT_UP', 'PERCENT_DOWN'] as AlertCondition[]).map((cond) => (
                  <button
                    key={cond}
                    onClick={() => setAlertForm((f) => ({ ...f, condition: cond }))}
                    className={`px-2 py-2 rounded text-[11px] font-semibold border transition-colors ${
                      alertForm.condition === cond
                        ? 'bg-accent text-white border-accent'
                        : 'bg-panel border-border-standard text-text-muted hover:border-accent/50'
                    }`}
                  >
                    {cond === 'ABOVE' ? '▲ Vượt lên' : cond === 'BELOW' ? '▼ Xuống dưới' : cond === 'PERCENT_UP' ? 'MẠNH Tăng %' : 'CẢNH BÁO Giảm %'}
                  </button>
                ))}
              </div>
            </div>

            {/* Target value */}
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                {alertForm.condition === 'PERCENT_UP' || alertForm.condition === 'PERCENT_DOWN'
                  ? 'Ngưỡng % thay đổi'
                  : 'Mức giá mục tiêu (nghìn đồng)'}
              </label>
              <input
                type="number"
                step={alertForm.condition === 'PERCENT_UP' || alertForm.condition === 'PERCENT_DOWN' ? '0.1' : '0.01'}
                value={alertForm.target_value}
                onChange={(e) => setAlertForm((f) => ({ ...f, target_value: e.target.value }))}
                placeholder={alertForm.condition === 'PERCENT_UP' || alertForm.condition === 'PERCENT_DOWN' ? 'vd: 5 (tức 5%)' : 'vd: 28.5'}
                className="w-full bg-panel border border-border-standard rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent font-mono"
              />
              <p className="text-[9px] text-text-dim mt-1">
                {alertForm.condition === 'ABOVE' && 'Sẽ báo khi giá ≥ mức này'}
                {alertForm.condition === 'BELOW' && 'Sẽ báo khi giá ≤ mức này'}
                {alertForm.condition === 'PERCENT_UP' && `Sẽ báo khi giá tăng ≥ ${alertForm.target_value || '?'}% so với giá hiện tại`}
                {alertForm.condition === 'PERCENT_DOWN' && `Sẽ báo khi giá giảm ≥ ${alertForm.target_value || '?'}% so với giá hiện tại`}
              </p>
            </div>

            {/* Note */}
            <div className="mb-4">
              <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Ghi chú (tuỳ chọn)</label>
              <input
                type="text"
                value={alertForm.note}
                onChange={(e) => setAlertForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="vd: Mua vào khi đạt mức này"
                className="w-full bg-panel border border-border-standard rounded px-3 py-2 text-[12px] text-text-main outline-none focus:border-accent"
              />
            </div>

            {alertError && <p className="text-[11px] text-negative mb-3">{alertError}</p>}

            <div className="flex gap-2">
              <button onClick={() => setShowAlertModal(false)} className="flex-1 py-2 rounded border border-border-standard text-[12px] text-text-muted hover:bg-white/5 transition-colors">
                Huỷ
              </button>
              <button
                onClick={saveAlert}
                disabled={alertSaving || !alertForm.target_value}
                className="flex-1 py-2 rounded bg-accent text-white font-semibold text-[12px] hover:bg-accent/80 disabled:opacity-50 transition-colors"
              >
                {alertSaving ? 'Đang lưu...' : 'Tạo cảnh báo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
