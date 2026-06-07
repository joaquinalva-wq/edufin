export type UserRole = 'student' | 'admin';
export type Language = 'es' | 'en';
export type GameStatus = 'setup' | 'active' | 'paused' | 'completed';
export type RoundStatus = 'open' | 'locked' | 'simulating' | 'done';
export type MaterialQuality = 'cheap' | 'medium' | 'premium';
export type SupplierType = 'budget' | 'standard' | 'premium';
export type EmployeeType = 'cheap' | 'balanced' | 'expert';
export type ServiceLevel = 'basic' | 'standard' | 'premium';
export type MarketingQuality = 'basic' | 'professional' | 'creative';
export type Positioning = 'budget' | 'quality_price' | 'premium' | 'sustainable' | 'sports' | 'youth';
export type MarketResearchLevel = 'basic' | 'standard' | 'premium';
export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type FeedbackType = 'success' | 'warning' | 'error' | 'info' | 'tip';
export type EventType = 'demand' | 'cost' | 'market' | 'operational' | 'macro';

export type ProductId =
  | 'bikes'
  | 'skateboards'
  | 'escooters'
  | 'backpacks'
  | 'bottles'
  | 'headphones';

export type LocationId =
  | 'school'
  | 'university'
  | 'mall'
  | 'residential'
  | 'tourist'
  | 'sports';

export type InvestmentId =
  | 'savings'
  | 'bond'
  | 'conservative_fund'
  | 'balanced_fund'
  | 'stocks'
  | 'crypto'
  | 'startup';

// ─── Static game entities ────────────────────────────────────────────────────

export interface Product {
  id: ProductId;
  nameKey: string;
  descKey: string;
  emoji: string;
  color: string;
  unitCost: number;
  minPrice: number;
  maxPrice: number;
  baseDemand: number;
  priceSensitivity: number;       // 0-1: how much price↑ kills demand
  marketingSensitivity: number;   // 0-1: how much marketing helps
  qualitySensitivity: number;     // 0-1: how much material quality matters
  operationalComplexity: number;  // 0-1: harder to operate = more employees needed
  scalabilityPotential: number;   // 0-1
  obsolescenceRisk: number;       // 0-1
  minEmployees: number;
}

export interface Location {
  id: LocationId;
  nameKey: string;
  descKey: string;
  emoji: string;
  color: string;
  rentPerRound: number;
  trafficMultiplier: number;      // base traffic multiplier
  segment: string;
  competitionLevel: number;       // 0-1
  growthPotential: number;        // 0-1
  risk: number;                   // 0-1
}

export interface Investment {
  id: InvestmentId;
  nameKey: string;
  descKey: string;
  emoji: string;
  color: string;
  riskLevel: RiskLevel;
  expectedReturn: number;         // fraction per round (e.g. 0.015 = 1.5%)
  volatility: number;             // std deviation of return rate
  maxLoss: number;                // worst-case fraction (negative, e.g. -0.6)
  maxGain: number;                // best-case fraction (e.g. 1.5)
  minHorizon: number;             // recommended minimum rounds
}

export interface RandomEvent {
  id: string;
  nameKey: string;
  descKey: string;
  emoji: string;
  type: EventType;
  weight: number;                 // probability weight in pool
  predictable: boolean;           // can market research reveal it?
  productModifiers: Partial<Record<ProductId, number>>;
  locationModifiers: Partial<Record<LocationId, number>>;
  generalDemandModifier: number;  // 1.0 = neutral
  costModifier: number;           // 1.0 = neutral
  investmentModifier: number;     // 1.0 = neutral, applied to risky assets
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  school: string;
  grade: string;
  subject: string;
  language: Language;
  activeGameId?: string;
  activeCompanyId?: string;
  createdAt: Date;
}

// ─── Game ────────────────────────────────────────────────────────────────────

export interface RoundScheduleEntry {
  roundNumber: number;
  openAt: Date;
  closeAt: Date;
  simulatedAt?: Date;
}

export type SimulationMode = 'automatic' | 'manual';

