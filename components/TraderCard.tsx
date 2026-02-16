import React from 'react';
import { TraderProfile } from '../types';

interface Props {
  trader: TraderProfile;
  onAiCheck: (trader: TraderProfile) => void;
  isAnalyzing: boolean;
}

export const TraderCard: React.FC<Props> = ({ trader, onAiCheck, isAnalyzing }) => {
  const isHighRisk = trader.riskScore.startsWith('8') || trader.riskScore.startsWith('9') || trader.riskScore.startsWith('10');
  const riskBg = isHighRisk ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-[#ECFDF5] border-[#A7F3D0]';
  const riskText = isHighRisk ? 'text-[#A63D3D]' : 'text-[#0B6E4B]';
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${trader.id}&backgroundColor=b6e3f4`;

  return (
    <div className="card-flat rounded-lg p-4 flex flex-col h-full hover:border-[#D1D5DB] transition-colors duration-150">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg border border-[#E5E7EB] overflow-hidden shrink-0 bg-[#F3F4F6]">
          <img src={avatarUrl} alt={trader.name} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-[#111827] font-semibold text-sm truncate" title={trader.name}>{trader.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${riskBg} ${riskText} flex items-center gap-1 w-fit`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Risk: {trader.riskScore}
            </span>
            <span className="text-[#6B7280] text-[10px] font-medium">{trader.followers.toLocaleString()} follower</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#F9FAFB] rounded-lg p-2.5 border border-[#E5E7EB]">
          <span className="text-[10px] text-[#6B7280] font-semibold uppercase block mb-0.5">ROI 30D</span>
          <p className="text-[#0B6E4B] font-semibold text-base font-mono">+{trader.roi}%</p>
        </div>
        <div className="bg-[#F9FAFB] rounded-lg p-2.5 border border-[#E5E7EB]">
          <span className="text-[10px] text-[#6B7280] font-semibold uppercase block mb-0.5">Win Rate</span>
          <p className="text-[#1E3A5F] font-semibold text-base font-mono">{trader.winRate}%</p>
        </div>
      </div>

      <div className="mb-4 min-h-[36px]">
        <p className="text-xs text-[#6B7280] line-clamp-2 leading-relaxed font-medium">
          "{trader.description}"
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
        {trader.topPairs.map(pair => (
          <span key={pair} className="bg-[#F3F4F6] text-[#374151] text-[10px] px-2 py-0.5 rounded font-semibold border border-[#E5E7EB]">
            {pair}
          </span>
        ))}
      </div>

      <div className="mt-auto">
        <button
          onClick={() => onAiCheck(trader)}
          disabled={isAnalyzing}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#6B7280] hover:text-[#111827] transition-colors duration-150 text-xs font-semibold disabled:opacity-60"
        >
          {isAnalyzing ? (
            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-[#1E3A5F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
          )}
          {isAnalyzing ? 'Đang phân tích...' : 'AI Phân Tích'}
        </button>
      </div>
    </div>
  );
};
