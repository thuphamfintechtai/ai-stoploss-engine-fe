import React from 'react';

interface Props {
  currentRisk: number;
  maxRisk: number;
}

export const RiskProgressBar: React.FC<Props> = ({ currentRisk, maxRisk }) => {
  const percentage = Math.min((currentRisk / maxRisk) * 100, 100);
  const isOverLimit = currentRisk > maxRisk;

  let bgClass = 'bg-accent';
  if (percentage > 50) bgClass = 'bg-[#B45309]';
  if (percentage > 80) bgClass = 'bg-[#A63D3D]';
  if (isOverLimit) bgClass = 'bg-[#A63D3D]';

  return (
    <div className="w-full bg-[#E5E7EB] rounded-full h-2 relative overflow-hidden mt-2">
      <div
        className={`h-full transition-all duration-300 ease-out ${bgClass}`}
        style={{ width: `${percentage}%` }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-text-main">
        {percentage.toFixed(1)}% Used
      </span>
    </div>
  );
};