export interface Game {
  id: string;
  name: string;
  description?: string;
  joinCode: string;               // 6-char uppercase code
  adminUid: string;               // creator (teacher or student host)
  status: GameStatus;
  simulationMode: SimulationMode; // 'automatic' = daily cron, 'manual' = host triggers
  currentRound: number;           // 1-indexed
  totalRounds: number;            // 10
  initialCapital: number;         // 100000
  decisionCloseTime: string;      // 'HH:mm'
  timezone: string;
  schoolFilter?: string;
  gradeFilter?: string;
  subjectFilter?: string;
  participantCount: number;
  roundHistory: RoundScheduleEntry[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// ─── Company ─────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  uid: string;
  gameId: string;
  name: string;
  brandName: string;
  productId: ProductId;
  locationId: LocationId;
  logoColor: string;
  initialCapital: number;
  currentCapital: number;
  netWorth: number;
  brandStrength: number;          // 0-1, accumulates
  customerSatisfaction: number;   // 0-1, starts at 0.5
  employeeMorale: number;         // 0-1, starts at 0.5
  localLevel: number;             // 0-5, improvements
  roundsCompleted: number;
  createdAt: Date;
}

// ─── Decision ────────────────────────────────────────────────────────────────

export interface InvestmentAllocation {
  investmentId: InvestmentId;
  amount: number;
}

export interface Decision {
  unitsProduced: number;
  materialQuality: MaterialQuality;
  supplierId: SupplierType;
  price: number;
  localImprovementBudget: number;
  serviceLevel: ServiceLevel;
  openingHours: number;           // hours/day: 6-16
  daysOpen: number;               // 5-7
  marketingBudget: number;
  marketingChannels: string[];
  marketingQuality: MarketingQuality;
  positioning: Positioning;
  employeeCount: number;
  employeeType: EmployeeType;
  trainingBudget: number;
  motivationBonus: number;
  marketResearchLevel?: MarketResearchLevel;
  marketResearchBudget: number;
  investments: InvestmentAllocation[];
  totalAllocated: number;
  liquidityRetained: number;
}

// ─── Round & Results ─────────────────────────────────────────────────────────

export interface InvestmentReturn {
  investmentId: InvestmentId;
  amountInvested: number;
  netReturn: number;              // net gain/loss (not including principal)
  returnPct: number;
}

export interface FeedbackPoint {
  type: FeedbackType;
  titleKey: string;
  messageKey: string;
  params?: Record<string, string | number>;
  learnMoreKey?: string;
}

export interface MarketResearchInsight {
  type: 'demand' | 'competition' | 'price' | 'event' | 'trend';
  messageKey: string;
  params?: Record<string, string | number>;
  confidence: number;             // 0-1
}

export interface MarketResearchResult {
  level: MarketResearchLevel;
  cost: number;
  insights: MarketResearchInsight[];
}

export interface RoundResult {
  // Demand
  potentialDemand: number;
  unitsSold: number;
  stockShortfall: number;
  overstock: number;

  // Revenue
  revenue: number;

  // Costs
  productionCost: number;
  rentCost: number;
  employeeCost: number;
  marketingCost: number;
  researchCost: number;
  localCost: number;
  totalOperatingCosts: number;

  // Profitability
  grossProfit: number;
  netProfit: number;

  // Investments
  investmentReturns: InvestmentReturn[];
  totalInvestmentNetReturn: number;

  // Capital
  startingCapital: number;
  endingCapital: number;
  capitalChange: number;
  capitalChangePct: number;
  cumulativeProfitability: number; // % vs initial $100k

  // Simulation indices (for transparency)
  productLocationFit: number;
  operationalEfficiency: number;
  employeeProductivity: number;
  marketingEffect: number;
  priceElasticityEffect: number;
  brandEffect: number;
  csEffect: number;
  randomEventModifier: number;

  // Updated company state
  brandStrengthNew: number;
  customerSatisfactionNew: number;
  employeeMoraleNew: number;

  // Issues
  liquidityCrisis: boolean;
  missedOpportunities: string[];

  // Ranking (populated after all companies simulated)
  rankInGame: number;
  totalParticipants: number;

  // Feedback
  feedbackPoints: FeedbackPoint[];
  eventId?: string;
}

export interface Round {
  id: string;
  gameId: string;
  companyId: string;
  uid: string;
  roundNumber: number;
  status: RoundStatus;
  openAt: Date;
  closeAt: Date;
  simulatedAt?: Date;
  startingCapital: number;
  decision?: Decision;
  result?: RoundResult;
  eventId?: string;
  marketResearchResult?: MarketResearchResult;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  uid: string;
  companyId: string;
  displayName: string;
  school: string;
  grade: string;
  companyName: string;
  brandName: string;
  productId: ProductId;
  locationId: LocationId;
  currentCapital: number;
  netWorth: number;
  cumulativeProfitability: number;
  rank: number;
  roundsCompleted: number;
  lastUpdated: Date;
}

// ─── Admin / Analytics ───────────────────────────────────────────────────────

export interface StudentAnalytics {
  uid: string;
  riskScore: number;              // 0-1
  diversificationScore: number;  // 0-1
  marketResearchUsage: number;   // 0-1 (fraction of rounds used)
  capitalAllocationQuality: number; // 0-1
  shortLongTermBalance: number;  // 0-1
  productLocationCoherence: number; // PLF average
  adaptabilityScore: number;     // 0-1 (strategy changes after bad rounds)
  liquidityManagement: number;   // 0-1 (avg liquidity kept)
  dominantStrategy: string;
  strengthAreas: string[];
  improvementAreas: string[];
  autoReportEs: string;
  autoReportEn: string;
}
