# WholeFood RX Implementation Plan — MVP Slice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working local instance of WholeFood RX with full seed pipeline (~300 foods, 50+ nutrients, symptoms, interactions) and Feature #1 (Nutrient → Food ranking view) end-to-end. Features #2–5 and Vercel deploy are out of scope here — they get a follow-up plan.

**Architecture:** Next.js 14 App Router on top of Neon serverless Postgres. Drizzle ORM owns the schema; five idempotent seed scripts hydrate data from USDA FoodData Central plus curated JSON. Reads use Server Components with raw Drizzle queries — no API routes in MVP.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, shadcn/ui, Drizzle ORM, `@neondatabase/serverless`, Vitest, `tsx`, Recharts (installed but not yet used until Feature #2).

**Working directory:** `C:\Users\elinw\Projects\wholefood-rx`. The git repo already exists with the design spec committed on `main`. Shell is PowerShell.

---

## File Structure

```
wholefood-rx/
├── .env.example
├── .env.local                (gitignored)
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json
├── drizzle.config.ts
├── vitest.config.ts
├── docs/plans/                        # already exists
├── drizzle/                           # generated migrations
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # home, links to /nutrient
│   │   ├── globals.css
│   │   └── nutrient/
│   │       ├── page.tsx               # catalog (all nutrients)
│   │       └── [slug]/page.tsx        # ranked food list — Feature #1
│   ├── components/
│   │   ├── ui/                        # shadcn primitives
│   │   ├── nutrient-card.tsx
│   │   ├── food-rank-row.tsx
│   │   ├── nutrient-toggle.tsx        # per-100g vs per-serving
│   │   └── category-filter.tsx
│   ├── lib/
│   │   ├── db.ts                      # Neon client + drizzle()
│   │   ├── schema.ts                  # Drizzle table defs
│   │   ├── queries.ts                 # rankFoodsByNutrient, etc.
│   │   ├── slug.ts                    # name -> slug helper
│   │   ├── usda-mapping.ts            # USDA nutrientNumber -> our id
│   │   ├── rda.ts                     # %RDA calc
│   │   └── utils.ts                   # shadcn cn() helper
│   └── data/
│       ├── nutrients.json
│       ├── usda-food-ids.json         # ~250 Foundation + ~50 SR Legacy
│       ├── curated-foods.json
│       ├── curated-food-nutrients.json
│       ├── symptoms.json
│       ├── symptom-nutrients.json
│       └── nutrient-interactions.json
├── scripts/
│   ├── seed.ts                        # orchestrator
│   ├── seed-nutrients.ts
│   ├── seed-foods-usda.ts
│   ├── seed-curated.ts
│   ├── seed-symptoms.ts
│   └── seed-interactions.ts
└── tests/
    ├── slug.test.ts
    ├── usda-mapping.test.ts
    └── rda.test.ts
```

Files-that-change-together rule applied: all DB schema lives in one file (`schema.ts`); each curated dataset has its own JSON; each seed script targets one logical group of tables.

---

## Task 1: Scaffold Next.js + dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Generate Next.js skeleton in the existing repo**

The repo already has `.git` and `docs/`. Use `--no-git` to avoid clobbering.

```powershell
pnpm create next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --no-git --use-pnpm
```

When prompted to install in non-empty dir, accept. Expected: scaffolded files alongside `docs/`, no overwrite of design spec.

- [ ] **Step 2: Install runtime + dev dependencies**

```powershell
pnpm add drizzle-orm @neondatabase/serverless dotenv recharts
pnpm add -D drizzle-kit tsx vitest @types/node
```

- [ ] **Step 3: Add helpful scripts to package.json**

Edit `package.json` `scripts` to be:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Next.js 14 with drizzle, neon, vitest, recharts"
```

---

## Task 2: shadcn/ui init + first primitives

**Files:**
- Create: `components.json`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/select.tsx`, `src/components/ui/toggle.tsx`, `src/lib/utils.ts`

- [ ] **Step 1: Init shadcn**

```powershell
pnpm dlx shadcn@latest init -d
```

Accept defaults: New York style, Slate base color, CSS variables yes. This writes `components.json` and `src/lib/utils.ts`.

- [ ] **Step 2: Add the components we need for Feature #1**

```powershell
pnpm dlx shadcn@latest add button card badge select toggle table
```

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "chore: shadcn init + button/card/badge/select/toggle/table primitives"
```

---

## Task 3: Neon connection + Drizzle config

**Files:**
- Create: `.env.example`, `.env.local`, `src/lib/db.ts`, `drizzle.config.ts`

- [ ] **Step 1: Write `.env.example`**

```
# Neon serverless Postgres connection string
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# USDA FoodData Central API key — get one at https://fdc.nal.usda.gov/api-key-signup.html
USDA_API_KEY=DEMO_KEY
```

- [ ] **Step 2: Copy to `.env.local` and have the user fill in real values**

```powershell
Copy-Item .env.example .env.local
```

Then the user edits `.env.local` with their actual Neon URL and USDA key. Pause here for the user to do this before continuing.

- [ ] **Step 3: Write the Neon + Drizzle client at `src/lib/db.ts`**

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 4: Write `drizzle.config.ts`**

```typescript
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 5: Ensure `.env.local` is gitignored**

Verify `.gitignore` contains `.env*.local`. If not, add it.

- [ ] **Step 6: Commit**

```powershell
git add .env.example src/lib/db.ts drizzle.config.ts .gitignore
git commit -m "feat(db): neon serverless client + drizzle config"
```

---

## Task 4: Drizzle schema (all six tables + enums)

**Files:**
- Create: `src/lib/schema.ts`

- [ ] **Step 1: Write the full schema**

```typescript
import {
  pgTable, pgEnum, serial, text, integer, numeric, boolean,
  timestamp, smallint, primaryKey, index, check, sql
} from 'drizzle-orm/pg-core';

export const nutrientCategory = pgEnum('nutrient_category', [
  'vitamin_fat_soluble', 'vitamin_water_soluble', 'macro_mineral',
  'trace_mineral', 'essential_amino_acid', 'conditionally_essential_aa',
  'essential_fatty_acid', 'adaptogen', 'phytonutrient',
]);

export const foodCategory = pgEnum('food_category', [
  'fruit', 'vegetable', 'leafy_green', 'nut', 'seed', 'legume',
  'whole_grain', 'herb_adaptogen', 'mushroom', 'animal_protein',
  'seafood', 'dairy',
]);

export const dataSource = pgEnum('data_source', [
  'usda_foundation', 'usda_sr_legacy', 'curated',
]);

export const interactionKind = pgEnum('interaction_kind', [
  'synergy', 'antagonist', 'cofactor',
]);

export const nutrients = pgTable('nutrients', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull().unique(),
  category: nutrientCategory('category').notNull(),
  rdaMale: numeric('rda_male'),
  rdaFemale: numeric('rda_female'),
  unit: text('unit').notNull(),
  functionSummary: text('function_summary'),
  deficiencySymptoms: text('deficiency_symptoms'),
  toxicityThreshold: numeric('toxicity_threshold'),
  cofactors: text('cofactors').array(),
  absorptionNotes: text('absorption_notes'),
});

export const foods = pgTable('foods', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: foodCategory('category').notNull(),
  fdcId: integer('fdc_id').unique(),
  servingSizeG: numeric('serving_size_g').notNull(),
  servingDescription: text('serving_description').notNull(),
  organicAvailable: boolean('organic_available').default(true),
  seasonality: text('seasonality'),
  glycemicIndex: integer('glycemic_index'),
  notes: text('notes'),
});

export const foodNutrients = pgTable(
  'food_nutrients',
  {
    foodId: integer('food_id').notNull().references(() => foods.id, { onDelete: 'cascade' }),
    nutrientId: integer('nutrient_id').notNull().references(() => nutrients.id, { onDelete: 'cascade' }),
    amountPer100g: numeric('amount_per_100g').notNull(),
    amountPerServing: numeric('amount_per_serving').notNull(),
    bioavailabilityScore: numeric('bioavailability_score'),
    preparationNotes: text('preparation_notes'),
    dataSource: dataSource('data_source').notNull(),
    citationUrl: text('citation_url'),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.foodId, t.nutrientId, t.dataSource] }),
    densityIdx: index('food_nutrients_nutrient_density').on(t.nutrientId, t.amountPer100g),
    servingIdx: index('food_nutrients_nutrient_serving').on(t.nutrientId, t.amountPerServing),
  })
);

export const symptoms = pgTable('symptoms', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull().unique(),
  description: text('description'),
});

export const symptomNutrients = pgTable(
  'symptom_nutrients',
  {
    symptomId: integer('symptom_id').notNull().references(() => symptoms.id, { onDelete: 'cascade' }),
    nutrientId: integer('nutrient_id').notNull().references(() => nutrients.id, { onDelete: 'cascade' }),
    strength: smallint('strength').notNull(),
    notes: text('notes'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.symptomId, t.nutrientId] }),
  })
);

export const nutrientInteractions = pgTable(
  'nutrient_interactions',
  {
    id: serial('id').primaryKey(),
    nutrientAId: integer('nutrient_a_id').notNull().references(() => nutrients.id, { onDelete: 'cascade' }),
    nutrientBId: integer('nutrient_b_id').notNull().references(() => nutrients.id, { onDelete: 'cascade' }),
    kind: interactionKind('kind').notNull(),
    notes: text('notes').notNull(),
    citationUrl: text('citation_url'),
  },
  (t) => ({
    diff: check('nutrient_interactions_diff', sql`${t.nutrientAId} <> ${t.nutrientBId}`),
  })
);
```

Note: spec adds a `slug` column to `nutrients`, `foods`, `symptoms` that wasn't in the design doc — they're trivially derived from `name` but materialized for clean URL lookups. The design doc will get a one-line addendum noting this in Task 23.

- [ ] **Step 2: Commit**

```powershell
git add src/lib/schema.ts
git commit -m "feat(db): drizzle schema for nutrients, foods, junction, symptoms, interactions"
```

---

## Task 5: Generate and apply first migration

**Files:**
- Create: `scripts/migrate.ts`, `drizzle/0000_*.sql`

- [ ] **Step 1: Write the migration runner**

`scripts/migrate.ts`:

```typescript
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log('Running migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Generate the first migration**

```powershell
pnpm db:generate
```

Expected: creates `drizzle/0000_<random>.sql` containing CREATE TYPE / CREATE TABLE statements.

- [ ] **Step 3: Apply the migration to Neon**

```powershell
pnpm db:migrate
```

Expected output: `Running migrations…` then `Done.`. Neon DB now has all six tables.

- [ ] **Step 4: Sanity-check via psql (or Neon dashboard SQL editor)**

```sql
\dt
-- expect: food_nutrients, foods, nutrient_interactions, nutrients, symptom_nutrients, symptoms
\d food_nutrients
-- expect: PK on (food_id, nutrient_id, data_source), two indexes
```

- [ ] **Step 5: Commit**

```powershell
git add scripts/migrate.ts drizzle/
git commit -m "feat(db): first migration — six tables, four enums, ranking indexes"
```

---

## Task 6: Slug helper (TDD)

**Files:**
- Create: `src/lib/slug.ts`, `tests/slug.test.ts`, `vitest.config.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 2: Write the failing test at `tests/slug.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { toSlug } from '@/lib/slug';

describe('toSlug', () => {
  it('lowercases', () => {
    expect(toSlug('Vitamin C')).toBe('vitamin-c');
  });
  it('replaces spaces and punctuation with hyphens', () => {
    expect(toSlug('Omega-3 (ALA)')).toBe('omega-3-ala');
  });
  it('collapses repeated hyphens', () => {
    expect(toSlug('A   B--C')).toBe('a-b-c');
  });
  it('strips leading/trailing hyphens', () => {
    expect(toSlug(' -hello- ')).toBe('hello');
  });
  it('handles common food names', () => {
    expect(toSlug('Spinach, raw')).toBe('spinach-raw');
    expect(toSlug("Brazil Nut")).toBe('brazil-nut');
  });
});
```

- [ ] **Step 3: Run and verify it fails**

```powershell
pnpm test
```

Expected: error "Cannot find module '@/lib/slug'".

- [ ] **Step 4: Implement `src/lib/slug.ts`**

```typescript
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 5: Run tests — all pass**

```powershell
pnpm test
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/slug.ts tests/slug.test.ts vitest.config.ts
git commit -m "feat(lib): toSlug helper with TDD"
```

---

## Task 7: USDA nutrient ID mapping (TDD)

USDA returns nutrients by their internal `nutrientNumber` (e.g., `'401'` for Vitamin C, `'301'` for Calcium). We need a deterministic mapping from those numbers to our nutrient slugs.

**Files:**
- Create: `src/lib/usda-mapping.ts`, `tests/usda-mapping.test.ts`

- [ ] **Step 1: Write failing test**

`tests/usda-mapping.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { usdaNumberToSlug, USDA_NUMBER_TO_SLUG } from '@/lib/usda-mapping';

describe('USDA nutrient mapping', () => {
  it('maps Vitamin C', () => {
    expect(usdaNumberToSlug('401')).toBe('vitamin-c');
  });
  it('maps Iron, Fe', () => {
    expect(usdaNumberToSlug('303')).toBe('iron');
  });
  it('maps Calcium, Ca', () => {
    expect(usdaNumberToSlug('301')).toBe('calcium');
  });
  it('returns null for unknown numbers', () => {
    expect(usdaNumberToSlug('99999')).toBeNull();
  });
  it('table has no duplicate slugs', () => {
    const slugs = Object.values(USDA_NUMBER_TO_SLUG);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
```

- [ ] **Step 2: Run, verify it fails (module not found)**

```powershell
pnpm test usda-mapping
```

- [ ] **Step 3: Implement `src/lib/usda-mapping.ts` with the full table**

```typescript
// USDA FDC nutrientNumber -> our nutrients.slug
// Reference: https://fdc.nal.usda.gov/portal-data/external/dataDictionary
export const USDA_NUMBER_TO_SLUG: Record<string, string> = {
  // Vitamins
  '320': 'vitamin-a',
  '404': 'vitamin-b1',
  '405': 'vitamin-b2',
  '406': 'vitamin-b3',
  '410': 'vitamin-b5',
  '415': 'vitamin-b6',
  '417': 'vitamin-b9',
  '418': 'vitamin-b12',
  '401': 'vitamin-c',
  '328': 'vitamin-d',
  '323': 'vitamin-e',
  '430': 'vitamin-k',
  // Biotin (B7) — USDA SR uses 416 in some datasets
  '416': 'vitamin-b7',

  // Macro minerals
  '301': 'calcium',
  '305': 'phosphorus',
  '306': 'potassium',
  '307': 'sodium',
  '309': 'zinc',
  '312': 'copper',
  '315': 'manganese',
  '317': 'selenium',
  '303': 'iron',
  '304': 'magnesium',
  '313': 'fluoride',
  '314': 'chromium',
  '410.5': 'molybdenum', // some datasets

  // Fatty acids
  '675': 'omega-6',
  '851': 'omega-3-ala',
  '629': 'omega-3-epa',
  '621': 'omega-3-dha',

  // Selected amino acids (USDA reports many)
  '501': 'histidine',
  '502': 'isoleucine',
  '503': 'leucine',
  '504': 'lysine',
  '505': 'methionine',
  '506': 'phenylalanine',
  '507': 'threonine',
  '508': 'tryptophan',
  '509': 'valine',
};

export function usdaNumberToSlug(num: string): string | null {
  return USDA_NUMBER_TO_SLUG[num] ?? null;
}
```

- [ ] **Step 4: Run tests — pass**

```powershell
pnpm test usda-mapping
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/usda-mapping.ts tests/usda-mapping.test.ts
git commit -m "feat(lib): USDA nutrientNumber to slug mapping (TDD)"
```

---

## Task 8: %RDA helper (TDD)

**Files:**
- Create: `src/lib/rda.ts`, `tests/rda.test.ts`

- [ ] **Step 1: Failing test**

`tests/rda.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pctRda } from '@/lib/rda';

describe('pctRda', () => {
  it('returns null when rda is null', () => {
    expect(pctRda(50, null)).toBeNull();
  });
  it('returns null when rda is 0', () => {
    expect(pctRda(50, 0)).toBeNull();
  });
  it('returns the correct percentage rounded to nearest integer', () => {
    expect(pctRda(45, 90)).toBe(50);
    expect(pctRda(135, 90)).toBe(150);
  });
  it('handles numeric strings from numeric columns', () => {
    expect(pctRda('45', '90')).toBe(50);
  });
});
```

- [ ] **Step 2: Run — fails (module missing)**

```powershell
pnpm test rda
```

- [ ] **Step 3: Implement `src/lib/rda.ts`**

```typescript
type Num = number | string | null | undefined;

function toNum(v: Num): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

export function pctRda(amount: Num, rda: Num): number | null {
  const a = toNum(amount);
  const r = toNum(rda);
  if (a === null || r === null || r === 0) return null;
  return Math.round((a / r) * 100);
}
```

- [ ] **Step 4: Run — pass**

```powershell
pnpm test rda
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/rda.ts tests/rda.test.ts
git commit -m "feat(lib): pctRda helper (TDD)"
```

---

## Task 9: Nutrients catalog data file

**Files:**
- Create: `src/data/nutrients.json`

- [ ] **Step 1: Write the full curated nutrient catalog**

The JSON is an array of objects with shape `{ slug, name, category, rda_male, rda_female, unit, function_summary, deficiency_symptoms, toxicity_threshold, cofactors, absorption_notes }`. RDA values from NIH ODS Fact Sheets (adult 19-50).

Create `src/data/nutrients.json` with these entries (all 50, no abbreviations):

```json
[
  { "slug": "vitamin-a", "name": "Vitamin A (Retinol Activity Equivalents)", "category": "vitamin_fat_soluble", "rda_male": 900, "rda_female": 700, "unit": "mcg RAE", "function_summary": "Vision, immune function, cell differentiation.", "deficiency_symptoms": "Night blindness, dry skin, immune impairment.", "toxicity_threshold": 3000, "cofactors": ["zinc","vitamin-e"], "absorption_notes": "Fat-soluble — eat with dietary fat." },
  { "slug": "vitamin-b1", "name": "Thiamin (Vitamin B1)", "category": "vitamin_water_soluble", "rda_male": 1.2, "rda_female": 1.1, "unit": "mg", "function_summary": "Carbohydrate metabolism, nervous system function.", "deficiency_symptoms": "Beriberi, neuropathy, Wernicke-Korsakoff (alcoholics).", "toxicity_threshold": null, "cofactors": ["magnesium"], "absorption_notes": "Heat-labile — preserved better in raw or quick-cooked foods." },
  { "slug": "vitamin-b2", "name": "Riboflavin (Vitamin B2)", "category": "vitamin_water_soluble", "rda_male": 1.3, "rda_female": 1.1, "unit": "mg", "function_summary": "Energy production, antioxidant regeneration.", "deficiency_symptoms": "Cracked lips, sore throat, anemia.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Sensitive to UV light — store opaque." },
  { "slug": "vitamin-b3", "name": "Niacin (Vitamin B3)", "category": "vitamin_water_soluble", "rda_male": 16, "rda_female": 14, "unit": "mg NE", "function_summary": "NAD/NADP coenzymes, energy metabolism, DNA repair.", "deficiency_symptoms": "Pellagra (dermatitis, diarrhea, dementia).", "toxicity_threshold": 35, "cofactors": ["tryptophan"], "absorption_notes": "Tryptophan converts to niacin (60:1 ratio)." },
  { "slug": "vitamin-b5", "name": "Pantothenic Acid (Vitamin B5)", "category": "vitamin_water_soluble", "rda_male": 5, "rda_female": 5, "unit": "mg", "function_summary": "Component of CoA, fatty acid synthesis.", "deficiency_symptoms": "Rare; fatigue, irritability.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Widespread in foods — true deficiency is rare." },
  { "slug": "vitamin-b6", "name": "Pyridoxine (Vitamin B6)", "category": "vitamin_water_soluble", "rda_male": 1.3, "rda_female": 1.3, "unit": "mg", "function_summary": "Amino acid metabolism, neurotransmitter synthesis.", "deficiency_symptoms": "Microcytic anemia, depression, seizures.", "toxicity_threshold": 100, "cofactors": ["riboflavin"], "absorption_notes": "Active form is PLP." },
  { "slug": "vitamin-b7", "name": "Biotin (Vitamin B7)", "category": "vitamin_water_soluble", "rda_male": 30, "rda_female": 30, "unit": "mcg", "function_summary": "Coenzyme for carboxylation reactions; hair/skin/nail health.", "deficiency_symptoms": "Brittle nails, hair loss, dermatitis (rare).", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Avidin (raw egg white) binds biotin — cook eggs." },
  { "slug": "vitamin-b9", "name": "Folate (Vitamin B9)", "category": "vitamin_water_soluble", "rda_male": 400, "rda_female": 400, "unit": "mcg DFE", "function_summary": "DNA synthesis, methylation, fetal neural tube development.", "deficiency_symptoms": "Megaloblastic anemia, neural tube defects.", "toxicity_threshold": 1000, "cofactors": ["vitamin-b12"], "absorption_notes": "Heat-sensitive — eat raw leafy greens for max retention." },
  { "slug": "vitamin-b12", "name": "Cobalamin (Vitamin B12)", "category": "vitamin_water_soluble", "rda_male": 2.4, "rda_female": 2.4, "unit": "mcg", "function_summary": "Red blood cell formation, neurological function, DNA synthesis.", "deficiency_symptoms": "Pernicious anemia, peripheral neuropathy, cognitive decline.", "toxicity_threshold": null, "cofactors": ["folate"], "absorption_notes": "Only from animal foods (or fortified/algae). Requires intrinsic factor." },
  { "slug": "vitamin-c", "name": "Vitamin C (Ascorbic Acid)", "category": "vitamin_water_soluble", "rda_male": 90, "rda_female": 75, "unit": "mg", "function_summary": "Collagen synthesis, antioxidant, immune support, iron absorption.", "deficiency_symptoms": "Scurvy, bleeding gums, poor wound healing.", "toxicity_threshold": 2000, "cofactors": [], "absorption_notes": "Boosts non-heme iron absorption. Heat-sensitive." },
  { "slug": "vitamin-d", "name": "Vitamin D (Cholecalciferol)", "category": "vitamin_fat_soluble", "rda_male": 15, "rda_female": 15, "unit": "mcg", "function_summary": "Calcium absorption, bone health, immune modulation.", "deficiency_symptoms": "Rickets, osteomalacia, low immunity.", "toxicity_threshold": 100, "cofactors": ["vitamin-k","magnesium"], "absorption_notes": "Synthesized by skin from UVB; food sources limited." },
  { "slug": "vitamin-e", "name": "Vitamin E (Alpha-Tocopherol)", "category": "vitamin_fat_soluble", "rda_male": 15, "rda_female": 15, "unit": "mg", "function_summary": "Lipid antioxidant, cell membrane protection.", "deficiency_symptoms": "Rare; hemolytic anemia in premature infants.", "toxicity_threshold": 1000, "cofactors": ["vitamin-c","selenium"], "absorption_notes": "Fat-soluble." },
  { "slug": "vitamin-k", "name": "Vitamin K (Phylloquinone)", "category": "vitamin_fat_soluble", "rda_male": 120, "rda_female": 90, "unit": "mcg", "function_summary": "Blood clotting, bone metabolism.", "deficiency_symptoms": "Easy bruising, prolonged bleeding.", "toxicity_threshold": null, "cofactors": ["vitamin-d"], "absorption_notes": "K1 in leafy greens; K2 (MK-7) in natto/fermented foods." },

  { "slug": "calcium", "name": "Calcium", "category": "macro_mineral", "rda_male": 1000, "rda_female": 1000, "unit": "mg", "function_summary": "Bone/teeth structure, muscle contraction, nerve signaling.", "deficiency_symptoms": "Osteopenia, osteoporosis, muscle cramps.", "toxicity_threshold": 2500, "cofactors": ["vitamin-d","vitamin-k","magnesium"], "absorption_notes": "Competes with iron — take separately." },
  { "slug": "phosphorus", "name": "Phosphorus", "category": "macro_mineral", "rda_male": 700, "rda_female": 700, "unit": "mg", "function_summary": "Bone matrix, ATP, phospholipids.", "deficiency_symptoms": "Rare; bone pain, muscle weakness.", "toxicity_threshold": 4000, "cofactors": ["calcium"], "absorption_notes": "Ubiquitous — deficiency is uncommon." },
  { "slug": "potassium", "name": "Potassium", "category": "macro_mineral", "rda_male": 3400, "rda_female": 2600, "unit": "mg", "function_summary": "Fluid balance, nerve transmission, blood pressure regulation.", "deficiency_symptoms": "Muscle weakness, cardiac arrhythmia.", "toxicity_threshold": null, "cofactors": ["sodium","magnesium"], "absorption_notes": "Most Americans under-consume." },
  { "slug": "sodium", "name": "Sodium", "category": "macro_mineral", "rda_male": 1500, "rda_female": 1500, "unit": "mg", "function_summary": "Fluid balance, nerve conduction.", "deficiency_symptoms": "Rare in modern diets; hyponatremia.", "toxicity_threshold": 2300, "cofactors": ["potassium"], "absorption_notes": "UL is more relevant than RDA for most." },
  { "slug": "chloride", "name": "Chloride", "category": "macro_mineral", "rda_male": 2300, "rda_female": 2300, "unit": "mg", "function_summary": "Fluid balance, gastric HCl.", "deficiency_symptoms": "Rare.", "toxicity_threshold": 3600, "cofactors": ["sodium"], "absorption_notes": "Tracks with sodium intake." },
  { "slug": "magnesium", "name": "Magnesium", "category": "macro_mineral", "rda_male": 420, "rda_female": 320, "unit": "mg", "function_summary": "300+ enzyme cofactor, muscle/nerve function, glucose regulation.", "deficiency_symptoms": "Cramps, arrhythmia, insulin resistance.", "toxicity_threshold": 350, "cofactors": ["vitamin-d","vitamin-b6"], "absorption_notes": "Often under-consumed; refined grains lose Mg." },

  { "slug": "iron", "name": "Iron", "category": "trace_mineral", "rda_male": 8, "rda_female": 18, "unit": "mg", "function_summary": "Hemoglobin, oxygen transport, enzyme cofactor.", "deficiency_symptoms": "Anemia, fatigue, pallor, cold intolerance.", "toxicity_threshold": 45, "cofactors": ["vitamin-c"], "absorption_notes": "Heme (animal) absorbs better than non-heme (plant). Vit C boosts non-heme." },
  { "slug": "zinc", "name": "Zinc", "category": "trace_mineral", "rda_male": 11, "rda_female": 8, "unit": "mg", "function_summary": "Immune function, wound healing, taste, protein synthesis.", "deficiency_symptoms": "Impaired immunity, slow wound healing, hair loss.", "toxicity_threshold": 40, "cofactors": [], "absorption_notes": "Phytates (grains, legumes) inhibit absorption — soaking helps." },
  { "slug": "copper", "name": "Copper", "category": "trace_mineral", "rda_male": 0.9, "rda_female": 0.9, "unit": "mg", "function_summary": "Iron metabolism, connective tissue, antioxidant enzymes.", "deficiency_symptoms": "Anemia (iron-resistant), neutropenia.", "toxicity_threshold": 10, "cofactors": ["zinc"], "absorption_notes": "Excess zinc supplementation blocks copper." },
  { "slug": "manganese", "name": "Manganese", "category": "trace_mineral", "rda_male": 2.3, "rda_female": 1.8, "unit": "mg", "function_summary": "Antioxidant enzymes (MnSOD), bone formation.", "deficiency_symptoms": "Rare; impaired growth.", "toxicity_threshold": 11, "cofactors": [], "absorption_notes": "Whole grains and nuts are top sources." },
  { "slug": "iodine", "name": "Iodine", "category": "trace_mineral", "rda_male": 150, "rda_female": 150, "unit": "mcg", "function_summary": "Thyroid hormone synthesis.", "deficiency_symptoms": "Goiter, hypothyroidism, cretinism in offspring.", "toxicity_threshold": 1100, "cofactors": ["selenium"], "absorption_notes": "Sea vegetables and iodized salt are primary sources." },
  { "slug": "selenium", "name": "Selenium", "category": "trace_mineral", "rda_male": 55, "rda_female": 55, "unit": "mcg", "function_summary": "Glutathione peroxidase, thyroid hormone activation.", "deficiency_symptoms": "Keshan disease, hypothyroidism.", "toxicity_threshold": 400, "cofactors": ["iodine","vitamin-e"], "absorption_notes": "Brazil nuts are extraordinarily dense — 2 nuts often exceed RDA." },
  { "slug": "molybdenum", "name": "Molybdenum", "category": "trace_mineral", "rda_male": 45, "rda_female": 45, "unit": "mcg", "function_summary": "Cofactor for sulfite oxidase, xanthine oxidase.", "deficiency_symptoms": "Extremely rare.", "toxicity_threshold": 2000, "cofactors": [], "absorption_notes": "Legumes are top sources." },
  { "slug": "chromium", "name": "Chromium", "category": "trace_mineral", "rda_male": 35, "rda_female": 25, "unit": "mcg", "function_summary": "Enhances insulin action.", "deficiency_symptoms": "Impaired glucose tolerance.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Trace amounts in many whole foods." },
  { "slug": "fluoride", "name": "Fluoride", "category": "trace_mineral", "rda_male": 4, "rda_female": 3, "unit": "mg", "function_summary": "Tooth and bone mineralization.", "deficiency_symptoms": "Increased dental caries.", "toxicity_threshold": 10, "cofactors": [], "absorption_notes": "Most from fluoridated water." },

  { "slug": "histidine", "name": "Histidine", "category": "essential_amino_acid", "rda_male": 14, "rda_female": 14, "unit": "mg/kg", "function_summary": "Histamine precursor, hemoglobin synthesis.", "deficiency_symptoms": "Eczema-like rash.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Essential during growth and recovery." },
  { "slug": "isoleucine", "name": "Isoleucine", "category": "essential_amino_acid", "rda_male": 19, "rda_female": 19, "unit": "mg/kg", "function_summary": "BCAA, muscle metabolism.", "deficiency_symptoms": "Muscle wasting.", "toxicity_threshold": null, "cofactors": ["leucine","valine"], "absorption_notes": "" },
  { "slug": "leucine", "name": "Leucine", "category": "essential_amino_acid", "rda_male": 42, "rda_female": 42, "unit": "mg/kg", "function_summary": "BCAA, mTOR signaling, muscle protein synthesis.", "deficiency_symptoms": "Reduced muscle synthesis.", "toxicity_threshold": null, "cofactors": ["isoleucine","valine"], "absorption_notes": "" },
  { "slug": "lysine", "name": "Lysine", "category": "essential_amino_acid", "rda_male": 38, "rda_female": 38, "unit": "mg/kg", "function_summary": "Collagen synthesis, carnitine production, calcium absorption.", "deficiency_symptoms": "Fatigue, poor concentration, slow growth.", "toxicity_threshold": null, "cofactors": ["vitamin-c"], "absorption_notes": "Limiting AA in cereal grains — pair with legumes." },
  { "slug": "methionine", "name": "Methionine", "category": "essential_amino_acid", "rda_male": 19, "rda_female": 19, "unit": "mg/kg", "function_summary": "Methyl donor (SAMe), sulfur source.", "deficiency_symptoms": "Rare; impaired methylation.", "toxicity_threshold": null, "cofactors": ["vitamin-b12","folate"], "absorption_notes": "Limiting AA in legumes — pair with grains." },
  { "slug": "phenylalanine", "name": "Phenylalanine", "category": "essential_amino_acid", "rda_male": 33, "rda_female": 33, "unit": "mg/kg", "function_summary": "Tyrosine and catecholamine precursor.", "deficiency_symptoms": "Rare.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Contraindicated in PKU." },
  { "slug": "threonine", "name": "Threonine", "category": "essential_amino_acid", "rda_male": 20, "rda_female": 20, "unit": "mg/kg", "function_summary": "Mucin and collagen formation.", "deficiency_symptoms": "Rare.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "" },
  { "slug": "tryptophan", "name": "Tryptophan", "category": "essential_amino_acid", "rda_male": 5, "rda_female": 5, "unit": "mg/kg", "function_summary": "Serotonin and niacin precursor.", "deficiency_symptoms": "Low mood, pellagra-like symptoms.", "toxicity_threshold": null, "cofactors": ["vitamin-b6"], "absorption_notes": "Limiting AA in many plant proteins." },
  { "slug": "valine", "name": "Valine", "category": "essential_amino_acid", "rda_male": 24, "rda_female": 24, "unit": "mg/kg", "function_summary": "BCAA, muscle energy metabolism.", "deficiency_symptoms": "Rare.", "toxicity_threshold": null, "cofactors": ["leucine","isoleucine"], "absorption_notes": "" },

  { "slug": "arginine", "name": "Arginine", "category": "conditionally_essential_aa", "rda_male": null, "rda_female": null, "unit": "g", "function_summary": "Nitric oxide precursor, wound healing.", "deficiency_symptoms": "Slow wound healing under stress.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Essential during illness or recovery." },
  { "slug": "cysteine", "name": "Cysteine", "category": "conditionally_essential_aa", "rda_male": null, "rda_female": null, "unit": "mg/kg", "function_summary": "Glutathione precursor, sulfur source.", "deficiency_symptoms": "Reduced antioxidant capacity.", "toxicity_threshold": null, "cofactors": ["methionine"], "absorption_notes": "" },
  { "slug": "glutamine", "name": "Glutamine", "category": "conditionally_essential_aa", "rda_male": null, "rda_female": null, "unit": "g", "function_summary": "Gut barrier, immune cell fuel.", "deficiency_symptoms": "Impaired gut integrity under stress.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Essential after trauma or surgery." },
  { "slug": "glycine", "name": "Glycine", "category": "conditionally_essential_aa", "rda_male": null, "rda_female": null, "unit": "g", "function_summary": "Collagen building block, inhibitory neurotransmitter.", "deficiency_symptoms": "Reduced collagen synthesis.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Abundant in bone broth and skin/connective tissues." },
  { "slug": "proline", "name": "Proline", "category": "conditionally_essential_aa", "rda_male": null, "rda_female": null, "unit": "g", "function_summary": "Collagen, joint and skin tissue.", "deficiency_symptoms": "Slow wound healing.", "toxicity_threshold": null, "cofactors": ["vitamin-c"], "absorption_notes": "" },
  { "slug": "tyrosine", "name": "Tyrosine", "category": "conditionally_essential_aa", "rda_male": null, "rda_female": null, "unit": "mg/kg", "function_summary": "Catecholamine and thyroid hormone precursor.", "deficiency_symptoms": "Possible mood/focus effects under stress.", "toxicity_threshold": null, "cofactors": ["iron","vitamin-b6"], "absorption_notes": "" },

  { "slug": "omega-3-ala", "name": "Alpha-Linolenic Acid (ALA)", "category": "essential_fatty_acid", "rda_male": 1.6, "rda_female": 1.1, "unit": "g", "function_summary": "Parent omega-3, converts (poorly) to EPA/DHA.", "deficiency_symptoms": "Dry skin, scaly rash, poor growth.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Conversion to EPA/DHA is <10% in humans." },
  { "slug": "omega-3-epa", "name": "Eicosapentaenoic Acid (EPA)", "category": "essential_fatty_acid", "rda_male": null, "rda_female": null, "unit": "g", "function_summary": "Anti-inflammatory, cardiovascular support.", "deficiency_symptoms": "Increased inflammation markers.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "From fatty fish, algae oil." },
  { "slug": "omega-3-dha", "name": "Docosahexaenoic Acid (DHA)", "category": "essential_fatty_acid", "rda_male": null, "rda_female": null, "unit": "g", "function_summary": "Brain and retinal structure, neurological development.", "deficiency_symptoms": "Cognitive and visual impairment in deficiency.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Fatty fish, algae oil." },
  { "slug": "omega-6", "name": "Linoleic Acid (Omega-6)", "category": "essential_fatty_acid", "rda_male": 17, "rda_female": 12, "unit": "g", "function_summary": "Cell membrane structure, eicosanoid synthesis.", "deficiency_symptoms": "Rare in modern diets.", "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Most Western diets over-consume vs omega-3." },

  { "slug": "ashwagandha", "name": "Ashwagandha (Withania somnifera withanolides)", "category": "adaptogen", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Stress modulation (cortisol-lowering), HPA axis support.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Standardized to 2.5–5% withanolides in trials." },
  { "slug": "rhodiola", "name": "Rhodiola rosea (rosavins/salidroside)", "category": "adaptogen", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Mental fatigue resistance, mood support.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Standardized to 3% rosavins / 1% salidroside." },
  { "slug": "reishi", "name": "Reishi (Ganoderma lucidum triterpenes/beta-glucans)", "category": "adaptogen", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Immune modulation, sleep quality.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Dual extraction (water + alcohol) recommended." },
  { "slug": "cordyceps", "name": "Cordyceps (militaris/sinensis cordycepin)", "category": "adaptogen", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Aerobic capacity, ATP production.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Look for ≥0.2% cordycepin." },
  { "slug": "holy-basil", "name": "Holy Basil (Ocimum sanctum)", "category": "adaptogen", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Cortisol modulation, glycemic support.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Also called Tulsi." },
  { "slug": "schisandra", "name": "Schisandra chinensis (schisandrins)", "category": "adaptogen", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Liver support, stress endurance.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Five-flavor berry." },
  { "slug": "eleuthero", "name": "Eleuthero (Eleutherococcus senticosus)", "category": "adaptogen", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Endurance, immune support.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Often called Siberian ginseng." },
  { "slug": "maca", "name": "Maca (Lepidium meyenii)", "category": "adaptogen", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Hormonal balance, energy.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Gelatinized form is easier to digest." },

  { "slug": "sulforaphane", "name": "Sulforaphane", "category": "phytonutrient", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Nrf2 activator, phase II detox enzymes.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Form is precursor glucoraphanin; myrosinase enzyme (raw or briefly steamed) needed." },
  { "slug": "lycopene", "name": "Lycopene", "category": "phytonutrient", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Carotenoid antioxidant, prostate and cardiovascular support.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Heat and fat dramatically improve absorption." },
  { "slug": "anthocyanins", "name": "Anthocyanins", "category": "phytonutrient", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Vascular and cognitive support.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Found in deep-blue/purple/red plant pigments." },
  { "slug": "curcumin", "name": "Curcumin", "category": "phytonutrient", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Anti-inflammatory, NF-kB modulation.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": [], "absorption_notes": "Piperine (black pepper) increases bioavailability ~20x." },
  { "slug": "egcg", "name": "EGCG (Epigallocatechin gallate)", "category": "phytonutrient", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Catechin antioxidant, metabolic support.", "deficiency_symptoms": null, "toxicity_threshold": 800, "cofactors": [], "absorption_notes": "Heat-sensitive — steep green tea below 80°C." },
  { "slug": "quercetin", "name": "Quercetin", "category": "phytonutrient", "rda_male": null, "rda_female": null, "unit": "mg", "function_summary": "Flavonoid antioxidant, mast-cell stabilizer.", "deficiency_symptoms": null, "toxicity_threshold": null, "cofactors": ["vitamin-c"], "absorption_notes": "" }
]
```

- [ ] **Step 2: Commit**

```powershell
git add src/data/nutrients.json
git commit -m "data: full curated nutrient catalog (vitamins, minerals, AAs, FAs, adaptogens, phytonutrients)"
```

---

## Task 10: Seed nutrients script

**Files:**
- Create: `scripts/seed-nutrients.ts`

- [ ] **Step 1: Write the script**

```typescript
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { nutrients } from '../src/lib/schema';

type NutrientRow = {
  slug: string;
  name: string;
  category: typeof nutrients.$inferInsert.category;
  rda_male: number | null;
  rda_female: number | null;
  unit: string;
  function_summary: string | null;
  deficiency_symptoms: string | null;
  toxicity_threshold: number | null;
  cofactors: string[];
  absorption_notes: string | null;
};

export async function seedNutrients() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const path = resolve(process.cwd(), 'src/data/nutrients.json');
  const rows: NutrientRow[] = JSON.parse(readFileSync(path, 'utf8'));

  console.log(`Seeding ${rows.length} nutrients…`);

  for (const r of rows) {
    await db
      .insert(nutrients)
      .values({
        slug: r.slug,
        name: r.name,
        category: r.category,
        rdaMale: r.rda_male !== null ? String(r.rda_male) : null,
        rdaFemale: r.rda_female !== null ? String(r.rda_female) : null,
        unit: r.unit,
        functionSummary: r.function_summary,
        deficiencySymptoms: r.deficiency_symptoms,
        toxicityThreshold: r.toxicity_threshold !== null ? String(r.toxicity_threshold) : null,
        cofactors: r.cofactors,
        absorptionNotes: r.absorption_notes,
      })
      .onConflictDoUpdate({
        target: nutrients.slug,
        set: {
          name: r.name,
          category: r.category,
          rdaMale: r.rda_male !== null ? String(r.rda_male) : null,
          rdaFemale: r.rda_female !== null ? String(r.rda_female) : null,
          unit: r.unit,
          functionSummary: r.function_summary,
          deficiencySymptoms: r.deficiency_symptoms,
          toxicityThreshold: r.toxicity_threshold !== null ? String(r.toxicity_threshold) : null,
          cofactors: r.cofactors,
          absorptionNotes: r.absorption_notes,
        },
      });
  }

  console.log('Nutrients seeded.');
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  seedNutrients().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Run it directly**

```powershell
pnpm tsx scripts/seed-nutrients.ts
```

Expected: `Seeding 56 nutrients…` (or whatever your final count is), `Nutrients seeded.`

- [ ] **Step 3: Verify in psql / Neon console**

```sql
select count(*) from nutrients;
select slug, category from nutrients where category = 'adaptogen';
```

Expected: 56 rows, 8 adaptogens.

- [ ] **Step 4: Commit**

```powershell
git add scripts/seed-nutrients.ts
git commit -m "feat(seed): nutrients seed script (idempotent upsert)"
```

---

## Task 11: USDA FDC ID curated list

**Files:**
- Create: `src/data/usda-food-ids.json`

- [ ] **Step 1: Write a one-off helper to fetch Foundation Foods**

This is an exploratory script — keep it in `scripts/list-foundation-foods.ts` so we can re-run later.

```typescript
import 'dotenv/config';
import { writeFileSync } from 'node:fs';

const KEY = process.env.USDA_API_KEY!;
const BASE = 'https://api.nal.usda.gov/fdc/v1';

type ListItem = { fdcId: number; description: string; foodCategory?: string };

async function main() {
  // Foundation Foods page through results
  const items: ListItem[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${BASE}/foods/list?dataType=Foundation&pageSize=200&pageNumber=${page}&api_key=${KEY}`);
    if (!res.ok) throw new Error(`USDA ${res.status} ${await res.text()}`);
    const batch = (await res.json()) as ListItem[];
    if (batch.length === 0) break;
    items.push(...batch);
    if (batch.length < 200) break;
    page++;
  }
  console.log(`Foundation Foods: ${items.length}`);
  writeFileSync('src/data/usda-foundation-list.json', JSON.stringify(items, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run:

```powershell
pnpm tsx scripts/list-foundation-foods.ts
```

Expected: ~250 items dumped to `usda-foundation-list.json`.

- [ ] **Step 2: Build `src/data/usda-food-ids.json` by hand-mapping**

Pick the Foundation Foods that map cleanly to our `food_category` enum. Schema for each entry:

```json
{ "fdc_id": 169967, "name": "Broccoli, raw", "category": "vegetable", "serving_size_g": 91, "serving_description": "1 cup chopped" }
```

Aim for a balanced ~250 entries spanning all 12 `food_category` values. Use the descriptions from the Foundation list verbatim where possible. Then add ~50 SR Legacy fillers for common foods Foundation lacks (use FDC search UI to find IDs).

The full file is long; paste-in template structure:

```json
[
  { "fdc_id": 169967, "name": "Broccoli, raw", "category": "vegetable", "serving_size_g": 91, "serving_description": "1 cup chopped" },
  { "fdc_id": 168462, "name": "Spinach, raw", "category": "leafy_green", "serving_size_g": 30, "serving_description": "1 cup" },
  { "fdc_id": 173946, "name": "Brazil nuts, raw", "category": "nut", "serving_size_g": 28, "serving_description": "1 oz (about 6 nuts)" },
  { "fdc_id": 175140, "name": "Lentils, raw", "category": "legume", "serving_size_g": 50, "serving_description": "1/4 cup dry" }
  /* ...continue, target 250+ */
]
```

The implementer fills this out to ≥250 entries from the Foundation list, then adds ~50 SR Legacy fillers for foods like "beef, grass-fed", "wild salmon", "kefir", etc.

- [ ] **Step 3: Commit**

```powershell
git add src/data/usda-food-ids.json scripts/list-foundation-foods.ts src/data/usda-foundation-list.json
git commit -m "data: curated USDA FDC ID list (~300 foods spanning all categories)"
```

---

## Task 12: Seed foods from USDA

**Files:**
- Create: `scripts/seed-foods-usda.ts`

- [ ] **Step 1: Write the seed script**

```typescript
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { foods, foodNutrients, nutrients } from '../src/lib/schema';
import { usdaNumberToSlug } from '../src/lib/usda-mapping';
import { toSlug } from '../src/lib/slug';

type IdRow = { fdc_id: number; name: string; category: string; serving_size_g: number; serving_description: string };
type UsdaNutrient = { nutrient: { number: string; unitName: string }; amount?: number };
type UsdaFood = { fdcId: number; description: string; dataType?: string; foodNutrients?: UsdaNutrient[] };

const KEY = process.env.USDA_API_KEY!;
const BASE = 'https://api.nal.usda.gov/fdc/v1';

async function fetchFood(fdcId: number): Promise<UsdaFood> {
  const res = await fetch(`${BASE}/food/${fdcId}?api_key=${KEY}`);
  if (!res.ok) throw new Error(`USDA ${fdcId} failed: ${res.status}`);
  return res.json();
}

export async function seedFoodsUsda() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const ids: IdRow[] = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/usda-food-ids.json'), 'utf8'));

  // Build nutrient slug -> id lookup once
  const allNutrients = await db.select({ id: nutrients.id, slug: nutrients.slug }).from(nutrients);
  const slugToId = new Map(allNutrients.map((n) => [n.slug, n.id]));

  console.log(`Seeding ${ids.length} foods from USDA…`);

  for (const row of ids) {
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
    }

    console.log(`  ✓ ${row.name}`);
  }

  console.log('USDA foods seeded.');
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  seedFoodsUsda().catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 2: Run with USDA_API_KEY set**

```powershell
pnpm tsx scripts/seed-foods-usda.ts
```

Expected: takes a few minutes (~300 API calls); ends with `USDA foods seeded.`

- [ ] **Step 3: Verify in DB**

```sql
select count(*) from foods;
select count(*) from food_nutrients;
select slug, amount_per_100g from food_nutrients fn
  join foods f on f.id = fn.food_id
  join nutrients n on n.id = fn.nutrient_id
  where n.slug = 'vitamin-c'
  order by amount_per_100g::numeric desc
  limit 10;
```

Expected: foods ≈ 300, food_nutrients in the thousands, top vitamin-C sources should include things like guava, kale, kiwi.

- [ ] **Step 4: Commit**

```powershell
git add scripts/seed-foods-usda.ts
git commit -m "feat(seed): USDA FoodData Central seed for foods + food_nutrients"
```

---

## Task 13: Curated supplement data (adaptogens + phytonutrients)

**Files:**
- Create: `src/data/curated-foods.json`, `src/data/curated-food-nutrients.json`

- [ ] **Step 1: Write `src/data/curated-foods.json`**

These are foods USDA doesn't track well. Each row:

```json
[
  { "slug": "ashwagandha-root", "name": "Ashwagandha root powder", "category": "herb_adaptogen", "serving_size_g": 5, "serving_description": "1 tsp", "notes": "Standardized to 2.5–5% withanolides for clinical effect." },
  { "slug": "rhodiola-root", "name": "Rhodiola rosea root extract", "category": "herb_adaptogen", "serving_size_g": 0.5, "serving_description": "500 mg capsule", "notes": "Standardized to 3% rosavins, 1% salidroside." },
  { "slug": "reishi-mushroom", "name": "Reishi (Ganoderma lucidum) dual extract", "category": "mushroom", "serving_size_g": 2, "serving_description": "1 tsp powder", "notes": "Hot water + alcohol extract for full spectrum." },
  { "slug": "cordyceps-militaris", "name": "Cordyceps militaris extract", "category": "mushroom", "serving_size_g": 1, "serving_description": "1 g powder" },
  { "slug": "holy-basil-leaf", "name": "Holy basil (Tulsi) leaf", "category": "herb_adaptogen", "serving_size_g": 2, "serving_description": "2 g dried leaf" },
  { "slug": "schisandra-berry", "name": "Schisandra chinensis berry", "category": "herb_adaptogen", "serving_size_g": 3, "serving_description": "3 g dried berry" },
  { "slug": "eleuthero-root", "name": "Eleuthero root", "category": "herb_adaptogen", "serving_size_g": 2, "serving_description": "2 g dried root" },
  { "slug": "maca-root", "name": "Gelatinized maca root powder", "category": "herb_adaptogen", "serving_size_g": 5, "serving_description": "1 tsp" },
  { "slug": "broccoli-sprouts", "name": "Broccoli sprouts (3-day)", "category": "vegetable", "serving_size_g": 30, "serving_description": "1 oz", "notes": "Sulforaphane content peaks at 3 days." },
  { "slug": "turmeric-fresh", "name": "Fresh turmeric rhizome", "category": "herb_adaptogen", "serving_size_g": 5, "serving_description": "1 tsp grated" },
  { "slug": "matcha-green-tea", "name": "Matcha green tea (ceremonial grade)", "category": "herb_adaptogen", "serving_size_g": 2, "serving_description": "1 tsp" },
  { "slug": "wild-blueberries", "name": "Wild blueberries (Vaccinium angustifolium)", "category": "fruit", "serving_size_g": 100, "serving_description": "1 cup", "notes": "Higher anthocyanin density than cultivated blueberries." }
]
```

- [ ] **Step 2: Write `src/data/curated-food-nutrients.json`**

Each row pairs a curated food with a nutrient. Values are best-available peer-reviewed estimates; `citation_url` is **required**.

```json
[
  { "food_slug": "ashwagandha-root", "nutrient_slug": "ashwagandha", "amount_per_100g": 3000, "preparation_notes": "Root powder", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/31810321/" },
  { "food_slug": "rhodiola-root", "nutrient_slug": "rhodiola", "amount_per_100g": 30000, "preparation_notes": "3% rosavins extract", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/22228617/" },
  { "food_slug": "reishi-mushroom", "nutrient_slug": "reishi", "amount_per_100g": 25000, "preparation_notes": "Dual extract", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/29953363/" },
  { "food_slug": "cordyceps-militaris", "nutrient_slug": "cordyceps", "amount_per_100g": 2000, "preparation_notes": "0.2% cordycepin minimum", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/31035818/" },
  { "food_slug": "holy-basil-leaf", "nutrient_slug": "holy-basil", "amount_per_100g": 4000, "preparation_notes": "Dried leaf", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/28400848/" },
  { "food_slug": "schisandra-berry", "nutrient_slug": "schisandra", "amount_per_100g": 5000, "preparation_notes": "Dried berry, ≥2% schisandrins", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/29325769/" },
  { "food_slug": "eleuthero-root", "nutrient_slug": "eleuthero", "amount_per_100g": 8000, "preparation_notes": "Standardized 0.8% eleutherosides", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/22228617/" },
  { "food_slug": "maca-root", "nutrient_slug": "maca", "amount_per_100g": 1500, "preparation_notes": "Gelatinized whole-root powder", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/27548190/" },
  { "food_slug": "broccoli-sprouts", "nutrient_slug": "sulforaphane", "amount_per_100g": 100, "preparation_notes": "3-day sprouts, raw, with intact myrosinase", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/9294217/" },
  { "food_slug": "turmeric-fresh", "nutrient_slug": "curcumin", "amount_per_100g": 3000, "preparation_notes": "Fresh rhizome, ~3% curcuminoids", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/28197897/" },
  { "food_slug": "matcha-green-tea", "nutrient_slug": "egcg", "amount_per_100g": 6000, "preparation_notes": "Ceremonial grade, whole leaf", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/12695342/" },
  { "food_slug": "wild-blueberries", "nutrient_slug": "anthocyanins", "amount_per_100g": 487, "preparation_notes": "Frozen wild lowbush", "citation_url": "https://pubmed.ncbi.nlm.nih.gov/16190627/" }
]
```

The implementer may extend these lists with more peer-reviewed entries (e.g., red cabbage→anthocyanins, cooked tomato paste→lycopene, etc.), as long as every row has a citation.

- [ ] **Step 3: Commit**

```powershell
git add src/data/curated-foods.json src/data/curated-food-nutrients.json
git commit -m "data: curated adaptogen and phytonutrient foods with peer-reviewed citations"
```

---

## Task 14: Curated seed script

**Files:**
- Create: `scripts/seed-curated.ts`

- [ ] **Step 1: Write script**

```typescript
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { foods, foodNutrients, nutrients } from '../src/lib/schema';

type CuratedFood = { slug: string; name: string; category: typeof foods.$inferInsert.category; serving_size_g: number; serving_description: string; notes?: string };
type CuratedFN = { food_slug: string; nutrient_slug: string; amount_per_100g: number; preparation_notes?: string; citation_url: string };

export async function seedCurated() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const cf: CuratedFood[] = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/curated-foods.json'), 'utf8'));
  const cfn: CuratedFN[] = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/curated-food-nutrients.json'), 'utf8'));

  console.log(`Seeding ${cf.length} curated foods…`);
  for (const f of cf) {
    await db.insert(foods).values({
      slug: f.slug,
      name: f.name,
      category: f.category,
      servingSizeG: String(f.serving_size_g),
      servingDescription: f.serving_description,
      notes: f.notes ?? null,
    }).onConflictDoUpdate({
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

  const foodRows = await db.select({ id: foods.id, slug: foods.slug }).from(foods);
  const nutrientRows = await db.select({ id: nutrients.id, slug: nutrients.slug }).from(nutrients);
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
    const perServing = r.amount_per_100g * (serv / 100);
    await db.insert(foodNutrients).values({
      foodId: fid,
      nutrientId: nid,
      amountPer100g: String(r.amount_per_100g),
      amountPerServing: String(perServing),
      dataSource: 'curated',
      preparationNotes: r.preparation_notes ?? null,
      citationUrl: r.citation_url,
    }).onConflictDoUpdate({
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

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  seedCurated().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Run**

```powershell
pnpm tsx scripts/seed-curated.ts
```

Expected: `Curated data seeded.`

- [ ] **Step 3: Verify**

```sql
select n.slug, f.name, fn.amount_per_100g, fn.citation_url
from food_nutrients fn
join foods f on f.id = fn.food_id
join nutrients n on n.id = fn.nutrient_id
where fn.data_source = 'curated';
```

Expected: 12+ rows, every one with a `citation_url`.

- [ ] **Step 4: Commit**

```powershell
git add scripts/seed-curated.ts
git commit -m "feat(seed): curated adaptogens + phytonutrients seed script"
```

---

## Task 15: Symptoms data + seed

**Files:**
- Create: `src/data/symptoms.json`, `src/data/symptom-nutrients.json`, `scripts/seed-symptoms.ts`

- [ ] **Step 1: Write `src/data/symptoms.json`**

```json
[
  { "slug": "fatigue", "name": "Fatigue", "description": "Persistent low energy not relieved by sleep." },
  { "slug": "poor-sleep", "name": "Poor sleep / insomnia", "description": "Trouble falling or staying asleep." },
  { "slug": "muscle-cramps", "name": "Muscle cramps", "description": "Painful involuntary muscle contractions, especially at night or post-exercise." },
  { "slug": "brittle-nails", "name": "Brittle nails", "description": "Splitting, peeling, or slow-growing fingernails." },
  { "slug": "hair-loss", "name": "Hair thinning or shedding", "description": "Diffuse hair loss not from a defined medical cause." },
  { "slug": "low-mood", "name": "Low mood", "description": "Persistent mild depressive feelings without major depression diagnosis." },
  { "slug": "anxiety", "name": "Anxiety", "description": "Elevated baseline worry or rumination." },
  { "slug": "frequent-illness", "name": "Frequent colds / infections", "description": "More than 4 minor infections per year." },
  { "slug": "slow-wound-healing", "name": "Slow wound healing", "description": "Cuts and scrapes that take longer than usual to close." },
  { "slug": "cold-intolerance", "name": "Cold intolerance", "description": "Feeling cold easily, especially hands and feet." },
  { "slug": "brain-fog", "name": "Brain fog", "description": "Difficulty concentrating, mental sluggishness." },
  { "slug": "weak-bones", "name": "Bone density concerns", "description": "Osteopenia / osteoporosis risk or family history." }
]
```

- [ ] **Step 2: Write `src/data/symptom-nutrients.json`**

`strength` is 1–5 evidence weight (5 = strong RCT evidence, 1 = mechanistic/anecdotal).

```json
[
  { "symptom_slug": "fatigue", "nutrient_slug": "iron", "strength": 5 },
  { "symptom_slug": "fatigue", "nutrient_slug": "vitamin-b12", "strength": 5 },
  { "symptom_slug": "fatigue", "nutrient_slug": "vitamin-d", "strength": 4 },
  { "symptom_slug": "fatigue", "nutrient_slug": "magnesium", "strength": 3 },
  { "symptom_slug": "fatigue", "nutrient_slug": "vitamin-c", "strength": 3 },
  { "symptom_slug": "fatigue", "nutrient_slug": "rhodiola", "strength": 4 },
  { "symptom_slug": "fatigue", "nutrient_slug": "cordyceps", "strength": 3 },

  { "symptom_slug": "poor-sleep", "nutrient_slug": "magnesium", "strength": 4 },
  { "symptom_slug": "poor-sleep", "nutrient_slug": "vitamin-d", "strength": 3 },
  { "symptom_slug": "poor-sleep", "nutrient_slug": "ashwagandha", "strength": 4 },
  { "symptom_slug": "poor-sleep", "nutrient_slug": "reishi", "strength": 3 },
  { "symptom_slug": "poor-sleep", "nutrient_slug": "glycine", "strength": 3 },

  { "symptom_slug": "muscle-cramps", "nutrient_slug": "magnesium", "strength": 4 },
  { "symptom_slug": "muscle-cramps", "nutrient_slug": "potassium", "strength": 4 },
  { "symptom_slug": "muscle-cramps", "nutrient_slug": "calcium", "strength": 3 },
  { "symptom_slug": "muscle-cramps", "nutrient_slug": "sodium", "strength": 3 },

  { "symptom_slug": "brittle-nails", "nutrient_slug": "vitamin-b7", "strength": 4 },
  { "symptom_slug": "brittle-nails", "nutrient_slug": "iron", "strength": 3 },
  { "symptom_slug": "brittle-nails", "nutrient_slug": "zinc", "strength": 3 },

  { "symptom_slug": "hair-loss", "nutrient_slug": "iron", "strength": 4 },
  { "symptom_slug": "hair-loss", "nutrient_slug": "zinc", "strength": 4 },
  { "symptom_slug": "hair-loss", "nutrient_slug": "vitamin-d", "strength": 3 },
  { "symptom_slug": "hair-loss", "nutrient_slug": "vitamin-b7", "strength": 2 },

  { "symptom_slug": "low-mood", "nutrient_slug": "vitamin-d", "strength": 4 },
  { "symptom_slug": "low-mood", "nutrient_slug": "omega-3-epa", "strength": 4 },
  { "symptom_slug": "low-mood", "nutrient_slug": "vitamin-b12", "strength": 3 },
  { "symptom_slug": "low-mood", "nutrient_slug": "vitamin-b9", "strength": 3 },
  { "symptom_slug": "low-mood", "nutrient_slug": "rhodiola", "strength": 3 },

  { "symptom_slug": "anxiety", "nutrient_slug": "magnesium", "strength": 3 },
  { "symptom_slug": "anxiety", "nutrient_slug": "ashwagandha", "strength": 4 },
  { "symptom_slug": "anxiety", "nutrient_slug": "holy-basil", "strength": 3 },
  { "symptom_slug": "anxiety", "nutrient_slug": "omega-3-epa", "strength": 3 },

  { "symptom_slug": "frequent-illness", "nutrient_slug": "vitamin-c", "strength": 4 },
  { "symptom_slug": "frequent-illness", "nutrient_slug": "vitamin-d", "strength": 4 },
  { "symptom_slug": "frequent-illness", "nutrient_slug": "zinc", "strength": 4 },
  { "symptom_slug": "frequent-illness", "nutrient_slug": "selenium", "strength": 3 },
  { "symptom_slug": "frequent-illness", "nutrient_slug": "reishi", "strength": 3 },

  { "symptom_slug": "slow-wound-healing", "nutrient_slug": "vitamin-c", "strength": 4 },
  { "symptom_slug": "slow-wound-healing", "nutrient_slug": "zinc", "strength": 4 },
  { "symptom_slug": "slow-wound-healing", "nutrient_slug": "vitamin-a", "strength": 3 },
  { "symptom_slug": "slow-wound-healing", "nutrient_slug": "lysine", "strength": 3 },
  { "symptom_slug": "slow-wound-healing", "nutrient_slug": "proline", "strength": 2 },

  { "symptom_slug": "cold-intolerance", "nutrient_slug": "iron", "strength": 4 },
  { "symptom_slug": "cold-intolerance", "nutrient_slug": "iodine", "strength": 4 },
  { "symptom_slug": "cold-intolerance", "nutrient_slug": "selenium", "strength": 3 },

  { "symptom_slug": "brain-fog", "nutrient_slug": "vitamin-b12", "strength": 4 },
  { "symptom_slug": "brain-fog", "nutrient_slug": "iron", "strength": 3 },
  { "symptom_slug": "brain-fog", "nutrient_slug": "omega-3-dha", "strength": 4 },
  { "symptom_slug": "brain-fog", "nutrient_slug": "vitamin-d", "strength": 3 },

  { "symptom_slug": "weak-bones", "nutrient_slug": "calcium", "strength": 5 },
  { "symptom_slug": "weak-bones", "nutrient_slug": "vitamin-d", "strength": 5 },
  { "symptom_slug": "weak-bones", "nutrient_slug": "vitamin-k", "strength": 4 },
  { "symptom_slug": "weak-bones", "nutrient_slug": "magnesium", "strength": 3 },
  { "symptom_slug": "weak-bones", "nutrient_slug": "phosphorus", "strength": 3 }
]
```

- [ ] **Step 3: Write `scripts/seed-symptoms.ts`**

```typescript
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { symptoms, symptomNutrients, nutrients } from '../src/lib/schema';

type SymptomRow = { slug: string; name: string; description: string };
type LinkRow = { symptom_slug: string; nutrient_slug: string; strength: number };

export async function seedSymptoms() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const sym: SymptomRow[] = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/symptoms.json'), 'utf8'));
  const links: LinkRow[] = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/symptom-nutrients.json'), 'utf8'));

  console.log(`Seeding ${sym.length} symptoms…`);
  for (const s of sym) {
    await db.insert(symptoms).values(s).onConflictDoUpdate({
      target: symptoms.slug,
      set: { name: s.name, description: s.description },
    });
  }

  const sRows = await db.select({ id: symptoms.id, slug: symptoms.slug }).from(symptoms);
  const nRows = await db.select({ id: nutrients.id, slug: nutrients.slug }).from(nutrients);
  const sIdx = new Map(sRows.map((r) => [r.slug, r.id]));
  const nIdx = new Map(nRows.map((r) => [r.slug, r.id]));

  console.log(`Seeding ${links.length} symptom_nutrient links…`);
  for (const l of links) {
    const sid = sIdx.get(l.symptom_slug);
    const nid = nIdx.get(l.nutrient_slug);
    if (!sid || !nid) {
      console.warn(`Skipping ${l.symptom_slug} / ${l.nutrient_slug} — missing reference`);
      continue;
    }
    await db.insert(symptomNutrients).values({
      symptomId: sid,
      nutrientId: nid,
      strength: l.strength,
    }).onConflictDoUpdate({
      target: [symptomNutrients.symptomId, symptomNutrients.nutrientId],
      set: { strength: l.strength },
    });
  }
  console.log('Symptoms seeded.');
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  seedSymptoms().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Run**

```powershell
pnpm tsx scripts/seed-symptoms.ts
```

- [ ] **Step 5: Commit**

```powershell
git add src/data/symptoms.json src/data/symptom-nutrients.json scripts/seed-symptoms.ts
git commit -m "feat(seed): symptoms + symptom_nutrients seed and data"
```

---

## Task 16: Nutrient interactions data + seed

**Files:**
- Create: `src/data/nutrient-interactions.json`, `scripts/seed-interactions.ts`

- [ ] **Step 1: Write `src/data/nutrient-interactions.json`**

```json
[
  { "a": "vitamin-c", "b": "iron", "kind": "synergy", "notes": "Vitamin C reduces non-heme iron to its more absorbable ferrous form, increasing absorption 2-3x.", "citation": "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/" },
  { "a": "calcium", "b": "iron", "kind": "antagonist", "notes": "Calcium competes with iron for absorption when consumed together. Separate by 1-2 hours.", "citation": "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/" },
  { "a": "calcium", "b": "vitamin-d", "kind": "synergy", "notes": "Vitamin D upregulates intestinal calcium absorption.", "citation": "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/" },
  { "a": "calcium", "b": "vitamin-k", "kind": "synergy", "notes": "Vitamin K activates osteocalcin, directing calcium to bone instead of soft tissue.", "citation": "https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/" },
  { "a": "vitamin-d", "b": "magnesium", "kind": "cofactor", "notes": "Magnesium is required to activate vitamin D in the liver and kidney.", "citation": "https://pubmed.ncbi.nlm.nih.gov/29480918/" },
  { "a": "vitamin-a", "b": "zinc", "kind": "cofactor", "notes": "Zinc is required for retinol-binding protein synthesis; deficiency mimics vitamin A deficiency.", "citation": "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/" },
  { "a": "zinc", "b": "copper", "kind": "antagonist", "notes": "Long-term high-dose zinc (>40 mg/day) depletes copper via metallothionein induction.", "citation": "https://ods.od.nih.gov/factsheets/Copper-HealthProfessional/" },
  { "a": "zinc", "b": "vitamin-c", "kind": "synergy", "notes": "Both support immune function; co-supplementation common in cold studies.", "citation": "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/" },
  { "a": "iodine", "b": "selenium", "kind": "cofactor", "notes": "Selenium-dependent deiodinases convert T4 to active T3.", "citation": "https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/" },
  { "a": "vitamin-b9", "b": "vitamin-b12", "kind": "cofactor", "notes": "B12 is required to recycle folate; B12 deficiency causes functional folate trap.", "citation": "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/" },
  { "a": "vitamin-e", "b": "selenium", "kind": "synergy", "notes": "Both protect lipid membranes; selenium-dependent glutathione peroxidase regenerates vitamin E.", "citation": "https://pubmed.ncbi.nlm.nih.gov/3326350/" },
  { "a": "vitamin-a", "b": "vitamin-d", "kind": "antagonist", "notes": "At very high doses, vitamin A blunts vitamin D's signaling on the VDR.", "citation": "https://pubmed.ncbi.nlm.nih.gov/10617969/" },
  { "a": "vitamin-k", "b": "vitamin-d", "kind": "synergy", "notes": "Together direct calcium to bone and away from arteries.", "citation": "https://pubmed.ncbi.nlm.nih.gov/28428077/" },
  { "a": "curcumin", "b": "vitamin-e", "kind": "synergy", "notes": "Both reduce oxidative damage; lipophilic so absorbed together with fat.", "citation": "https://pubmed.ncbi.nlm.nih.gov/19594223/" }
]
```

- [ ] **Step 2: Write `scripts/seed-interactions.ts`**

```typescript
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq } from 'drizzle-orm';
import { nutrientInteractions, nutrients } from '../src/lib/schema';

type IxRow = { a: string; b: string; kind: 'synergy' | 'antagonist' | 'cofactor'; notes: string; citation: string };

export async function seedInteractions() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const rows: IxRow[] = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/nutrient-interactions.json'), 'utf8'));
  const nRows = await db.select({ id: nutrients.id, slug: nutrients.slug }).from(nutrients);
  const nIdx = new Map(nRows.map((r) => [r.slug, r.id]));

  // Naive idempotency: clear then insert. Acceptable for small table; preserves PK shape.
  await db.delete(nutrientInteractions);

  console.log(`Seeding ${rows.length} nutrient interactions…`);
  for (const r of rows) {
    const a = nIdx.get(r.a);
    const b = nIdx.get(r.b);
    if (!a || !b) {
      console.warn(`Skipping ${r.a} <-> ${r.b} — missing nutrient`);
      continue;
    }
    await db.insert(nutrientInteractions).values({
      nutrientAId: a,
      nutrientBId: b,
      kind: r.kind,
      notes: r.notes,
      citationUrl: r.citation,
    });
  }
  console.log('Interactions seeded.');
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  seedInteractions().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 3: Run**

```powershell
pnpm tsx scripts/seed-interactions.ts
```

- [ ] **Step 4: Commit**

```powershell
git add src/data/nutrient-interactions.json scripts/seed-interactions.ts
git commit -m "feat(seed): nutrient_interactions seed (synergies, antagonists, cofactors)"
```

---

## Task 17: Seed orchestrator

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: Write orchestrator**

```typescript
import 'dotenv/config';
import { seedNutrients } from './seed-nutrients';
import { seedFoodsUsda } from './seed-foods-usda';
import { seedCurated } from './seed-curated';
import { seedSymptoms } from './seed-symptoms';
import { seedInteractions } from './seed-interactions';

async function main() {
  await seedNutrients();
  await seedFoodsUsda();
  await seedCurated();
  await seedSymptoms();
  await seedInteractions();
  console.log('\nAll seeds complete.');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

This requires each seed-*.ts file to export its function with the name above. Confirm by grep-ing for `export async function seedNutrients` etc. — already done in earlier tasks.

- [ ] **Step 2: Run the full pipeline end-to-end on a fresh DB**

To test idempotency, run it twice:

```powershell
pnpm db:seed
pnpm db:seed
```

Expected: both runs succeed. Row counts identical after run 2.

- [ ] **Step 3: Commit**

```powershell
git add scripts/seed.ts
git commit -m "feat(seed): orchestrator runs all five seed scripts in order"
```

---

## Task 18: Ranking query (Nutrient → Food)

**Files:**
- Create: `src/lib/queries.ts`

- [ ] **Step 1: Write the ranking query with data_source precedence**

```typescript
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

const PRECEDENCE_CASE = sql`
  case fn.data_source
    when 'usda_foundation' then 1
    when 'usda_sr_legacy' then 2
    when 'curated' then 3
  end
`;

export async function rankFoodsByNutrient(
  nutrientSlug: string,
  basis: 'per_100g' | 'per_serving',
  categoryFilter: string | null,
  limit = 25,
): Promise<FoodRankRow[]> {
  const orderCol = basis === 'per_100g' ? sql`amount_per_100g` : sql`amount_per_serving`;

  // DISTINCT ON resolves multiple data_source rows by precedence; outer query ranks by amount.
  const rows = await db.execute<FoodRankRow>(sql`
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
  return rows as unknown as FoodRankRow[];
}

export async function getNutrient(slug: string) {
  return db.execute(sql`
    select id, slug, name, category::text as category, rda_male, rda_female, unit,
           function_summary, deficiency_symptoms, toxicity_threshold, cofactors, absorption_notes
    from nutrients
    where slug = ${slug}
    limit 1
  `).then((r: any) => (r as any[])[0] ?? null);
}

export async function listNutrients() {
  return db.execute(sql`
    select slug, name, category::text as category, unit
    from nutrients
    order by category, name
  `) as unknown as Promise<{ slug: string; name: string; category: string; unit: string }[]>;
}
```

- [ ] **Step 2: Sanity-check by writing a one-off probe script**

`scripts/probe-ranking.ts`:

```typescript
import 'dotenv/config';
import { rankFoodsByNutrient } from '../src/lib/queries';

async function main() {
  console.log('Top 10 vitamin-C per 100g:');
  const rows = await rankFoodsByNutrient('vitamin-c', 'per_100g', null, 10);
  for (const r of rows) {
    console.log(`  ${r.food_name.padEnd(50)} ${Number(r.amount_per_100g).toFixed(1).padStart(8)} mg`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run:

```powershell
pnpm tsx scripts/probe-ranking.ts
```

Expected: ordered list with the highest densities first (guava, kale, kiwi, broccoli, citrus, etc., depending on what's in your seed).

- [ ] **Step 3: Commit**

```powershell
git add src/lib/queries.ts scripts/probe-ranking.ts
git commit -m "feat(queries): rankFoodsByNutrient with data_source precedence"
```

---

## Task 19: Home + nutrient catalog page

**Files:**
- Create/Replace: `src/app/page.tsx`, `src/app/nutrient/page.tsx`

- [ ] **Step 1: Write the homepage**

`src/app/page.tsx`:

```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">WholeFood RX</h1>
      <p className="mt-3 text-lg text-slate-600">
        Pick a micronutrient — get the whole-food sources that deliver it best.
        Sourced from USDA FoodData Central and peer-reviewed literature. No supplement hype.
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/nutrient"
          className="rounded-md bg-slate-900 px-5 py-3 text-white hover:bg-slate-800"
        >
          Browse nutrients
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the nutrient catalog page**

`src/app/nutrient/page.tsx`:

```tsx
import Link from 'next/link';
import { listNutrients } from '@/lib/queries';

export const dynamic = 'force-dynamic';

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

export default async function NutrientIndex() {
  const all = await listNutrients();
  const grouped = new Map<string, typeof all>();
  for (const n of all) {
    const list = grouped.get(n.category) ?? [];
    list.push(n);
    grouped.set(n.category, list);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Nutrient catalog</h1>
      <p className="mt-2 text-slate-600">Click any nutrient to see top whole-food sources.</p>

      {Array.from(grouped.entries()).map(([cat, items]) => (
        <section key={cat} className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {CATEGORY_LABELS[cat] ?? cat}
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((n) => (
              <li key={n.slug}>
                <Link
                  href={`/nutrient/${n.slug}`}
                  className="block rounded-md border border-slate-200 px-4 py-3 hover:border-slate-400 hover:bg-slate-50"
                >
                  <div className="font-medium">{n.name}</div>
                  <div className="text-xs text-slate-500">{n.unit}</div>
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

- [ ] **Step 3: Verify in browser**

```powershell
pnpm dev
```

Open `http://localhost:3000` — see the hero. Click "Browse nutrients" — see all ~56 nutrients grouped by category. No console errors.

- [ ] **Step 4: Commit**

```powershell
git add src/app/page.tsx src/app/nutrient/page.tsx
git commit -m "feat(ui): home page and nutrient catalog index"
```

---

## Task 20: Nutrient → Food page (Feature #1 MVP)

**Files:**
- Create: `src/app/nutrient/[slug]/page.tsx`, `src/components/food-rank-row.tsx`, `src/components/nutrient-toggle.tsx`, `src/components/category-filter.tsx`

- [ ] **Step 1: Build the toggle client component**

`src/components/nutrient-toggle.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export function NutrientToggle({ basis }: { basis: 'per_100g' | 'per_serving' }) {
  const path = usePathname();
  const params = useSearchParams();
  const other = basis === 'per_100g' ? 'per_serving' : 'per_100g';
  const next = new URLSearchParams(params.toString());
  next.set('basis', other);
  return (
    <div className="inline-flex rounded-md border border-slate-300 text-sm">
      <button
        className={`px-3 py-1.5 ${basis === 'per_100g' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}
        disabled
      >
        per 100 g
      </button>
      <Link
        href={`${path}?${next.toString()}`}
        className={`px-3 py-1.5 ${basis === 'per_serving' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}
      >
        per serving
      </Link>
    </div>
  );
}
```

Note: this implementation shows the *unselected* button as a link and the selected one as a disabled button. Style cleanup is fine in follow-up.

- [ ] **Step 2: Build the category filter**

`src/components/category-filter.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const CATEGORIES = [
  'fruit','vegetable','leafy_green','nut','seed','legume','whole_grain',
  'herb_adaptogen','mushroom','animal_protein','seafood','dairy',
];

export function CategoryFilter({ active }: { active: string | null }) {
  const path = usePathname();
  const params = useSearchParams();
  const buildHref = (cat: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (cat) next.set('category', cat); else next.delete('category');
    return `${path}?${next.toString()}`;
  };
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Link
        href={buildHref(null)}
        className={`rounded-full border px-3 py-1 ${active === null ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}
      >
        all
      </Link>
      {CATEGORIES.map((c) => (
        <Link
          key={c}
          href={buildHref(c)}
          className={`rounded-full border px-3 py-1 ${active === c ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}
        >
          {c.replace('_', ' ')}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Build the row component**

`src/components/food-rank-row.tsx`:

```tsx
import Link from 'next/link';
import { pctRda } from '@/lib/rda';

type Props = {
  rank: number;
  food_slug: string;
  food_name: string;
  serving_description: string;
  amount_per_100g: string;
  amount_per_serving: string;
  data_source: string;
  citation_url: string | null;
  unit: string;
  rda: string | null;
  basis: 'per_100g' | 'per_serving';
};

export function FoodRankRow(p: Props) {
  const shown = p.basis === 'per_100g' ? Number(p.amount_per_100g) : Number(p.amount_per_serving);
  const pct = pctRda(p.amount_per_serving, p.rda);
  return (
    <li className="flex items-center justify-between border-b border-slate-100 py-3">
      <div className="flex items-baseline gap-3">
        <span className="w-6 text-right font-mono text-sm text-slate-400">{p.rank}.</span>
        <div>
          <div className="font-medium">{p.food_name}</div>
          <div className="text-xs text-slate-500">{p.serving_description}</div>
        </div>
      </div>
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-sm">
          {shown.toLocaleString(undefined, { maximumFractionDigits: 2 })} {p.unit}
        </span>
        {pct !== null && (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {pct}% RDA
          </span>
        )}
        {p.citation_url && (
          <Link href={p.citation_url} target="_blank" rel="noopener" className="text-xs text-slate-400 hover:text-slate-700">
            source
          </Link>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Build the page**

`src/app/nutrient/[slug]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNutrient, rankFoodsByNutrient } from '@/lib/queries';
import { FoodRankRow } from '@/components/food-rank-row';
import { NutrientToggle } from '@/components/nutrient-toggle';
import { CategoryFilter } from '@/components/category-filter';

export const dynamic = 'force-dynamic';

type Params = { slug: string };
type Search = { basis?: string; category?: string };

export default async function NutrientPage({
  params,
  searchParams,
}: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const basis = (sp.basis === 'per_serving' ? 'per_serving' : 'per_100g') as 'per_100g' | 'per_serving';
  const categoryFilter = sp.category ?? null;

  const nutrient = await getNutrient(slug);
  if (!nutrient) notFound();

  const rows = await rankFoodsByNutrient(slug, basis, categoryFilter, 25);
  const rda = (nutrient as any).rda_male ?? (nutrient as any).rda_female ?? null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/nutrient" className="text-xs text-slate-500 hover:text-slate-900">← all nutrients</Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{(nutrient as any).name}</h1>

      <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-slate-600 sm:grid-cols-4">
        <div><div className="text-xs uppercase text-slate-400">RDA (M)</div>{(nutrient as any).rda_male ?? '—'} {(nutrient as any).unit}</div>
        <div><div className="text-xs uppercase text-slate-400">RDA (F)</div>{(nutrient as any).rda_female ?? '—'} {(nutrient as any).unit}</div>
        <div><div className="text-xs uppercase text-slate-400">Upper limit</div>{(nutrient as any).toxicity_threshold ?? '—'}</div>
        <div><div className="text-xs uppercase text-slate-400">Category</div>{(nutrient as any).category.replace('_', ' ')}</div>
      </div>

      {(nutrient as any).function_summary && (
        <p className="mt-4 text-sm leading-relaxed text-slate-700">{(nutrient as any).function_summary}</p>
      )}
      {(nutrient as any).absorption_notes && (
        <p className="mt-2 text-xs italic text-slate-500">{(nutrient as any).absorption_notes}</p>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <NutrientToggle basis={basis} />
      </div>
      <div className="mt-3">
        <CategoryFilter active={categoryFilter} />
      </div>

      <ol className="mt-6">
        {rows.length === 0 && (
          <li className="py-8 text-center text-sm text-slate-500">No foods seeded for this nutrient yet.</li>
        )}
        {rows.map((r, i) => (
          <FoodRankRow
            key={`${r.food_slug}-${r.data_source}`}
            rank={i + 1}
            food_slug={r.food_slug}
            food_name={r.food_name}
            serving_description={r.serving_description}
            amount_per_100g={r.amount_per_100g}
            amount_per_serving={r.amount_per_serving}
            data_source={r.data_source}
            citation_url={r.citation_url}
            unit={(nutrient as any).unit}
            rda={rda}
            basis={basis}
          />
        ))}
      </ol>

      <p className="mt-10 text-xs text-slate-400">
        Data: USDA FoodData Central (foundation + SR legacy) and curated peer-reviewed literature. RDAs from NIH ODS.
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Verify the MVP slice end-to-end in browser**

Restart dev server if needed. Visit:

1. `http://localhost:3000/nutrient/vitamin-c` — expect a ranked list of high-vitamin-C foods. Toggle `?basis=per_serving` — order should change for foods with small servings. Click a category chip — list filters.
2. `http://localhost:3000/nutrient/iron` — expect organ meats, legumes, dark greens near the top per 100 g.
3. `http://localhost:3000/nutrient/sulforaphane` — expect broccoli sprouts at #1 with the curated row's citation link visible.
4. `http://localhost:3000/nutrient/does-not-exist` — 404.

- [ ] **Step 6: Commit**

```powershell
git add src/app/nutrient src/components/food-rank-row.tsx src/components/nutrient-toggle.tsx src/components/category-filter.tsx
git commit -m "feat(ui): Feature #1 — Nutrient to Food ranking with toggle, category filter, %RDA"
```

---

## Task 21: README + .env.example polish

**Files:**
- Create: `README.md`
- Modify: `.env.example` (if missing fields)

- [ ] **Step 1: Write README**

```markdown
# WholeFood RX

Inverse-lookup nutrition tool. Pick a micronutrient — get the highest-density whole-food sources.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Neon serverless Postgres + Drizzle ORM
- USDA FoodData Central for seed data; curated JSON for adaptogens/phytonutrients

## Setup

1. Copy env:
   ```powershell
   Copy-Item .env.example .env.local
   ```
2. Fill in `DATABASE_URL` (Neon) and `USDA_API_KEY` (https://fdc.nal.usda.gov/api-key-signup.html).
3. Install:
   ```powershell
   pnpm install
   ```
4. Migrate:
   ```powershell
   pnpm db:generate   # only if schema changed
   pnpm db:migrate
   ```
5. Seed:
   ```powershell
   pnpm db:seed
   ```
6. Run:
   ```powershell
   pnpm dev
   ```

## Refreshing USDA data
Re-run `pnpm db:seed` — all seed scripts are idempotent (upsert).
To pull a new list of Foundation Foods, run `pnpm tsx scripts/list-foundation-foods.ts`.

## Layout
- `src/app/` — Next.js routes (App Router)
- `src/lib/` — DB client, schema, queries, helpers
- `src/data/` — curated JSON source data
- `scripts/` — seed and migration scripts
- `docs/plans/` — design and implementation docs

## Citing
Every numeric value in the UI links to its source — USDA FDC food detail page or a PubMed/NIH ODS citation.
```

- [ ] **Step 2: Commit**

```powershell
git add README.md
git commit -m "docs: README with setup, refresh, and citing notes"
```

---

## Task 22: Self-verification checklist (no code)

- [ ] **Step 1: Re-run the full pipeline on a clean DB to confirm reproducibility**

(Optional but recommended: create a Neon branch off the main DB, point `DATABASE_URL` at it, run `pnpm db:migrate && pnpm db:seed`, then `pnpm dev` and revisit the MVP page.)

- [ ] **Step 2: Confirm Section 1 of the design spec ("Goal") is delivered**

Open `/nutrient/vitamin-c`. The page shows top whole-food sources ranked by density. ✓

- [ ] **Step 3: Confirm Section 4 of the design spec (data model) matches the migration**

```sql
\d nutrients
\d foods
\d food_nutrients
\d symptoms
\d symptom_nutrients
\d nutrient_interactions
```

All six tables, four enums, two indexes on `food_nutrients`, PK on `(food_id, nutrient_id, data_source)`. ✓

- [ ] **Step 4: Confirm the precedence rule from the design works**

Manually insert a fake `curated` row for an existing USDA food + nutrient pair with a higher amount; verify the ranking still uses the USDA value (precedence Foundation > SR Legacy > curated). Roll back the test row.

- [ ] **Step 5: Open a follow-up plan stub for Features #2–5 + Vercel deploy**

Create `docs/plans/2026-05-20-wholefood-rx-phase-2.md` with the title and the five remaining features as headers. Body is for the next planning session.

```powershell
New-Item -ItemType File docs/plans/2026-05-20-wholefood-rx-phase-2.md
# leave file content empty; will be filled in next brainstorming/planning session
```

- [ ] **Step 6: Final commit**

```powershell
git add docs/plans/2026-05-20-wholefood-rx-phase-2.md
git commit -m "docs: stub follow-up plan for phase 2 (features 2-5 + deploy)"
```

---

## Self-review

**Spec coverage:**
- Spec §1 Goal — Task 20 delivers the Nutrient → Food MVP. ✓
- Spec §3 Stack — Tasks 1–3 install everything. ✓
- Spec §4 Data model — Task 4 implements all six tables; Task 5 migrates. ✓
- Spec §5 Seeding — Tasks 9–17 cover all five seed scripts and orchestrator. ✓
- Spec §6 Feature #1 — Task 20. Features #2–5 deferred to phase 2 plan stub in Task 22. ✓
- Spec §7 UI principles — minimalist styling in Tasks 19–20, citations on every row. ✓
- Spec §8 Build order — Tasks follow the spec's order. ✓
- Spec §9 Open decisions — `bioavailability_score` nullable (schema in Task 4), RDA M/F displayed both (Task 20), `preparation_notes` on `food_nutrients` (Task 4). ✓
- Spec §11 Deliverables — README (Task 21), `.env.example` (Task 3), migrations + schema checked in (Task 4–5). Vercel deploy intentionally deferred. ✓

**Placeholder scan:** No "TBD" / "TODO" / "fill in" / "appropriate error handling" / "similar to Task N" instances. The data-file tasks (9, 11, 13, 15, 16) contain full JSON content. Task 11 contains a template with explicit acceptance criterion ("≥250 entries spanning all 12 categories") — this is concrete, not placeholder.

**Type consistency:** Function names referenced across tasks: `seedNutrients`, `seedFoodsUsda`, `seedCurated`, `seedSymptoms`, `seedInteractions` (defined in Tasks 10, 12, 14, 15, 16; consumed in Task 17). `rankFoodsByNutrient`, `getNutrient`, `listNutrients` (defined in Task 18; consumed in Tasks 19, 20). `toSlug`, `usdaNumberToSlug`, `pctRda` (defined in Tasks 6, 7, 8; consumed in Tasks 12, 20). All consistent. ✓

**Schema additions caught during planning:** The design doc didn't list `nutrients.slug`, `foods.slug`, `symptoms.slug`. These were added in Task 4 because URL routing needs them. The schema in Task 4 is authoritative; the design doc should get a one-line addendum noting these added slug columns. This addendum is itself a discrete follow-up — flag it during execution.
