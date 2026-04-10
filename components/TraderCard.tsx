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
  const riskText = isHighRisk ? 'text-negative' : 'text-positive';
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${trader.id}&backgroundColor=b6e3f4`;

  return (
    <div className="card-flat rounded-lg p-4 flex flex-col h-full hover:border-[#D1D5DB] transition-colors duration-150">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg border border-border-standard overflow-hidden shrink-0 bg-panel">
          <img src={avatarUrl} alt={trader.name} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-text-main font-semibold text-sm truncate" title={trader.name}>{trader.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${riskBg} ${riskText} flex items-center gap-1 w-fit`}>
              Risk: {trader.riskScore}
            </span>
            <span className="text-text-muted text-[10px] font-medium">{trader.followers.toLocaleString()} follower</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-panel rounded-lg p-2.5 border border-border-standard">
          <span className="text-[10px] text-text-muted font-semibold uppercase block mb-0.5">ROI 30D</span>
          <p className="text-positive font-semibold text-base font-mono">+{trader.roi}%</p>
        </div>
        <div className="bg-panel rounded-lg p-2.5 border border-border-standard">
          <span className="text-[10px] text-text-muted font-semibold uppercase block mb-0.5">Win Rate</span>
          <p className="text-accent font-semibold text-base font-mono">{trader.winRate}%</p>
        </div>
      </div>

      <div className="mb-4 min-h-[36px]">
        <p className="text-xs text-text-muted line-clamp-2 leading-relaxed font-medium">
          "{trader.description}"
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
        {trader.topPairs.map(pair => (
          <span key={pair} className="bg-panel text-text-main text-[10px] px-2 py-0.5 rounded font-semibold border border-border-standard">
            {pair}
          </span>
        ))}
      </div>

      <div className="mt-auto">
        <button
          onClick={() => onAiCheck(trader)}
          disabled={isAnalyzing}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border-standard bg-panel hover:bg-panel text-text-muted hover:text-text-main transition-colors duration-150 text-xs font-semibold disabled:opacity-60"
        >
          {isAnalyzing ? 'Đang phân tích...' : 'AI Phân Tích'}
        </button>
      </div>
    </div>
  );
};
