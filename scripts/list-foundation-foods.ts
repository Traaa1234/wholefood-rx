import { config } from 'dotenv';
config({ path: '.env.local' });
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Pages through the USDA FoodData Central Foundation Foods dataset and writes
 * the combined raw list to src/data/usda-foundation-list.json.
 *
 * Each output item has: { fdcId, description, foodCategory }.
 *
 * Note: the foods/list endpoint returns an empty foodCategory for Foundation
 * Foods, so a second pass enriches each item via the bulk foods detail
 * endpoint (which does include foodCategory.description).
 */

type FdcListItem = {
  fdcId: number;
  description: string;
  foodCategory?: string;
  dataType?: string;
};

type FdcDetail = {
  fdcId: number;
  description: string;
  foodCategory?: { description?: string } | string;
};

const API_KEY = process.env.USDA_API_KEY;
const PAGE_SIZE = 200;
const DETAIL_BATCH = 20;

async function fetchPage(pageNumber: number): Promise<FdcListItem[]> {
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/list` +
    `?dataType=Foundation&pageSize=${PAGE_SIZE}&pageNumber=${pageNumber}` +
    `&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `USDA foods/list failed: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as FdcListItem[];
  return data;
}

async function fetchCategories(
  ids: number[],
): Promise<Map<number, string>> {
  const params = ids.map((i) => `fdcIds=${i}`).join('&');
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods?${params}&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `USDA foods detail failed: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as FdcDetail[];
  const out = new Map<number, string>();
  for (const d of data) {
    const cat =
      typeof d.foodCategory === 'string'
        ? d.foodCategory
        : (d.foodCategory?.description ?? '');
    out.set(d.fdcId, cat);
  }
  return out;
}

async function main() {
  if (!API_KEY) {
    throw new Error('USDA_API_KEY missing from environment (.env.local).');
  }

  const all: FdcListItem[] = [];
  let pageNumber = 1;

  // The foods/list endpoint paginates; stop once a page returns < PAGE_SIZE.
  while (true) {
    const page = await fetchPage(pageNumber);
    console.log(`page ${pageNumber}: ${page.length} items`);
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    pageNumber += 1;
  }

  // Enrich each item with its USDA foodCategory via the bulk detail endpoint.
  console.log(`Fetching categories for ${all.length} items…`);
  const categories = new Map<number, string>();
  for (let i = 0; i < all.length; i += DETAIL_BATCH) {
    const batch = all.slice(i, i + DETAIL_BATCH).map((x) => x.fdcId);
    const cats = await fetchCategories(batch);
    for (const [id, cat] of cats) categories.set(id, cat);
  }

  const slim = all.map((x) => ({
    fdcId: x.fdcId,
    description: x.description,
    foodCategory: categories.get(x.fdcId) ?? x.foodCategory ?? '',
  }));

  const outPath = resolve(process.cwd(), 'src/data/usda-foundation-list.json');
  writeFileSync(outPath, JSON.stringify(slim, null, 2) + '\n', 'utf8');

  console.log(`Wrote ${slim.length} Foundation Foods to ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
