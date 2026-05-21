import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * One-off generator for src/data/usda-food-ids.json — the curated list of
 * whole-food FDC IDs that the Task 12 seed script will pull nutrient data for.
 *
 * Reads src/data/usda-foundation-list.json (produced by list-foundation-foods.ts),
 * maps each USDA foodCategory to our food_category enum, refines by description,
 * assigns serving sizes, cleans up names, dedupes, and writes the result.
 *
 * If Foundation Foods alone yields < 250 entries, supplements via the USDA
 * search API for a hardcoded list of common whole foods.
 */

const FOOD_CATEGORIES = [
  'fruit',
  'vegetable',
  'leafy_green',
  'nut',
  'seed',
  'legume',
  'whole_grain',
  'herb_adaptogen',
  'mushroom',
  'animal_protein',
  'seafood',
  'dairy',
] as const;
type FoodCategory = (typeof FOOD_CATEGORIES)[number];

type FoundationItem = {
  fdcId: number;
  description: string;
  foodCategory: string;
};

type FoodIdEntry = {
  fdc_id: number;
  name: string;
  category: FoodCategory;
  serving_size_g: number;
  serving_description: string;
};

const API_KEY = process.env.USDA_API_KEY;
const TARGET = 250;
// A category with fewer than this many entries is "thin" — trigger Step 3
// supplementation to give it real coverage even when the total clears TARGET.
const MIN_PER_CATEGORY = 6;

// --- USDA foodCategory string -> our enum --------------------------------
const CATEGORY_MAP: Record<string, FoodCategory> = {
  'Fruits and Fruit Juices': 'fruit',
  'Vegetables and Vegetable Products': 'vegetable',
  'Nuts and Seeds': 'nut', // refined to seed/nut below by description
  'Nut and Seed Products': 'nut',
  'Legumes and Legume Products': 'legume',
  'Cereal Grains and Pasta': 'whole_grain',
  'Breakfast Cereals': 'whole_grain',
  'Beef Products': 'animal_protein',
  'Poultry Products': 'animal_protein',
  'Pork Products': 'animal_protein',
  'Lamb, Veal, and Game Products': 'animal_protein',
  'Sausages and Luncheon Meats': 'animal_protein',
  'Finfish and Shellfish Products': 'seafood',
  'Dairy and Egg Products': 'dairy',
  'Spices and Herbs': 'herb_adaptogen',
  Mushrooms: 'mushroom',
};

// Categories that, if encountered, are intentionally skipped (no clean mapping).
// Anything not present in CATEGORY_MAP is dropped automatically.

// --- serving size defaults by category -----------------------------------
const SERVING_DEFAULTS: Record<
  FoodCategory,
  { serving_size_g: number; serving_description: string }
> = {
  leafy_green: { serving_size_g: 30, serving_description: '1 cup raw' },
  vegetable: { serving_size_g: 90, serving_description: '1 cup chopped' },
  fruit: { serving_size_g: 120, serving_description: '1 medium / 1 cup' },
  nut: { serving_size_g: 28, serving_description: '1 oz' },
  seed: { serving_size_g: 15, serving_description: '1 tbsp' },
  legume: { serving_size_g: 100, serving_description: '1/2 cup cooked' },
  whole_grain: { serving_size_g: 50, serving_description: '1/4 cup dry' },
  mushroom: { serving_size_g: 70, serving_description: '1 cup' },
  herb_adaptogen: { serving_size_g: 5, serving_description: '1 tsp' },
  animal_protein: { serving_size_g: 85, serving_description: '3 oz' },
  seafood: { serving_size_g: 85, serving_description: '3 oz' },
  dairy: { serving_size_g: 100, serving_description: '100 g' },
};

// --- description-based refinement keywords -------------------------------
const LEAFY_GREEN_WORDS = [
  'spinach',
  'kale',
  'lettuce',
  'chard',
  'arugula',
  'collard',
  'watercress',
  'romaine',
  'endive',
  'escarole',
  'mustard greens',
  'turnip greens',
  'beet greens',
  'bok choy',
  'mesclun',
];
const SEED_WORDS = [
  'chia',
  'flax',
  'flaxseed',
  'pumpkin seed',
  'sunflower seed',
  'sesame',
  'hemp seed',
  'hemp',
  'poppy seed',
];

