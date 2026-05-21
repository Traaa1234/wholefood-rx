# WholeFood RX Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete WholeFood RX by adding the four remaining features — Food → Nutrient profile (#2), Symptom → Nutrient → Food chain (#3), Daily plate builder (#4), Synergy notes (#5) — plus site navigation, and deploy to Vercel.

**Architecture:** Builds on the phase-1 MVP. All reads go through new functions added to `src/lib/queries.ts`, following the established `db.execute(sql\`...\`)` → `.rows` pattern with `data_source` precedence dedup. Charts use Recharts in `'use client'` components fed by Server Components. The plate builder is client-side (localStorage) and reaches the DB through a Server Action. No new tables — the schema and seed data from phase 1 already cover symptoms and interactions.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui (Radix, pinned `shadcn@3.8.5`), Recharts 3, Neon Postgres, Drizzle ORM 0.45, Vitest. Deploy: GitHub + Vercel.

**Working directory:** `C:\Users\elinw\Projects\wholefood-rx`. Repo exists, phase-1 MVP committed on `main`. Shell is PowerShell on Windows.

---

## Carried conventions (from phase 1 — every task must honor these)

1. **Standalone scripts** (anything under `scripts/`, run via `tsx`) must start with:
   ```typescript
   import { config } from 'dotenv';
   config({ path: '.env.local' });
   ```
   and use the Windows-robust direct-run guard:
   ```typescript
   import { pathToFileURL } from 'node:url';
   import { resolve } from 'node:path';
   const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href.toLowerCase() : '';
   if (import.meta.url.toLowerCase() === invokedPath) { /* run */ }
   ```
   Next.js app code does NOT need this — Next loads `.env.local` automatically.
2. **`db.execute(sql\`...\`)` returns a `NeonHttpQueryResult`** — rows are under `.rows`, not the value itself. Unwrap accordingly.
3. **`src/lib/db.ts` exports a lazy `db` proxy** — safe to import in Server Components and Server Actions.
4. **`data_source` precedence:** when a (food, nutrient) pair has multiple rows, prefer `usda_foundation` > `usda_sr_legacy` > `curated` via `DISTINCT ON ... ORDER BY <precedence CASE>`.
5. **Client components using `useSearchParams()` must be wrapped in `<Suspense>`** by their parent page (Next.js 16 requirement).
6. **`params` and `searchParams` are Promises** in Next.js 16 page components — `await` them.
7. Never print or commit `.env.local`.

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                    # MODIFY — add <SiteNav/>
│   ├── food/
│   │   ├── page.tsx                  # CREATE — food catalog index
│   │   └── [slug]/page.tsx           # CREATE — Feature #2: Food → Nutrient
│   ├── symptoms/
│   │   └── page.tsx                  # CREATE — Feature #3: Symptom chain
│   ├── plate/
│   │   ├── page.tsx                  # CREATE — Feature #4: plate builder shell
│   │   └── actions.ts                # CREATE — Server Action: getPlateData
│   └── nutrient/[slug]/page.tsx       # MODIFY — embed <SynergyCard/>
├── components/
│   ├── site-nav.tsx                  # CREATE — top navigation
│   ├── food-rank-row.tsx             # MODIFY — link food name to /food/[slug]
│   ├── nutrient-radar-chart.tsx      # CREATE — 'use client' Recharts radar
│   ├── nutrient-bar-chart.tsx        # CREATE — 'use client' Recharts bar
│   ├── nutrient-profile-table.tsx    # CREATE — full micronutrient table
│   ├── synergy-card.tsx              # CREATE — Feature #5 interaction card
│   ├── symptom-selector.tsx          # CREATE — 'use client' multi-select
│   ├── plate-builder.tsx             # CREATE — 'use client' localStorage plate
│   └── add-to-plate-button.tsx       # CREATE — 'use client' add button
├── lib/
│   ├── queries.ts                    # MODIFY — add 7 query functions
│   └── plate.ts                      # CREATE — computePlateTotals (pure, TDD)
tests/
└── plate.test.ts                     # CREATE — computePlateTotals tests
```

---

## Task 1: Food queries

**Files:**
- Modify: `src/lib/queries.ts`

Add three functions for Feature #2. Append them to the existing file; keep all existing exports.

- [ ] **Step 1: Add `listFoods`, `getFood`, `getFoodNutrientProfile` to `src/lib/queries.ts`**

Append to the file (the file already imports `sql` from `drizzle-orm` and `db` from `./db`; reuse the existing `PRECEDENCE_CASE` constant defined for `rankFoodsByNutrient` — if it is not exported/at module scope, this task may hoist it to module scope so both functions share it):

```typescript
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
```

**Note on `PRECEDENCE_CASE`:** the phase-1 `rankFoodsByNutrient` defined a `PRECEDENCE_CASE` SQL fragment for `case fn.data_source when 'usda_foundation' then 1 when 'usda_sr_legacy' then 2 when 'curated' then 3 end`. Read the existing `queries.ts`. If `PRECEDENCE_CASE` is a module-scope `const`, reuse it directly. If it is defined inside `rankFoodsByNutrient`, move it to module scope (a `const PRECEDENCE_CASE = sql\`...\`;`) so both functions share one definition — DRY. Do not duplicate the CASE expression.

- [ ] **Step 2: Probe the new queries**

Create `scripts/probe-food.ts`:

```typescript
import { config } from 'dotenv';
config({ path: '.env.local' });
import { listFoods, getFood, getFoodNutrientProfile } from '../src/lib/queries';

async function main() {
  const foods = await listFoods();
  console.log('listFoods count:', foods.length);
  const sample = foods.find((f) => f.slug.includes('broccoli')) ?? foods[0];
  console.log('sample food slug:', sample.slug);

  const food = await getFood(sample.slug);
  console.log('getFood:', food ? `${food.name} (serving ${food.serving_size_g}g)` : 'NULL');
  console.log('getFood(bad-slug):', await getFood('not-a-real-food'));

  if (food) {
    const profile = await getFoodNutrientProfile(food.id);
    console.log(`profile rows for ${food.name}:`, profile.length);
    console.log('first 5:', profile.slice(0, 5).map((p) => `${p.nutrient_name}=${Number(p.amount_per_serving).toFixed(2)}${p.unit}`));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `pnpm tsx scripts/probe-food.ts`

Expected: `listFoods count` ≈ 400; `getFood` prints a name; `getFood(bad-slug)` prints `null`; profile has multiple nutrient rows with plausible amounts.

- [ ] **Step 3: tsc + commit**

```powershell
./node_modules/.bin/tsc --noEmit
git add src/lib/queries.ts scripts/probe-food.ts
git commit -m "feat(queries): food queries — listFoods, getFood, getFoodNutrientProfile"
```

---

## Task 2: Symptom and interaction queries

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Step 1: Add `listSymptoms`, `getNutrientsForSymptoms`, `getInteractionsForNutrient`, `getInteractionsAmongNutrientSlugs`**

Append to `src/lib/queries.ts`:

```typescript
export type SymptomRow = {
  slug: string;
  name: string;
  description: string | null;
};

