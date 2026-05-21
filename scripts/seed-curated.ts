import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { foods, foodNutrients, nutrients } from '../src/lib/schema';

type CuratedFood = {
  slug: string;
  name: string;
  category: typeof foods.$inferInsert.category;
  serving_size_g: number;
  serving_description: string;
  notes?: string;
};
type CuratedFN = {
  food_slug: string;
  nutrient_slug: string;
  amount_per_100g: number;
  preparation_notes?: string;
  citation_url: string;
};

export async function seedCurated() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const cf: CuratedFood[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/data/curated-foods.json'), 'utf8')
  );
  const cfn: CuratedFN[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/data/curated-food-nutrients.json'), 'utf8')
  );

  // Upsert curated foods. These have no fdcId — they are supplements / adaptogens
  // / phytonutrient-rich foods not in the USDA FoodData Central catalog.
  console.log(`Seeding ${cf.length} curated foods…`);
  for (const f of cf) {
    await db
      .insert(foods)
      .values({
        slug: f.slug,
        name: f.name,
        category: f.category,
        servingSizeG: String(f.serving_size_g),
        servingDescription: f.serving_description,
        notes: f.notes ?? null,
      })
      .onConflictDoUpdate({
        target: foods.slug,
        set: {
          name: f.name,
          category: f.category,
          servingSizeG: String(f.serving_size_g),
          servingDescription: f.serving_description,
          notes: f.notes ?? null,
        },
      });
  }

  // Build slug -> id lookups and a food.slug -> serving_size_g map.
  const foodRows = await db.select({ id: foods.id, slug: foods.slug }).from(foods);
  const nutrientRows = await db
    .select({ id: nutrients.id, slug: nutrients.slug })
    .from(nutrients);
  const fIdx = new Map(foodRows.map((r) => [r.slug, r.id]));
  const nIdx = new Map(nutrientRows.map((r) => [r.slug, r.id]));
  const servingByFood = new Map(cf.map((f) => [f.slug, f.serving_size_g]));

  console.log(`Seeding ${cfn.length} curated food_nutrients rows…`);
  for (const r of cfn) {
    const fid = fIdx.get(r.food_slug);
    const nid = nIdx.get(r.nutrient_slug);
    const serv = servingByFood.get(r.food_slug);
    if (!fid || !nid || serv === undefined) {
      console.warn(`Skipping ${r.food_slug} / ${r.nutrient_slug} — missing reference`);
      continue;
    }
    // Curated amounts are per-100g; scale to the curated serving size.
    const perServing = r.amount_per_100g * (serv / 100);
    await db
      .insert(foodNutrients)
      .values({
        foodId: fid,
        nutrientId: nid,
        amountPer100g: String(r.amount_per_100g),
        amountPerServing: String(perServing),
        dataSource: 'curated',
        preparationNotes: r.preparation_notes ?? null,
        citationUrl: r.citation_url,
      })
      .onConflictDoUpdate({
        target: [foodNutrients.foodId, foodNutrients.nutrientId, foodNutrients.dataSource],
        set: {
          amountPer100g: String(r.amount_per_100g),
          amountPerServing: String(perServing),
          preparationNotes: r.preparation_notes ?? null,
          citationUrl: r.citation_url,
        },
      });
  }
  console.log('Curated data seeded.');
}

// Direct-run guard: resolve argv[1] to an absolute file:// URL so it matches
// import.meta.url regardless of OS (Windows passes a relative argv[1] under tsx,
// and differs in drive-letter casing / slash direction).
const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href.toLowerCase()
  : '';
if (import.meta.url.toLowerCase() === invokedPath) {
  seedCurated().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
