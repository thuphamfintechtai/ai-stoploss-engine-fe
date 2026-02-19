import React from 'react';

interface Props {
  currentView: string;
  onChangeView: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onLogout?: () => void | Promise<void>;
}

export const Sidebar: React.FC<Props> = ({ currentView, onChangeView, isOpen, onToggle, onLogout }) => {
  const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
  const user = userStr ? (() => { try { return JSON.parse(userStr); } catch { return null; } })() : null;
  const displayName = user?.username || user?.fullName || user?.email?.split('@')[0] || 'User';
  const initials = (displayName.slice(0, 2) || 'AD').toUpperCase();
  const menuItems = [
    { id: 'home', label: 'Tổng Quan', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    )},
    { id: 'terminal', label: 'Giao Dịch', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    )},
    { id: 'market', label: 'Tin Tức', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125v18.75c0 .621-.504 1.125-1.125 1.125h-3.375m0-3H21m-3.75 3H21m-3.75 3h-3.375m0-3H21" />
      </svg>
    )},
  ];

  return (
    <div
      className={`hidden lg:flex h-screen fixed left-0 top-0 flex-col z-50 bg-white border-r border-[#E5E7EB] transition-[width] duration-200 ease-out ${isOpen ? 'w-56' : 'w-[72px]'}`}
    >
      {/* Brand */}
      <div className={`h-16 flex items-center shrink-0 ${isOpen ? 'px-4' : 'justify-center'} border-b border-[#E5E7EB]`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-[#1E3A5F] shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
            <span className="block text-sm font-semibold text-[#111827] truncate">RiskGuard</span>
            <span className="block text-[10px] text-[#6B7280] font-medium">Risk Management</span>
          </div>
        </div>
      </div>

      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-[#E5E7EB] rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#1E3A5F] hover:border-[#1E3A5F] shadow-sm z-50 transition-colors duration-150"
        aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
      >
        {isOpen ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        )}
      </button>

      <nav className={`flex-1 overflow-y-auto ${isOpen ? 'py-4 space-y-1' : 'py-3 flex flex-col items-center gap-1'}`}>
        {isOpen && <p className="px-4 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">Menu</p>}
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            title={!isOpen ? item.label : ''}
            className={`flex items-center rounded-lg text-sm font-medium transition-colors duration-150 ${
              isOpen ? 'w-[calc(100%-16px)] mx-2 gap-3 px-3 py-2.5' : 'w-9 h-9 min-w-9 min-h-9 justify-center'
            } ${
              currentView === item.id
                ? 'bg-[#1E3A5F] text-white'
                : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className={`truncate transition-all duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* User & Logout — khi thu gọn: cột đều, cùng kích thước ô, căn giữa */}
      <div
        className={`shrink-0 border-t border-[#E5E7EB] ${isOpen ? 'p-3 px-4' : 'p-2 flex flex-col items-center gap-2'}`}
      >
        <div className={`flex min-w-0 ${isOpen ? 'items-center gap-3' : 'justify-center'}`}>
          <div
            className={`rounded-lg bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-[10px] font-semibold text-[#374151] shrink-0 ${isOpen ? 'w-8 h-8' : 'w-9 h-9'}`}
          >
            {initials}
          </div>
          <div className={`min-w-0 transition-all duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            <p className="text-xs font-medium text-[#111827] truncate">{displayName}</p>
            <p className="text-[10px] text-[#0B6E4B] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0B6E4B]" />
              Online
            </p>
          </div>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={() => onLogout()}
            title="Đăng xuất"
            className={`rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#A63D3D] hover:border-[#FECACA] text-xs font-semibold transition-colors flex items-center justify-center ${
              isOpen ? 'w-full py-2' : 'w-9 h-9 min-w-[36px] min-h-[36px]'
            }`}
          >
            {isOpen ? 'Đăng xuất' : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
