'use server';

import { getFood, getFoodNutrientProfile, listNutrients } from '@/lib/queries';
import type { PlateFood, PlateNutrientMeta } from '@/lib/plate';

export type PlateData = {
  foods: PlateFood[];
  nutrients: PlateNutrientMeta[];
  missingSlugs: string[];
};

export async function getPlateData(
  entries: { slug: string; servings: number }[],
): Promise<PlateData> {
  const catalog = await listNutrients();
  const nutrients: PlateNutrientMeta[] = catalog.map((n) => ({
    slug: n.slug,
    name: n.name,
    unit: n.unit,
    rda: n.rda_male !== null ? Number(n.rda_male) : n.rda_female !== null ? Number(n.rda_female) : null,
  }));

  const foods: PlateFood[] = [];
  const missingSlugs: string[] = [];

  for (const entry of entries) {
    const food = await getFood(entry.slug);
    if (!food) {
      missingSlugs.push(entry.slug);
      continue;
    }
    const profile = await getFoodNutrientProfile(food.id);
    foods.push({
      slug: food.slug,
      name: food.name,
      servings: entry.servings,
      nutrients: profile.map((p) => ({
        slug: p.nutrient_slug,
        amountPerServing: Number(p.amount_per_serving),
      })),
    });
  }

  return { foods, nutrients, missingSlugs };
}