// --- name cleanup ---------------------------------------------------------
const SMALL_WORDS = new Set([
  'and',
  'or',
  'the',
  'of',
  'with',
  'in',
  'a',
  'an',
  'to',
]);

/** Title-cases a USDA description; trims trailing commas/whitespace. */
function cleanName(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ').replace(/,\s*$/, '');
  // Title-case word-by-word, keeping small words lowercase mid-string.
  const words = s.split(' ');
  s = words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i !== 0 && SMALL_WORDS.has(lower)) return lower;
      // Preserve a leading non-letter (e.g. parens) then capitalise.
      const m = lower.match(/^([^a-z]*)([a-z].*)?$/);
      if (!m || !m[2]) return w;
      return m[1] + m[2].charAt(0).toUpperCase() + m[2].slice(1);
    })
    .join(' ');
  return s;
}

// Pure condiments / refined items USDA may file under a whole-food category
// (e.g. table salt sits under "Spices and Herbs") — not whole foods, drop them.
const NON_WHOLE_FOOD = [
  /^salt[, ]/i,
  /^sugar[s]?[, ]/i,
  /^sugars?,/i,
  /\bsyrup\b/i,
];

/** Maps one foundation item to a food-id entry, or null if it should drop. */
function mapItem(item: FoundationItem): FoodIdEntry | null {
  const desc = item.description ?? '';
  const lower = desc.toLowerCase();

  if (NON_WHOLE_FOOD.some((re) => re.test(desc))) return null;

  let category = CATEGORY_MAP[item.foodCategory.trim()];
  if (!category) return null;

  // Refine: leafy greens filed under vegetables.
  if (
    (category === 'vegetable' || category === 'fruit') &&
    LEAFY_GREEN_WORDS.some((w) => lower.includes(w))
  ) {
    category = 'leafy_green';
  }

  // Refine: mushrooms by description.
  if (lower.includes('mushroom')) {
    category = 'mushroom';
  }

  // Refine: Nuts and Seeds -> seed vs nut by description.
  if (category === 'nut' && SEED_WORDS.some((w) => lower.includes(w))) {
    category = 'seed';
  }

  const serving = SERVING_DEFAULTS[category];
  return {
    fdc_id: item.fdcId,
    name: cleanName(desc),
    category,
    serving_size_g: serving.serving_size_g,
    serving_description: serving.serving_description,
  };
}

