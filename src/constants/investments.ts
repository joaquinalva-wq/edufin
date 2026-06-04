import type { Investment } from '@/types';

export const INVESTMENTS: Record<string, Investment> = {
  savings: {
    id: 'savings',
    nameKey: 'investments.savings.name',
    descKey: 'investments.savings.desc',
    emoji: '🏦',
    color: '#6b7280',
    riskLevel: 'very_low',
    expectedReturn: 0.015,   // 1.5% per round
    volatility: 0.002,
    maxLoss: -0.005,
    maxGain: 0.025,
    minHorizon: 1,
  },
  bond: {
    id: 'bond',
    nameKey: 'investments.bond.name',
    descKey: 'investments.bond.desc',
    emoji: '📜',
    color: '#3b82f6',
    riskLevel: 'low',
    expectedReturn: 0.025,   // 2.5% per round
    volatility: 0.008,
    maxLoss: -0.02,
    maxGain: 0.045,
    minHorizon: 3,
  },
  conservative_fund: {
    id: 'conservative_fund',
    nameKey: 'investments.conservative_fund.name',
    descKey: 'investments.conservative_fund.desc',
    emoji: '🛡️',
    color: '#10b981',
    riskLevel: 'low',
    expectedReturn: 0.035,   // 3.5% per round
    volatility: 0.018,
    maxLoss: -0.06,
    maxGain: 0.09,
    minHorizon: 2,
  },
  balanced_fund: {
    id: 'balanced_fund',
    nameKey: 'investments.balanced_fund.name',
    descKey: 'investments.balanced_fund.desc',
    emoji: '⚖️',
    color: '#f59e0b',
    riskLevel: 'medium',
    expectedReturn: 0.06,    // 6% per round
    volatility: 0.05,
    maxLoss: -0.18,
    maxGain: 0.25,
    minHorizon: 3,
  },
  stocks: {
    id: 'stocks',
    nameKey: 'investments.stocks.name',
    descKey: 'investments.stocks.desc',
    emoji: '📈',
    color: '#8b5cf6',
    riskLevel: 'high',
    expectedReturn: 0.09,    // 9% per round
    volatility: 0.15,
    maxLoss: -0.45,
    maxGain: 0.70,
    minHorizon: 5,
  },
  crypto: {
    id: 'crypto',
    nameKey: 'investments.crypto.name',
    descKey: 'investments.crypto.desc',
    emoji: '🪙',
    color: '#f97316',
    riskLevel: 'very_high',
    expectedReturn: 0.15,    // 15% per round
    volatility: 0.35,
    maxLoss: -0.65,
    maxGain: 1.80,
    minHorizon: 1,
  },
  startup: {
    id: 'startup',
    nameKey: 'investments.startup.name',
    descKey: 'investments.startup.desc',
    emoji: '🚀',
    color: '#ec4899',
    riskLevel: 'very_high',
    expectedReturn: 0.20,    // 20% per round (if it works)
    volatility: 0.42,
    maxLoss: -0.85,
    maxGain: 2.50,
    minHorizon: 5,
  },
};

export const INVESTMENT_LIST = Object.values(INVESTMENTS);

export const RISK_LEVEL_COLORS: Record<string, string> = {
  very_low: '#6b7280',
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  very_high: '#7c3aed',
};

export const RISK_LEVEL_LABEL_KEYS: Record<string, string> = {
  very_low: 'risk.very_low',
  low: 'risk.low',
  medium: 'risk.medium',
  high: 'risk.high',
  very_high: 'risk.very_high',
};
