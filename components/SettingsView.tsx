import React, { useState, useEffect, useCallback } from 'react';
import { authApi, portfolioApi, notificationsApi, priceAlertsApi } from '../services/api';
import type { PriceAlert, Notification } from '../services/api';
import { formatNumberVI } from '../constants';

type SettingsTab = 'profile' | 'portfolio' | 'notifications' | 'alerts' | 'appearance';

interface Props {
  portfolio: any | null;
  onOpenSetup: () => void;
  onPortfolioUpdated: () => void;
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
const Icon = {
  user: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/></svg>,
  portfolio: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3"/></svg>,
  bell: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>,
  alert: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>,
  palette: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"/></svg>,
  eye: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  eyeOff: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>,
  check: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>,
  trash: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>,
  plus: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>,
  edit: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>,
  key: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg>,
};

// ── Toggle Switch ─────────────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border-standard'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
  </button>
);

// ── Input ─────────────────────────────────────────────────────────────────────
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <div>
    <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">{label}</label>
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg text-sm text-text-main bg-panel border border-border-standard focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all ${props.className ?? ''}`}
    />
  </div>
);

// ── Status message ────────────────────────────────────────────────────────────
const StatusMsg: React.FC<{ msg: string; type: 'success' | 'error' }> = ({ msg, type }) =>
  msg ? (
    <div className={`text-xs px-3 py-2 rounded-lg ${type === 'success' ? 'bg-positive/10 text-positive border border-positive/20' : 'bg-negative/10 text-negative border border-negative/20'}`}>
      {msg}
    </div>
  ) : null;

// ══════════════════════════════════════════════════════════════════════════════
// TAB: HỒ SƠ
// ══════════════════════════════════════════════════════════════════════════════
const ProfileTab: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  useEffect(() => {
    authApi.me().then((res: any) => {
      const d = res.data?.data;
      if (d) { setProfile(d); setFullName(d.fullName ?? ''); setUsername(d.username ?? ''); }
    }).catch(() => {});
  }, []);

  const initials = profile?.fullName
    ? profile.fullName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : (profile?.email?.[0] ?? '?').toUpperCase();

  const saveProfile = async () => {
    setSaving(true); setProfileMsg(''); setProfileErr('');
    try {
      await authApi.updateProfile({ fullName, username });
      setProfileMsg('Cập nhật hồ sơ thành công');
    } catch (e: any) {
      setProfileErr(e?.response?.data?.message ?? 'Lỗi cập nhật');
    } finally { setSaving(false); }
  };

  const changePwd = async () => {
    setPwdMsg(''); setPwdErr('');
    if (newPwd !== confirmPwd) { setPwdErr('Mật khẩu xác nhận không khớp'); return; }
    if (newPwd.length < 6) { setPwdErr('Mật khẩu mới cần ít nhất 6 ký tự'); return; }
    setChangingPwd(true);
    try {
      await authApi.changePassword({ current_password: curPwd, new_password: newPwd });
      setPwdMsg('Đổi mật khẩu thành công');
      setCurPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) {
      setPwdErr(e?.response?.data?.message ?? 'Mật khẩu hiện tại không đúng');
    } finally { setChangingPwd(false); }
  };

  return (
    <div className="space-y-6">
      {/* Avatar + info */}
      <div className="panel-section p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#1e40af,#3b82f6)' }}>
            {initials}
          </div>
          <div>
            <p className="text-base font-bold text-text-main">{profile?.fullName || profile?.username || '—'}</p>
            <p className="text-sm text-text-muted mt-0.5">{profile?.email}</p>
            <p className="text-[10px] text-text-dim mt-1">
              Thành viên từ {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('vi-VN') : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Họ tên" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
          <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} placeholder="nguyenvana" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveProfile} disabled={saving}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          <StatusMsg msg={profileMsg} type="success" />
          <StatusMsg msg={profileErr} type="error" />
        </div>
      </div>

      {/* Đổi mật khẩu */}
      <div className="panel-section p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-accent">{Icon.key}</span>
          <h3 className="text-sm font-bold text-text-main">Đổi Mật Khẩu</h3>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Input label="Mật khẩu hiện tại" type={showCur ? 'text' : 'password'} value={curPwd} onChange={e => setCurPwd(e.target.value)} />
            <button type="button" onClick={() => setShowCur(v => !v)}
              className="absolute right-3 top-7 text-text-muted hover:text-text-main">
              {showCur ? Icon.eyeOff : Icon.eye}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Input label="Mật khẩu mới" type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Ít nhất 6 ký tự" />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-7 text-text-muted hover:text-text-main">
                {showNew ? Icon.eyeOff : Icon.eye}
              </button>
            </div>
            <Input label="Xác nhận mật khẩu mới" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={changePwd} disabled={changingPwd || !curPwd || !newPwd}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
            {changingPwd ? 'Đang xử lý...' : 'Đổi mật khẩu'}
          </button>
          <StatusMsg msg={pwdMsg} type="success" />
          <StatusMsg msg={pwdErr} type="error" />
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// TAB: PORTFOLIO
// ══════════════════════════════════════════════════════════════════════════════
const PortfolioTab: React.FC<{ activePortfolio: any; onOpenSetup: () => void; onPortfolioUpdated: () => void }> = ({
  activePortfolio, onOpenSetup, onPortfolioUpdated
}) => {
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portfolioApi.getAll();
      if (res.data?.success) setPortfolios(res.data.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (p: any) => {
    setEditId(p.id);
    setEditData({ name: p.name, total_balance: p.total_balance, max_risk_percent: p.max_risk_percent, expected_return_percent: p.expected_return_percent });
    setMsg(''); setErr('');
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true); setMsg(''); setErr('');
    try {
      await portfolioApi.update(editId, {
        name: editData.name,
        totalBalance: parseFloat(editData.total_balance),
        maxRiskPercent: parseFloat(editData.max_risk_percent),
        expectedReturnPercent: parseFloat(editData.expected_return_percent),
      });
      setMsg('Đã cập nhật portfolio');
      setEditId(null);
      load();
      onPortfolioUpdated();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Lỗi cập nhật');
    } finally { setSaving(false); }
  };

  const deletePortfolio = async (id: string) => {
    try {
      await portfolioApi.delete(id);
      setDeleteConfirm(null);
      load();
      onPortfolioUpdated();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Không thể xóa portfolio');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">Quản lý các danh mục đầu tư của bạn</p>
        <button onClick={onOpenSetup}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors">
          {Icon.plus} Tạo mới
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="panel-section h-20 animate-pulse" />)}</div>
      ) : portfolios.length === 0 ? (
        <div className="panel-section p-8 text-center text-text-muted text-sm">Chưa có portfolio nào</div>
      ) : (
        <div className="space-y-3">
          {portfolios.map(p => {
            const isActive = p.id === activePortfolio?.id;
            const isEditing = editId === p.id;
            return (
              <div key={p.id} className={`panel-section p-4 transition-all ${isActive ? 'border-accent/40' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded mb-1.5">
                        ● Đang dùng
                      </span>
                    )}
                    {isEditing ? (
                      <div className="space-y-2 mt-1">
                        <Input label="Tên portfolio" value={editData.name}
                          onChange={e => setEditData((d: any) => ({ ...d, name: e.target.value }))} />
                        <div className="grid grid-cols-3 gap-2">
                          <Input label="Vốn (VND)" type="number" value={editData.total_balance}
                            onChange={e => setEditData((d: any) => ({ ...d, total_balance: e.target.value }))} />
                          <Input label="Risk tối đa (%)" type="number" value={editData.max_risk_percent}
                            onChange={e => setEditData((d: any) => ({ ...d, max_risk_percent: e.target.value }))} />
                          <Input label="Return kỳ vọng (%)" type="number" value={editData.expected_return_percent}
                            onChange={e => setEditData((d: any) => ({ ...d, expected_return_percent: e.target.value }))} />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={saveEdit} disabled={saving}
                            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-60">
                            {saving ? 'Lưu...' : 'Lưu'}
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="px-3 py-1.5 rounded-lg border border-border-standard text-xs text-text-muted hover:text-text-main">
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-text-main text-sm truncate">{p.name}</p>
                        <div className="flex gap-4 mt-1.5 text-[11px] text-text-muted">
                          <span>Vốn: <strong className="text-text-main">{formatNumberVI(parseFloat(p.total_balance), { maximumFractionDigits: 0 })} ₫</strong></span>
                          <span>Risk: <strong className="text-text-main">{p.max_risk_percent}%</strong></span>
                          <span>Return: <strong className="text-text-main">{p.expected_return_percent}%</strong></span>
                        </div>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(p)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                        {Icon.edit}
                      </button>
                      {!isActive && (
                        <button onClick={() => setDeleteConfirm(p.id)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-negative hover:bg-negative/10 transition-colors">
                          {Icon.trash}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {deleteConfirm === p.id && (
                  <div className="mt-3 pt-3 border-t border-border-standard flex items-center gap-3">
                    <p className="text-xs text-negative flex-1">Xóa portfolio này? Hành động không thể hoàn tác.</p>
                    <button onClick={() => deletePortfolio(p.id)}
                      className="px-3 py-1.5 rounded-lg bg-negative text-white text-xs font-semibold">Xóa</button>
                    <button onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 rounded-lg border border-border-standard text-xs text-text-muted">Hủy</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(msg || err) && <StatusMsg msg={msg || err} type={msg ? 'success' : 'error'} />}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// TAB: THÔNG BÁO
// ══════════════════════════════════════════════════════════════════════════════
const NOTIF_TYPES = [
  { key: 'SL_TRIGGERED', label: 'Stop Loss kích hoạt', desc: 'Khi vị thế chạm stop loss' },
  { key: 'TP_TRIGGERED', label: 'Take Profit kích hoạt', desc: 'Khi vị thế chạm take profit' },
  { key: 'RISK_WARNING', label: 'Cảnh báo rủi ro', desc: 'Khi danh mục vượt ngưỡng rủi ro' },
  { key: 'AI_ALERT', label: 'AI Alert', desc: 'Tín hiệu và phân tích từ AI' },
  { key: 'POSITION_OPENED', label: 'Mở vị thế', desc: 'Khi lệnh được khớp và mở vị thế' },
  { key: 'POSITION_CLOSED', label: 'Đóng vị thế', desc: 'Khi vị thế được đóng' },
  { key: 'SYSTEM', label: 'Hệ thống', desc: 'Thông báo hệ thống quan trọng' },
];

const NotificationsTab: React.FC = () => {
  const PREF_KEY = 'notif_prefs';
  const defaultPrefs = Object.fromEntries(NOTIF_TYPES.map(t => [t.key, true]));
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; }
    catch { return defaultPrefs; }
  });
  const [recent, setRecent] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    notificationsApi.getAll({ limit: 10 }).then((res: any) => {
      if (res.data?.success) setRecent(res.data.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const togglePref = (key: string) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearRead = async () => {
    setClearing(true);
    try {
      await notificationsApi.deleteRead();
      setRecent(prev => prev.filter(n => !n.is_read));
      setMsg('Đã xóa thông báo đã đọc');
      setTimeout(() => setMsg(''), 3000);
    } catch { /* ignore */ } finally { setClearing(false); }
  };

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setRecent(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* ignore */ }
  };

  const filteredRecent = recent.filter(n => prefs[n.type] !== false);

  const severityColor: Record<string, string> = {
    INFO: 'text-accent', WARNING: 'text-warning', ERROR: 'text-negative', SUCCESS: 'text-positive',
  };

  return (
    <div className="space-y-5">
      {/* Preferences */}
      <div className="panel-section p-4">
        <h3 className="text-sm font-bold text-text-main mb-3">Tùy chọn loại thông báo</h3>
        <div className="space-y-2.5">
          {NOTIF_TYPES.map(t => (
            <div key={t.key} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm font-medium text-text-main">{t.label}</p>
                <p className="text-[11px] text-text-muted">{t.desc}</p>
              </div>
              <Toggle checked={prefs[t.key] ?? true} onChange={() => togglePref(t.key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Recent notifications */}
      <div className="panel-section p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text-main">Thông báo gần đây</h3>
          <button onClick={clearRead} disabled={clearing}
            className="text-xs text-negative hover:underline disabled:opacity-50">
            {clearing ? 'Đang xóa...' : 'Xóa đã đọc'}
          </button>
        </div>
        {msg && <StatusMsg msg={msg} type="success" />}
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-border-subtle rounded animate-pulse" />)}</div>
        ) : filteredRecent.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">Chưa có thông báo nào</p>
        ) : (
          <div className="space-y-1.5">
            {filteredRecent.map(n => (
              <div key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${n.is_read ? 'opacity-60' : 'bg-accent/5 hover:bg-accent/10 cursor-pointer'}`}>
                <span className={`text-[10px] font-bold mt-0.5 ${severityColor[n.severity] ?? 'text-text-muted'}`}>●</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-main leading-snug">{n.title}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{n.message}</p>
                  <p className="text-[9px] text-text-dim mt-0.5">{new Date(n.created_at).toLocaleString('vi-VN')}</p>
                </div>
                {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CẢNH BÁO GIÁ
// ══════════════════════════════════════════════════════════════════════════════
const AlertsTab: React.FC = () => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbol: '', exchange: 'HOSE', condition: 'ABOVE', target_value: '', note: '' });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await priceAlertsApi.getAll();
      if (res.data?.success) setAlerts(res.data.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string) => {
    try {
      await priceAlertsApi.toggle(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: !a.is_active } : a));
    } catch { /* ignore */ }
  };

  const remove = async (id: string) => {
    try {
      await priceAlertsApi.delete(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
  };

  const create = async () => {
    if (!form.symbol || !form.target_value) { setErr('Vui lòng điền đủ thông tin'); return; }
    setCreating(true); setErr('');
    try {
      await priceAlertsApi.create({
        symbol: form.symbol.toUpperCase(), exchange: form.exchange,
        condition: form.condition as any, target_value: parseFloat(form.target_value) * 1000,
        note: form.note || undefined,
      });
      setShowForm(false);
      setForm({ symbol: '', exchange: 'HOSE', condition: 'ABOVE', target_value: '', note: '' });
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Lỗi tạo cảnh báo');
    } finally { setCreating(false); }
  };

  const conditionLabel: Record<string, string> = {
    ABOVE: 'Vượt lên', BELOW: 'Xuống dưới', CHANGE_PCT_UP: 'Tăng %', CHANGE_PCT_DOWN: 'Giảm %',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">{alerts.length} cảnh báo giá</p>
        <button onClick={() => { setShowForm(v => !v); setErr(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors">
          {Icon.plus} Tạo cảnh báo
        </button>
      </div>

      {/* Form tạo mới */}
      {showForm && (
        <div className="panel-section p-4 border-accent/30">
          <h3 className="text-sm font-bold text-text-main mb-3">Cảnh báo mới</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mã CK" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} placeholder="VD: ACB" />
            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Sàn</label>
              <select value={form.exchange} onChange={e => setForm(f => ({ ...f, exchange: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm text-text-main bg-panel border border-border-standard focus:border-accent outline-none">
                {['HOSE','HNX','UPCOM','DERIVATIVE'].map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Điều kiện</label>
              <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm text-text-main bg-panel border border-border-standard focus:border-accent outline-none">
                {Object.entries(conditionLabel).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <Input label="Giá (nghìn đồng)" type="number" value={form.target_value}
              onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} placeholder="VD: 25.5" />
          </div>
          <div className="mt-3">
            <Input label="Ghi chú (tuỳ chọn)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="VD: Vùng kháng cự quan trọng" />
          </div>
          {err && <div className="mt-2"><StatusMsg msg={err} type="error" /></div>}
          <div className="flex gap-2 mt-3">
            <button onClick={create} disabled={creating}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-60">
              {creating ? 'Đang tạo...' : 'Tạo cảnh báo'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 rounded-lg border border-border-standard text-xs text-text-muted hover:text-text-main">
              Hủy
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="panel-section h-14 animate-pulse" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="panel-section p-8 text-center text-text-muted text-sm">Chưa có cảnh báo giá nào</div>
      ) : (
        <div className="panel-section overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {alerts.map(a => (
              <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${a.is_triggered ? 'opacity-50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text-main">{a.symbol}</span>
                    <span className="text-[9px] font-semibold text-text-dim bg-border-subtle px-1.5 py-0.5 rounded">{a.exchange}</span>
                    {a.is_triggered && <span className="text-[9px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded">Đã kích hoạt</span>}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {conditionLabel[a.condition] ?? a.condition} <strong className="text-text-main">{(a.target_value / 1000).toFixed(2)}k</strong>
                    {a.note && <span className="ml-2 text-text-dim">· {a.note}</span>}
                  </p>
                </div>
                <Toggle checked={a.is_active} onChange={() => toggle(a.id)} disabled={a.is_triggered} />
                <button onClick={() => remove(a.id)}
                  className="p-1.5 text-text-dim hover:text-negative hover:bg-negative/10 rounded-lg transition-colors">
                  {Icon.trash}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// TAB: GIAO DIỆN
// ══════════════════════════════════════════════════════════════════════════════
const AppearanceTab: React.FC = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'dark');
  const [sidebarDefault, setSidebarDefault] = useState(() => localStorage.getItem('sidebar_default') !== 'closed');
  const [defaultRR, setDefaultRR] = useState(() => localStorage.getItem('default_rr') ?? '2');

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  const toggleSidebar = (v: boolean) => {
    setSidebarDefault(v);
    localStorage.setItem('sidebar_default', v ? 'open' : 'closed');
  };

  const changeRR = (v: string) => {
    setDefaultRR(v);
    localStorage.setItem('default_rr', v);
  };

  const themes = [
    { id: 'dark', label: 'Tối', desc: 'Nền đen, mắt không mỏi khi giao dịch đêm', color: '#080d1a' },
    { id: 'light', label: 'Sáng', desc: 'Nền trắng, phù hợp ban ngày', color: '#f8fafc' },
  ];

  return (
    <div className="space-y-5">
      {/* Theme */}
      <div className="panel-section p-4">
        <h3 className="text-sm font-bold text-text-main mb-3">Chủ đề giao diện</h3>
        <div className="grid grid-cols-2 gap-3">
          {themes.map(t => (
            <button key={t.id} onClick={() => applyTheme(t.id)}
              className={`relative p-3 rounded-xl border-2 text-left transition-all ${theme === t.id ? 'border-accent' : 'border-border-standard hover:border-border-standard/80'}`}>
              <div className="w-full h-12 rounded-lg mb-2 border border-border-subtle"
                style={{ background: t.color }}>
                <div className="flex gap-1 p-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: theme === 'dark' ? '#22c55e' : '#16a34a' }} />
                  <div className="w-8 h-1.5 rounded" style={{ background: t.id === 'dark' ? '#1e293b' : '#e2e8f0' }} />
                </div>
              </div>
              <p className="text-sm font-semibold text-text-main">{t.label}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{t.desc}</p>
              {theme === t.id && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white">
                  {Icon.check}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Preferences */}
      <div className="panel-section p-4 space-y-4">
        <h3 className="text-sm font-bold text-text-main">Tùy chọn khác</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-main">Sidebar mở rộng mặc định</p>
            <p className="text-[11px] text-text-muted">Sidebar sẽ mở rộng khi khởi động app</p>
          </div>
          <Toggle checked={sidebarDefault} onChange={toggleSidebar} />
        </div>

        <div className="border-t border-border-subtle pt-4">
          <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            Tỷ lệ R:R mặc định trong AI Terminal
          </label>
          <div className="flex items-center gap-3">
            <input type="range" min="1" max="5" step="0.5" value={parseFloat(defaultRR)}
              onChange={e => changeRR(e.target.value)}
              className="flex-1 accent-accent" />
            <span className="text-sm font-bold text-accent w-8 text-right">1:{defaultRR}</span>
          </div>
        </div>

        <div className="pt-2">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Ngôn ngữ</p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-border-subtle/40">
            <span className="text-base">🇻🇳</span>
            <span className="text-sm text-text-main font-medium">Tiếng Việt</span>
            <span className="ml-auto text-[10px] text-text-dim bg-border-subtle px-2 py-0.5 rounded">Mặc định</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-positive">
        {Icon.check}
        <span>Các thay đổi được lưu tự động</span>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export const SettingsView: React.FC<Props> = ({ portfolio, onOpenSetup, onPortfolioUpdated }) => {
  const [tab, setTab] = useState<SettingsTab>('profile');

  const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile',       label: 'Hồ Sơ',        icon: Icon.user },
    { id: 'portfolio',     label: 'Portfolio',     icon: Icon.portfolio },
    { id: 'notifications', label: 'Thông Báo',     icon: Icon.bell },
    { id: 'alerts',        label: 'Cảnh Báo Giá',  icon: Icon.alert },
    { id: 'appearance',    label: 'Giao Diện',      icon: Icon.palette },
  ];

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-main">Cài Đặt</h1>
        <p className="text-sm text-text-muted mt-0.5">Quản lý tài khoản, portfolio và tùy chọn hệ thống</p>
      </div>

      <div className="flex gap-6">
        {/* Left nav tabs */}
        <div className="w-44 shrink-0">
          <nav className="panel-section p-1.5 space-y-0.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                  tab === t.id
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-text-main hover:bg-border-subtle/50'
                }`}
              >
                <span className={tab === t.id ? 'text-white' : 'text-text-muted'}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {tab === 'profile'       && <ProfileTab />}
          {tab === 'portfolio'     && <PortfolioTab activePortfolio={portfolio} onOpenSetup={onOpenSetup} onPortfolioUpdated={onPortfolioUpdated} />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'alerts'        && <AlertsTab />}
          {tab === 'appearance'    && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
