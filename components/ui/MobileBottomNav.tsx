import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface MobileBottomNavProps {
  currentView: string;
  onChangeView: (view: string) => void;
  unreadNotifications?: number;
}

// Theme icons for quick toggle
const ThemeIcons = {
  sun: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  moon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  ),
};

// Optimized Icons (20x20 for mobile touch targets)
const Icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  portfolio: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  terminal: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  ),
  watchlist: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  menu: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
  market: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
    </svg>
  ),
  notifications: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

// Primary nav items (shown directly in bottom bar)
const PRIMARY_NAV = [
  { id: 'dashboard', label: 'Tổng quan', icon: Icons.dashboard },
  { id: 'portfolio', label: 'Vốn', icon: Icons.portfolio },
  { id: 'terminal', label: 'Lệnh', icon: Icons.terminal },
  { id: 'watchlist', label: 'Theo dõi', icon: Icons.watchlist },
];

// Secondary nav items (shown in menu sheet)
const SECONDARY_NAV = [
  { id: 'market', label: 'Bảng giá', icon: Icons.market },
  { id: 'notifications', label: 'Thông báo', icon: Icons.notifications },
  { id: 'settings', label: 'Cài đặt', icon: Icons.settings },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onChangeView,
  unreadNotifications = 0,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Phase 10 A-02 — theme từ ThemeContext (SSoT)
  const { theme, toggleTheme } = useTheme();

  const activeId = currentView === 'home' ? 'dashboard' : currentView;
  const isSecondaryActive = SECONDARY_NAV.some(item => item.id === activeId);

  const handleNav = (viewId: string) => {
    onChangeView(viewId);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[60] lg:hidden"
        style={{
          background: 'var(--color-background)',
          borderTop: '1px solid var(--color-border-subtle)',
          height: 56,
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
        }}
      >
        <div className="flex items-center justify-around h-full px-2">
          {/* Primary nav items */}
          {PRIMARY_NAV.map(item => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`
                  flex flex-col items-center justify-center gap-1 flex-1 h-full
                  transition-colors duration-150 active:scale-95
                  ${isActive ? 'text-accent' : 'text-text-dim'}
                `}
              >
                {item.icon}
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </button>
            );
          })}

          {/* Menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`
              flex flex-col items-center justify-center gap-1 flex-1 h-full
              transition-colors duration-150 active:scale-95
              ${isMenuOpen || isSecondaryActive ? 'text-accent' : 'text-text-dim'}
            `}
          >
            <span className="relative">
              {isMenuOpen ? Icons.close : Icons.menu}
              {!isMenuOpen && unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-negative" />
              )}
            </span>
            <span className="text-[10px] font-medium leading-none">Menu</span>
          </button>
        </div>
      </nav>

      {/* Menu Sheet */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[59] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
            style={{ animation: 'fadeIn 0.15s ease-out' }}
          />

          {/* Bottom Sheet */}
          <div
            className="absolute bottom-14 left-3 right-3 rounded-xl overflow-hidden"
            style={{
              background: 'var(--color-background)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
              animation: 'fadeUp 0.2s ease-out',
              paddingBottom: 'env(safe-area-inset-bottom, 0)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: 'var(--color-border-standard)' }}
              />
            </div>

            {/* Menu Grid */}
            <div className="px-3 pb-4">
              <div className="grid grid-cols-3 gap-2">
                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl transition-all duration-150 active:scale-95 text-text-muted hover:bg-white/5"
                >
                  {theme === 'dark' ? ThemeIcons.sun : ThemeIcons.moon}
                  <span className="text-[12px] font-medium">
                    {theme === 'dark' ? 'Sáng' : 'Tối'}
                  </span>
                </button>
                {SECONDARY_NAV.map(item => {
                  const isActive = activeId === item.id;
                  const hasNotification = item.id === 'notifications' && unreadNotifications > 0;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={`
                        flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl
                        transition-all duration-150 active:scale-95
                        ${isActive
                          ? 'text-accent bg-accent/10'
                          : 'text-text-muted hover:bg-white/5'
                        }
                      `}
                    >
                      <span className="relative">
                        {item.icon}
                        {hasNotification && (
                          <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 rounded-full bg-negative text-white text-[9px] font-bold flex items-center justify-center px-1">
                            {unreadNotifications > 99 ? '99+' : unreadNotifications}
                          </span>
                        )}
                      </span>
                      <span className="text-[12px] font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
