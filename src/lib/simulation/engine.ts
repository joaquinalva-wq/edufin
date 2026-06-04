import type {
  Decision, Company, Game, RandomEvent, RoundResult,
  InvestmentReturn, FeedbackPoint, Product, Location,
} from '@/types';
import {
  PRODUCTS, LOCATIONS, INVESTMENTS,
  MATERIAL_COST_MULTIPLIERS, MATERIAL_QUALITY_EFFECT,
  SUPPLIER_COST_MULTIPLIERS,
  EMPLOYEE_DAILY_COST, EMPLOYEE_BASE_PRODUCTIVITY,
  SERVICE_LEVEL_MULTIPLIER, MARKETING_QUALITY_MULTIPLIER,
  INITIAL_CAPITAL, LIQUIDITY_CRISIS_THRESHOLD,
} from '@/constants';
import { getProductLocationFit } from '@/constants/matrix';
import { gaussianSample, clamp, diminishingReturns } from '@/lib/utils';

// ─── Sub-calculators ─────────────────────────────────────────────────────────

function calcMarketingEffect(
  budget: number,
  quality: string,
): number {
  if (budget <= 0) return 0.72; // penalty for zero marketing
  const qualityMult = MARKETING_QUALITY_MULTIPLIER[quality] ?? 1.0;
  // Diminishing returns: max budget $40k → diminishing after $20k
  const budgetEffect = diminishingReturns(budget, 40_000, 2.5);
  // 0.72 base + up to 0.78 gain = 0.72–1.50
  return clamp(0.72 + budgetEffect * 0.78 * qualityMult, 0.72, 1.52);
}

function calcEmployeeProductivity(
  count: number,
  type: string,
  trainingBudget: number,
  motivationBonus: number,
  morale: number,
): number {
  if (count <= 0) return 0;
  const baseProd = EMPLOYEE_BASE_PRODUCTIVITY[type] ?? 1.0;
  const trainingEffect = diminishingReturns(trainingBudget, 10_000) * 0.2;
  const bonusEffect = diminishingReturns(motivationBonus, 8_000) * 0.15;
  const moraleEffect = morale * 0.15; // 0–0.15
  return clamp(baseProd + trainingEffect + bonusEffect + moraleEffect, 0.35, 1.35);
}

function calcOperationalEfficiency(
  count: number,
  hours: number,
  daysOpen: number,
  serviceLevel: string,
  complexity: number,
): number {
  if (count <= 0) return 0;
  const capacityScore = clamp((hours / 12) * (daysOpen / 7), 0.4, 1.0);
  const serviceMult = SERVICE_LEVEL_MULTIPLIER[serviceLevel] ?? 1.0;
  const complexityPenalty = complexity * 0.2; // more complex = harder to run efficiently
  return clamp(capacityScore * serviceMult - complexityPenalty, 0.3, 1.0);
}

function calcMaxUnitsPerEmployee(
  employeeType: string,
  hours: number,
  daysOpen: number,
): number {
  const baseCapacity: Record<string, number> = {
    cheap: 6,
    balanced: 10,
    expert: 14,
  };
  const perEmployeePerDay = baseCapacity[employeeType] ?? 10;
  return perEmployeePerDay * (hours / 8) * daysOpen;
}

function calcNewBrandStrength(
  current: number,
  marketingBudget: number,
  marketingQuality: string,
  unitsSold: number,
  positioning: string,
): number {
  const qualityMult = MARKETING_QUALITY_MULTIPLIER[marketingQuality] ?? 1.0;
  const marketingGain = diminishingReturns(marketingBudget, 30_000) * 0.06 * qualityMult;
  const salesGain = diminishingReturns(unitsSold, 50) * 0.03;
  const premiumBonus = positioning === 'premium' ? 0.01 : 0;
  // Brand decays slightly each round without investment
  const decay = marketingBudget < 3_000 ? -0.04 : 0;
  return clamp(current + marketingGain + salesGain + premiumBonus + decay, 0, 1);
}

