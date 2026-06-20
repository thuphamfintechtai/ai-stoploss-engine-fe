import React, { useState } from 'react';
import { portfolioApi } from '../services/api';

interface OnboardingWizardProps {
  onComplete: () => void;
  onNavigate: (view: string) => void;
}

type PortfolioType = 'LONG_TERM' | 'SWING' | 'DAY_TRADE';

const TOTAL_STEPS = 4;
const MIN_CAPITAL_VND = 5_000_000; // 1 lô @ giá ~50k/cp = 5tr — ngưỡng F0-friendly

const PORTFOLIO_TYPES: Array<{
  key: PortfolioType;
  label: string;
  desc: string;
  example: string;
}> = [
  {
    key: 'LONG_TERM',
    label: 'Đầu tư dài hạn',
    desc: 'Mua giữ cổ phiếu cơ bản tốt từ 6 tháng trở lên. Rủi ro thấp, theo dõi cuối tuần.',
    example: 'Ví dụ: mua VNM, FPT, MWG cho mục tiêu 1-3 năm.',
  },
  {
    key: 'SWING',
    label: 'Swing trade',
    desc: 'Giữ 1-4 tuần, ăn xu hướng. Rủi ro vừa, theo dõi 1-2 lần/ngày.',
    example: 'Ví dụ: mua HPG khi vượt MA20, bán khi đạt mục tiêu +10%.',
  },
  {
    key: 'DAY_TRADE',
    label: 'Lướt sóng (T+)',
    desc: 'Giao dịch trong ngày hoặc 2-3 phiên. Rủi ro cao, đòi hỏi kỷ luật chặt.',
    example: 'Nhớ: VN có T+2.5 — cổ mua hôm nay không bán được trong ngày.',
  },
];

// Phí broker thực tế VN (default): mua 0.15%, bán 0.15%, thuế bán 0.1%
const DEFAULT_FEES = {
  buy_fee_percent: 0.15,
  sell_fee_percent: 0.15,
  sell_tax_percent: 0.1,
};

