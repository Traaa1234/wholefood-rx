import { sql } from 'drizzle-orm';
import { db } from './db';

export type FoodRankRow = {
  food_id: number;
  food_slug: string;
  food_name: string;
  food_category: string;
  serving_size_g: string;
  serving_description: string;
  amount_per_100g: string;
  amount_per_serving: string;
  data_source: 'usda_foundation' | 'usda_sr_legacy' | 'curated';
  citation_url: string | null;
};

export type NutrientRow = {
  id: number;
  slug: string;
  name: string;
  category: string;
  rda_male: string | null;
  rda_female: string | null;
  unit: string;
  function_summary: string | null;
  deficiency_symptoms: string | null;
  toxicity_threshold: string | null;
  cofactors: string[] | null;
  absorption_notes: string | null;
};

export type NutrientListItem = {
  slug: string;
  name: string;
  category: string;
  unit: string;
};

// Lower number = higher precedence: prefer USDA Foundation over SR Legacy over curated.
const PRECEDENCE_CASE = sql`
  case fn.data_source
    when 'usda_foundation' then 1
    when 'usda_sr_legacy' then 2
    when 'curated' then 3
  end
`;

/**
 * Top-N foods for a nutrient, ranked by density.
 *
 * The `best` CTE uses `DISTINCT ON (food_id, nutrient_id)` ordered by the
 * data_source precedence so that, when a food has rows from multiple sources,
 * only the highest-precedence row survives — the same food never appears twice.
 * The outer query then ranks the deduped rows by the chosen basis.
 */
export async function rankFoodsByNutrient(
  nutrientSlug: string,
  basis: 'per_100g' | 'per_serving',
  categoryFilter: string | null,
  limit = 25,
): Promise<FoodRankRow[]> {
  const orderCol = basis === 'per_100g' ? sql`b.amount_per_100g` : sql`b.amount_per_serving`;

  const result = await db.execute<FoodRankRow>(sql`
    with best as (
      select distinct on (fn.food_id, fn.nutrient_id)
        fn.food_id,
        fn.nutrient_id,
        fn.amount_per_100g,
        fn.amount_per_serving,
        fn.data_source,
        fn.citation_url
      from food_nutrients fn
      join nutrients n on n.id = fn.nutrient_id
      where n.slug = ${nutrientSlug}
      order by fn.food_id, fn.nutrient_id, ${PRECEDENCE_CASE}
    )
    select
      f.id as food_id,
      f.slug as food_slug,
      f.name as food_name,
      f.category::text as food_category,
      f.serving_size_g,
      f.serving_description,
      b.amount_per_100g,
      b.amount_per_serving,
      b.data_source::text as data_source,
      b.citation_url
    from best b
    join foods f on f.id = b.food_id
    ${categoryFilter ? sql`where f.category = ${categoryFilter}::food_category` : sql``}
    order by ${orderCol}::numeric desc
    limit ${limit}
  `);

  // drizzle-orm neon-http `db.execute` returns a NeonHttpQueryResult: the rows
  // live under `.rows`, not on the result itself.
  return result.rows as FoodRankRow[];
}

/** One nutrient row by slug, or null if not found. */
export async function getNutrient(slug: string): Promise<NutrientRow | null> {
  const result = await db.execute<NutrientRow>(sql`
    select id, slug, name, category::text as category, rda_male, rda_female, unit,
           function_summary, deficiency_symptoms, toxicity_threshold, cofactors, absorption_notes
    from nutrients
    where slug = ${slug}
    limit 1
  `);
  return (result.rows[0] as NutrientRow | undefined) ?? null;
}

/** All nutrients (slug, name, category, unit) for the catalog page. */
export async function listNutrients(): Promise<NutrientListItem[]> {
  const result = await db.execute<NutrientListItem>(sql`
    select slug, name, category::text as category, unit
    from nutrients
    order by category, name
  `);
  return result.rows as NutrientListItem[];
}

export type FoodListRow = {
  slug: string;
  name: string;
  category: string;
};

export async function listFoods(): Promise<FoodListRow[]> {
  const result = await db.execute(sql`
    select slug, name, category::text as category
    from foods
    order by category, name
  `);
  return result.rows as FoodListRow[];
}

export type FoodRow = {
  id: number;
  slug: string;
  name: string;
  category: string;
  fdc_id: number | null;
  serving_size_g: string;
  serving_description: string;
  organic_available: boolean | null;
  seasonality: string | null;
  glycemic_index: number | null;
  notes: string | null;
};

export async function getFood(slug: string): Promise<FoodRow | null> {
  const result = await db.execute(sql`
    select id, slug, name, category::text as category, fdc_id,
           serving_size_g, serving_description, organic_available,
           seasonality, glycemic_index, notes
    from foods
    where slug = ${slug}
    limit 1
  `);
  return (result.rows[0] as FoodRow) ?? null;
}

export type FoodNutrientRow = {
  nutrient_slug: string;
  nutrient_name: string;
  nutrient_category: string;
  unit: string;
  rda_male: string | null;
  rda_female: string | null;
  amount_per_100g: string;
  amount_per_serving: string;
  data_source: string;
  citation_url: string | null;
};

export async function getFoodNutrientProfile(foodId: number): Promise<FoodNutrientRow[]> {
  const result = await db.execute(sql`
    with best as (
      select distinct on (fn.food_id, fn.nutrient_id)
        fn.nutrient_id,
        fn.amount_per_100g,
        fn.amount_per_serving,
        fn.data_source,
        fn.citation_url
      from food_nutrients fn
      where fn.food_id = ${foodId}
      order by fn.food_id, fn.nutrient_id, ${PRECEDENCE_CASE}
    )
    select
      n.slug as nutrient_slug,
      n.name as nutrient_name,
      n.category::text as nutrient_category,
      n.unit,
      n.rda_male,
      n.rda_female,
      b.amount_per_100g,
      b.amount_per_serving,
      b.data_source::text as data_source,
      b.citation_url
    from best b
    join nutrients n on n.id = b.nutrient_id
    order by n.category, n.name
  `);
  return result.rows as FoodNutrientRow[];
}
