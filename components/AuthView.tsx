import React, { useState } from 'react';
import { authApi } from '../services/api';
import type { LoginRequest, RegisterRequest } from '../services/api';
import { Button, Input, Card, CardBody, Alert, TabsCompact } from './ui/primitives';

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
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-5 border-b border-border-subtle bg-background-elevated">
            <h1 className="text-xl font-semibold text-text-main text-center">TradeGuard AI</h1>
            <p className="text-sm text-text-muted text-center mt-1">Đăng nhập hoặc đăng ký để tiếp tục</p>
          </div>

          <CardBody padding="default">
            <TabsCompact
              className="mb-4"
              tabs={[
                { value: 'login', label: 'Đăng nhập' },
                { value: 'register', label: 'Đăng ký' },
              ]}
              value={tab}
              onChange={(value) => { setTab(value as Tab); setError(null); }}
            />

            {error && (
              <Alert variant="error" className="mb-4">{error}</Alert>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  type="email"
                  label="Email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@example.com"
                  required
                />
                <Input
                  type="password"
                  label="Mật khẩu"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
                <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                  Đăng nhập
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  type="email"
                  label="Email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@example.com"
                  required
                />
                <Input
                  type="text"
                  label="Tên đăng nhập (3–50 ký tự)"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="username"
                  minLength={3}
                  maxLength={50}
                  required
                />
                <Input
                  type="text"
                  label="Họ tên (tùy chọn)"
                  value={registerForm.fullName ?? ''}
                  onChange={(e) => setRegisterForm((p) => ({ ...p, fullName: e.target.value || undefined }))}
                  placeholder="Nguyễn Văn A"
                />
                <Input
                  type="password"
                  label="Mật khẩu (tối thiểu 6 ký tự)"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                  Đăng ký
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
