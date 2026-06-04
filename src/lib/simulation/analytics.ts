import type { Round, StudentAnalytics } from '@/types';
import { clamp } from '@/lib/utils';

export function computeStudentAnalytics(rounds: Round[], uid: string): StudentAnalytics {
  const done = rounds.filter(r => r.status === 'done' && r.decision && r.result);
  if (done.length === 0) {
    return emptyAnalytics(uid);
  }

  const n = done.length;

  // Risk score: avg fraction in high/very-high investments
  const riskScore = done.reduce((sum, r) => {
    const invTotal = r.decision!.investments.reduce((s, i) => s + i.amount, 0);
    const riskyTotal = r.decision!.investments
      .filter(i => ['stocks', 'crypto', 'startup'].includes(i.investmentId))
      .reduce((s, i) => s + i.amount, 0);
    const riskyFrac = invTotal > 0 ? riskyTotal / invTotal : 0;
    const aggressiveBiz = clamp(r.decision!.marketingBudget / 30_000, 0, 1);
    return sum + (riskyFrac * 0.6 + aggressiveBiz * 0.4);
  }, 0) / n;

  // Diversification: how many distinct allocation buckets used
  const diversificationScore = done.reduce((sum, r) => {
    const d = r.decision!;
    const buckets = [
      d.unitsProduced > 0 ? 1 : 0,
      d.marketingBudget > 0 ? 1 : 0,
      d.investments.length > 0 ? 1 : 0,
      d.localImprovementBudget > 0 ? 1 : 0,
      d.trainingBudget + d.motivationBonus > 0 ? 1 : 0,
      d.liquidityRetained > 0.1 * r.startingCapital ? 1 : 0,
    ] as number[];
    return sum + clamp(buckets.reduce((a, b) => a + b, 0) / 5, 0, 1);
  }, 0) / n;

  // Market research usage
  const marketResearchUsage = done.filter(r => r.decision!.marketResearchBudget > 0).length / n;

  // Capital allocation quality: revenue / total allocated (efficiency ratio)
  const capitalAllocationQuality = done.reduce((sum, r) => {
    const allocated = r.decision!.totalAllocated;
    if (allocated <= 0) return sum;
    const revenue = r.result!.revenue;
    const ratio = clamp(revenue / allocated, 0, 2);
    return sum + ratio / 2; // normalize to 0-1
  }, 0) / n;

  // Short/long-term balance: marketing (long) vs heavy production now (short)
  const shortLongTermBalance = done.reduce((sum, r) => {
    const d = r.decision!;
    const total = d.totalAllocated || 1;
    const longTermFrac = (d.marketingBudget + d.trainingBudget + d.localImprovementBudget) / total;
    return sum + clamp(longTermFrac * 2, 0, 1); // balanced ~= 50% long-term
  }, 0) / n;

  // Product-location coherence: average PLF
  const productLocationCoherence = done.reduce((sum, r) =>
    sum + (r.result?.productLocationFit ?? 0.8), 0) / n;

  // Adaptability: did they change strategy after a bad round?
  let adaptChanges = 0;
  for (let i = 1; i < done.length; i++) {
    const prev = done[i - 1];
    const curr = done[i];
    if ((prev.result?.capitalChangePct ?? 0) < -5) {
      // Check if they meaningfully changed marketing or production
      const mktChange = Math.abs((curr.decision!.marketingBudget - prev.decision!.marketingBudget) / (prev.decision!.marketingBudget || 1));
      if (mktChange > 0.25) adaptChanges++;
    }
  }
  const adaptabilityScore = clamp(adaptChanges / Math.max(1, done.length - 1), 0, 1);

  // Liquidity management: avg fraction kept as liquid
  const liquidityManagement = done.reduce((sum, r) =>
    sum + clamp(r.decision!.liquidityRetained / r.startingCapital, 0, 1), 0) / n;

  // Dominant strategy detection
  const dominantStrategy = detectDominantStrategy(riskScore, marketResearchUsage, diversificationScore, shortLongTermBalance);
  const strengthAreas = detectStrengths(riskScore, diversificationScore, marketResearchUsage, productLocationCoherence, liquidityManagement);
  const improvementAreas = detectImprovements(riskScore, diversificationScore, marketResearchUsage, productLocationCoherence, liquidityManagement, capitalAllocationQuality);

  const analytics: Omit<StudentAnalytics, 'autoReportEs' | 'autoReportEn'> = {
    uid,
    riskScore,
    diversificationScore,
    marketResearchUsage,
    capitalAllocationQuality,
    shortLongTermBalance,
    productLocationCoherence,
    adaptabilityScore,
    liquidityManagement,
    dominantStrategy,
    strengthAreas,
    improvementAreas,
  };

  return {
    ...analytics,
    autoReportEs: buildReport(analytics, 'es'),
    autoReportEn: buildReport(analytics, 'en'),
  };
}

function detectDominantStrategy(risk: number, research: number, diversification: number, longTerm: number): string {
  if (risk > 0.7) return 'aggressive';
  if (risk < 0.25 && diversification > 0.7) return 'conservative_diversified';
  if (risk < 0.2) return 'conservative';
  if (research > 0.7) return 'research_driven';
  if (diversification > 0.75) return 'diversified';
  if (longTerm > 0.65) return 'brand_builder';
  return 'balanced';
}

