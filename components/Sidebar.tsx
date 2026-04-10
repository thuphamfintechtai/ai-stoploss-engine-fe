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
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  paperTrading: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.699-1.329 2.699H4.13c-1.36 0-2.333-1.7-1.329-2.699L5 14.5" />
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
      { id: 'dashboard', label: 'Tổng quan', icon: Icons.dashboard },
      { id: 'portfolio', label: 'Quản lý vốn', icon: Icons.portfolio, colorVariant: 'blue' as const },
      { id: 'terminal', label: 'Đặt lệnh', icon: Icons.terminal },
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
      } bg-panel-secondary`}
    >
      {/* Brand / Logo */}
      <div className={`h-14 flex items-center shrink-0 border-b border-border-standard ${isOpen ? 'px-3 gap-3' : 'justify-center'}`}>
        {/* Icon — chevron up + protective arc */}
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-background border border-accent-subtle shadow-[0_0_12px_var(--color-accent-muted),inset_0_1px_0_var(--color-divider)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            {/* Chevron lên */}
            <path d="M4 17 L12 7 L20 17"
              stroke="var(--color-text-main)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Cung bảo vệ phía dưới — xanh lá */}
            <path d="M3 21 Q12 27 21 21"
              stroke="var(--color-positive)" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
            {/* Dot tại đỉnh chevron */}
            <circle cx="12" cy="7" r="2" fill="var(--color-positive)"/>
          </svg>
        </div>

        {isOpen && (
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-black tracking-[0.05em] leading-none text-text-main">
                TRADEGUARD
              </span>
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-positive text-text-inverse leading-none tracking-[0.05em]">
                AI
              </span>
            </div>
            <span className="block text-[9px] tracking-[0.2em] uppercase mt-1 text-text-muted opacity-70">
              Smart Terminal
            </span>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[58px] w-6 h-6 rounded-full flex items-center justify-center z-50 transition-colors duration-150 hover:text-accent bg-panel border border-border-standard text-text-muted shadow-elevated"
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
                const colorVariant = (item as any).colorVariant as 'blue' | 'violet' | undefined;

                // Style cho variant màu (Portfolio = blue, Mô Phỏng = violet)
                const variantActiveColor = colorVariant === 'blue'
                  ? 'var(--color-accent-active)'
                  : colorVariant === 'violet'
                  ? 'var(--color-secondary)'
                  : undefined;
                const variantActiveBg = colorVariant === 'blue'
                  ? 'var(--color-accent-subtle)'
                  : colorVariant === 'violet'
                  ? 'color-mix(in srgb, var(--color-secondary) 10%, transparent)'
                  : undefined;
                const variantTextClass = isActive
                  ? (colorVariant === 'blue'
                    ? 'text-accent-hover'
                    : colorVariant === 'violet'
                    ? 'text-secondary-hover'
                    : 'text-accent')
                  : 'text-text-muted hover:text-text-main';

                const activeBorderColor = variantActiveColor || 'var(--color-accent)';
                const activeBg = isActive ? (variantActiveBg || 'var(--color-accent-subtle)') : undefined;

                return (
                  <button
                    key={item.id}
                    onClick={() => onChangeView(item.id)}
                    title={!isOpen ? item.label : undefined}
                    className={`
                      relative flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-all duration-150
                      ${isOpen ? 'w-full px-3 py-2' : 'w-8 h-8 min-w-[32px] justify-center'}
                      ${isActive
                        ? `${variantTextClass} border-l-2`
                        : 'text-text-muted hover:text-text-main border-l-2 border-transparent hover:bg-white/5'
                      }
                    `}
                    style={isActive
                      ? { background: activeBg, borderLeftColor: activeBorderColor, paddingLeft: isOpen ? '10px' : undefined }
                      : {}
                    }
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
                ${isActive ? 'text-accent border-l-2 border-accent bg-accent-subtle' : 'text-text-muted hover:text-text-main border-l-2 border-transparent hover:bg-white/5'}
              `}
              style={isActive ? { paddingLeft: isOpen ? '10px' : undefined } : {}}
            >
              {Icons.settings}
              {isOpen && <span className="truncate">Cài Đặt</span>}
            </button>
          );
        })()}

        {/* User row */}
        <div className={`flex items-center min-w-0 py-2 ${isOpen ? 'gap-2.5 px-3' : 'justify-center'}`}>
          <div
            className="rounded-md flex items-center justify-center text-[11px] font-bold text-text-main shrink-0 w-7 h-7 bg-accent-subtle border border-border-standard"
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
