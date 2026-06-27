import React, { useState, useEffect, useCallback } from 'react';
import { AuthView } from './components/AuthView';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ActivePortfolioProvider } from './contexts/ActivePortfolioContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainApp } from './components/MainApp';
import { authApi } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('auth_token'));

  const handleLogout = useCallback(async () => {
    await authApi.logout();
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    const handler = () => setIsAuthenticated(false);
    window.addEventListener('auth:logout', handler);

    // MDI-02: BE reject WS connection (UNAUTHENTICATED/INVALID_TOKEN) → websocket.ts dispatch
    // 'ws:unauthenticated' → clear token + chuyển về AuthView (reuse auth:logout flow).
    const handleWsUnauth = (e: Event) => {
      const detail = (e as CustomEvent).detail as { reason?: string } | undefined;
      console.warn('[App] WS unauthenticated:', detail?.reason);
      // Clear token + user tương tự axios 401 interceptor, rồi reuse handler phía trên.
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    };
    window.addEventListener('ws:unauthenticated', handleWsUnauth);

    return () => {
      window.removeEventListener('auth:logout', handler);
      window.removeEventListener('ws:unauthenticated', handleWsUnauth);
    };
  }, []);

  if (!isAuthenticated) {
    return <AuthView onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <AppErrorBoundary onReset={handleLogout}>
      <ThemeProvider>
        <ActivePortfolioProvider>
          <MainApp onLogout={handleLogout} />
        </ActivePortfolioProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default App;
