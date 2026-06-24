import React from 'react';
import { AlertOctagon } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Sử dụng React.Component với explicit typing để tương thích React 19 + useDefineForClassFields: false
export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${new Date().toISOString()}] Unhandled error: ${error.message}`, info);
  }

  override render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Lỗi không xác định';
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-panel p-4">
          {/* Icon cảnh báo */}
          <div className="mb-4 w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertOctagon size={32} strokeWidth={1.5} className="text-red-400" aria-hidden="true" />
          </div>

          <h2 className="text-[16px] font-bold text-text-main mb-2">Đã xảy ra lỗi không mong đợi</h2>
          <p className="text-[12px] text-text-muted mb-1 max-w-sm text-center">{errorMessage}</p>
          {isDev && this.state.error?.stack && (
            <pre className="mt-2 mb-4 text-[10px] text-red-400/70 bg-red-950/20 border border-red-900/30 rounded p-3 max-w-lg overflow-auto max-h-40">
              {this.state.error.stack}
            </pre>
          )}

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset?.();
              }}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 transition-colors"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                // Navigate về dashboard
                window.location.hash = '';
                this.props.onReset?.();
              }}
              className="px-4 py-2 rounded-lg bg-white/10 text-text-main text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Quay về Trang Chủ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
