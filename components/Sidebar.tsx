import React from 'react';

interface Props {
  currentView: string;
  onChangeView: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onLogout?: () => void | Promise<void>;
  unreadNotifications?: number;
}

const Icons = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  portfolio: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  terminal: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  ),
  watchlist: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  market: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
    </svg>
  ),
  news: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6V7.5z" />
    </svg>
  ),
  signals: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
  risk: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  notifications: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
};

const NAV_SECTIONS = [
  {
    label: 'Danh mục',
    items: [
      { id: 'dashboard', label: 'Tổng Quan', icon: Icons.dashboard },
      { id: 'portfolio', label: 'Portfolio', icon: Icons.portfolio },
      { id: 'terminal', label: 'Terminal', icon: Icons.terminal },
    ],
  },
  {
    label: 'Thị trường',
    items: [
      { id: 'watchlist', label: 'Theo Dõi', icon: Icons.watchlist },
      { id: 'market', label: 'Bảng Giá', icon: Icons.market },
    ],
  },
  {
    label: 'Phân tích',
    items: [
      { id: 'notifications', label: 'Thông Báo', icon: Icons.notifications },
    ],
  },
];

export const Sidebar: React.FC<Props> = ({ currentView, onChangeView, isOpen, onToggle, onLogout, unreadNotifications = 0 }) => {
  const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
  const user = userStr ? (() => { try { return JSON.parse(userStr); } catch { return null; } })() : null;
  const displayName = user?.username || user?.fullName || user?.email?.split('@')[0] || 'User';
  const initials = (displayName.slice(0, 2) || 'AD').toUpperCase();

  // 'home' backward-compat → 'dashboard'
  const activeId = currentView === 'home' ? 'dashboard' : currentView;

  return (
    <div
      className={`hidden lg:flex h-screen fixed left-0 top-0 flex-col z-50 border-r border-border-standard transition-[width] duration-200 ease-out ${
        isOpen ? 'w-[220px]' : 'w-16'
      }`}
      style={{ background: 'var(--color-panel-secondary)' }}
    >
      {/* Brand / Logo */}
      <div className={`h-14 flex items-center shrink-0 border-b border-border-standard ${isOpen ? 'px-3 gap-3' : 'justify-center'}`}>
        {/* Icon — chevron up + protective arc */}
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: '#080d1a', border: '1px solid rgba(59,130,246,0.2)', boxShadow: '0 0 12px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            {/* Chevron lên — trắng đậm */}
            <path d="M4 17 L12 7 L20 17"
              stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Cung bảo vệ phía dưới — xanh lá */}
            <path d="M3 21 Q12 27 21 21"
              stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
            {/* Dot tại đỉnh chevron */}
            <circle cx="12" cy="7" r="2" fill="#22c55e"/>
          </svg>
        </div>

        {isOpen && (
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-black tracking-[0.05em] leading-none" style={{ color: '#f1f5f9' }}>
                TRADEGUARD
              </span>
              <span className="text-[8px] font-bold px-1 py-0.5 rounded"
                style={{ background: '#22c55e', color: '#000', lineHeight: 1, letterSpacing: '0.05em' }}>
                AI
              </span>
            </div>
            <span className="block text-[9px] tracking-[0.2em] uppercase mt-1" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Smart Terminal
            </span>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[58px] w-6 h-6 rounded-full flex items-center justify-center z-50 transition-colors duration-150 hover:text-accent"
        style={{
          background: 'var(--color-panel)',
          border: '1px solid var(--color-border-standard)',
          color: 'var(--color-text-muted)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}
        aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
      >
        {isOpen ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto py-2 dense-scroll">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-1">
            {isOpen && (
              <p className="px-4 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                {section.label}
              </p>
            )}
            {!isOpen && <div className="h-2" />}
            <div className={`space-y-0.5 ${isOpen ? 'px-2' : 'px-2 flex flex-col items-center'}`}>
              {section.items.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onChangeView(item.id)}
                    title={!isOpen ? item.label : undefined}
                    className={`
                      relative flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-all duration-150
                      ${isOpen ? 'w-full px-3 py-2' : 'w-8 h-8 min-w-[32px] justify-center'}
                      ${isActive
                        ? 'text-accent border-l-2 border-accent'
                        : 'text-text-muted hover:text-text-main border-l-2 border-transparent hover:bg-white/5'
                      }
                    `}
                    style={isActive ? { background: 'var(--color-accent-subtle)', paddingLeft: isOpen ? '10px' : undefined } : {}}
                  >
                    <span className="shrink-0 relative">
                      {item.icon}
                      {item.id === 'notifications' && unreadNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                          {unreadNotifications > 99 ? '99+' : unreadNotifications}
                        </span>
                      )}
                    </span>
                    {isOpen && <span className="truncate leading-none">{item.label}</span>}
                    {isOpen && item.id === 'notifications' && unreadNotifications > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold flex items-center justify-center px-1 border border-red-500/30">
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: Settings + User + Logout */}
      <div className={`shrink-0 border-t border-border-standard ${isOpen ? 'p-2 space-y-0.5' : 'p-2 flex flex-col items-center gap-1'}`}>
        {/* Settings */}
        {(() => {
          const isActive = activeId === 'settings';
          return (
            <button
              onClick={() => onChangeView('settings')}
              title={!isOpen ? 'Cài đặt' : undefined}
              className={`
                flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-all duration-150
                ${isOpen ? 'w-full px-3 py-2' : 'w-8 h-8 min-w-[32px] justify-center'}
                ${isActive ? 'text-accent border-l-2 border-accent' : 'text-text-muted hover:text-text-main border-l-2 border-transparent hover:bg-white/5'}
              `}
              style={isActive ? { background: 'var(--color-accent-subtle)', paddingLeft: isOpen ? '10px' : undefined } : {}}
            >
              {Icons.settings}
              {isOpen && <span className="truncate">Cài Đặt</span>}
            </button>
          );
        })()}

        {/* User row */}
        <div className={`flex items-center min-w-0 py-2 ${isOpen ? 'gap-2.5 px-3' : 'justify-center'}`}>
          <div
            className="rounded-md flex items-center justify-center text-[11px] font-bold text-text-main shrink-0 w-7 h-7"
            style={{ background: 'var(--color-accent-subtle)', border: '1px solid var(--color-border-standard)' }}
          >
            {initials}
          </div>
          {isOpen && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-text-main truncate leading-none">{displayName}</p>
                <p className="text-[10px] text-positive flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-positive inline-block" />
                  Online
                </p>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => onLogout()}
                  title="Đăng xuất"
                  className="p-1.5 rounded-md transition-colors shrink-0 text-text-dim hover:text-negative hover:bg-red-950/40"
                >
                  {Icons.logout}
                </button>
              )}
            </>
          )}
        </div>

        {/* Logout khi thu gọn */}
        {!isOpen && onLogout && (
          <button
            type="button"
            onClick={() => onLogout()}
            title="Đăng xuất"
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors text-text-dim hover:text-negative hover:bg-red-950/40"
          >
            {Icons.logout}
          </button>
        )}
      </div>
    </div>
  );
};
