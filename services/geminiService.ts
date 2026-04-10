import { GoogleGenAI } from "@google/genai";
import { TraderProfile, AiAnalysis } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing in process.env");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeTrader = async (trader: TraderProfile, marketContext: string): Promise<AiAnalysis | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  const prompt = `
    ROLE: Senior Risk Manager & Algo Trading Analyst.
    TASK: Analyze the trader profile against the current market context and return a strict JSON report.

    TRADER PROFILE:
    - Name: ${trader.name}
    - 30D ROI: ${trader.roi}%
    - Win Rate: ${trader.winRate}%
    - Internal Risk Score: ${trader.riskScore}
    - Strategy: ${trader.strategy}
    - Top Pairs: ${trader.topPairs.join(', ')}

    CURRENT MARKET CONTEXT:
    ${marketContext}

    RESPONSE FORMAT (STRICT JSON ONLY, NO MARKDOWN BLOCK):
    {
      "marketFitScore": number (0-100, how well strategy fits current market),
      "safetyScore": number (0-100, inverse of risk, higher is safer),
      "verdict": "RECOMMENDED" | "CAUTION" | "AVOID",
      "marketAnalysis": "Short paragraph (in Vietnamese) analyzing why they fit/don't fit the current market.",
      "pros": ["Point 1 (Vietnamese)", "Point 2 (Vietnamese)"],
      "cons": ["Point 1 (Vietnamese)", "Point 2 (Vietnamese)"],
      "strategyMatch": "Short tag (e.g., 'Phù hợp biến động mạnh', 'Rủi ro cao', 'An toàn')"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    if (!text) return null;
    
    // Parse JSON
    const data = JSON.parse(text) as AiAnalysis;
    return data;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};