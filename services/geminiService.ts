import { TraderProfile, AiAnalysis } from '../types';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Phân tích trader qua backend API (proxy đến Gemini).
 * Không expose API key trên frontend.
 */
export const analyzeTrader = async (trader: TraderProfile, marketContext: string): Promise<AiAnalysis | null> => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await axios.post(
      `${API_URL}/api/ai/analyze-trader`,
      { trader, marketContext },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.data?.success && response.data?.data) {
      return response.data.data as AiAnalysis;
    }
    return null;
  } catch (error) {
    console.error("AI Trader Analysis Error:", error);
    return null;
  }
};
