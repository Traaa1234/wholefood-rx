import { pctRda } from './rda';

export type PlateFood = {
  slug: string;
  name: string;
  servings: number;
  nutrients: { slug: string; amountPerServing: number }[];
};

export type PlateNutrientMeta = {
  slug: string;
  name: string;
  unit: string;
  rda: number | null;
};

export type PlateTotal = {
  slug: string;
  name: string;
  unit: string;
  amount: number;
  pctRda: number | null;
  isGap: boolean;
};

/** Below this %RDA, a nutrient is flagged as a plate gap. */
export const GAP_THRESHOLD_PCT = 25;

export function computePlateTotals(
  foods: PlateFood[],
  nutrients: PlateNutrientMeta[],
): PlateTotal[] {
  const summed = new Map<string, number>();
  for (const food of foods) {
    for (const n of food.nutrients) {
      summed.set(n.slug, (summed.get(n.slug) ?? 0) + n.amountPerServing * food.servings);
    }
  }

  return nutrients.map((meta) => {
    const amount = summed.get(meta.slug) ?? 0;
    const pct = pctRda(amount, meta.rda);
    return {
      slug: meta.slug,
      name: meta.name,
      unit: meta.unit,
      amount,
      pctRda: pct,
      isGap: pct !== null && pct < GAP_THRESHOLD_PCT,
    };
  });
}
