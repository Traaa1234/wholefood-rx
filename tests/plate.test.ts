import { describe, it, expect } from 'vitest';
import { computePlateTotals, type PlateFood, type PlateNutrientMeta } from '@/lib/plate';

const NUTRIENTS: PlateNutrientMeta[] = [
  { slug: 'iron', name: 'Iron', unit: 'mg', rda: 18 },
  { slug: 'vitamin-c', name: 'Vitamin C', unit: 'mg', rda: 90 },
  { slug: 'selenium', name: 'Selenium', unit: 'mcg', rda: null },
];

const FOODS: PlateFood[] = [
  {
    slug: 'spinach', name: 'Spinach', servings: 2,
    nutrients: [
      { slug: 'iron', amountPerServing: 1.5 },
      { slug: 'vitamin-c', amountPerServing: 8 },
    ],
  },
  {
    slug: 'orange', name: 'Orange', servings: 1,
    nutrients: [
      { slug: 'vitamin-c', amountPerServing: 70 },
    ],
  },
];

describe('computePlateTotals', () => {
  it('sums amounts across foods, multiplying by servings', () => {
    const totals = computePlateTotals(FOODS, NUTRIENTS);
    const iron = totals.find((t) => t.slug === 'iron')!;
    expect(iron.amount).toBe(3); // 1.5 * 2 servings
    const vitC = totals.find((t) => t.slug === 'vitamin-c')!;
    expect(vitC.amount).toBe(86); // 8*2 + 70*1
  });

  it('computes %RDA when an RDA exists', () => {
    const totals = computePlateTotals(FOODS, NUTRIENTS);
    const vitC = totals.find((t) => t.slug === 'vitamin-c')!;
    expect(vitC.pctRda).toBe(96); // round(86/90*100)
  });

  it('returns null pctRda when the nutrient has no RDA', () => {
    const totals = computePlateTotals(FOODS, NUTRIENTS);
    const se = totals.find((t) => t.slug === 'selenium')!;
    expect(se.amount).toBe(0);
    expect(se.pctRda).toBeNull();
  });

  it('flags a nutrient as a gap when pctRda is below 25', () => {
    const totals = computePlateTotals(FOODS, NUTRIENTS);
    const iron = totals.find((t) => t.slug === 'iron')!;
    expect(iron.pctRda).toBe(17); // round(3/18*100)
    expect(iron.isGap).toBe(true);
    const vitC = totals.find((t) => t.slug === 'vitamin-c')!;
    expect(vitC.isGap).toBe(false); // 96% is not a gap
  });

  it('includes every catalog nutrient even if no food provides it', () => {
    const totals = computePlateTotals(FOODS, NUTRIENTS);
    expect(totals).toHaveLength(3);
  });

  it('returns all-zero totals for an empty plate', () => {
    const totals = computePlateTotals([], NUTRIENTS);
    expect(totals.every((t) => t.amount === 0)).toBe(true);
  });
});