export async function listSymptoms(): Promise<SymptomRow[]> {
  const result = await db.execute(sql`
    select slug, name, description
    from symptoms
    order by name
  `);
  return result.rows as SymptomRow[];
}

export type SymptomNutrientRow = {
  nutrient_slug: string;
  nutrient_name: string;
  nutrient_category: string;
  unit: string;
  total_strength: number;
  symptom_count: number;
};

export async function getNutrientsForSymptoms(symptomSlugs: string[]): Promise<SymptomNutrientRow[]> {
  if (symptomSlugs.length === 0) return [];
  const slugList = sql.join(symptomSlugs.map((s) => sql`${s}`), sql`, `);
  const result = await db.execute(sql`
    select
      n.slug as nutrient_slug,
      n.name as nutrient_name,
      n.category::text as nutrient_category,
      n.unit,
      sum(sn.strength)::int as total_strength,
      count(distinct sn.symptom_id)::int as symptom_count
    from symptom_nutrients sn
    join symptoms s on s.id = sn.symptom_id
    join nutrients n on n.id = sn.nutrient_id
    where s.slug in (${slugList})
    group by n.id, n.slug, n.name, n.category, n.unit
    order by total_strength desc, symptom_count desc, n.name
  `);
  return result.rows as SymptomNutrientRow[];
}

export type InteractionRow = {
  kind: string;
  notes: string;
  citation_url: string | null;
  a_slug: string;
  a_name: string;
  b_slug: string;
  b_name: string;
};

export async function getInteractionsForNutrient(nutrientSlug: string): Promise<InteractionRow[]> {
  const result = await db.execute(sql`
    select
      ix.kind::text as kind,
      ix.notes,
      ix.citation_url,
      na.slug as a_slug, na.name as a_name,
      nb.slug as b_slug, nb.name as b_name
    from nutrient_interactions ix
    join nutrients na on na.id = ix.nutrient_a_id
    join nutrients nb on nb.id = ix.nutrient_b_id
    join nutrients target on target.slug = ${nutrientSlug}
    where ix.nutrient_a_id = target.id or ix.nutrient_b_id = target.id
    order by ix.kind, na.name
  `);
  return result.rows as InteractionRow[];
}

export async function getInteractionsAmongNutrientSlugs(nutrientSlugs: string[]): Promise<InteractionRow[]> {
  if (nutrientSlugs.length < 2) return [];
  const slugList = sql.join(nutrientSlugs.map((s) => sql`${s}`), sql`, `);
  const result = await db.execute(sql`
    select
      ix.kind::text as kind,
      ix.notes,
      ix.citation_url,
      na.slug as a_slug, na.name as a_name,
      nb.slug as b_slug, nb.name as b_name
    from nutrient_interactions ix
    join nutrients na on na.id = ix.nutrient_a_id
    join nutrients nb on nb.id = ix.nutrient_b_id
    where na.slug in (${slugList}) and nb.slug in (${slugList})
    order by ix.kind, na.name
  `);
  return result.rows as InteractionRow[];
}
```

- [ ] **Step 2: Probe the new queries**

Create `scripts/probe-symptoms.ts`:

```typescript
import { config } from 'dotenv';
config({ path: '.env.local' });
import {
  listSymptoms, getNutrientsForSymptoms,
  getInteractionsForNutrient, getInteractionsAmongNutrientSlugs,
} from '../src/lib/queries';

