export interface TraderProfile {
  id: string;
  name: string;
  roi: number;
  winRate: number;
  riskScore: string; // "8/10"
  description: string;
  topPairs: string[];
  followers: number;
  strategy: string; // For AI context
}

export interface TradeConfig {
  totalBalance: number;
  maxRiskPercent: number;
  expectedReturnPercent?: number;
}

export interface AiAnalysis {
  marketFitScore: number; // 0-100
  safetyScore: number; // 0-100
  verdict: 'RECOMMENDED' | 'CAUTION' | 'AVOID';
  marketAnalysis: string;
  pros: string[];
  cons: string[];
  strategyMatch: string; // e.g., "High Volatility Match"
}