// --- Step 3: supplemental whole foods via the USDA search API ------------
// Each term -> the enum category to assign to the top SR Legacy hit.
const SUPPLEMENT_TERMS: { query: string; category: FoodCategory }[] = [
  { query: 'salmon atlantic wild raw', category: 'seafood' },
  { query: 'sardines canned', category: 'seafood' },
  { query: 'mackerel atlantic raw', category: 'seafood' },
  { query: 'oysters raw', category: 'seafood' },
  { query: 'mussels raw', category: 'seafood' },
  { query: 'tuna yellowfin raw', category: 'seafood' },
  { query: 'cod atlantic raw', category: 'seafood' },
  { query: 'herring atlantic raw', category: 'seafood' },
  { query: 'trout rainbow raw', category: 'seafood' },
  { query: 'shrimp raw', category: 'seafood' },
  { query: 'blueberries raw', category: 'fruit' },
  { query: 'strawberries raw', category: 'fruit' },
  { query: 'raspberries raw', category: 'fruit' },
  { query: 'blackberries raw', category: 'fruit' },
  { query: 'pomegranate raw', category: 'fruit' },
  { query: 'kiwifruit raw', category: 'fruit' },
  { query: 'papaya raw', category: 'fruit' },
  { query: 'mango raw', category: 'fruit' },
  { query: 'cherries sweet raw', category: 'fruit' },
  { query: 'apricots raw', category: 'fruit' },
  { query: 'figs raw', category: 'fruit' },
  { query: 'cantaloupe raw', category: 'fruit' },
  { query: 'quinoa cooked', category: 'whole_grain' },
  { query: 'oats raw', category: 'whole_grain' },
  { query: 'brown rice cooked', category: 'whole_grain' },
  { query: 'buckwheat groats roasted cooked', category: 'whole_grain' },
  { query: 'barley pearled cooked', category: 'whole_grain' },
  { query: 'millet cooked', category: 'whole_grain' },
  { query: 'amaranth grain cooked', category: 'whole_grain' },
  { query: 'farro cooked', category: 'whole_grain' },
  { query: 'wild rice cooked', category: 'whole_grain' },
  { query: 'almonds raw', category: 'nut' },
  { query: 'walnuts english', category: 'nut' },
  { query: 'pecans raw', category: 'nut' },
  { query: 'cashews raw', category: 'nut' },
  { query: 'pistachios raw', category: 'nut' },
  { query: 'brazil nuts raw', category: 'nut' },
  { query: 'macadamia nuts raw', category: 'nut' },
  { query: 'hazelnuts raw', category: 'nut' },
  { query: 'chia seeds dried', category: 'seed' },
  { query: 'flaxseed', category: 'seed' },
  { query: 'pumpkin seeds dried', category: 'seed' },
  { query: 'sunflower seeds dried', category: 'seed' },
  { query: 'sesame seeds whole dried', category: 'seed' },
  { query: 'hemp seeds hulled', category: 'seed' },
  { query: 'lentils cooked', category: 'legume' },
  { query: 'chickpeas cooked', category: 'legume' },
  { query: 'black beans cooked', category: 'legume' },
  { query: 'kidney beans cooked', category: 'legume' },
  { query: 'navy beans cooked', category: 'legume' },
  { query: 'pinto beans cooked', category: 'legume' },
  { query: 'edamame cooked', category: 'legume' },
  { query: 'green peas cooked', category: 'legume' },
  { query: 'spinach raw', category: 'leafy_green' },
  { query: 'kale raw', category: 'leafy_green' },
  { query: 'swiss chard raw', category: 'leafy_green' },
  { query: 'arugula raw', category: 'leafy_green' },
  { query: 'collard greens raw', category: 'leafy_green' },
  { query: 'watercress raw', category: 'leafy_green' },
  { query: 'romaine lettuce raw', category: 'leafy_green' },
  { query: 'mustard greens raw', category: 'leafy_green' },
  { query: 'broccoli raw', category: 'vegetable' },
  { query: 'cauliflower raw', category: 'vegetable' },
  { query: 'brussels sprouts raw', category: 'vegetable' },
  { query: 'sweet potato raw', category: 'vegetable' },
  { query: 'carrots raw', category: 'vegetable' },
  { query: 'beets raw', category: 'vegetable' },
  { query: 'bell pepper red raw', category: 'vegetable' },
  { query: 'asparagus raw', category: 'vegetable' },
  { query: 'cabbage raw', category: 'vegetable' },
  { query: 'zucchini raw', category: 'vegetable' },
  { query: 'shiitake mushrooms raw', category: 'mushroom' },
  { query: 'maitake mushrooms raw', category: 'mushroom' },
  { query: 'portabella mushrooms raw', category: 'mushroom' },
  { query: 'oyster mushrooms raw', category: 'mushroom' },
  { query: 'white button mushrooms raw', category: 'mushroom' },
  { query: 'kefir plain', category: 'dairy' },
  { query: 'greek yogurt plain whole milk', category: 'dairy' },
  { query: 'cottage cheese', category: 'dairy' },
  { query: 'egg whole raw', category: 'dairy' },
  { query: 'beef grass fed ground raw', category: 'animal_protein' },
  { query: 'chicken breast raw', category: 'animal_protein' },
  { query: 'turkey breast raw', category: 'animal_protein' },
  { query: 'beef liver raw', category: 'animal_protein' },
  { query: 'lamb ground raw', category: 'animal_protein' },
  { query: 'pork tenderloin raw', category: 'animal_protein' },
  { query: 'ginger root raw', category: 'herb_adaptogen' },
  { query: 'turmeric ground', category: 'herb_adaptogen' },
  { query: 'parsley fresh', category: 'herb_adaptogen' },
  { query: 'basil fresh', category: 'herb_adaptogen' },
  { query: 'cilantro coriander leaves raw', category: 'herb_adaptogen' },
  { query: 'thyme fresh', category: 'herb_adaptogen' },
  { query: 'rosemary fresh', category: 'herb_adaptogen' },
  { query: 'oregano dried', category: 'herb_adaptogen' },
  { query: 'sage ground', category: 'herb_adaptogen' },
  { query: 'peppermint fresh', category: 'herb_adaptogen' },
  { query: 'spearmint fresh', category: 'herb_adaptogen' },
  { query: 'dill weed fresh', category: 'herb_adaptogen' },
  { query: 'cinnamon ground', category: 'herb_adaptogen' },
  { query: 'garlic raw', category: 'herb_adaptogen' },
];

