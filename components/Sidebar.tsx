import React, { useState } from 'react';
import { PortfolioSwitcher } from './portfolio/PortfolioSwitcher';

interface Props {
  currentView: string;
  onChangeView: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onLogout?: () => void | Promise<void>;
  unreadNotifications?: number;
}

// Theme icons for quick toggle
const ThemeIcons = {
  sun: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  moon: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  ),
};

// TradingView-style Icons (optimized for 18x18 display)
const Icons = {
  dashboard: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  portfolio: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  terminal: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  ),
  watchlist: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  market: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
    </svg>
  ),
  notifications: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  settings: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
  collapse: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  expand: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
};

// Overview icon (Phase 8 — MP-05)
const OverviewIcon = (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

// Navigation items organized by section
const NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: OverviewIcon },
  { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
  { id: 'portfolio', label: 'Quản lý vốn', icon: Icons.portfolio },
  { id: 'terminal', label: 'Đặt lệnh', icon: Icons.terminal },
  { id: 'watchlist', label: 'Theo dõi', icon: Icons.watchlist },
  { id: 'market', label: 'Bảng giá', icon: Icons.market },
  { id: 'notifications', label: 'Thông báo', icon: Icons.notifications },
];

// Tooltip component for collapsed state
const NavTooltip: React.FC<{ label: string; visible: boolean }> = ({ label, visible }) => {
  if (!visible) return null;
  return (
    <div
      className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap z-50 pointer-events-none"
      style={{
        background: 'var(--color-panel)',
        border: '1px solid var(--color-border-standard)',
        boxShadow: 'var(--shadow-elevated)',
        color: 'var(--color-text-main)',
      }}
    >
      {label}
    </div>
  );
};