async function main() {
  const symptoms = await listSymptoms();
  console.log('listSymptoms count:', symptoms.length);

  console.log('\nempty symptom selection:', await getNutrientsForSymptoms([]));

  const picked = ['fatigue', 'poor-sleep'];
  const ranked = await getNutrientsForSymptoms(picked);
  console.log(`\nnutrients for ${picked.join(' + ')}:`);
  for (const r of ranked.slice(0, 8)) {
    console.log(`  ${r.nutrient_name.padEnd(36)} strength=${r.total_strength} symptoms=${r.symptom_count}`);
  }

  console.log('\ninteractions for iron:');
  for (const ix of await getInteractionsForNutrient('iron')) {
    console.log(`  [${ix.kind}] ${ix.a_name} <-> ${ix.b_name}`);
  }

  console.log('\ninteractions among [iron, vitamin-c, calcium]:');
  for (const ix of await getInteractionsAmongNutrientSlugs(['iron', 'vitamin-c', 'calcium'])) {
    console.log(`  [${ix.kind}] ${ix.a_name} <-> ${ix.b_name}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `pnpm tsx scripts/probe-symptoms.ts`

Expected: 12 symptoms; empty selection returns `[]`; fatigue+poor-sleep ranks iron / B12 / magnesium / vitamin-D / ashwagandha etc. high; iron interactions include the vitamin-C synergy and calcium antagonist; the among-query returns iron↔vitamin-c and calcium↔iron.

- [ ] **Step 3: tsc + commit**

```powershell
./node_modules/.bin/tsc --noEmit
git add src/lib/queries.ts scripts/probe-symptoms.ts
git commit -m "feat(queries): symptom-chain and interaction queries"
```

---

## Task 3: Site navigation

**Files:**
- Create: `src/components/site-nav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/components/site-nav.tsx`**

A Server Component (no interactivity needed — plain links):

```tsx
import Link from 'next/link';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/nutrient', label: 'Nutrients' },
  { href: '/food', label: 'Foods' },
  { href: '/symptoms', label: 'Symptoms' },
  { href: '/plate', label: 'My Plate' },
];

export function SiteNav() {
  return (
    <header className="border-b border-slate-200">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-6 py-3">
        <Link href="/" className="mr-4 font-semibold tracking-tight">
          WholeFood RX
        </Link>
        {LINKS.slice(1).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Mount `<SiteNav/>` in `src/app/layout.tsx`**

In `layout.tsx`, import `SiteNav` and render it inside `<body>` before `{children}`:

```tsx
import { SiteNav } from "@/components/site-nav";
```

Change the body to:

```tsx
      <body className="min-h-full flex flex-col">
        <SiteNav />
        <div className="flex-1">{children}</div>
      </body>
```

Keep the existing `metadata`, fonts, and `<html>` attributes unchanged.

- [ ] **Step 3: Verify build + nav renders**

```powershell
./node_modules/.bin/next build
```

Expected: compiles. Then dev smoke test:

```powershell
Start-Process -NoNewWindow powershell -ArgumentList '-Command','cd "C:\Users\elinw\Projects\wholefood-rx"; ./node_modules/.bin/next dev'
```

Wait ~8s, then:

```powershell
$html = (Invoke-WebRequest http://localhost:3000/ -UseBasicParsing).Content
if ($html -match 'Nutrients' -and $html -match 'My Plate') { 'NAV OK' } else { 'NAV MISSING' }
```

Expected: `NAV OK`. Stop only the dev server process you started (capture its PID; do not blanket-kill node).

- [ ] **Step 4: Commit**

```powershell
git add src/components/site-nav.tsx src/app/layout.tsx
git commit -m "feat(ui): site navigation header"
```

---

## Task 4: Food catalog page + food links

**Files:**
- Create: `src/app/food/page.tsx`
- Modify: `src/components/food-rank-row.tsx`

- [ ] **Step 1: Create `src/app/food/page.tsx`**

A Server Component listing all foods grouped by category, mirroring the nutrient catalog:

```tsx
import Link from 'next/link';
import { listFoods } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  fruit: 'Fruits',
  vegetable: 'Vegetables',
  leafy_green: 'Leafy greens',
  nut: 'Nuts',
  seed: 'Seeds',
  legume: 'Legumes',
  whole_grain: 'Whole grains',
  herb_adaptogen: 'Herbs & adaptogens',
  mushroom: 'Mushrooms',
  animal_protein: 'Animal protein',
  seafood: 'Seafood',
  dairy: 'Dairy',
};

export default async function FoodIndex() {
  const all = await listFoods();
  const grouped = new Map<string, typeof all>();
  for (const f of all) {
    const list = grouped.get(f.category) ?? [];
    list.push(f);
    grouped.set(f.category, list);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Food catalog</h1>
      <p className="mt-2 text-slate-600">
        {all.length} whole foods. Click any food to see its full micronutrient profile.
      </p>

      {Array.from(grouped.entries()).map(([cat, items]) => (
        <section key={cat} className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {CATEGORY_LABELS[cat] ?? cat} <span className="text-slate-400">({items.length})</span>
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/food/${f.slug}`}
                  className="block rounded-md border border-slate-200 px-4 py-2.5 text-sm hover:border-slate-400 hover:bg-slate-50"
                >
                  {f.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Make food names link to their profile in `src/components/food-rank-row.tsx`**

The phase-1 `food-rank-row.tsx` renders `<div className="font-medium">{p.food_name}</div>`. Wrap that food name in a `Link` to `/food/{slug}`. The component already receives `food_slug` as a prop. Change the food-name `div` to:

```tsx
        <div>
          <Link href={`/food/${p.food_slug}`} className="font-medium hover:underline">
            {p.food_name}
          </Link>
          <div className="text-xs text-slate-500">{p.serving_description}</div>
        </div>
```

Ensure `import Link from 'next/link';` is present at the top of the file (phase-1 may already import it for the citation link — if so, don't duplicate).

- [ ] **Step 3: Verify**

```powershell
./node_modules/.bin/next build
```

Then dev smoke test (start dev server, capture PID):

```powershell
(Invoke-WebRequest http://localhost:3000/food -UseBasicParsing).StatusCode
$html = (Invoke-WebRequest http://localhost:3000/food -UseBasicParsing).Content
if ($html -match 'Food catalog' -and $html -match 'Vegetables') { 'FOOD INDEX OK' } else { 'FAIL' }
```

Expected: `200`, `FOOD INDEX OK`. Stop the dev server you started.

- [ ] **Step 4: Commit**

```powershell
git add src/app/food/page.tsx src/components/food-rank-row.tsx
git commit -m "feat(ui): food catalog index + link food rank rows to profiles"
```

---

## Task 5: Recharts chart components

**Files:**
- Create: `src/components/nutrient-radar-chart.tsx`
- Create: `src/components/nutrient-bar-chart.tsx`

Recharts requires the DOM — both are `'use client'` components fed plain data arrays by their parent Server Component.

- [ ] **Step 1: Create `src/components/nutrient-radar-chart.tsx`**

```tsx
'use client';

import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';

export type ChartDatum = { label: string; pct: number };

export function NutrientRadarChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No vitamin data for this food.</p>;
  }
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <Radar
            dataKey="pct"
            stroke="#0f766e"
            fill="#14b8a6"
            fillOpacity={0.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

`pct` is %RDA per serving, capped at 100 by the parent (a serving providing 250% RDA still plots at the 100 edge — the table shows exact numbers).

- [ ] **Step 2: Create `src/components/nutrient-bar-chart.tsx`**

```tsx
'use client';

import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { ChartDatum } from './nutrient-radar-chart';

export function NutrientBarChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No mineral data for this food.</p>;
  }
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
          <YAxis
            type="category"
            dataKey="label"
            width={96}
            tick={{ fontSize: 11, fill: '#475569' }}
          />
          <Tooltip
            formatter={(v: number) => [`${v}% RDA`, '']}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="pct" fill="#14b8a6" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2b: Verify the components typecheck**

```powershell
./node_modules/.bin/tsc --noEmit
```

Expected: exit 0. (These components aren't rendered until Task 6 — tsc is the only check here.)

- [ ] **Step 3: Commit**

```powershell
git add src/components/nutrient-radar-chart.tsx src/components/nutrient-bar-chart.tsx
git commit -m "feat(ui): Recharts radar + bar chart components"
```

---

## Task 6: Food → Nutrient profile page (Feature #2)

**Files:**
- Create: `src/components/nutrient-profile-table.tsx`
- Create: `src/app/food/[slug]/page.tsx`

- [ ] **Step 1: Create `src/components/nutrient-profile-table.tsx`**

A Server Component rendering the full micronutrient table grouped by nutrient category. Uses the `FoodNutrientRow` type from queries and the `pctRda` helper.

```tsx
import Link from 'next/link';
import type { FoodNutrientRow } from '@/lib/queries';
import { pctRda } from '@/lib/rda';

const CATEGORY_LABELS: Record<string, string> = {
  vitamin_fat_soluble: 'Fat-soluble vitamins',
  vitamin_water_soluble: 'Water-soluble vitamins',
  macro_mineral: 'Macro minerals',
  trace_mineral: 'Trace minerals',
  essential_amino_acid: 'Essential amino acids',
  conditionally_essential_aa: 'Conditionally essential amino acids',
  essential_fatty_acid: 'Essential fatty acids',
  adaptogen: 'Adaptogens',
  phytonutrient: 'Phytonutrients',
};

export function NutrientProfileTable({ rows }: { rows: FoodNutrientRow[] }) {
  const grouped = new Map<string, FoodNutrientRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.nutrient_category) ?? [];
    list.push(r);
    grouped.set(r.nutrient_category, list);
  }

  return (
    <div className="mt-4 space-y-8">
      {Array.from(grouped.entries()).map(([cat, items]) => (
        <section key={cat}>
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {CATEGORY_LABELS[cat] ?? cat}
          </h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-1.5">Nutrient</th>
                <th className="py-1.5 text-right">Per 100 g</th>
                <th className="py-1.5 text-right">Per serving</th>
                <th className="py-1.5 text-right">% RDA</th>
                <th className="py-1.5 text-right">Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const rda = r.rda_male ?? r.rda_female;
                const pct = pctRda(r.amount_per_serving, rda);
                return (
                  <tr key={r.nutrient_slug} className="border-b border-slate-100">
                    <td className="py-1.5">
                      <Link href={`/nutrient/${r.nutrient_slug}`} className="hover:underline">
                        {r.nutrient_name}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {Number(r.amount_per_100g).toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {Number(r.amount_per_serving).toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit}
                    </td>
                    <td className="py-1.5 text-right">
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      {r.citation_url ? (
                        <a href={r.citation_url} target="_blank" rel="noopener" className="text-xs text-slate-400 hover:text-slate-700">
                          {r.data_source === 'curated' ? 'cite' : 'USDA'}
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/food/[slug]/page.tsx`**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFood, getFoodNutrientProfile } from '@/lib/queries';
import { pctRda } from '@/lib/rda';
import { NutrientRadarChart, type ChartDatum } from '@/components/nutrient-radar-chart';
import { NutrientBarChart } from '@/components/nutrient-bar-chart';
import { NutrientProfileTable } from '@/components/nutrient-profile-table';

export const dynamic = 'force-dynamic';

const VITAMIN_CATS = ['vitamin_fat_soluble', 'vitamin_water_soluble'];
const MINERAL_CATS = ['macro_mineral', 'trace_mineral'];

function shortLabel(name: string): string {
  // "Vitamin C (Ascorbic Acid)" -> "Vitamin C"; "Calcium" -> "Calcium"
  return name.replace(/\s*\(.*\)\s*/, '').trim();
}

export default async function FoodPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const food = await getFood(slug);
  if (!food) notFound();

  const profile = await getFoodNutrientProfile(food.id);

  const toChart = (cats: string[]): ChartDatum[] =>
    profile
      .filter((r) => cats.includes(r.nutrient_category))
      .map((r) => {
        const pct = pctRda(r.amount_per_serving, r.rda_male ?? r.rda_female);
        return { label: shortLabel(r.nutrient_name), pct: pct === null ? 0 : Math.min(pct, 100) };
      })
      .filter((d) => d.pct > 0);

  const vitaminData = toChart(VITAMIN_CATS);
  const mineralData = toChart(MINERAL_CATS);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/food" className="text-xs text-slate-500 hover:text-slate-900">← all foods</Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{food.name}</h1>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
        <span>Category: {food.category.replace(/_/g, ' ')}</span>
        <span>Serving: {food.serving_description} ({Number(food.serving_size_g)} g)</span>
        {food.glycemic_index !== null && <span>GI: {food.glycemic_index}</span>}
      </div>
      {food.notes && <p className="mt-3 text-sm italic text-slate-500">{food.notes}</p>}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Vitamins (% RDA / serving)</h2>
          <NutrientRadarChart data={vitaminData} />
        </div>
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Minerals (% RDA / serving)</h2>
          <NutrientBarChart data={mineralData} />
        </div>
      </div>

      <h2 className="mt-12 text-lg font-medium">Full micronutrient profile</h2>
      {profile.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No nutrient data seeded for this food.</p>
      ) : (
        <NutrientProfileTable rows={profile} />
      )}

      <p className="mt-10 text-xs text-slate-400">
        Charts cap at 100% RDA for readability — the table shows exact amounts. Data: USDA FoodData Central and curated peer-reviewed literature. RDAs from NIH ODS.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Verify — build + smoke test**

```powershell
./node_modules/.bin/next build
```

Then dev smoke test (start dev server, capture PID):

```powershell
(Invoke-WebRequest http://localhost:3000/food -UseBasicParsing).StatusCode
# pick a real food slug from the catalog HTML, then:
(Invoke-WebRequest 'http://localhost:3000/food/broccoli-raw' -UseBasicParsing).StatusCode
try { (Invoke-WebRequest 'http://localhost:3000/food/not-real' -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
```

If `broccoli-raw` is not a real slug, open `http://localhost:3000/food`, read the HTML, pick any real `/food/<slug>` href, and test that instead. Expected: real food → `200` and the HTML contains "Full micronutrient profile" plus vitamin/mineral names; bad slug → `404`. Stop the dev server you started.

- [ ] **Step 4: Commit**

```powershell
git add src/components/nutrient-profile-table.tsx "src/app/food/[slug]/page.tsx"
git commit -m "feat(ui): Feature #2 — Food to Nutrient profile with radar/bar charts + table"
```

---

## Task 7: Synergy notes (Feature #5)

**Files:**
- Create: `src/components/synergy-card.tsx`
- Modify: `src/app/nutrient/[slug]/page.tsx`
- Modify: `src/app/food/[slug]/page.tsx`

- [ ] **Step 1: Create `src/components/synergy-card.tsx`**

A Server Component rendering a list of interactions. Reused on both the nutrient page and the food page.

```tsx
import type { InteractionRow } from '@/lib/queries';

const KIND_META: Record<string, { label: string; cls: string }> = {
  synergy: { label: 'Synergy', cls: 'bg-emerald-50 text-emerald-700' },
  antagonist: { label: 'Antagonist', cls: 'bg-rose-50 text-rose-700' },
  cofactor: { label: 'Cofactor', cls: 'bg-sky-50 text-sky-700' },
};

export function SynergyCard({
  interactions,
  title = 'Absorption & synergy notes',
}: {
  interactions: InteractionRow[];
  title?: string;
}) {
  if (interactions.length === 0) return null;
  return (
    <section className="mt-8 rounded-lg border border-slate-200 p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">{title}</h2>
      <ul className="mt-3 space-y-3">
        {interactions.map((ix, i) => {
          const meta = KIND_META[ix.kind] ?? { label: ix.kind, cls: 'bg-slate-100 text-slate-700' };
          return (
            <li key={`${ix.a_slug}-${ix.b_slug}-${i}`} className="text-sm">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${meta.cls}`}>
                  {meta.label}
                </span>
                <span className="font-medium">{ix.a_name} + {ix.b_name}</span>
              </div>
              <p className="mt-1 text-slate-600">{ix.notes}</p>
              {ix.citation_url && (
                <a href={ix.citation_url} target="_blank" rel="noopener" className="text-xs text-slate-400 hover:text-slate-700">
                  source
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Embed in `src/app/nutrient/[slug]/page.tsx`**

Add the import:
```tsx
import { SynergyCard } from '@/components/synergy-card';
```
Add `getInteractionsForNutrient` to the existing `@/lib/queries` import.

In the page body, after fetching the nutrient, fetch its interactions:
```tsx
  const interactions = await getInteractionsForNutrient(slug);
```
Render `<SynergyCard interactions={interactions} />` just before the closing data-source `<p>` footer (after the ranked food `<ol>`).

- [ ] **Step 3: Embed in `src/app/food/[slug]/page.tsx`**

Add the import:
```tsx
import { SynergyCard } from '@/components/synergy-card';
```
Add `getInteractionsAmongNutrientSlugs` to the existing `@/lib/queries` import.

After computing `profile`, derive the food's nutrient slugs and fetch interactions among them:
```tsx
  const interactions = await getInteractionsAmongNutrientSlugs(profile.map((r) => r.nutrient_slug));
```
Render `<SynergyCard interactions={interactions} title="Nutrient pairings in this food" />` after the `NutrientProfileTable` block and before the closing footer `<p>`.

- [ ] **Step 4: Verify**

```powershell
./node_modules/.bin/next build
```

Dev smoke test (start dev server, capture PID):

```powershell
$n = (Invoke-WebRequest 'http://localhost:3000/nutrient/iron' -UseBasicParsing).Content
if ($n -match 'synergy' -or $n -match 'Synergy' -or $n -match 'Antagonist') { 'NUTRIENT SYNERGY OK' } else { 'FAIL' }
# food page: pick an iron+vitamin-c rich food, e.g. a leafy green; confirm a pairing card appears on at least one food
```

Expected: the iron nutrient page shows synergy/antagonist entries (iron has the vitamin-C synergy and calcium antagonist seeded). Stop the dev server you started.

- [ ] **Step 5: Commit**

```powershell
git add src/components/synergy-card.tsx "src/app/nutrient/[slug]/page.tsx" "src/app/food/[slug]/page.tsx"
git commit -m "feat(ui): Feature #5 — synergy notes cards on nutrient and food pages"
```

---

## Task 8: Symptom → Nutrient → Food chain (Feature #3)

**Files:**
- Create: `src/components/symptom-selector.tsx`
- Create: `src/app/symptoms/page.tsx`

The selector is a client component that toggles symptom slugs in the URL (`?s=fatigue&s=poor-sleep`). The page is a Server Component that reads the params, ranks nutrients, and shows top foods for each.

- [ ] **Step 1: Create `src/components/symptom-selector.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

type Symptom = { slug: string; name: string };

export function SymptomSelector({ symptoms }: { symptoms: Symptom[] }) {
  const path = usePathname();
  const params = useSearchParams();
  const selected = new Set(params.getAll('s'));

  function hrefToggling(slug: string): string {
    const next = new URLSearchParams();
    const after = new Set(selected);
    if (after.has(slug)) after.delete(slug);
    else after.add(slug);
    for (const s of after) next.append('s', s);
    const qs = next.toString();
    return qs ? `${path}?${qs}` : path;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {symptoms.map((s) => {
        const on = selected.has(s.slug);
        return (
          <Link
            key={s.slug}
            href={hrefToggling(s.slug)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              on
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-700 hover:border-slate-500'
            }`}
          >
            {s.name}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/symptoms/page.tsx`**

```tsx
import { Suspense } from 'react';
import Link from 'next/link';
import { listSymptoms, getNutrientsForSymptoms, rankFoodsByNutrient } from '@/lib/queries';
import { SymptomSelector } from '@/components/symptom-selector';

export const dynamic = 'force-dynamic';

export default async function SymptomsPage({
  searchParams,
}: { searchParams: Promise<{ s?: string | string[] }> }) {
  const sp = await searchParams;
  const selected = sp.s === undefined ? [] : Array.isArray(sp.s) ? sp.s : [sp.s];

  const symptoms = await listSymptoms();
  const nutrients = await getNutrientsForSymptoms(selected);

  // For the top 6 ranked nutrients, fetch their top 3 food sources.
  const topNutrients = nutrients.slice(0, 6);
  const foodsByNutrient = await Promise.all(
    topNutrients.map((n) => rankFoodsByNutrient(n.nutrient_slug, 'per_serving', null, 3)),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Symptom finder</h1>
      <p className="mt-2 text-slate-600">
        Select what you're experiencing. We surface the micronutrients most associated with
        those symptoms, then the whole foods richest in each. Not medical advice — see a
        clinician for persistent symptoms.
      </p>

      <div className="mt-6">
        <Suspense fallback={<div className="h-9" />}>
          <SymptomSelector symptoms={symptoms} />
        </Suspense>
      </div>

      {selected.length === 0 && (
        <p className="mt-10 text-center text-sm text-slate-500">
          Pick one or more symptoms above to see suggested nutrients.
        </p>
      )}

      {selected.length > 0 && nutrients.length === 0 && (
        <p className="mt-10 text-center text-sm text-slate-500">
          No nutrient associations found for that selection.
        </p>
      )}

      {topNutrients.length > 0 && (
        <div className="mt-10 space-y-8">
          {topNutrients.map((n, i) => (
            <section key={n.nutrient_slug}>
              <div className="flex items-baseline justify-between">
                <Link href={`/nutrient/${n.nutrient_slug}`} className="text-lg font-medium hover:underline">
                  {n.nutrient_name}
                </Link>
                <span className="text-xs text-slate-400">
                  evidence weight {n.total_strength} · {n.symptom_count} of your symptoms
                </span>
              </div>
              <ul className="mt-2">
                {foodsByNutrient[i].map((f) => (
                  <li key={f.food_slug} className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
                    <Link href={`/food/${f.food_slug}`} className="hover:underline">{f.food_name}</Link>
                    <span className="font-mono text-slate-600">
                      {Number(f.amount_per_serving).toLocaleString(undefined, { maximumFractionDigits: 2 })} {n.unit} / serving
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-10 text-xs text-slate-400">
        Nutrient–symptom associations are evidence-weighted (1–5) from the curated dataset.
        Educational tool, not a diagnosis.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

```powershell
./node_modules/.bin/next build
```

Dev smoke test (start dev server, capture PID):

```powershell
(Invoke-WebRequest 'http://localhost:3000/symptoms' -UseBasicParsing).StatusCode
$r = (Invoke-WebRequest 'http://localhost:3000/symptoms?s=fatigue&s=poor-sleep' -UseBasicParsing).Content
if ($r -match 'evidence weight' -and ($r -match 'Iron' -or $r -match 'Magnesium')) { 'SYMPTOM CHAIN OK' } else { 'FAIL' }
```

Expected: `200`; the fatigue+poor-sleep selection shows ranked nutrients with food lists. Stop the dev server you started.

- [ ] **Step 4: Commit**

```powershell
git add src/components/symptom-selector.tsx src/app/symptoms/page.tsx
git commit -m "feat(ui): Feature #3 — symptom to nutrient to food chain"
```

---

## Task 9: Plate aggregation helper (TDD)

**Files:**
- Create: `src/lib/plate.ts`
- Create: `tests/plate.test.ts`

A pure function that aggregates a plate's nutrient totals. No DB, no React — fully unit-testable.

- [ ] **Step 1: Write the failing test `tests/plate.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run — confirm it fails**

```powershell
./node_modules/.bin/vitest run tests/plate.test.ts
```

Expected: fails with "Cannot find module '@/lib/plate'".

- [ ] **Step 3: Implement `src/lib/plate.ts`**

```typescript
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
```

- [ ] **Step 4: Run — all pass**

```powershell
./node_modules/.bin/vitest run tests/plate.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: tsc + commit**

```powershell
./node_modules/.bin/tsc --noEmit
git add src/lib/plate.ts tests/plate.test.ts
git commit -m "feat(lib): computePlateTotals plate aggregation helper (TDD)"
```

---

## Task 10: Daily plate builder (Feature #4)

**Files:**
- Create: `src/app/plate/actions.ts`
- Create: `src/components/plate-builder.tsx`
- Create: `src/components/add-to-plate-button.tsx`
- Create: `src/app/plate/page.tsx`
- Modify: `src/app/food/[slug]/page.tsx`
- Modify: `src/app/food/page.tsx`

The plate lives in `localStorage` (no auth). A Server Action fetches nutrient data for the chosen foods; the client aggregates via `computePlateTotals`.

- [ ] **Step 1: Create the Server Action `src/app/plate/actions.ts`**

```typescript
'use server';

import { getFood, getFoodNutrientProfile, listNutrients } from '@/lib/queries';
import type { PlateFood, PlateNutrientMeta } from '@/lib/plate';

export type PlateData = {
  foods: PlateFood[];
  nutrients: PlateNutrientMeta[];
  missingSlugs: string[];
};

/** Given plate entries (food slug + servings), return per-food nutrient data + the nutrient catalog. */
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
```

**Note:** `listNutrients()` from phase 1 must return `rda_male` and `rda_female`. Read the existing `listNutrients` in `queries.ts`. If it only selects `slug, name, category, unit`, extend its SELECT and its return type to also include `rda_male` and `rda_female` (both `string | null`). This is a small, safe widening — the nutrient catalog page ignores the extra fields.

- [ ] **Step 2: Create `src/components/add-to-plate-button.tsx`**

A client component that appends a food slug to the `localStorage` plate.

```tsx
'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'wholefoodrx-plate';

type Entry = { slug: string; servings: number };

function readPlate(): Entry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

function writePlate(entries: Entry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function AddToPlateButton({ slug, name }: { slug: string; name: string }) {
  const [inPlate, setInPlate] = useState(false);

  useEffect(() => {
    setInPlate(readPlate().some((e) => e.slug === slug));
  }, [slug]);

  function toggle() {
    const plate = readPlate();
    const exists = plate.some((e) => e.slug === slug);
    const next = exists
      ? plate.filter((e) => e.slug !== slug)
      : [...plate, { slug, servings: 1 }];
    writePlate(next);
    setInPlate(!exists);
  }

  return (
    <button
      onClick={toggle}
      className={`rounded-md border px-3 py-1.5 text-sm ${
        inPlate
          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
          : 'border-slate-300 text-slate-700 hover:border-slate-500'
      }`}
      aria-label={inPlate ? `Remove ${name} from plate` : `Add ${name} to plate`}
    >
      {inPlate ? '✓ On plate' : '+ Add to plate'}
    </button>
  );
}
```

- [ ] **Step 3: Create `src/components/plate-builder.tsx`**

The client component for `/plate`: reads localStorage, calls the Server Action, aggregates, renders totals + gaps.

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getPlateData } from '@/app/plate/actions';
import { computePlateTotals, type PlateTotal } from '@/lib/plate';

const STORAGE_KEY = 'wholefoodrx-plate';

type Entry = { slug: string; servings: number };

function readPlate(): Entry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

function writePlate(entries: Entry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

type FoodView = { slug: string; name: string; servings: number };

export function PlateBuilder() {
  const [loading, setLoading] = useState(true);
  const [foods, setFoods] = useState<FoodView[]>([]);
  const [totals, setTotals] = useState<PlateTotal[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const entries = readPlate();
    if (entries.length === 0) {
      setFoods([]);
      setTotals([]);
      setLoading(false);
      return;
    }
    const data = await getPlateData(entries);
    // Drop any slugs that no longer resolve.
    if (data.missingSlugs.length > 0) {
      writePlate(entries.filter((e) => !data.missingSlugs.includes(e.slug)));
    }
    setFoods(data.foods.map((f) => ({ slug: f.slug, name: f.name, servings: f.servings })));
    setTotals(computePlateTotals(data.foods, data.nutrients));
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function setServings(slug: string, servings: number) {
    if (servings < 1) return;
    writePlate(readPlate().map((e) => (e.slug === slug ? { ...e, servings } : e)));
    void refresh();
  }

  function remove(slug: string) {
    writePlate(readPlate().filter((e) => e.slug !== slug));
    void refresh();
  }

  function clearAll() {
    writePlate([]);
    void refresh();
  }

  if (loading) return <p className="mt-8 text-sm text-slate-500">Loading your plate…</p>;

  if (foods.length === 0) {
    return (
      <p className="mt-8 text-sm text-slate-500">
        Your plate is empty. Browse the{' '}
        <Link href="/food" className="underline">food catalog</Link>{' '}
        and add foods to see your cumulative nutrient coverage.
      </p>
    );
  }

  const covered = totals.filter((t) => t.pctRda !== null);
  const gaps = covered.filter((t) => t.isGap);
  const sortedTotals = [...covered].sort((a, b) => (a.pctRda ?? 0) - (b.pctRda ?? 0));

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Today's plate ({foods.length})</h2>
        <button onClick={clearAll} className="text-xs text-slate-400 hover:text-rose-600">
          clear all
        </button>
      </div>
      <ul className="mt-3">
        {foods.map((f) => (
          <li key={f.slug} className="flex items-center justify-between border-b border-slate-100 py-2">
            <Link href={`/food/${f.slug}`} className="text-sm hover:underline">{f.name}</Link>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-slate-500">
                servings
                <input
                  type="number"
                  min={1}
                  value={f.servings}
                  onChange={(e) => setServings(f.slug, Number(e.target.value))}
                  className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                />
              </label>
              <button onClick={() => remove(f.slug)} className="text-xs text-slate-400 hover:text-rose-600">
                remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {gaps.length > 0 && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-medium text-amber-800">
            Biggest gaps ({gaps.length} nutrients under {25}% RDA)
          </h3>
          <p className="mt-1 text-sm text-amber-700">
            {gaps.slice(0, 8).map((g) => g.name).join(', ')}
          </p>
        </div>
      )}

      <h3 className="mt-8 text-sm font-medium uppercase tracking-wide text-slate-500">
        Cumulative coverage (lowest first)
      </h3>
      <ul className="mt-2">
        {sortedTotals.map((t) => (
          <li key={t.slug} className="flex items-center gap-3 border-b border-slate-100 py-1.5 text-sm">
            <Link href={`/nutrient/${t.slug}`} className="w-48 shrink-0 hover:underline">{t.name}</Link>
            <div className="h-2 flex-1 rounded bg-slate-100">
              <div
                className={`h-2 rounded ${t.isGap ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(t.pctRda ?? 0, 100)}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right font-mono text-xs text-slate-600">
              {t.amount.toLocaleString(undefined, { maximumFractionDigits: 1 })} {t.unit}
            </span>
            <span className="w-12 shrink-0 text-right text-xs">{t.pctRda}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-slate-400">
        Coverage uses the per-serving amounts × your serving counts. Nutrients without an
        established RDA (most adaptogens, phytonutrients, EPA/DHA) are omitted from coverage.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/plate/page.tsx`**

```tsx
import { PlateBuilder } from '@/components/plate-builder';

export const metadata = { title: 'My Plate · WholeFood RX' };

export default function PlatePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Daily plate builder</h1>
      <p className="mt-2 text-slate-600">
        Add whole foods to today's plate and see how much of each micronutrient's RDA you're
        covering. Stored in your browser only — no account needed.
      </p>
      <PlateBuilder />
    </main>
  );
}
```

- [ ] **Step 5: Add the "add to plate" button to the food profile page**

In `src/app/food/[slug]/page.tsx`, import the button:
```tsx
import { AddToPlateButton } from '@/components/add-to-plate-button';
```
Render it in the header area, right after the food facts `div` (before the `food.notes` paragraph):
```tsx
      <div className="mt-4">
        <AddToPlateButton slug={food.slug} name={food.name} />
      </div>
```

- [ ] **Step 6: Add the button to the food catalog rows**

In `src/app/food/page.tsx`, import `AddToPlateButton` and change each catalog `<li>` so the food link and an add button sit side by side:
```tsx
              <li key={f.slug} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-4 py-2.5">
                <Link href={`/food/${f.slug}`} className="text-sm hover:underline">
                  {f.name}
                </Link>
                <AddToPlateButton slug={f.slug} name={f.name} />
              </li>
```
(Replace the existing `<li>`/`<Link>` block from Task 4 with this; the link no longer needs the full-card styling since the `<li>` now carries the border.)

- [ ] **Step 7: Verify**

```powershell
./node_modules/.bin/next build
./node_modules/.bin/vitest run
```

Expected: build compiles (`/plate` appears as a route), all tests pass (20 — phase-1's 14 plus 6 plate tests).

Dev smoke test (start dev server, capture PID):
```powershell
(Invoke-WebRequest 'http://localhost:3000/plate' -UseBasicParsing).StatusCode
$p = (Invoke-WebRequest 'http://localhost:3000/plate' -UseBasicParsing).Content
if ($p -match 'Daily plate builder') { 'PLATE OK' } else { 'FAIL' }
```
Expected: `200`, `PLATE OK`. The empty-plate message renders (Server Action exercising needs a real browser — note that interactive add/remove is verified by build + the `computePlateTotals` unit tests). Stop the dev server you started.

- [ ] **Step 8: Commit**

```powershell
git add src/app/plate "src/components/plate-builder.tsx" "src/components/add-to-plate-button.tsx" "src/app/food/[slug]/page.tsx" src/app/food/page.tsx src/lib/queries.ts
git commit -m "feat(ui): Feature #4 — daily plate builder with localStorage + %RDA coverage"
```

---

## Task 11: README update + full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the "Status" and route sections of `README.md`**

Replace the `## Status` section at the end of `README.md` with:

```markdown
## Features

- **Nutrient → Food** (`/nutrient/[slug]`) — top food sources for any micronutrient, ranked, with %RDA and citations.
- **Food → Nutrient** (`/food/[slug]`) — a food's full micronutrient profile as radar + bar charts and a table.
- **Symptom finder** (`/symptoms`) — pick symptoms, get evidence-weighted nutrient suggestions and their top foods.
- **Daily plate builder** (`/plate`) — add foods, see cumulative %RDA coverage and gaps. Stored in `localStorage`.
- **Synergy notes** — absorption pairings (synergies, antagonists, cofactors) shown inline on nutrient and food pages.

All micronutrient data is cited to USDA FoodData Central or peer-reviewed literature.
```

- [ ] **Step 2: Full verification pass**

```powershell
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build
```

Expected: 20 tests pass; tsc clean; build compiles with routes `/`, `/nutrient`, `/nutrient/[slug]`, `/food`, `/food/[slug]`, `/symptoms`, `/plate`.

- [ ] **Step 3: Commit**

```powershell
git add README.md
git commit -m "docs: README — phase-2 features"
```

---

## Task 12: Deploy to Vercel

**Files:** none (deployment task)

This task creates a GitHub repository, pushes `main`, and deploys to Vercel. It is **partially interactive** — `gh` and Vercel both need the user's authenticated accounts. If a step needs credentials the agent doesn't have, STOP and report exactly what the user must do, rather than guessing.

- [ ] **Step 1: Confirm `gh` is authenticated**

```powershell
gh auth status
```

If not authenticated, STOP and report: the user must run `gh auth login`. Do not proceed.

- [ ] **Step 2: Create the GitHub repo and push**

```powershell
gh repo create wholefood-rx --private --source=. --remote=origin --push
```

Expected: creates a private repo, adds `origin`, pushes `main`. Confirm with `git remote -v` and `gh repo view --web` (don't open a browser — just confirm the command resolves).

- [ ] **Step 3: Verify `.env.local` did NOT get pushed**

```powershell
git ls-files | Select-String '.env'
```

Expected: only `.env.example`. If `.env.local` appears, STOP — it must never be pushed.

- [ ] **Step 4: Deploy to Vercel**

Two paths — prefer (A):

**(A) Vercel CLI:**
```powershell
pnpm dlx vercel@latest --version
pnpm dlx vercel@latest login        # interactive — may need the user
pnpm dlx vercel@latest link --yes
pnpm dlx vercel@latest env add DATABASE_URL production
pnpm dlx vercel@latest env add USDA_API_KEY production
pnpm dlx vercel@latest --prod
```
For the two `env add` commands, the value must be supplied by the user (the agent must NOT read `.env.local` and paste secrets into logs). When you reach `vercel env add`, STOP and tell the user to either run those two commands themselves with their values, or paste the values into the Vercel dashboard (Project → Settings → Environment Variables).

**(B) If the Vercel CLI can't authenticate non-interactively:** STOP and give the user a short checklist:
1. Go to https://vercel.com/new, import the `wholefood-rx` GitHub repo.
2. Add env vars `DATABASE_URL` and `USDA_API_KEY` (values from their local `.env.local`).
3. Deploy.

- [ ] **Step 5: Verify the deployment**

Once deployed, fetch the production URL's `/nutrient/vitamin-c` and confirm it returns `200` with ranked foods. The Neon serverless driver works in Vercel's runtime (HTTP-based — no connection pooling issue).

If the build fails on Vercel, the most likely cause is the build running `next build` without `DATABASE_URL` available — the pages are `force-dynamic` so they shouldn't query at build time, but if a page does, confirm env vars are set for the "Production" environment and redeploy.

- [ ] **Step 6: Record the deploy URL**

Add a line to the top of `README.md` under the title: `Live: <production-url>`. Commit:

```powershell
git add README.md
git commit -m "docs: add Vercel production URL"
git push
```

---

## Self-Review

**Spec coverage** (against the phase-2 stub `2026-05-20-wholefood-rx-phase-2.md` and design spec §6):
- Feature #2 Food → Nutrient — Tasks 1, 5, 6 (queries, charts, page). ✓
- Feature #3 Symptom chain — Tasks 2, 8. ✓
- Feature #4 Plate builder — Tasks 9, 10. ✓
- Feature #5 Synergy notes — Tasks 2, 7. ✓
- Navigation across all pages — Task 3. ✓
- Vercel deploy — Task 12. ✓

**Placeholder scan:** No "TBD"/"TODO"/"similar to Task N". All code blocks are complete. Task 12 is intentionally interactive but each branch has concrete commands and an explicit STOP-and-report instruction — not a placeholder.

**Type consistency:**
- `ChartDatum` defined in `nutrient-radar-chart.tsx` (Task 5), imported by `nutrient-bar-chart.tsx` (Task 5) and `food/[slug]/page.tsx` (Task 6). ✓
- `FoodNutrientRow` defined in Task 1, consumed by `NutrientProfileTable` (Task 6). ✓
- `InteractionRow` defined in Task 2, consumed by `SynergyCard` (Task 7). ✓
- `PlateFood` / `PlateNutrientMeta` / `PlateTotal` defined in `src/lib/plate.ts` (Task 9), consumed by `actions.ts` and `plate-builder.tsx` (Task 10). ✓
- `getPlateData` defined in Task 10 Step 1, consumed by `plate-builder.tsx` in Task 10 Step 3. ✓
- Plate `localStorage` key `wholefoodrx-plate` and `Entry` shape `{slug, servings}` are identical in `add-to-plate-button.tsx` and `plate-builder.tsx` (Task 10). ✓
- `listNutrients` widening (Task 10 Step 1 note) — flagged explicitly as a required edit with the return-type change; `actions.ts` depends on `rda_male`/`rda_female` being present. ✓

**Known cross-task dependency:** Task 10 depends on `listNutrients()` exposing `rda_male`/`rda_female`. The Task 10 Step 1 note makes the widening explicit. If the implementer of Task 10 finds `listNutrients` already returns them, the note is a no-op — safe either way.
