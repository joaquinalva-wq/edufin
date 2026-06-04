import type { Company, Game, RandomEvent, MarketResearchResult, MarketResearchInsight, MarketResearchLevel } from '@/types';
import { PRODUCTS, LOCATIONS, MARKET_RESEARCH_COSTS, MARKET_RESEARCH_INSIGHTS } from '@/constants';
import { getProductLocationFit } from '@/constants/matrix';

export function generateMarketResearchResult(
  level: MarketResearchLevel,
  company: Company,
  _game: Game,
  nextEvent: RandomEvent | null,
  currentRound: number,
): MarketResearchResult {
  const cost = MARKET_RESEARCH_COSTS[level];
  const insightCount = MARKET_RESEARCH_INSIGHTS[level];
  const product = PRODUCTS[company.productId];
  const location = LOCATIONS[company.locationId];
  const plf = getProductLocationFit(company.productId, company.locationId);

  const allInsights: MarketResearchInsight[] = [];

  // Insight 1: demand forecast (always included)
  const demandBase = product.baseDemand * location.trafficMultiplier * plf;
  const demandLow = Math.floor(demandBase * 0.75);
  const demandHigh = Math.floor(demandBase * 1.35);
  allInsights.push({
    type: 'demand',
    messageKey: 'research.demand_forecast',
    params: { low: demandLow, high: demandHigh, product: product.nameKey },
    confidence: 0.70,
  });

  // Insight 2: competition level
  allInsights.push({
    type: 'competition',
    messageKey: location.competitionLevel > 0.6 ? 'research.high_competition' : 'research.low_competition',
    params: { location: location.nameKey, pct: Math.round(location.competitionLevel * 100) },
    confidence: 0.85,
  });

  // Insight 3: price sensitivity hint
  allInsights.push({
    type: 'price',
    messageKey: product.priceSensitivity > 0.8 ? 'research.price_sensitive' : 'research.price_tolerant',
    params: { product: product.nameKey },
    confidence: 0.80,
  });

  // Insight 4: trend/seasonal hint
  const roundTrend = currentRound <= 3 ? 'research.early_game_tip'
    : currentRound <= 7 ? 'research.mid_game_tip'
    : 'research.late_game_tip';
  allInsights.push({
    type: 'trend',
    messageKey: roundTrend,
    params: { round: currentRound },
    confidence: 0.65,
  });

  // Insight 5: event preview (only for predictable events, with partial info)
  if (nextEvent?.predictable) {
    const confidence = level === 'premium' ? 0.72 : 0.55;
    allInsights.push({
      type: 'event',
      messageKey: 'research.event_hint',
      params: { eventType: nextEvent.type },
      confidence,
    });
  } else {
    allInsights.push({
      type: 'event',
      messageKey: 'research.no_clear_event',
      confidence: 0.5,
    });
  }

  return {
    level,
    cost,
    insights: allInsights.slice(0, insightCount),
  };
}
