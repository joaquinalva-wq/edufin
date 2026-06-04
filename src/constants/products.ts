import type { Product } from '@/types';

export const PRODUCTS: Record<string, Product> = {
  bikes: {
    id: 'bikes',
    nameKey: 'products.bikes.name',
    descKey: 'products.bikes.desc',
    emoji: '🚲',
    color: '#6366f1',
    unitCost: 800,
    minPrice: 1200,
    maxPrice: 2500,
    baseDemand: 12,
    priceSensitivity: 0.7,
    marketingSensitivity: 0.5,
    qualitySensitivity: 0.85,
    operationalComplexity: 0.75,
    scalabilityPotential: 0.65,
    obsolescenceRisk: 0.2,
    minEmployees: 2,
  },
  skateboards: {
    id: 'skateboards',
    nameKey: 'products.skateboards.name',
    descKey: 'products.skateboards.desc',
    emoji: '🛹',
    color: '#f59e0b',
    unitCost: 250,
    minPrice: 400,
    maxPrice: 900,
    baseDemand: 22,
    priceSensitivity: 0.9,
    marketingSensitivity: 0.95,
    qualitySensitivity: 0.5,
    operationalComplexity: 0.3,
    scalabilityPotential: 0.8,
    obsolescenceRisk: 0.35,
    minEmployees: 1,
  },
  escooters: {
    id: 'escooters',
    nameKey: 'products.escooters.name',
    descKey: 'products.escooters.desc',
    emoji: '🛴',
    color: '#10b981',
    unitCost: 1800,
    minPrice: 2800,
    maxPrice: 5500,
    baseDemand: 7,
    priceSensitivity: 0.8,
    marketingSensitivity: 0.6,
    qualitySensitivity: 0.9,
    operationalComplexity: 0.9,
    scalabilityPotential: 0.9,
    obsolescenceRisk: 0.45,
    minEmployees: 2,
  },
  backpacks: {
    id: 'backpacks',
    nameKey: 'products.backpacks.name',
    descKey: 'products.backpacks.desc',
    emoji: '🎒',
    color: '#ec4899',
    unitCost: 350,
    minPrice: 600,
    maxPrice: 1400,
    baseDemand: 28,
    priceSensitivity: 0.7,
    marketingSensitivity: 0.8,
    qualitySensitivity: 0.7,
    operationalComplexity: 0.4,
    scalabilityPotential: 0.75,
    obsolescenceRisk: 0.25,
    minEmployees: 1,
  },
  bottles: {
    id: 'bottles',
    nameKey: 'products.bottles.name',
    descKey: 'products.bottles.desc',
    emoji: '🍶',
    color: '#14b8a6',
    unitCost: 80,
    minPrice: 150,
    maxPrice: 380,
    baseDemand: 55,
    priceSensitivity: 1.0,
    marketingSensitivity: 0.65,
    qualitySensitivity: 0.5,
    operationalComplexity: 0.2,
    scalabilityPotential: 0.7,
    obsolescenceRisk: 0.15,
    minEmployees: 1,
  },
  headphones: {
    id: 'headphones',
    nameKey: 'products.headphones.name',
    descKey: 'products.headphones.desc',
    emoji: '🎧',
    color: '#8b5cf6',
    unitCost: 500,
    minPrice: 900,
    maxPrice: 2000,
    baseDemand: 18,
    priceSensitivity: 0.8,
    marketingSensitivity: 1.0,
    qualitySensitivity: 0.8,
    operationalComplexity: 0.5,
    scalabilityPotential: 0.85,
    obsolescenceRisk: 0.5,
    minEmployees: 1,
  },
};

export const PRODUCT_LIST = Object.values(PRODUCTS);

export const MATERIAL_COST_MULTIPLIERS: Record<string, number> = {
  cheap: 0.78,
  medium: 1.0,
  premium: 1.32,
};

export const MATERIAL_QUALITY_EFFECT: Record<string, number> = {
  cheap: 0.75,
  medium: 1.0,
  premium: 1.25,
};

export const SUPPLIER_COST_MULTIPLIERS: Record<string, number> = {
  budget: 0.85,
  standard: 1.0,
  premium: 1.2,
};

export const SUPPLIER_RELIABILITY: Record<string, number> = {
  budget: 0.8,
  standard: 1.0,
  premium: 1.15,
};

export const EMPLOYEE_DAILY_COST: Record<string, number> = {
  cheap: 1800,
  balanced: 3200,
  expert: 5800,
};

export const EMPLOYEE_BASE_PRODUCTIVITY: Record<string, number> = {
  cheap: 0.6,
  balanced: 1.0,
  expert: 1.4,
};

export const SERVICE_LEVEL_MULTIPLIER: Record<string, number> = {
  basic: 0.85,
  standard: 1.0,
  premium: 1.2,
};

export const MARKETING_QUALITY_MULTIPLIER: Record<string, number> = {
  basic: 0.8,
  professional: 1.0,
  creative: 1.35,
};

export const MARKET_RESEARCH_COSTS: Record<string, number> = {
  basic: 5000,
  standard: 10000,
  premium: 20000,
};

export const MARKET_RESEARCH_INSIGHTS: Record<string, number> = {
  basic: 1,
  standard: 3,
  premium: 5,
};
