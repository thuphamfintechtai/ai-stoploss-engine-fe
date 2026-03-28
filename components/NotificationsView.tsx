import React, { useState, useEffect, useCallback } from 'react';
import { notificationsApi } from '../services/api';
import type { Notification } from '../services/api';
import { FinancialTooltip } from './ui/Tooltip';
import { EmptyState } from './ui/EmptyState';

interface Props {
  onUnreadCountChange?: (count: number) => void;
  onNavigate?: (view: string) => void;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} giờ trước`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}

// Notification type categories
type FilterTab = 'all' | 'ai' | 'price' | 'risk' | 'system';

const AI_TYPES = new Set(['AI_SIGNAL', 'AI_REVIEW', 'AI_TREND', 'AI_SUGGESTION']);
const PRICE_TYPES = new Set(['PRICE_ALERT', 'STOP_LOSS', 'TAKE_PROFIT', 'TRAILING_UPDATE']);
const RISK_TYPES = new Set(['RISK_ALERT', 'MARGIN_CALL', 'DRAWDOWN_ALERT', 'POSITION_SIZE']);

function getCategory(type: string): FilterTab {
  if (AI_TYPES.has(type)) return 'ai';
  if (PRICE_TYPES.has(type)) return 'price';
  if (RISK_TYPES.has(type)) return 'risk';
  return 'system';
}

// Severity styles
const SEVERITY_CONFIG: Record<string, {
  dot: string; border: string; bg: string; headerBg: string;
}> = {
  INFO:    { dot: 'bg-info',     border: 'border-info/20',     bg: 'hover:bg-info/5',     headerBg: 'bg-info/8' },
  WARNING: { dot: 'bg-warning',  border: 'border-warning/20',  bg: 'hover:bg-warning/5',  headerBg: 'bg-warning/8' },
  SUCCESS: { dot: 'bg-positive', border: 'border-positive/20', bg: 'hover:bg-positive/5', headerBg: 'bg-positive/8' },
  ERROR:   { dot: 'bg-negative', border: 'border-negative/20', bg: 'hover:bg-negative/5', headerBg: 'bg-negative/8' },
};

// Icons per notification type
function TypeIcon({ type, severity }: { type: string; severity: string }) {
  const color = severity === 'ERROR' ? 'text-negative'
    : severity === 'WARNING' ? 'text-warning'
    : severity === 'SUCCESS' ? 'text-positive'
    : 'text-info';

  if (AI_TYPES.has(type)) {
    return (
      <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    );
  }
  if (type === 'STOP_LOSS' || type === 'TRAILING_UPDATE') {
    return (
      <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
      </svg>
    );
  }
  if (type === 'PRICE_ALERT' || type === 'TAKE_PROFIT') {
    return (
      <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    );
  }
  if (RISK_TYPES.has(type)) {
    return (
      <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    );
  }
  return (
    <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

// Action buttons based on notification type
function ActionButtons({ notif, onNavigate, onDismiss }: {
  notif: Notification;
  onNavigate?: (view: string) => void;
  onDismiss: () => void;
}) {
  const type = notif.type;
  const meta = notif.metadata ?? {};

  if (AI_TYPES.has(type)) {
    return (
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {meta.symbol && (
          <button
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onNavigate?.('terminal'); }}
            className="text-[10px] px-2 py-1 rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
          >
            Xem mã {meta.symbol as string} →
          </button>
        )}
        <button
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onNavigate?.('portfolio'); }}
          className="text-[10px] px-2 py-1 rounded border border-info/30 text-info hover:bg-info/10 transition-colors"
        >
          Review vị thế →
        </button>
        <button
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDismiss(); }}
          className="text-[10px] px-2 py-1 rounded border border-border-standard text-text-dim hover:text-text-muted hover:bg-white/5 transition-colors"
        >
          Bỏ qua
        </button>
      </div>
    );
  }

  if (type === 'STOP_LOSS' || type === 'TAKE_PROFIT') {
    return (
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <button
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onNavigate?.('portfolio'); }}
          className="text-[10px] px-2 py-1 rounded border border-border-standard text-text-muted hover:bg-white/5 transition-colors"
        >
          Xem danh mục →
        </button>
        {meta.symbol && (
          <button
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onNavigate?.('terminal'); }}
            className="text-[10px] px-2 py-1 rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
          >
            Đặt lệnh mới →
          </button>
        )}
      </div>
    );
  }

  if (type === 'PRICE_ALERT') {
    return (
      <div className="flex items-center gap-1.5 mt-2">
        {meta.symbol && (
          <button
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onNavigate?.('terminal'); }}
            className="text-[10px] px-2 py-1 rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
          >
            Phân tích {meta.symbol as string} →
          </button>
        )}
        <button
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDismiss(); }}
          className="text-[10px] px-2 py-1 rounded border border-border-standard text-text-dim hover:text-text-muted hover:bg-white/5 transition-colors"
        >
          Đã biết
        </button>
      </div>
    );
  }

  if (RISK_TYPES.has(type)) {
    return (
      <div className="flex items-center gap-1.5 mt-2">
        <button
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onNavigate?.('portfolio'); }}
          className="text-[10px] px-2 py-1 rounded border border-negative/30 text-negative hover:bg-negative/10 transition-colors"
        >
          Quản lý rủi ro →
        </button>
      </div>
    );
  }

  return null;
}

// Category tab config
const TABS: { id: FilterTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'all',
    label: 'Tất Cả',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    id: 'ai',
    label: 'AI',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
  {
    id: 'price',
    label: 'Giá',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
  {
    id: 'risk',
    label: 'Rủi Ro',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
      </svg>
    ),
  },
  {
    id: 'system',
    label: 'Hệ Thống',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  },
];

export const NotificationsView: React.FC<Props> = ({ onUnreadCountChange, onNavigate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const LIMIT = 20;

  const loadNotifications = useCallback(async (pageNum = 0, replace = true) => {
    try {
      setLoading(true);
      const res = await notificationsApi.getAll({
        limit: LIMIT,
        offset: pageNum * LIMIT,
        unread_only: unreadOnly,
      });
      if (res.data.success) {
        const items: Notification[] = res.data.data;
        setNotifications((prev: Notification[]) => replace ? items : [...prev, ...items]);
        setHasMore(res.data.pagination?.has_more ?? false);
        const unreadCount = res.data.unread_count ?? 0;
        onUnreadCountChange?.(unreadCount);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, onUnreadCountChange]);

  useEffect(() => {
    setPage(0);
    loadNotifications(0, true);
  }, [unreadOnly]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev: Notification[]) => prev.map((n: Notification) => n.id === id ? { ...n, is_read: true } : n));
      const countRes = await notificationsApi.getUnreadCount();
      onUnreadCountChange?.(countRes.data.data.count);
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    // Optimistic update
    const prev = notifications;
    setNotifications((ns: Notification[]) => ns.map((n: Notification) => ({ ...n, is_read: true })));
    onUnreadCountChange?.(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      // Rollback nếu API fail
      setNotifications(prev);
      const countRes = await notificationsApi.getUnreadCount().catch(() => null);
      if (countRes?.data?.data?.count != null) onUnreadCountChange?.(countRes.data.data.count);
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    setNotifications((prev: Notification[]) => prev.filter((n: Notification) => n.id !== id));
    try {
      await notificationsApi.delete(id);
    } catch {
      // Rollback – reload
      loadNotifications(page, true);
    }
  };

  const handleDeleteRead = async () => {
    if (!window.confirm('Xoá tất cả thông báo đã đọc?')) return;
    try {
      await notificationsApi.deleteRead();
      await loadNotifications(0, true);
    } catch { /* ignore */ }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadNotifications(nextPage, false);
  };

  // Filter by tab + unread
  const filtered: Notification[] = notifications.filter((n: Notification) => {
    if (unreadOnly && n.is_read) return false;
    if (activeTab === 'all') return true;
    return getCategory(n.type) === activeTab;
  });

  // Count per tab
  const counts: Record<FilterTab, number> = { all: 0, ai: 0, price: 0, risk: 0, system: 0 };
  notifications.forEach((n: Notification) => {
    if (!n.is_read) {
      counts.all++;
      counts[getCategory(n.type)]++;
    }
  });

  return (
    <div className="animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-text-main">Trung Tâm Cảnh Báo AI</h2>
          {counts.all > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-accent/20 text-accent border border-accent/30 animate-pulse">
              {counts.all} mới
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Unread toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={() => setUnreadOnly((v: boolean) => !v)}
              className={`relative w-7 h-4 rounded-full transition-colors cursor-pointer ${unreadOnly ? 'bg-accent' : 'bg-border-standard'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${unreadOnly ? 'left-3.5' : 'left-0.5'}`} />
            </div>
            <span className="text-[11px] text-text-muted select-none">Chưa đọc</span>
          </label>
          {counts.all > 0 && (
            <button onClick={handleMarkAllRead} className="text-[11px] text-accent hover:underline">
              Đọc tất cả
            </button>
          )}
          {notifications.some((n: Notification) => n.is_read) && (
            <button onClick={handleDeleteRead} className="text-[11px] text-text-dim hover:text-negative hover:underline">
              Xóa đã đọc
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-3 shrink-0 border-b border-border-standard pb-2 overflow-x-auto dense-scroll">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-accent/15 text-accent'
                : 'text-text-muted hover:text-text-main hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
            {counts[tab.id] > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-accent/20 text-accent' : 'bg-white/10 text-text-muted'
              }`}>
                {counts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 mb-3 shrink-0">
        <span className="text-[11px] text-text-dim">
          {filtered.length} thông báo{activeTab !== 'all' ? ` trong mục "${TABS.find(t => t.id === activeTab)?.label}"` : ''}
        </span>
        {activeTab === 'risk' && counts.risk > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-negative/10 text-negative border border-negative/20 font-semibold">
            Cần xử lý ngay
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto dense-scroll space-y-1.5 grid grid-cols-1">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={unreadOnly ? 'Không có cảnh báo chưa đọc' : 'Không có thông báo mới'}
            description="Thông báo sẽ xuất hiện khi có sự kiện quan trọng: lệnh khớp, SL thay đổi, cảnh báo rủi ro."
          />
        ) : (
          <>
            {filtered.map((notif: Notification) => {
              const sev = SEVERITY_CONFIG[notif.severity] ?? SEVERITY_CONFIG.INFO;
              const isUrgent = (notif.severity === 'ERROR') && !notif.is_read;
              return (
                <div
                  key={notif.id}
                  className={`
                    group relative flex gap-3 p-3 rounded-lg border transition-all cursor-default
                    ${notif.is_read
                      ? `border-border-standard bg-transparent ${sev.bg}`
                      : `border ${sev.border} bg-white/[0.03] ${sev.bg}`
                    }
                    ${isUrgent ? 'ring-1 ring-negative/20' : ''}
                  `}
                  onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                >
                  {/* Unread dot */}
                  {!notif.is_read && (
                    <span className={`absolute right-3 top-3 w-2 h-2 rounded-full ${sev.dot} shrink-0 ${isUrgent ? 'animate-pulse' : ''}`} />
                  )}

                  {/* Icon */}
                  <div className="shrink-0 mt-0.5">
                    <TypeIcon type={notif.type} severity={notif.severity} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className={`text-[13px] font-medium leading-snug ${notif.is_read ? 'text-text-muted' : 'text-text-main'}`}>
                        {notif.title}
                      </p>
                      {/* Category badge */}
                      {getCategory(notif.type) === 'ai' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/20 shrink-0">
                          AI
                        </span>
                      )}
                      {(notif.severity === 'ERROR') && !notif.is_read && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-negative/15 text-negative border border-negative/20 shrink-0">
                          KHẨN
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-text-dim mt-0.5 leading-snug">{notif.message}</p>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-text-dim">{fmtTime(notif.created_at)}</span>
                      {notif.metadata?.symbol && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                          {notif.metadata.symbol as string}
                        </span>
                      )}
                      <span className={`text-[9px] uppercase tracking-wide ${
                        notif.severity === 'ERROR' ? 'text-negative' :
                        notif.severity === 'WARNING' ? 'text-warning' :
                        notif.severity === 'SUCCESS' ? 'text-positive' : 'text-info'
                      }`}>
                        {notif.severity}
                      </span>
                    </div>

                    {/* Action buttons */}
                    {!notif.is_read && onNavigate && (
                      <ActionButtons
                        notif={notif}
                        onNavigate={onNavigate}
                        onDismiss={() => handleMarkRead(notif.id)}
                      />
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(notif.id); }}
                    className="absolute right-2.5 bottom-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-negative/10 text-text-dim hover:text-negative"
                    title="Xóa"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-2.5 text-[12px] text-text-muted hover:text-text-main border border-border-standard rounded-lg hover:bg-white/5 transition-colors"
              >
                {loading ? 'Đang tải...' : 'Xem thêm'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
