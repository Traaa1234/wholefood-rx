import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { foods, foodNutrients, nutrients } from '../src/lib/schema';
import { usdaNumberToSlug } from '../src/lib/usda-mapping';
import { toSlug } from '../src/lib/slug';

type IdRow = {
  fdc_id: number;
  name: string;
  category: string;
  serving_size_g: number;
  serving_description: string;
};
type UsdaNutrient = { nutrient: { number: string; unitName: string }; amount?: number };
type UsdaFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients?: UsdaNutrient[];
};

const KEY = process.env.USDA_API_KEY!;
const BASE = 'https://api.nal.usda.gov/fdc/v1';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fetch a food with retry on transient failures (HTTP 429 / 5xx).
// Up to 3 attempts with 2s then 4s backoff. 4xx (other than 429) fails fast.
async function fetchFood(fdcId: number): Promise<UsdaFood> {
  const delays = [2000, 4000];
  let lastErr: Error = new Error(`USDA ${fdcId}: no attempt made`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/food/${fdcId}?api_key=${KEY}`);
      if (res.ok) return (await res.json()) as UsdaFood;
      const transient = res.status === 429 || res.status >= 500;
      lastErr = new Error(`USDA ${fdcId} failed: HTTP ${res.status}`);
      if (!transient || attempt === 2) throw lastErr;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      // Network errors are transient; non-transient HTTP errors already thrown above.
      if (attempt === 2) throw lastErr;
    }
    await sleep(delays[attempt]);
  }
  throw lastErr;
}

export async function seedFoodsUsda() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const ids: IdRow[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/data/usda-food-ids.json'), 'utf8')
  );

  // Build nutrient slug -> id lookup once
  const allNutrients = await db
    .select({ id: nutrients.id, slug: nutrients.slug })
    .from(nutrients);
  const slugToId = new Map(allNutrients.map((n) => [n.slug, n.id]));

  console.log(`Seeding ${ids.length} foods from USDA…`);

  let seeded = 0;
  let nutrientRows = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i++) {
    const row = ids[i];

    if ((i + 1) % 25 === 0) {
      console.log(`[${i + 1}/${ids.length}]`);
    }

    try {
      const usda = await fetchFood(row.fdc_id);
      const isFoundation = (usda.dataType ?? '').toLowerCase().includes('foundation');
      const ds = isFoundation ? 'usda_foundation' : 'usda_sr_legacy';

      const foodSlug = toSlug(row.name);

      // Upsert food
      const [food] = await db
        .insert(foods)
        .values({
          slug: foodSlug,
          name: row.name,
          category: row.category as typeof foods.$inferInsert.category,
          fdcId: row.fdc_id,
          servingSizeG: String(row.serving_size_g),
          servingDescription: row.serving_description,
        })
        .onConflictDoUpdate({
          target: foods.slug,
          set: {
            name: row.name,
            category: row.category as typeof foods.$inferInsert.category,
            fdcId: row.fdc_id,
            servingSizeG: String(row.serving_size_g),
            servingDescription: row.serving_description,
          },
        })
        .returning();

      // For each USDA-reported nutrient that maps to our slugs, write a food_nutrients row
      for (const fn of usda.foodNutrients ?? []) {
        const slug = usdaNumberToSlug(fn.nutrient.number);
        if (!slug) continue;
        const nutrientId = slugToId.get(slug);
        if (!nutrientId) continue;
        if (fn.amount === undefined || fn.amount === null) continue;

        // USDA amounts are per-100g
        const per100 = fn.amount;
        const perServing = per100 * (row.serving_size_g / 100);

        await db
          .insert(foodNutrients)
          .values({
            foodId: food.id,
            nutrientId,
            amountPer100g: String(per100),
            amountPerServing: String(perServing),
            dataSource: ds,
            citationUrl: `https://fdc.nal.usda.gov/food-details/${row.fdc_id}`,
          })
          .onConflictDoUpdate({
            target: [foodNutrients.foodId, foodNutrients.nutrientId, foodNutrients.dataSource],
            set: {
              amountPer100g: String(per100),
              amountPerServing: String(perServing),
              citationUrl: `https://fdc.nal.usda.gov/food-details/${row.fdc_id}`,
            },
          });
        nutrientRows++;
      }

      seeded++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${row.name}: ${msg}`);
      continue;
    }
  }

  console.log(
    `Seeded ${seeded} foods, ${nutrientRows} food_nutrient rows, ${failed} foods failed.`
  );
}

// Direct-run guard: resolve argv[1] to an absolute file:// URL so it matches
// import.meta.url regardless of OS (Windows passes a relative argv[1] under tsx,
// and differs in drive-letter casing / slash direction).
const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href.toLowerCase()
  : '';
if (import.meta.url.toLowerCase() === invokedPath) {
  seedFoodsUsda().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