function detectStrengths(risk: number, diversification: number, research: number, plf: number, liquidity: number): string[] {
  const s: string[] = [];
  if (plf > 1.2) s.push('product_location_fit');
  if (diversification > 0.7) s.push('diversification');
  if (research > 0.6) s.push('market_research');
  if (liquidity > 0.2) s.push('liquidity_management');
  if (risk > 0.6) s.push('growth_mindset');
  return s.slice(0, 3);
}

function detectImprovements(risk: number, div: number, research: number, plf: number, liquidity: number, alloc: number): string[] {
  const s: string[] = [];
  if (plf < 1.0) s.push('location_strategy');
  if (div < 0.4) s.push('diversification');
  if (research < 0.3) s.push('market_research');
  if (liquidity < 0.1) s.push('liquidity_reserve');
  if (risk > 0.75) s.push('risk_management');
  if (alloc < 0.4) s.push('capital_efficiency');
  return s.slice(0, 3);
}

function buildReport(a: Omit<StudentAnalytics, 'autoReportEs' | 'autoReportEn'>, lang: 'es' | 'en'): string {
  const t = lang === 'es' ? ES_TEMPLATES : EN_TEMPLATES;
  const risk = a.riskScore > 0.65 ? t.high_risk : a.riskScore < 0.3 ? t.low_risk : t.mid_risk;
  const research = a.marketResearchUsage > 0.6 ? t.uses_research : t.skips_research;
  const fit = a.productLocationCoherence > 1.15 ? t.good_fit : t.poor_fit;
  const strengths = a.strengthAreas.map(s => t[s as keyof typeof t] ?? s).join(', ');
  const improvements = a.improvementAreas.map(s => t[`imp_${s}` as keyof typeof t] ?? s).join(', ');
  return `${risk} ${research} ${fit} ${t.strengths}: ${strengths || '-'}. ${t.improvements}: ${improvements || '-'}.`;
}

const ES_TEMPLATES = {
  high_risk: 'Este estudiante mostró una estrategia agresiva, con alta exposición a inversiones riesgosas y decisiones de alto impacto.',
  low_risk: 'Este estudiante adoptó un enfoque conservador, priorizando la seguridad sobre el crecimiento.',
  mid_risk: 'Este estudiante mantuvo un perfil de riesgo moderado, balanceando crecimiento y estabilidad.',
  uses_research: 'Hizo uso frecuente de la investigación de mercado, lo que indica capacidad de decisión informada.',
  skips_research: 'Tomó decisiones sin recurrir a investigación de mercado en la mayoría de las rondas.',
  good_fit: 'Demostró buena coherencia entre producto y ubicación.',
  poor_fit: 'La combinación producto-ubicación no fue óptima, afectando la demanda.',
  strengths: 'Fortalezas detectadas',
  improvements: 'Áreas de mejora',
  product_location_fit: 'coherencia producto-ubicación',
  diversification: 'diversificación de capital',
  market_research: 'uso de investigación',
  liquidity_management: 'gestión de liquidez',
  growth_mindset: 'mentalidad de crecimiento',
  imp_location_strategy: 'estrategia de ubicación',
  imp_diversification: 'diversificación',
  imp_market_research: 'investigación de mercado',
  imp_liquidity_reserve: 'reserva de liquidez',
  imp_risk_management: 'gestión del riesgo',
  imp_capital_efficiency: 'eficiencia del capital',
};

const EN_TEMPLATES = {
  high_risk: 'This student showed an aggressive strategy, with high exposure to risky investments and high-impact decisions.',
  low_risk: 'This student took a conservative approach, prioritizing safety over growth.',
  mid_risk: 'This student maintained a moderate risk profile, balancing growth and stability.',
  uses_research: 'Used market research frequently, indicating data-driven decision making.',
  skips_research: 'Made decisions without market research in most rounds.',
  good_fit: 'Showed good product-location coherence.',
  poor_fit: 'Product-location combination was suboptimal, affecting demand.',
  strengths: 'Detected strengths',
  improvements: 'Areas for improvement',
  product_location_fit: 'product-location fit',
  diversification: 'capital diversification',
  market_research: 'research usage',
  liquidity_management: 'liquidity management',
  growth_mindset: 'growth mindset',
  imp_location_strategy: 'location strategy',
  imp_diversification: 'diversification',
  imp_market_research: 'market research',
  imp_liquidity_reserve: 'liquidity reserve',
  imp_risk_management: 'risk management',
  imp_capital_efficiency: 'capital efficiency',
};

function emptyAnalytics(uid: string): StudentAnalytics {
  return {
    uid,
    riskScore: 0,
    diversificationScore: 0,
    marketResearchUsage: 0,
    capitalAllocationQuality: 0,
    shortLongTermBalance: 0,
    productLocationCoherence: 0,
    adaptabilityScore: 0,
    liquidityManagement: 0,
    dominantStrategy: 'unknown',
    strengthAreas: [],
    improvementAreas: [],
    autoReportEs: 'Sin suficientes rondas para generar un reporte.',
    autoReportEn: 'Not enough rounds to generate a report.',
  };
}