// Nav Item component
const NavItem: React.FC<{
  item: { id: string; label: string; icon: React.ReactNode };
  isActive: boolean;
  isOpen: boolean;
  onClick: () => void;
  badge?: number;
}> = ({ item, isActive, isOpen, onClick, badge }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !isOpen && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      className={`
        relative flex items-center w-full rounded-md transition-all duration-150 ease-out
        ${isOpen ? 'px-3 py-2 gap-3' : 'p-2 justify-center'}
        ${isActive
          ? 'text-accent bg-accent/10'
          : 'text-text-muted hover:text-text-main hover:bg-white/5'
        }
      `}
    >
      <span className="relative shrink-0">
        {item.icon}
        {badge !== undefined && badge > 0 && !isOpen && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-negative text-white text-[9px] font-bold flex items-center justify-center px-0.5">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>

      {isOpen && (
        <>
          <span className="text-[13px] font-medium truncate">{item.label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="ml-auto min-w-[20px] h-5 rounded-full bg-negative/20 text-negative-text text-[10px] font-bold flex items-center justify-center px-1.5">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}

      <NavTooltip label={item.label} visible={showTooltip} />
    </button>
  );
};

export const Sidebar: React.FC<Props> = ({
  currentView,
  onChangeView,
  isOpen,
  onToggle,
  onLogout,
  unreadNotifications = 0
}) => {
  const [settingsTooltip, setSettingsTooltip] = useState(false);
  const [logoutTooltip, setLogoutTooltip] = useState(false);
  const [themeTooltip, setThemeTooltip] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'dark');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
  const user = userStr ? (() => { try { return JSON.parse(userStr); } catch { return null; } })() : null;
  const displayName = user?.username || user?.fullName || user?.email?.split('@')[0] || 'User';
  const initials = (displayName.slice(0, 2) || 'U').toUpperCase();

  const activeId = currentView === 'home' ? 'dashboard' : currentView;

  return (
    <aside
      className={`
        hidden lg:flex h-screen fixed left-0 top-0 flex-col z-50
        transition-[width] duration-200 ease-out
        ${isOpen ? 'w-[200px]' : 'w-[52px]'}
      `}
      style={{
        background: 'var(--color-background)',
        borderRight: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Logo / Brand */}
      <div
        className={`
          h-12 flex items-center shrink-0
          ${isOpen ? 'px-3 gap-2.5' : 'justify-center'}
        `}
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" fill="white" fillOpacity="0.9"/>
            <path d="M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z" fill="white" fillOpacity="0.7"/>
            <path d="M16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" fill="white"/>
          </svg>
        </div>

        {isOpen && (
          <div className="min-w-0 flex-1">
            <span className="text-[13px] font-bold tracking-tight text-text-main">
              TradeGuard
            </span>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="
          absolute -right-3 top-[54px] w-6 h-6 rounded-full z-50
          flex items-center justify-center transition-colors duration-150
          text-text-dim hover:text-text-main
        "
        style={{
          background: 'var(--color-panel)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
        aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
      >
        {isOpen ? Icons.collapse : Icons.expand}
      </button>

      {/* Portfolio Switcher (Phase 8 — MP-04) */}
      <div
        className="shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <PortfolioSwitcher compact={!isOpen} />
      </div>

      {/* Main Navigation */}
      <nav className={`flex-1 overflow-y-auto py-3 ${isOpen ? 'px-2' : 'px-1.5'} dense-scroll`}>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              isActive={activeId === item.id}
              isOpen={isOpen}
              onClick={() => onChangeView(item.id)}
              badge={item.id === 'notifications' ? unreadNotifications : undefined}
            />
          ))}
        </div>
      </nav>

      {/* Footer: Divider + Settings + User */}
      <div
        className={`shrink-0 ${isOpen ? 'px-2 pb-2' : 'px-1.5 pb-2'}`}
        style={{ borderTop: '1px solid var(--color-border-subtle)' }}
      >
        {/* Theme Toggle + Settings */}
        <div className="pt-2 space-y-0.5">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            onMouseEnter={() => !isOpen && setThemeTooltip(true)}
            onMouseLeave={() => setThemeTooltip(false)}
            className={`
              relative flex items-center w-full rounded-md transition-all duration-150
              ${isOpen ? 'px-3 py-2 gap-3' : 'p-2 justify-center'}
              text-text-muted hover:text-text-main hover:bg-white/5
            `}
            title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          >
            {theme === 'dark' ? ThemeIcons.sun : ThemeIcons.moon}
            {isOpen && (
              <span className="text-[13px] font-medium">
                {theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
              </span>
            )}
            <NavTooltip label={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'} visible={themeTooltip} />
          </button>

          {/* Settings */}
          <button
            onClick={() => onChangeView('settings')}
            onMouseEnter={() => !isOpen && setSettingsTooltip(true)}
            onMouseLeave={() => setSettingsTooltip(false)}
            aria-label="Cài đặt"
            aria-current={activeId === 'settings' ? 'page' : undefined}
            className={`
              relative flex items-center w-full rounded-md transition-all duration-150
              ${isOpen ? 'px-3 py-2 gap-3' : 'p-2 justify-center'}
              ${activeId === 'settings'
                ? 'text-accent bg-accent/10'
                : 'text-text-muted hover:text-text-main hover:bg-white/5'
              }
            `}
          >
            {Icons.settings}
            {isOpen && <span className="text-[13px] font-medium">Cài đặt</span>}
            <NavTooltip label="Cài đặt" visible={settingsTooltip} />
          </button>
        </div>

        {/* User Profile */}
        <div
          className={`
            mt-2 flex items-center rounded-md
            ${isOpen ? 'px-2 py-2 gap-2.5' : 'p-2 justify-center'}
          `}
          style={{ background: 'var(--color-panel-secondary)' }}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {initials}
          </div>

          {isOpen && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-text-main truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-positive flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-positive inline-block animate-pulse" />
                  Online
                </p>
              </div>

              {onLogout && (
                <button
                  onClick={() => onLogout()}
                  onMouseEnter={() => setLogoutTooltip(true)}
                  onMouseLeave={() => setLogoutTooltip(false)}
                  className="relative p-1.5 rounded-md transition-colors text-text-dim hover:text-negative hover:bg-negative/10"
                  title="Đăng xuất"
                >
                  {Icons.logout}
                </button>
              )}
            </>
          )}
        </div>

        {/* Logout button when collapsed */}
        {!isOpen && onLogout && (
          <button
            onClick={() => onLogout()}
            onMouseEnter={() => setLogoutTooltip(true)}
            onMouseLeave={() => setLogoutTooltip(false)}
            className="
              relative w-full mt-1 p-2 rounded-md flex items-center justify-center
              transition-colors text-text-dim hover:text-negative hover:bg-negative/10
            "
          >
            {Icons.logout}
            <NavTooltip label="Đăng xuất" visible={logoutTooltip} />
          </button>
        )}
      </div>
    </aside>
  );
};