type SearchHit = { fdcId: number; description: string };

async function searchTopHit(query: string): Promise<SearchHit | null> {
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search` +
    `?query=${encodeURIComponent(query)}&dataType=SR%20Legacy` +
    `&pageSize=1&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `USDA foods/search failed: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as { foods?: SearchHit[] };
  const hit = data.foods?.[0];
  return hit ? { fdcId: hit.fdcId, description: hit.description } : null;
}

async function main() {
  if (!API_KEY) {
    throw new Error('USDA_API_KEY missing from environment (.env.local).');
  }

  const listPath = resolve(
    process.cwd(),
    'src/data/usda-foundation-list.json',
  );
  const foundation: FoundationItem[] = JSON.parse(
    readFileSync(listPath, 'utf8'),
  );

  const seenIds = new Set<number>();
  const entries: FoodIdEntry[] = [];

  // Map Foundation Foods.
  for (const item of foundation) {
    const mapped = mapItem(item);
    if (!mapped) continue;
    if (seenIds.has(mapped.fdc_id)) continue;
    seenIds.add(mapped.fdc_id);
    entries.push(mapped);
  }
  console.log(`Foundation Foods mapped cleanly: ${entries.length}`);

  // Decide whether Step 3 supplementation is needed: either the total is
  // below target, or some category is too thin to be useful on its own.
  const catCount = (): Record<string, number> => {
    const c: Record<string, number> = {};
    for (const e of entries) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  };
  const thinCategories = () =>
    FOOD_CATEGORIES.filter((c) => (catCount()[c] ?? 0) < MIN_PER_CATEGORY);

  // Step 3: supplement via search if below target or any category is thin.
  let supplemented = 0;
  const needSupplement =
    entries.length < TARGET || thinCategories().length > 0;
  if (needSupplement) {
    if (entries.length < TARGET) {
      console.log(
        `Below target of ${TARGET}; supplementing via USDA search API…`,
      );
    } else {
      console.log(
        `Thin categories (< ${MIN_PER_CATEGORY}): ` +
          `${thinCategories().join(', ')}; supplementing via USDA search…`,
      );
    }
    for (const term of SUPPLEMENT_TERMS) {
      let hit: SearchHit | null = null;
      try {
        hit = await searchTopHit(term.query);
      } catch (err) {
        console.warn(
          `  search "${term.query}" failed: ` +
            (err instanceof Error ? err.message : String(err)),
        );
        continue;
      }
      if (!hit) continue;
      if (seenIds.has(hit.fdcId)) continue;
      seenIds.add(hit.fdcId);
      const serving = SERVING_DEFAULTS[term.category];
      entries.push({
        fdc_id: hit.fdcId,
        name: cleanName(hit.description),
        category: term.category,
        serving_size_g: serving.serving_size_g,
        serving_description: serving.serving_description,
      });
      supplemented += 1;
    }
    console.log(`Supplemented ${supplemented} entries via search.`);
  }

  // Sort for deterministic output: category, then name.
  entries.sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );

  const outPath = resolve(process.cwd(), 'src/data/usda-food-ids.json');
  writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n', 'utf8');

  const byCat: Record<string, number> = {};
  for (const e of entries) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
  console.log(`Wrote ${entries.length} entries to ${outPath}`);
  console.table(byCat);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
