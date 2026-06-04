import { create } from 'zustand';
import type { Decision, MaterialQuality, SupplierType, EmployeeType, ServiceLevel, MarketingQuality, Positioning, InvestmentAllocation, MarketResearchLevel } from '@/types';
import { INITIAL_CAPITAL } from '@/constants';

type PartialDecision = Partial<Decision>;

interface DecisionState {
  draft: PartialDecision;
  availableCapital: number;
  totalAllocated: number;
  isValid: boolean;

  setAvailableCapital: (amount: number) => void;
  update: (patch: PartialDecision) => void;
  setUnitsProduced: (n: number) => void;
  setMaterialQuality: (q: MaterialQuality) => void;
  setSupplier: (s: SupplierType) => void;
  setPrice: (p: number) => void;
  setLocalImprovementBudget: (n: number) => void;
  setServiceLevel: (s: ServiceLevel) => void;
  setOpeningHours: (h: number) => void;
  setDaysOpen: (d: number) => void;
  setMarketingBudget: (n: number) => void;
  setMarketingChannels: (c: string[]) => void;
  setMarketingQuality: (q: MarketingQuality) => void;
  setPositioning: (p: Positioning) => void;
  setEmployeeCount: (n: number) => void;
  setEmployeeType: (t: EmployeeType) => void;
  setTrainingBudget: (n: number) => void;
  setMotivationBonus: (n: number) => void;
  setMarketResearch: (level: MarketResearchLevel | undefined, cost: number) => void;
  setInvestments: (investments: InvestmentAllocation[]) => void;
  reset: (capital?: number) => void;
}

function buildDefault(capital: number): PartialDecision {
  return {
    unitsProduced: 0,
    materialQuality: 'medium',
    supplierId: 'standard',
    price: 0,
    localImprovementBudget: 0,
    serviceLevel: 'standard',
    openingHours: 10,
    daysOpen: 6,
    marketingBudget: 0,
    marketingChannels: [],
    marketingQuality: 'basic',
    positioning: 'quality_price',
    employeeCount: 1,
    employeeType: 'balanced',
    trainingBudget: 0,
    motivationBonus: 0,
    marketResearchLevel: undefined,
    marketResearchBudget: 0,
    investments: [],
    totalAllocated: 0,
    liquidityRetained: capital,
  };
}

export const useDecisionStore = create<DecisionState>((set) => ({
  draft: buildDefault(INITIAL_CAPITAL),
  availableCapital: INITIAL_CAPITAL,
  totalAllocated: 0,
  isValid: false,

  setAvailableCapital: (amount) => set({ availableCapital: amount }),

  update: (patch) => set((state) => {
    const next = { ...state.draft, ...patch };
    return { draft: next };
  }),

  setUnitsProduced: (n) => set((s) => ({ draft: { ...s.draft, unitsProduced: n } })),
  setMaterialQuality: (q) => set((s) => ({ draft: { ...s.draft, materialQuality: q } })),
  setSupplier: (sup) => set((s) => ({ draft: { ...s.draft, supplierId: sup } })),
  setPrice: (p) => set((s) => ({ draft: { ...s.draft, price: p } })),
  setLocalImprovementBudget: (n) => set((s) => ({ draft: { ...s.draft, localImprovementBudget: n } })),
  setServiceLevel: (sl) => set((s) => ({ draft: { ...s.draft, serviceLevel: sl } })),
  setOpeningHours: (h) => set((s) => ({ draft: { ...s.draft, openingHours: h } })),
  setDaysOpen: (d) => set((s) => ({ draft: { ...s.draft, daysOpen: d } })),
  setMarketingBudget: (n) => set((s) => ({ draft: { ...s.draft, marketingBudget: n } })),
  setMarketingChannels: (c) => set((s) => ({ draft: { ...s.draft, marketingChannels: c } })),
  setMarketingQuality: (q) => set((s) => ({ draft: { ...s.draft, marketingQuality: q } })),
  setPositioning: (p) => set((s) => ({ draft: { ...s.draft, positioning: p } })),
  setEmployeeCount: (n) => set((s) => ({ draft: { ...s.draft, employeeCount: n } })),
  setEmployeeType: (t) => set((s) => ({ draft: { ...s.draft, employeeType: t } })),
  setTrainingBudget: (n) => set((s) => ({ draft: { ...s.draft, trainingBudget: n } })),
  setMotivationBonus: (n) => set((s) => ({ draft: { ...s.draft, motivationBonus: n } })),
  setMarketResearch: (level, cost) => set((s) => ({
    draft: { ...s.draft, marketResearchLevel: level, marketResearchBudget: cost },
  })),
  setInvestments: (investments) => set((s) => ({ draft: { ...s.draft, investments } })),

  reset: (capital = INITIAL_CAPITAL) => set({
    draft: buildDefault(capital),
    availableCapital: capital,
    totalAllocated: 0,
    isValid: false,
  }),
}));