function calcNewCustomerSatisfaction(
  current: number,
  materialQuality: string,
  serviceLevel: string,
  price: number,
  minPrice: number,
  maxPrice: number,
  ep: number,
  hadStockShortfall: boolean,
): number {
  const matEffect = MATERIAL_QUALITY_EFFECT[materialQuality] ?? 1.0;
  const svcEffect = SERVICE_LEVEL_MULTIPLIER[serviceLevel] ?? 1.0;
  const priceNorm = (price - minPrice) / (maxPrice - minPrice + 1); // 0–1
  const valuePerception = matEffect - priceNorm * 0.4; // high price reduces value perception
  const epEffect = (ep - 1.0) * 0.1; // great employees boost CS
  const stockPenalty = hadStockShortfall ? -0.06 : 0;

  const target = clamp(0.5 * valuePerception + 0.3 * svcEffect - 0.1 * priceNorm + epEffect, 0.2, 1.0);
  // CS moves toward target slowly (inertia)
  const newCS = current + (target - current) * 0.35 + stockPenalty;
  return clamp(newCS, 0.1, 1.0);
}

function calcNewMorale(
  current: number,
  type: string,
  trainingBudget: number,
  motivationBonus: number,
): number {
  const investment = trainingBudget + motivationBonus;
  const gain = diminishingReturns(investment, 15_000) * 0.12;
  const decay = type === 'cheap' ? -0.04 : 0; // cheap employees disengage faster
  return clamp(current + gain + decay, 0.1, 1.0);
}

// ─── Feedback generator ───────────────────────────────────────────────────────

function generateFeedback(
  decision: Decision,
  result: Omit<RoundResult, 'feedbackPoints' | 'rankInGame' | 'totalParticipants'>,
  product: Product,
  _location: Location,
): FeedbackPoint[] {
  const points: FeedbackPoint[] = [];

  // PLF feedback
  if (result.productLocationFit >= 1.3) {
    points.push({ type: 'success', titleKey: 'feedback.great_fit.title', messageKey: 'feedback.great_fit.msg', params: { fit: result.productLocationFit.toFixed(2) } });
  } else if (result.productLocationFit <= 0.75) {
    points.push({ type: 'error', titleKey: 'feedback.poor_fit.title', messageKey: 'feedback.poor_fit.msg', learnMoreKey: 'feedback.poor_fit.learn', params: { fit: result.productLocationFit.toFixed(2) } });
  }

  // Stock shortfall
  if (result.stockShortfall > 5) {
    const lost = result.stockShortfall * decision.price;
    points.push({ type: 'warning', titleKey: 'feedback.stock_out.title', messageKey: 'feedback.stock_out.msg', learnMoreKey: 'feedback.stock_out.learn', params: { units: result.stockShortfall, lost: Math.round(lost) } });
  }

  // Overstock
  if (result.overstock > decision.unitsProduced * 0.4) {
    points.push({ type: 'warning', titleKey: 'feedback.overstock.title', messageKey: 'feedback.overstock.msg', params: { units: result.overstock } });
  }

  // Liquidity crisis
  if (result.liquidityCrisis) {
    points.push({ type: 'error', titleKey: 'feedback.liquidity_crisis.title', messageKey: 'feedback.liquidity_crisis.msg', learnMoreKey: 'feedback.liquidity_crisis.learn' });
  }

  // Zero marketing
  if (decision.marketingBudget === 0) {
    points.push({ type: 'tip', titleKey: 'feedback.no_marketing.title', messageKey: 'feedback.no_marketing.msg', learnMoreKey: 'feedback.no_marketing.learn' });
  }

  // Great marketing ROI
  if (result.marketingEffect > 1.35) {
    points.push({ type: 'success', titleKey: 'feedback.great_marketing.title', messageKey: 'feedback.great_marketing.msg', params: { effect: (result.marketingEffect * 100 - 100).toFixed(0) } });
  }

  // Material-positioning mismatch
  if (decision.materialQuality === 'cheap' && decision.positioning === 'premium') {
    points.push({ type: 'error', titleKey: 'feedback.quality_mismatch.title', messageKey: 'feedback.quality_mismatch.msg', learnMoreKey: 'feedback.quality_mismatch.learn' });
  }

  // Good profit
  if (result.netProfit > 0 && result.capitalChangePct > 5) {
    points.push({ type: 'success', titleKey: 'feedback.profitable.title', messageKey: 'feedback.profitable.msg', params: { pct: result.capitalChangePct.toFixed(1) } });
  }

  // Loss
  if (result.netProfit < 0) {
    points.push({ type: 'warning', titleKey: 'feedback.loss.title', messageKey: 'feedback.loss.msg', learnMoreKey: 'feedback.loss.learn', params: { loss: Math.abs(Math.round(result.netProfit)) } });
  }

  // Low employee count for complexity
  if (decision.employeeCount < (PRODUCTS[product.id]?.minEmployees ?? 1) * 1.5 && result.operationalEfficiency < 0.6) {
    points.push({ type: 'warning', titleKey: 'feedback.understaffed.title', messageKey: 'feedback.understaffed.msg' });
  }

  return points.slice(0, 5); // cap at 5 feedback cards
}