const formatVND = (v: number) => v.toLocaleString('vi-VN');

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onNavigate }) => {
  const [step, setStep] = useState(1);
  const [capital, setCapital] = useState<string>('');
  const [portfolioType, setPortfolioType] = useState<PortfolioType>('SWING');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const capitalNumber = Number(capital.replace(/[.,\s]/g, ''));
  const capitalValid = Number.isFinite(capitalNumber) && capitalNumber >= MIN_CAPITAL_VND;

  const goNext = () => {
    if (step === 2 && !capitalValid) {
      setError(`Vốn ban đầu tối thiểu ${formatVND(MIN_CAPITAL_VND)}đ (1 lô 100 cp giá thấp).`);
      return;
    }
    setError('');
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
    setError('');
  };

  const handleCreatePortfolio = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await portfolioApi.create({
        name: 'Danh mục chính',
        totalBalance: capitalNumber,
        portfolioType,
      });
      if (res.data?.success) {
        // Đánh dấu onboarding xong (lưu localStorage — BE settings endpoint có thể wire sau)
        try { localStorage.setItem('onboarding_completed_at', new Date().toISOString()); } catch {}
        onNavigate('portfolio');
        onComplete();
      } else {
        setError(res.data?.message || 'Tạo danh mục thất bại');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Lỗi khi tạo danh mục. Thử lại sau.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-panel border border-border-standard rounded-2xl shadow-card-hover w-full max-w-lg mx-4 overflow-hidden">

        {/* Step indicator dots */}
        <div className="flex justify-center gap-2 pt-6 pb-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i + 1 === step ? 'bg-accent scale-110' : i + 1 < step ? 'bg-accent/40' : 'bg-border-standard'
              }`}
            />
          ))}
        </div>

        <div className="p-6 pt-4 min-h-[420px] flex flex-col">

          {/* Step 1 — Welcome */}
          {step === 1 && (
            <div className="flex-1 flex flex-col items-center text-center gap-4 animate-fade-in">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-text-main">Chào mừng đến TradeGuard AI!</h2>
              <p className="text-text-muted text-sm leading-relaxed max-w-sm">
                Chúng tôi sẽ cùng bạn lập danh mục đầu tiên trong 3 bước. Bạn cần chuẩn bị: vốn dự kiến đầu tư.
              </p>
              <div className="flex-1" />
              <button
                onClick={goNext}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors"
              >
                Bắt đầu
              </button>
            </div>
          )}

          {/* Step 2 — Capital */}
          {step === 2 && (
            <div className="flex-1 flex flex-col gap-4 animate-fade-in">
              <h2 className="text-xl font-bold text-text-main">Vốn ban đầu</h2>
              <p className="text-text-muted text-sm leading-relaxed">
                Nhập số tiền bạn dự định đầu tư. Đây là cơ sở để tính rủi ro mỗi lệnh.
              </p>

              <label className="block">
                <span className="text-[12px] font-medium text-text-muted mb-1.5 block">Số tiền (VND)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="VD: 50000000"
                  className="w-full px-3 py-2.5 rounded-lg border border-border-standard bg-bg text-text-main text-sm focus:border-accent focus:outline-none"
                />
                {capital && (
                  <span className="text-[11px] text-text-dim mt-1 block">
                    ≈ {formatVND(capitalNumber)}đ
                  </span>
                )}
              </label>

              <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-[11px] text-text-muted leading-relaxed">
                <div className="font-semibold text-accent mb-0.5">Lưu ý lô tối thiểu sàn VN</div>
                Mỗi lệnh phải mua tối thiểu <strong>1 lô = 100 cổ phiếu</strong>. Cổ giá thấp khoảng 5tr (50.000đ × 100cp). Vốn dưới 5tr sẽ khó vào lệnh chuẩn.
              </div>

              {error && <p className="text-[12px] text-negative">{error}</p>}

              <div className="flex-1" />
              <div className="flex gap-3 w-full">
                <button onClick={goBack} className="px-4 py-3 rounded-xl border border-border-standard text-text-muted hover:text-text-main hover:border-accent/30 text-sm transition-colors">Quay lại</button>
                <button
                  onClick={goNext}
                  disabled={!capital}
                  className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  Tiếp tục
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Portfolio type */}
          {step === 3 && (
            <div className="flex-1 flex flex-col gap-3 animate-fade-in">
              <h2 className="text-xl font-bold text-text-main">Phong cách đầu tư</h2>
              <p className="text-text-muted text-sm leading-relaxed">
                Chọn 1 phong cách phù hợp — AI sẽ điều chỉnh gợi ý SL/TP theo đó.
              </p>

              <div className="space-y-2 mt-1">
                {PORTFOLIO_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setPortfolioType(t.key)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      portfolioType === t.key
                        ? 'border-accent bg-accent/5'
                        : 'border-border-standard hover:border-accent/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[13px] font-bold text-text-main">{t.label}</span>
                      {portfolioType === t.key && <span className="text-accent">✓</span>}
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">{t.desc}</p>
                    <p className="text-[10px] text-text-dim leading-relaxed mt-1 italic">{t.example}</p>
                  </button>
                ))}
              </div>

              <div className="flex-1" />
              <div className="flex gap-3 w-full">
                <button onClick={goBack} className="px-4 py-3 rounded-xl border border-border-standard text-text-muted hover:text-text-main hover:border-accent/30 text-sm transition-colors">Quay lại</button>
                <button onClick={goNext} className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors">Tiếp tục</button>
              </div>
            </div>
          )}

          {/* Step 4 — Review + Create */}
          {step === 4 && (
            <div className="flex-1 flex flex-col gap-4 animate-fade-in">
              <h2 className="text-xl font-bold text-text-main">Xác nhận</h2>
              <p className="text-text-muted text-sm leading-relaxed">
                Chúng tôi sẽ tạo danh mục "Danh mục chính" với thông tin sau:
              </p>

              <div className="bg-panel-secondary rounded-lg p-4 space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-text-muted">Vốn ban đầu:</span>
                  <span className="font-mono font-bold text-text-main">{formatVND(capitalNumber)}đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Phong cách:</span>
                  <span className="font-bold text-text-main">{PORTFOLIO_TYPES.find(t => t.key === portfolioType)?.label}</span>
                </div>
                <div className="border-t border-border-subtle pt-2 mt-2">
                  <div className="text-text-muted mb-1">Phí broker mặc định (có thể đổi sau):</div>
                  <div className="flex justify-between text-[11px] text-text-dim">
                    <span>Mua/Bán</span>
                    <span>{DEFAULT_FEES.buy_fee_percent}% / {DEFAULT_FEES.sell_fee_percent}%</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-text-dim">
                    <span>Thuế bán</span>
                    <span>{DEFAULT_FEES.sell_tax_percent}%</span>
                  </div>
                </div>
              </div>

              {error && <p className="text-[12px] text-negative">{error}</p>}

              <div className="flex-1" />
              <div className="flex gap-3 w-full">
                <button
                  onClick={goBack}
                  disabled={creating}
                  className="px-4 py-3 rounded-xl border border-border-standard text-text-muted hover:text-text-main hover:border-accent/30 text-sm transition-colors disabled:opacity-50"
                >
                  Quay lại
                </button>
                <button
                  onClick={handleCreatePortfolio}
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {creating ? 'Đang tạo...' : 'Tạo danh mục'}
                </button>
              </div>
              <button
                onClick={onComplete}
                disabled={creating}
                className="text-[11px] text-text-muted hover:text-accent transition-colors py-1"
              >
                Bỏ qua, tự tạo sau
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
