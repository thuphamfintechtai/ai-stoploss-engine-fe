import React from 'react';

interface AppLoaderProps {
  message?: string;
  showLogo?: boolean;
}

export const AppLoader: React.FC<AppLoaderProps> = ({
  message = 'Đang tải...',
  showLogo = true,
}) => (
  <div className="fixed inset-0 bg-base flex flex-col items-center justify-center z-[9999]">
    {showLogo && (
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <path d="M24 4 L42 12 L42 24 C42 34 34 42 24 46 C14 42 6 34 6 24 L6 12 Z" fill="white" fillOpacity="0.15"/>
              <path d="M14 30 L20 24 L26 28 L34 18" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M30 16 L34 18 L32 22" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-title text-main font-bold">TradeGuard AI</h1>
            <p className="text-caption text-muted">Quản lý rủi ro thông minh</p>
          </div>
        </div>
      </div>
    )}

    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-panel-hover border-t-accent animate-spin" />
      </div>
      <p className="text-body text-muted animate-pulse">{message}</p>
    </div>

    <div className="absolute bottom-8 text-caption text-dim">
      <p>Powered by AI</p>
    </div>
  </div>
);

export const SectionLoader: React.FC<{
  message?: string;
  minHeight?: string;
}> = ({ message = 'Đang tải...', minHeight = '200px' }) => (
  <div
    className="flex flex-col items-center justify-center gap-3"
    style={{ minHeight }}
  >
    <div className="spinner spinner-lg" />
    <p className="text-body-sm text-muted">{message}</p>
  </div>
);

export const InlineLoader: React.FC<{
  message?: string;
}> = ({ message }) => (
  <div className="inline-flex items-center gap-2 text-body-sm text-muted">
    <div className="spinner spinner-sm" />
    {message && <span>{message}</span>}
  </div>
);