// ─── Main simulation engine ───────────────────────────────────────────────────

export function simulateRound(
  decision: Decision,
  company: Company,
  _game: Game,
  event?: RandomEvent,
): Omit<RoundResult, 'rankInGame' | 'totalParticipants'> {
  const product = PRODUCTS[company.productId];
  const location = LOCATIONS[company.locationId];

  if (!product || !location) {
    throw new Error(`Unknown product "${company.productId}" or location "${company.locationId}"`);
  }

  // ── 1. Key indices ──────────────────────────────────────────────────────────

  const PLF = getProductLocationFit(company.productId, company.locationId);

  const priceNorm = clamp((decision.price - product.minPrice) / (product.maxPrice - product.minPrice + 1), 0, 1);
  const PEE = clamp(1.5 - priceNorm * product.priceSensitivity, 0.35, 1.55);

  const marketingEffect = calcMarketingEffect(
    decision.marketingBudget,
    decision.marketingQuality,
  );

  const EP = calcEmployeeProductivity(
    decision.employeeCount,
    decision.employeeType,
    decision.trainingBudget,
    decision.motivationBonus,
    company.employeeMorale,
  );

  const OE = calcOperationalEfficiency(
    decision.employeeCount,
    decision.openingHours,
    decision.daysOpen,
    decision.serviceLevel,
    product.operationalComplexity,
  );

  const brandEffect = 0.82 + company.brandStrength * 0.48; // 0.82–1.30
  const csEffect = 0.72 + company.customerSatisfaction * 0.56; // 0.72–1.28

  // ── 2. Event modifier ───────────────────────────────────────────────────────

  let REM = event?.generalDemandModifier ?? 1.0;
  if (event?.productModifiers?.[company.productId]) {
    REM *= event.productModifiers[company.productId]!;
  }
  if (event?.locationModifiers?.[company.locationId]) {
    REM *= event.locationModifiers[company.locationId]!;
  }

  // Partnership opportunity only activates with enough liquidity
  if (event?.id === 'partnership_opportunity' && decision.liquidityRetained < 15_000) {
    REM = 1.0;
  }

  // ── 3. Demand calculation ───────────────────────────────────────────────────

  const NOISE = gaussianSample(1.0, 0.08);
  const baseDemand = product.baseDemand * location.trafficMultiplier;
  const potentialDemand = baseDemand * PLF * PEE * marketingEffect * brandEffect * csEffect
    * Math.pow(EP, 0.28) * REM * NOISE;

  const maxOperational = decision.employeeCount
    * calcMaxUnitsPerEmployee(decision.employeeType, decision.openingHours, decision.daysOpen)
    * OE;

  const unitsSold = Math.max(0, Math.floor(Math.min(potentialDemand, decision.unitsProduced, maxOperational)));
  const stockShortfall = Math.max(0, Math.floor(potentialDemand) - decision.unitsProduced);
  const overstock = Math.max(0, decision.unitsProduced - unitsSold);

  // ── 4. Revenue ──────────────────────────────────────────────────────────────

  const revenue = unitsSold * decision.price;

  // ── 5. Operating costs ──────────────────────────────────────────────────────

  const matCostMult = (MATERIAL_COST_MULTIPLIERS[decision.materialQuality] ?? 1.0)
    * (SUPPLIER_COST_MULTIPLIERS[decision.supplierId] ?? 1.0);
  const eventCostMult = event?.costModifier ?? 1.0;
  const productionCost = decision.unitsProduced * product.unitCost * matCostMult * eventCostMult;

  const rentCost = location.rentPerRound;

  const employeeDailyCost = EMPLOYEE_DAILY_COST[decision.employeeType] ?? 3200;
  const employeeCost = decision.employeeCount * employeeDailyCost
    + decision.trainingBudget + decision.motivationBonus;

  const marketingCost = decision.marketingBudget;
  const researchCost = decision.marketResearchBudget;
  const localCost = decision.localImprovementBudget;
  const totalOperatingCosts = productionCost + rentCost + employeeCost
    + marketingCost + researchCost + localCost;

  // ── 6. Profitability ────────────────────────────────────────────────────────

  const grossProfit = revenue - productionCost;
  const netProfit = revenue - totalOperatingCosts;

  // ── 7. Investments ──────────────────────────────────────────────────────────

  const investmentReturns: InvestmentReturn[] = decision.investments.map(inv => {
    const def = INVESTMENTS[inv.investmentId];
    if (!def || inv.amount <= 0) return { investmentId: inv.investmentId, amountInvested: 0, netReturn: 0, returnPct: 0 };

    let eventInvMult = event?.investmentModifier ?? 1.0;
    // crypto_boom only supercharges risky assets
    if (event?.id === 'crypto_boom' && !['crypto', 'startup', 'stocks'].includes(inv.investmentId)) {
      eventInvMult = 1.0;
    }

    const baseReturnRate = def.expectedReturn * eventInvMult;
    const noise = gaussianSample(0, def.volatility);
    const rawReturnRate = baseReturnRate + noise;
    const clampedRate = clamp(rawReturnRate, def.maxLoss, def.maxGain);
    const netReturn = inv.amount * clampedRate;

    return {
      investmentId: inv.investmentId,
      amountInvested: inv.amount,
      netReturn,
      returnPct: clampedRate * 100,
    };
  });

  const totalInvestmentNetReturn = investmentReturns.reduce((s, r) => s + r.netReturn, 0);

  // ── 8. Capital update ───────────────────────────────────────────────────────

  const startingCapital = company.currentCapital;
  // Investments are not "spent" — principal returns + gains/losses
  const endingCapital = startingCapital - totalOperatingCosts + revenue + totalInvestmentNetReturn;

  const capitalChange = endingCapital - startingCapital;
  const capitalChangePct = (capitalChange / startingCapital) * 100;
  const cumulativeProfitability = ((endingCapital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

  const liquidityCrisis = endingCapital < startingCapital * LIQUIDITY_CRISIS_THRESHOLD;

  // ── 9. Update company state ─────────────────────────────────────────────────

  const brandStrengthNew = calcNewBrandStrength(
    company.brandStrength,
    decision.marketingBudget,
    decision.marketingQuality,
    unitsSold,
    decision.positioning,
  );

  const customerSatisfactionNew = calcNewCustomerSatisfaction(
    company.customerSatisfaction,
    decision.materialQuality,
    decision.serviceLevel,
    decision.price,
    product.minPrice,
    product.maxPrice,
    EP,
    stockShortfall > 0,
  );

  const employeeMoraleNew = calcNewMorale(
    company.employeeMorale,
    decision.employeeType,
    decision.trainingBudget,
    decision.motivationBonus,
  );

  // ── 10. Build partial result (no rank yet) ──────────────────────────────────

  const partialResult = {
    potentialDemand: Math.floor(potentialDemand),
    unitsSold,
    stockShortfall,
    overstock,
    revenue,
    productionCost,
    rentCost,
    employeeCost,
    marketingCost,
    researchCost,
    localCost,
    totalOperatingCosts,
    grossProfit,
    netProfit,
    investmentReturns,
    totalInvestmentNetReturn,
    startingCapital,
    endingCapital,
    capitalChange,
    capitalChangePct,
    cumulativeProfitability,
    productLocationFit: PLF,
    operationalEfficiency: OE,
    employeeProductivity: EP,
    marketingEffect,
    priceElasticityEffect: PEE,
    brandEffect,
    csEffect,
    randomEventModifier: REM,
    brandStrengthNew,
    customerSatisfactionNew,
    employeeMoraleNew,
    liquidityCrisis,
    missedOpportunities: stockShortfall > 5 ? ['stock_shortfall'] : [],
    eventId: event?.id,
  };

  const feedbackPoints: FeedbackPoint[] = generateFeedback(
    decision,
    partialResult,
    product as Product,
    location as Location, // eslint-disable-line
  );

  return { ...partialResult, feedbackPoints };
}
