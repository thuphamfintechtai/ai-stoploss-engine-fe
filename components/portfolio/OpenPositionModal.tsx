import React, { useState } from 'react';
import { positionApi, marketApi } from '../../services/api';
import type { CreatePositionRequest } from '../../services/api';
import { STOCK_PRICE_DISPLAY_SCALE, PRICE_FRACTION_OPTIONS, PRICE_LOCALE, formatNumberVI } from '../../constants';

export interface OpenPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  onSuccess: () => void;
}

// Modal Đặt lệnh (SL: giá cố định / % / thua lỗ tối đa; TP: cố định / % / R:R)
export function OpenPositionModal({
  isOpen,
  onClose,
  portfolioId,
  onSuccess,
}: OpenPositionModalProps) {
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState<string>('');
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [useMarketPrice, setUseMarketPrice] = useState(true); // true = lấy giá thị trường, false = tự nhập
  const [entryPriceInput, setEntryPriceInput] = useState(''); // giá (điểm) khi tự nhập
  const [quantityInput, setQuantityInput] = useState(''); // khối lượng do user nhập (không lấy từ thị trường)
  const [stopType, setStopType] = useState<'FIXED' | 'PERCENT' | 'MAX_LOSS'>('FIXED');
  const [stopPrice, setStopPrice] = useState('');
  const [stopPercent, setStopPercent] = useState('');
  const [stopMaxLossVnd, setStopMaxLossVnd] = useState('');
  const [takeProfitType, setTakeProfitType] = useState<'FIXED' | 'PERCENT' | 'R_RATIO' | ''>('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [takeProfitPercent, setTakeProfitPercent] = useState('');
  const [takeProfitRR, setTakeProfitRR] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<{ stop_loss: number; take_profit: number | null; risk_value_vnd: number; risk_reward: number | null } | null>(null);

  const fetchEntryInfo = async (sym: string, qty?: number) => {
    const s = sym.trim();
    if (!s) {
      setExchange('');
      setMarketPrice(null);
      setQuantityInput('');
      setExchangeError(null);
      return;
    }
    setExchangeLoading(true);
    setExchangeError(null);
    try {
      const res = await marketApi.getEntryInfo(s, qty != null ? { quantity: qty } : undefined);
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setExchange(d.exchange || '');
        // Giá luôn lưu theo đơn vị ĐIỂM (1 điểm = 1.000 VND). Nếu API trả VND (>= 1000) thì quy về điểm.
        const raw = typeof d.market_price === 'number' ? d.market_price : null;
        const priceInPoints = raw != null ? (raw >= 1000 ? raw / 1000 : raw) : null;
        setMarketPrice(priceInPoints);
        setExchangeError(null);
      } else {
        setExchange('');
        setMarketPrice(null);
        setQuantityInput('');
        setExchangeError('Không lấy được thông tin mã');
      }
    } catch {
      setExchange('');
      setMarketPrice(null);
      setQuantityInput('');
      setExchangeError('Không lấy được thông tin mã');
    } finally {
      setExchangeLoading(false);
    }
  };

  const resetForm = () => {
    setSymbol('');
    setExchange('');
    setExchangeLoading(false);
    setExchangeError(null);
    setMarketPrice(null);
    setQuantityInput('');
    setUseMarketPrice(true);
    setEntryPriceInput('');
    setStopType('FIXED');
    setStopPrice('');
    setStopPercent('');
    setStopMaxLossVnd('');
    setTakeProfitType('');
    setTakeProfitPrice('');
    setTakeProfitPercent('');
    setTakeProfitRR('');
    setPreview(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const parseQuantity = (): number | null => {
    const s = quantityInput.replace(/\s|,/g, '');
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const effectiveQuantity = parseQuantity();

  const getEffectivePricePoints = (): number | null => {
    if (useMarketPrice) {
      const p = marketPrice != null ? (marketPrice >= 1000 ? marketPrice / 1000 : marketPrice) : null;
      return p != null && p > 0 ? p : null;
    }
    const n = parseFloat(entryPriceInput.replace(/,/g, '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const effectivePricePoints = getEffectivePricePoints();

  // Quy ước: Popup nhập giá theo ĐIỂM (1 điểm = 1.000 ₫). Gửi lên BE luôn là VND (điểm × 1000).
  const buildBody = (): CreatePositionRequest | null => {
    if (effectiveQuantity == null || effectiveQuantity <= 0) return null;
    if (effectivePricePoints == null || effectivePricePoints <= 0) return null;

    const body: CreatePositionRequest = {
      symbol: symbol.trim(),
      exchange,
      use_market_entry: useMarketPrice,
      ...(useMarketPrice ? {} : { entry_price: Math.round(effectivePricePoints * 1000) }),
      use_market_quantity: false,
      quantity: effectiveQuantity,
      stop_type: stopType,
      stop_params: {},
    };

    if (stopType === 'FIXED') {
      const sp = parseFloat(stopPrice);
      if (Number.isNaN(sp)) return null;
      body.stop_price = Math.round(sp * 1000); // điểm → VND
    } else if (stopType === 'PERCENT') {
      const pct = parseFloat(stopPercent);
      if (Number.isNaN(pct)) return null;
      body.stop_params = { percent: pct };
    } else if (stopType === 'MAX_LOSS') {
      const maxVnd = parseFloat(stopMaxLossVnd);
      if (Number.isNaN(maxVnd) || maxVnd <= 0) return null;
      body.stop_params = { max_loss_vnd: maxVnd }; // đã là VND
    }

    if (takeProfitType === 'FIXED') {
      const tp = parseFloat(takeProfitPrice);
      if (!Number.isNaN(tp)) {
        body.take_profit_type = 'FIXED';
        body.take_profit_price = Math.round(tp * 1000); // điểm → VND
      }
    } else if (takeProfitType === 'PERCENT') {
      const pct = parseFloat(takeProfitPercent);
      if (!Number.isNaN(pct)) {
        body.take_profit_type = 'PERCENT';
        body.take_profit_params = { percent: pct };
      }
    } else if (takeProfitType === 'R_RATIO') {
      const rr = parseFloat(takeProfitRR);
      if (!Number.isNaN(rr) && rr > 0) {
        body.take_profit_type = 'R_RATIO';
        body.take_profit_params = { risk_reward_ratio: rr };
      }
    }
    return body;
  };

  const handlePreview = async () => {
    const body = buildBody();
    if (!body || !body.symbol) {
      alert('Điền đủ Mã CK và cấu hình dừng lỗ. Khối lượng lấy từ thị trường sau khi chọn mã.');
      return;
    }
    if (!exchange || effectivePricePoints == null || effectivePricePoints <= 0 || effectiveQuantity == null || effectiveQuantity <= 0) {
      alert('Chọn mã CK, nhập giá và khối lượng hợp lệ.');
      return;
    }
    try {
      const entryPriceVnd = Math.round(effectivePricePoints * 1000);
      const res = await positionApi.calculate(portfolioId, {
        entry_price: entryPriceVnd,
        quantity: effectiveQuantity,
        stop_type: body.stop_type,
        stop_params: body.stop_params,
        stop_price: body.stop_price,
        take_profit_type: body.take_profit_type,
        take_profit_params: body.take_profit_params,
        take_profit_price: body.take_profit_price,
      });
      if (res.data?.success && res.data?.data) {
        setPreview(res.data.data);
      }
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Tính toán thất bại.');
    }
  };

  const handleSubmit = async () => {
    const body = buildBody();
    if (!body || !body.symbol) {
      alert('Điền đủ Mã CK và cấu hình dừng lỗ. Khối lượng lấy từ thị trường sau khi chọn mã.');
      return;
    }
    if (!exchange || effectivePricePoints == null || effectivePricePoints <= 0 || effectiveQuantity == null || effectiveQuantity <= 0) {
      alert('Chọn mã CK và nhập giá, khối lượng hợp lệ.');
      return;
    }
    setSubmitting(true);
    try {
      await positionApi.create(portfolioId, body);
      onSuccess();
      handleClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Đặt lệnh thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-panel rounded-2xl w-full max-w-lg shadow-xl overflow-hidden h-[90vh] max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 flex justify-between items-center flex-shrink-0 border-b border-border-standard/80">
          <h2 className="text-xl font-semibold text-text-main">
            Đặt lệnh
          </h2>
          <button type="button" onClick={handleClose} className="p-2 rounded-full text-text-muted hover:bg-panel hover:text-text-main" aria-label="Đóng">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6 bg-[#FAFBFC]">
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-text-main">Mã &amp; sàn</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Mã CK</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => {
                    setSymbol(e.target.value);
                    if (!e.target.value.trim()) { setExchange(''); setMarketPrice(null); setExchangeError(null); }
                  }}
                  onBlur={() => fetchEntryInfo(symbol)}
                  placeholder="VD: ACB"
                  className="w-full px-3 py-2.5 rounded-xl border border-border-standard text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] bg-panel"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Sàn</label>
                <div className="px-3 py-2.5 rounded-xl border border-border-standard bg-panel text-text-main text-sm min-h-[42px] flex items-center">
                  {exchangeLoading ? 'Đang tải...' : exchangeError ? <span className="text-negative">{exchangeError}</span> : exchange || '—'}
                </div>
              </div>
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-text-main">Giá &amp; khối lượng</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm text-text-muted">Giá vào</label>
                <div className="flex rounded-xl overflow-hidden bg-[#F1F5F9] p-1">
                  <button type="button" onClick={() => setUseMarketPrice(true)} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${useMarketPrice ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Giá sàn</button>
                  <button type="button" onClick={() => { setUseMarketPrice(false); if (marketPrice != null && entryPriceInput === '') setEntryPriceInput((marketPrice >= 1000 ? marketPrice / 1000 : marketPrice).toFixed(2)); }} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${!useMarketPrice ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Tự nhập</button>
                </div>
                {useMarketPrice ? (
                  <div className="px-3 py-2.5 rounded-xl border border-border-standard bg-panel min-h-[44px] flex items-center justify-between">
                    {exchangeLoading ? <span className="text-[#64748B] text-sm">Đang lấy giá...</span> : marketPrice != null ? (<><span className="font-semibold tabular-nums text-text-main">{(() => { const p = marketPrice * STOCK_PRICE_DISPLAY_SCALE; const points = p >= 1000 ? p / 1000 : p; return points.toFixed(2); })()}</span><span className="text-[#64748B] text-sm">điểm</span></>) : <span className="text-[#94A3B8] text-sm">Chọn mã CK trước</span>}
                  </div>
                ) : (
                  <div className="flex rounded-xl border border-border-standard bg-panel overflow-hidden">
                    <input type="text" inputMode="decimal" value={entryPriceInput} onChange={(e) => setEntryPriceInput(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="23.85" className="flex-1 min-w-0 px-3 py-2.5 text-text-main min-h-[44px] placeholder:text-[#94A3B8] focus:outline-none" />
                    <span className="flex-shrink-0 min-w-[3.5rem] px-3 py-2.5 text-sm text-[#64748B] flex items-center justify-end bg-[#F8FAFC]">điểm</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Khối lượng (cp)</label>
                <input type="text" inputMode="numeric" value={quantityInput} onChange={(e) => setQuantityInput(e.target.value.replace(/[^\d,]/g, ''))} placeholder="Số cp" className="w-full px-3 py-2.5 rounded-xl border border-border-standard text-text-main placeholder:text-[#94A3B8] bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] min-h-[44px]" />
              </div>
            </div>
          </section>
          {effectivePricePoints != null && effectivePricePoints > 0 && effectiveQuantity != null && effectiveQuantity > 0 && (() => {
            const pricePoints = effectivePricePoints;
            const priceVndPerShare = pricePoints * 1000;
            const totalVnd = Math.round(pricePoints * 1000 * effectiveQuantity);
            return (
              <section className="rounded-xl bg-panel border border-border-standard/80 p-4">
                <h3 className="text-sm font-medium text-text-main mb-3">Tổng tiền ước tính</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-[#475569]"><span>Giá</span><span className="font-mono tabular-nums">{pricePoints.toFixed(2)} điểm</span></div>
                  <div className="flex justify-between text-[#475569]"><span>Đơn giá</span><span className="font-mono tabular-nums">{formatNumberVI(priceVndPerShare)} ₫/cp</span></div>
                  <div className="flex justify-between text-[#475569]"><span>Khối lượng</span><span className="font-mono tabular-nums">{formatNumberVI(effectiveQuantity)} cp</span></div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-border-standard font-medium text-text-main"><span>Thành tiền</span><span className="font-mono tabular-nums text-[#166534]">{formatNumberVI(totalVnd)} ₫</span></div>
                </div>
              </section>
            );
          })()}
          <section className="rounded-xl bg-panel border border-border-standard/80 p-4 space-y-3">
            <h3 className="text-sm font-medium text-text-main">Ngừng lỗ</h3>
            <div className="flex rounded-xl overflow-hidden bg-[#F1F5F9] p-1">
              <button type="button" onClick={() => setStopType('FIXED')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${stopType === 'FIXED' ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Theo giá</button>
              <button type="button" onClick={() => setStopType('PERCENT')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${stopType === 'PERCENT' ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Theo %</button>
              <button type="button" onClick={() => setStopType('MAX_LOSS')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${stopType === 'MAX_LOSS' ? 'bg-panel text-accent shadow-sm' : 'text-[#64748B]'}`}>Thua lỗ tối đa</button>
            </div>
            {stopType === 'FIXED' && (
              <div>
                <label className="block text-sm text-text-muted mb-1">Giá dừng lỗ (điểm)</label>
                <input type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder="VD: 22.50" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {stopPrice.trim() !== '' && (() => {
                  const sp = parseFloat(stopPrice);
                  if (!Number.isFinite(sp) || sp <= 0) return null;
                  const entryPoints = effectivePricePoints ?? 0;
                  const stopVndPerShare = sp * 1000;
                  const riskPerShare = (entryPoints - sp) * 1000;
                  const qty = effectiveQuantity ?? 0;
                  const totalRisk = qty > 0 ? Math.round(riskPerShare * qty) : 0;
                  return (
                    <div className="mt-3 rounded-xl bg-negative/10/60 border border-[#FECACA]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính dừng lỗ</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Giá dừng lỗ</span><span className="font-mono tabular-nums">{sp.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between"><span>Đơn giá</span><span className="font-mono tabular-nums">{formatNumberVI(stopVndPerShare)} ₫/cp</span></div>
                        {effectivePricePoints != null && effectiveQuantity != null && effectiveQuantity > 0 && (
                          <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Rủi ro ước tính</span><span className="font-mono tabular-nums text-negative">{formatNumberVI(totalRisk)} ₫</span></div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {stopType === 'PERCENT' && (
              <>
                <label className="block text-sm text-text-muted mb-1">% thua lỗ chấp nhận</label>
                <input type="number" value={stopPercent} onChange={(e) => setStopPercent(e.target.value)} placeholder="VD: 5" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {stopPercent.trim() !== '' && effectivePricePoints != null && effectiveQuantity != null && (() => {
                  const pct = parseFloat(stopPercent);
                  if (!Number.isFinite(pct) || pct < 0) return null;
                  const entryPoints = effectivePricePoints;
                  const stopPoints = entryPoints * (1 - pct / 100);
                  const stopVnd = stopPoints * 1000;
                  const riskPerShare = (entryPoints - stopPoints) * 1000;
                  const totalRisk = Math.round(riskPerShare * effectiveQuantity);
                  return (
                    <div className="mt-3 rounded-xl bg-negative/10/60 border border-[#FECACA]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính dừng lỗ</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Giá vào</span><span className="font-mono tabular-nums">{entryPoints.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between"><span>Giảm {pct}%</span><span className="font-mono tabular-nums">→ {stopPoints.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Rủi ro ước tính</span><span className="font-mono tabular-nums text-negative">{formatNumberVI(totalRisk)} ₫</span></div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {stopType === 'MAX_LOSS' && (
              <>
                <label className="block text-sm text-text-muted mb-1">Số tiền tối đa chấp nhận thua (₫)</label>
                <input type="number" value={stopMaxLossVnd} onChange={(e) => setStopMaxLossVnd(e.target.value)} placeholder="VD: 500000" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {stopMaxLossVnd.trim() !== '' && effectivePricePoints != null && effectiveQuantity != null && effectiveQuantity > 0 && (() => {
                  const maxVnd = parseFloat(stopMaxLossVnd);
                  if (!Number.isFinite(maxVnd) || maxVnd <= 0) return null;
                  const entryPoints = effectivePricePoints;
                  const riskPerShareVnd = maxVnd / effectiveQuantity;
                  const stopPoints = entryPoints - riskPerShareVnd / 1000;
                  if (stopPoints <= 0) return null;
                  return (
                    <div className="mt-3 rounded-xl bg-negative/10/60 border border-[#FECACA]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính dừng lỗ</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Thua lỗ tối đa</span><span className="font-mono tabular-nums">{formatNumberVI(maxVnd)} ₫</span></div>
                        <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Giá dừng lỗ (điểm)</span><span className="font-mono tabular-nums text-negative">{stopPoints.toFixed(2)}</span></div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </section>
          <section className="rounded-xl bg-panel border border-border-standard/80 p-4 space-y-3">
            <h3 className="text-sm font-medium text-text-main">Chốt lời <span className="text-text-muted font-normal">(tùy chọn)</span></h3>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setTakeProfitType('')} className={`py-2 text-xs font-medium rounded-lg transition-colors ${takeProfitType === '' ? 'bg-positive/10 text-positive border border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border border-transparent'}`}>Không</button>
              <button type="button" onClick={() => setTakeProfitType('FIXED')} className={`py-2 text-xs font-medium rounded-lg transition-colors ${takeProfitType === 'FIXED' ? 'bg-positive/10 text-positive border border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border border-transparent'}`}>Giá cố định</button>
              <button type="button" onClick={() => setTakeProfitType('PERCENT')} className={`py-2 text-xs font-medium rounded-lg transition-colors ${takeProfitType === 'PERCENT' ? 'bg-positive/10 text-positive border border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border border-transparent'}`}>Theo %</button>
              <button type="button" onClick={() => setTakeProfitType('R_RATIO')} className={`py-2 text-xs font-medium rounded-lg transition-colors ${takeProfitType === 'R_RATIO' ? 'bg-positive/10 text-positive border border-[#A7F3D0]' : 'bg-[#F1F5F9] text-[#64748B] border border-transparent'}`}>Theo R:R</button>
            </div>
            {takeProfitType === 'FIXED' && (
              <>
                <label className="block text-sm text-text-muted mb-1">Giá chốt lời (điểm)</label>
                <input type="number" value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} placeholder="VD: 26.00" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {takeProfitPrice.trim() !== '' && (() => {
                  const tp = parseFloat(takeProfitPrice);
                  if (!Number.isFinite(tp) || tp <= 0) return null;
                  const tpVnd = tp * 1000;
                  const qty = effectiveQuantity ?? 0;
                  const totalVnd = qty > 0 ? Math.round(tpVnd * qty) : 0;
                  return (
                    <div className="mt-3 rounded-xl bg-[#F0FDF4]/80 border border-[#BBF7D0]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính chốt lời</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Giá chốt lời</span><span className="font-mono tabular-nums">{tp.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between"><span>Đơn giá</span><span className="font-mono tabular-nums">{formatNumberVI(tpVnd)} ₫/cp</span></div>
                        {qty > 0 && <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Thành tiền ước tính</span><span className="font-mono tabular-nums text-[#166534]">{formatNumberVI(totalVnd)} ₫</span></div>}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {takeProfitType === 'PERCENT' && (
              <>
                <label className="block text-sm text-text-muted mb-1">% lợi nhuận mong muốn</label>
                <input type="number" value={takeProfitPercent} onChange={(e) => setTakeProfitPercent(e.target.value)} placeholder="VD: 10" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {takeProfitPercent.trim() !== '' && effectivePricePoints != null && (() => {
                  const pct = parseFloat(takeProfitPercent);
                  if (!Number.isFinite(pct) || pct < 0) return null;
                  const entryPoints = effectivePricePoints;
                  const tpPoints = entryPoints * (1 + pct / 100);
                  const tpVnd = tpPoints * 1000;
                  const qty = effectiveQuantity ?? 0;
                  const totalVnd = qty > 0 ? Math.round(tpVnd * qty) : 0;
                  return (
                    <div className="mt-3 rounded-xl bg-[#F0FDF4]/80 border border-[#BBF7D0]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính chốt lời</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>Giá vào</span><span className="font-mono tabular-nums">{entryPoints.toFixed(2)} điểm</span></div>
                        <div className="flex justify-between"><span>Tăng {pct}%</span><span className="font-mono tabular-nums">→ {tpPoints.toFixed(2)} điểm</span></div>
                        {qty > 0 && <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Thành tiền ước tính</span><span className="font-mono tabular-nums text-[#166534]">{formatNumberVI(totalVnd)} ₫</span></div>}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {takeProfitType === 'R_RATIO' && (
              <>
                <label className="block text-sm text-text-muted mb-1">Tỷ lệ R:R (lợi : rủi ro)</label>
                <input type="number" value={takeProfitRR} onChange={(e) => setTakeProfitRR(e.target.value)} placeholder="VD: 2" className="w-full px-3 py-2.5 border border-border-standard rounded-xl text-text-main bg-panel focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20" />
                {takeProfitRR.trim() !== '' && effectivePricePoints != null && (() => {
                  const rr = parseFloat(takeProfitRR);
                  if (!Number.isFinite(rr) || rr <= 0) return null;
                  const entryPoints = effectivePricePoints;
                  let riskPerShare = 0;
                  if (stopType === 'FIXED' && stopPrice.trim() !== '') {
                    const sp = parseFloat(stopPrice);
                    if (Number.isFinite(sp)) riskPerShare = (entryPoints - sp) * 1000;
                  } else if (stopType === 'PERCENT' && stopPercent.trim() !== '') {
                    const pct = parseFloat(stopPercent);
                    if (Number.isFinite(pct) && pct >= 0) {
                      const stopPoints = entryPoints * (1 - pct / 100);
                      riskPerShare = (entryPoints - stopPoints) * 1000;
                    }
                  } else if (stopType === 'MAX_LOSS' && stopMaxLossVnd.trim() !== '' && effectiveQuantity != null && effectiveQuantity > 0) {
                    const maxVnd = parseFloat(stopMaxLossVnd);
                    if (Number.isFinite(maxVnd) && maxVnd > 0) riskPerShare = maxVnd / effectiveQuantity;
                  }
                  if (riskPerShare <= 0) return null;
                  const rewardPerShare = riskPerShare * rr;
                  const tpPoints = entryPoints + rewardPerShare / 1000;
                  const tpVnd = tpPoints * 1000;
                  const qty = effectiveQuantity ?? 0;
                  const totalVnd = qty > 0 ? Math.round(tpVnd * qty) : 0;
                  return (
                    <div className="mt-3 rounded-xl bg-[#F0FDF4]/80 border border-[#BBF7D0]/80 p-3 text-sm">
                      <div className="text-xs text-text-muted mb-2">Tính chốt lời R:R</div>
                      <div className="space-y-1.5 text-[#475569]">
                        <div className="flex justify-between"><span>R:R = 1:{rr}</span><span className="font-mono tabular-nums">Giá chốt lời {tpPoints.toFixed(2)} điểm</span></div>
                        {qty > 0 && <div className="flex justify-between pt-1.5 border-t border-border-standard font-medium text-text-main"><span>Thành tiền ước tính</span><span className="font-mono tabular-nums text-[#166534]">{formatNumberVI(totalVnd)} ₫</span></div>}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </section>
          {preview && (
            <section className="rounded-xl bg-panel border border-border-standard/80 p-4">
              <h3 className="text-sm font-medium text-text-main mb-2">Xem trước</h3>
              <div className="text-sm text-[#475569] space-y-1">
                <p>Dừng lỗ: {typeof preview.stop_loss === 'number' ? (preview.stop_loss / 1000).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—'} · Chốt lời: {preview.take_profit != null && typeof preview.take_profit === 'number' ? (preview.take_profit / 1000).toLocaleString(PRICE_LOCALE, PRICE_FRACTION_OPTIONS) : '—'}</p>
                <p>Rủi ro: {typeof preview.risk_value_vnd === 'number' ? formatNumberVI(preview.risk_value_vnd) : '—'} ₫ · R:R: {preview.risk_reward != null && typeof preview.risk_reward === 'number' ? preview.risk_reward.toFixed(2) : '—'}</p>
              </div>
            </section>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border-standard/80 flex-shrink-0 bg-panel rounded-b-2xl">
          <button type="button" onClick={handleSubmit} disabled={submitting || !exchange || effectivePricePoints == null || effectivePricePoints <= 0 || effectiveQuantity == null || effectiveQuantity <= 0 || exchangeLoading} className="w-full py-3 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none transition-colors">{submitting ? 'Đang tạo...' : 'Đặt lệnh'}</button>
        </div>
      </div>
    </div>
  );
}

export default OpenPositionModal;
