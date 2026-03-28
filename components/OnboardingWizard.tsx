import React, { useState } from 'react';

interface OnboardingWizardProps {
  onComplete: () => void;
  onNavigate: (view: string) => void;
}

const TOTAL_STEPS = 3;

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onNavigate }) => {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      setDirection('forward');
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setDirection('backward');
      setStep(step - 1);
    }
  };

  const handleNavigateAndComplete = (view: string) => {
    onNavigate(view);
    onComplete();
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
                i + 1 === step
                  ? 'bg-accent scale-110'
                  : i + 1 < step
                    ? 'bg-accent/40'
                    : 'bg-border-standard'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="p-6 pt-4 min-h-[380px] flex flex-col">

          {/* Step 1 - Chao Mung */}
          {step === 1 && (
            <div className={`flex-1 flex flex-col items-center text-center gap-4 animate-fade-in`}>
              {/* Shield + Chart icon */}
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-text-main">
                Chào mừng đến TradeGuard AI!
              </h2>

              <p className="text-text-muted text-sm leading-relaxed max-w-sm">
                Công cụ quản lý rủi ro thông minh giúp bạn đầu tư an toàn hơn. Hãy bắt đầu với 3 bước đơn giản.
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

          {/* Step 2 - Tao Portfolio */}
          {step === 2 && (
            <div className={`flex-1 flex flex-col items-center text-center gap-4 animate-fade-in`}>
              {/* Wallet icon */}
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h.008A2.25 2.25 0 0017.25 6H21m-18 6a2.25 2.25 0 002.25 2.25H9a3 3 0 100 6h-.008A2.25 2.25 0 006.75 18H3m18-6v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v6z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-text-main">
                Tạo danh mục đầu tiên
              </h2>

              <p className="text-text-muted text-sm leading-relaxed max-w-sm">
                Danh mục giúp bạn theo dõi tất cả vị thế, lãi/lỗ, và rủi ro tại một nơi.
              </p>

              {/* 2 cards: Real vs Paper */}
              <div className="grid grid-cols-2 gap-3 w-full mt-2">
                <div className="p-3 rounded-xl border-2 border-blue-500/40 bg-blue-500/5 text-left">
                  <div className="text-xs font-bold text-blue-400 mb-1">Danh mục thật</div>
                  <div className="text-[11px] text-text-muted leading-relaxed">
                    Ghi nhận lệnh đã đặt trên sàn (VPS, SSI,...)
                  </div>
                </div>
                <div className="p-3 rounded-xl border-2 border-violet-500/40 bg-violet-500/5 text-left">
                  <div className="text-xs font-bold text-violet-400 mb-1">Mô phỏng</div>
                  <div className="text-[11px] text-text-muted leading-relaxed">
                    Tập chơi không mất tiền thật -- học hỏi trước khi đầu tư
                  </div>
                </div>
              </div>

              <div className="flex-1" />

              <div className="flex gap-3 w-full">
                <button
                  onClick={goBack}
                  className="px-4 py-3 rounded-xl border border-border-standard text-text-muted hover:text-text-main hover:border-accent/30 text-sm transition-colors"
                >
                  Quay lại
                </button>
                <button
                  onClick={goNext}
                  className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors"
                >
                  Tiếp tục
                </button>
              </div>
            </div>
          )}

          {/* Step 3 - Nhap Lenh Dau Tien */}
          {step === 3 && (
            <div className={`flex-1 flex flex-col items-center text-center gap-4 animate-fade-in`}>
              {/* Order/plus icon */}
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-text-main">
                Nhập lệnh đầu tiên
              </h2>

              <p className="text-text-muted text-sm leading-relaxed max-w-sm">
                Bạn có thể nhập lệnh thật đã đặt trên sàn, hoặc thử mô phỏng lệnh ảo để làm quen.
              </p>

              {/* 2 CTA buttons */}
              <div className="grid grid-cols-2 gap-3 w-full mt-2">
                <button
                  onClick={() => handleNavigateAndComplete('portfolio')}
                  className="p-4 rounded-xl border-2 border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 transition-colors text-left"
                >
                  <div className="text-xs font-bold text-blue-400 mb-1">Nhập lệnh thật</div>
                  <div className="text-[11px] text-text-muted">Ghi nhận lệnh trên sàn</div>
                </button>
                <button
                  onClick={() => handleNavigateAndComplete('paper-trading')}
                  className="p-4 rounded-xl border-2 border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 transition-colors text-left"
                >
                  <div className="text-xs font-bold text-violet-400 mb-1">Thử mô phỏng</div>
                  <div className="text-[11px] text-text-muted">Làm quen với giao dịch</div>
                </button>
              </div>

              <div className="flex-1" />

              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={goBack}
                  className="px-4 py-3 rounded-xl border border-border-standard text-text-muted hover:text-text-main hover:border-accent/30 text-sm transition-colors"
                >
                  Quay lại
                </button>
                <button
                  onClick={onComplete}
                  className="text-[11px] text-text-muted hover:text-accent transition-colors py-2"
                >
                  Bỏ qua, tôi đã biết dùng
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
