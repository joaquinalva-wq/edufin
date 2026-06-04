import type { ProductId, LocationId } from '@/types';

/**
 * Product × Location compatibility matrix.
 *
 * Values represent demand multipliers (0.5–1.4).
 *
 * Design intent: no single combination is obviously dominant.
 * Each product has 2–3 "good" locations (1.2–1.4) with non-obvious peaks,
 * counterintuitive second-bests, and meaningful penalties for bad fits.
 *
 * Hidden insights students discover through market research or trial:
 * - Bikes:       BEST = residential (daily commuters), not sports (weekend riders)
 * - Skateboards: BEST = university (youth culture hub), not school or sports
 * - E-Scooters:  BEST = university/tourist (tech commuters + novelty tourism)
 * - Backpacks:   BEST = university (slightly > school — college students buy more)
 * - Bottles:     BEST = mall (impulse buy + high traffic), not sports (assumed best)
 * - Headphones:  BEST = university (study + workout), sports has specialized competitors
 */
export const PRODUCT_LOCATION_MATRIX: Record<ProductId, Record<LocationId, number>> = {
  bikes: {
    school:      0.80,  // students don't buy bikes at school
    university:  1.10,  // decent — some commuters
    mall:        1.00,  // impulse exists but low fit
    residential: 1.40,  // ★ BEST: daily commuters need bikes near home
    tourist:     1.30,  // tourists rent/buy urban bikes (strong)
    sports:      1.20,  // good but weekend-only, not daily need
  },
  skateboards: {
    school:      1.10,  // decent — teen market
    university:  1.40,  // ★ BEST: culture, lifestyle, lots of buyers
    mall:        0.90,  // low fit — shoppers aren't skaters
    residential: 0.70,  // weak — not neighborhood product
    tourist:     1.25,  // tourists love novelty skate culture
    sports:      1.20,  // good but less cultural affinity
  },
  escooters: {
    school:      0.70,  // too expensive for teens, low need
    university:  1.40,  // ★ BEST: tech-savvy commuters, shared culture
    mall:        1.10,  // moderate — some lifestyle shoppers
    residential: 0.80,  // moderate — some last-mile need
    tourist:     1.35,  // strong — novelty + tourism circuits
    sports:      1.00,  // neutral — athletes prefer other gear
  },
  backpacks: {
    school:      1.30,  // very good — obvious market
    university:  1.40,  // ★ BEST: college students buy quality, have own money
    mall:        1.10,  // decent — gift purchases, back-to-school
    residential: 0.70,  // weak — limited target audience
    tourist:     0.60,  // poor — tourists already have luggage
    sports:      0.55,  // poor — athletes use specialized gear bags
  },
  bottles: {
    school:      1.10,  // good — students need hydration
    university:  1.30,  // great — campus lifestyle, sustainability trend
    mall:        1.40,  // ★ BEST: impulse buys, high traffic, gifting
    residential: 0.80,  // moderate — bought online more than local
    tourist:     1.15,  // decent — tourists buy souvenirs/thermal bottles
    sports:      1.25,  // good, but expected choice — lots of competitors
  },
  headphones: {
    school:      0.90,  // moderate — budget restrictions
    university:  1.40,  // ★ BEST: study culture + workout, disposable income
    mall:        1.30,  // strong — electronics impulse purchases
    residential: 0.70,  // weak — people buy online at home
    tourist:     1.00,  // neutral — not a travel-priority item
    sports:      1.15,  // good but sports stores also sell audio gear
  },
};

export function getProductLocationFit(productId: ProductId, locationId: LocationId): number {
  return PRODUCT_LOCATION_MATRIX[productId]?.[locationId] ?? 1.0;
}

export function getBestLocationForProduct(productId: ProductId): LocationId {
  const row = PRODUCT_LOCATION_MATRIX[productId];
  let best: LocationId = 'school';
  let bestVal = row['school'] ?? 0;
  for (const [loc, val] of Object.entries(row)) {
    if (val > bestVal) { bestVal = val; best = loc as LocationId; }
  }
  return best;
}
