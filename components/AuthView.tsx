import React, { useState } from 'react';
import { authApi } from '../services/api';
import type { LoginRequest, RegisterRequest } from '../services/api';

type Tab = 'login' | 'register';

interface AuthViewProps {
  onSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState<LoginRequest>({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState<RegisterRequest>({
    email: '',
    username: '',
    password: '',
    fullName: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(loginForm);
      const data = (res.data as any);
      if (data?.success && data?.data?.token) {
        localStorage.setItem('auth_token', data.data.token);
        if (data.data.user) {
          localStorage.setItem('user', JSON.stringify(data.data.user));
        }
        onSuccess();
      } else {
        setError(data?.message || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Đăng nhập thất bại';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (registerForm.password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    if ((registerForm.username?.length ?? 0) < 3) {
      setError('Tên đăng nhập tối thiểu 3 ký tự');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(registerForm);
      const data = (res.data as any);
      if (data?.success && data?.data?.token) {
        localStorage.setItem('auth_token', data.data.token);
        if (data.data.user) {
          localStorage.setItem('user', JSON.stringify(data.data.user));
        }
        onSuccess();
      } else {
        setError(data?.message || 'Đăng ký thất bại');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Đăng ký thất bại';
      const errors = err.response?.data?.errors;
      setError(errors?.length ? errors.map((x: any) => x.message).join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-panel rounded-2xl border border-border-subtle shadow-[var(--shadow-elevated)] overflow-hidden">
          <div className="px-6 py-5 border-b border-border-subtle bg-background-elevated">
            <h1 className="text-xl font-semibold text-text-main text-center">AI Stop-Loss Engine</h1>
            <p className="text-sm text-text-muted text-center mt-1">Đăng nhập hoặc đăng ký để tiếp tục</p>
          </div>

          <div className="flex border-b border-border-subtle">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'login' ? 'text-accent border-b-2 border-accent bg-panel' : 'text-text-muted hover:text-text-main'}`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'register' ? 'text-accent border-b-2 border-accent bg-panel' : 'text-text-muted hover:text-text-main'}`}
            >
              Đăng ký
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 py-2.5 px-3 rounded-lg bg-negative/10 border border-negative/30 text-sm text-negative">
                {error}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-background border border-border-subtle rounded-lg text-text-main placeholder:text-text-dim focus:ring-2 focus:ring-accent-subtle focus:border-border-focus outline-none transition-colors"
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Mật khẩu</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-background border border-border-subtle rounded-lg text-text-main placeholder:text-text-dim focus:ring-2 focus:ring-accent-subtle focus:border-border-focus outline-none transition-colors"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover active:bg-accent-active text-text-on-primary font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Đang xử lý...' : 'Đăng nhập'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-background border border-border-subtle rounded-lg text-text-main placeholder:text-text-dim focus:ring-2 focus:ring-accent-subtle focus:border-border-focus outline-none transition-colors"
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Tên đăng nhập (3–50 ký tự)</label>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm((p) => ({ ...p, username: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-background border border-border-subtle rounded-lg text-text-main placeholder:text-text-dim focus:ring-2 focus:ring-accent-subtle focus:border-border-focus outline-none transition-colors"
                    placeholder="username"
                    minLength={3}
                    maxLength={50}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Họ tên (tùy chọn)</label>
                  <input
                    type="text"
                    value={registerForm.fullName ?? ''}
                    onChange={(e) => setRegisterForm((p) => ({ ...p, fullName: e.target.value || undefined }))}
                    className="w-full px-4 py-2.5 bg-background border border-border-subtle rounded-lg text-text-main placeholder:text-text-dim focus:ring-2 focus:ring-accent-subtle focus:border-border-focus outline-none transition-colors"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Mật khẩu (tối thiểu 6 ký tự)</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-background border border-border-subtle rounded-lg text-text-main placeholder:text-text-dim focus:ring-2 focus:ring-accent-subtle focus:border-border-focus outline-none transition-colors"
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover active:bg-accent-active text-text-on-primary font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Đang xử lý...' : 'Đăng ký'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
